import { sleep } from '@xstd/abortable';
import {
  type AsyncDisposableRef,
  AsyncRefCount,
  type SharedAsyncDisposableRef,
} from '@xstd/async-ref-count';
import { Resource, ResourceFactory } from '@xstd/resource';
import { sha256 } from '@xstd/sha256';

import { type MqttSubscriptionResource } from '../../subscription/implementations/default/subscription/mqtt-subscription-resource.ts';
import { type MqttResourceTrait } from '../../traits/mqtt-resource.trait.ts';
import { type MqttResourceOpenOptions } from '../../traits/static/types/methods/mqtt-resource-open-options.ts';
import { type MqttResourcePublishOptions } from '../../traits/types/methods/publish/mqtt-resource-publish-options.ts';
import { type MqttResourcePublishPayload } from '../../traits/types/methods/publish/mqtt-resource-publish.payload.ts';
import { type MqttResourceSubscribeOptions } from '../../traits/types/methods/subscribe/mqtt-resource-subscribe-options.ts';
import { MqttResource } from '../default/mqtt-resource.ts';

/* TYPES */

export type SharedMqttResourceFactory = ResourceFactory<
  [url: string | URL],
  SharedMqttResource,
  SharedMqttResourceOpenOptions
>;

export interface SharedMqttResourceOpenOptions extends MqttResourceOpenOptions {}

/* INTERNAL TYPES */

interface ActiveConnection {
  readonly refCount: AsyncRefCount<MqttResource>;
}

/* CLASS */

export class SharedMqttResource extends Resource implements MqttResourceTrait {
  static maintainAlive: number = 1000;

  static #activeConnections = new Map<string /* key */, ActiveConnection>();

  static readonly #factory: SharedMqttResourceFactory = new ResourceFactory<
    [url: string | URL],
    SharedMqttResource,
    SharedMqttResourceOpenOptions
  >(
    async (
      url: string | URL,
      { clientId, username, password, signal }: SharedMqttResourceOpenOptions = {},
    ): Promise<SharedMqttResource> => {
      signal?.throwIfAborted();

      const key: string = sha256(
        new TextEncoder().encode(JSON.stringify([url.toString(), clientId, username, password])),
      ).toHex();

      let activeConnection: ActiveConnection | undefined = this.#activeConnections.get(key);

      if (activeConnection === undefined) {
        activeConnection = {
          refCount: new AsyncRefCount<MqttResource>(
            async (signal: AbortSignal): Promise<AsyncDisposableRef<MqttResource>> => {
              const client: MqttResource = await MqttResource.open(url, {
                clientId,
                username,
                password,
                signal,
              });

              const close = async (reason?: unknown): Promise<void> => {
                return client.close(reason);
              };

              const maintainAlive: number = SharedMqttResource.maintainAlive;

              if (maintainAlive === 0) {
                return {
                  value: client,
                  close,
                };
              } else {
                return {
                  value: client,
                  close: async (reason: unknown, signal: AbortSignal): Promise<void> => {
                    await sleep(maintainAlive, { signal });
                    await close(reason);
                  },
                  closeShared: (): void => {},
                };
              }
            },
          ),
        };

        this.#activeConnections.set(key, activeConnection);
      }

      return new SharedMqttResource(
        await activeConnection.refCount.open({
          signal,
        }),
      );
    },
  );

  static get factory(): SharedMqttResourceFactory {
    return this.#factory;
  }

  static async open(
    url: string | URL,
    options?: SharedMqttResourceOpenOptions,
  ): Promise<SharedMqttResource> {
    return this.#factory.open(url, options);
  }

  readonly #shared: SharedAsyncDisposableRef<MqttResource>;

  private constructor(shared: SharedAsyncDisposableRef<MqttResource>) {
    super((reason: unknown): Promise<void> => shared.close(reason));

    // TODO should probably use a close stack here?
    this.#shared = shared;
    this.closesWith(shared.value);
  }

  publish(
    topic: string,
    payload: MqttResourcePublishPayload,
    options?: MqttResourcePublishOptions,
  ): Promise<void> {
    this.throwIfClosed();
    return this.#shared.value.publish(topic, payload, options);
  }

  subscribe(
    topic: string,
    options?: MqttResourceSubscribeOptions,
  ): Promise<MqttSubscriptionResource> {
    this.throwIfClosed();
    return this.#shared.value.subscribe(topic, options);
  }
}
