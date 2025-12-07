import { sleep } from '@xstd/abortable';
import {
  type AcquireCloseHook,
  AsyncRefCount,
  type ClosableValue,
  type DerivedClosableValue,
} from '@xstd/async-ref-count';
import { uint8ArrayToHex } from '@xstd/hex';
import { Resource, ResourceFactory } from '@xstd/resource';
import { sha256 } from '@xstd/sha256';
import { type HavingMaintainAliveOption } from '../../maintain-alive-option/having-maintain-alive-option.js';
import { resolveMaxMaintainAliveOptions } from '../../maintain-alive-option/helpers/resolve-max-maintain-alive-options.js';
import { type MaintainAliveOption } from '../../maintain-alive-option/maintain-alive-option.js';

import { type MqttSubscriptionResource } from '../../subscription/implementations/default/subscription/mqtt-subscription-resource.js';
import { type MqttResourceTrait } from '../../traits/mqtt-resource.trait.js';
import { type MqttResourceOpenOptions } from '../../traits/static/types/methods/mqtt-resource-open-options.js';
import { type MqttResourcePublishOptions } from '../../traits/types/methods/publish/mqtt-resource-publish-options.js';
import { type MqttResourcePublishPayload } from '../../traits/types/methods/publish/mqtt-resource-publish.payload.js';
import { type MqttResourceSubscribeOptions } from '../../traits/types/methods/subscribe/mqtt-resource-subscribe-options.js';
import { MqttResource } from '../default/mqtt-resource.js';

/* TYPES */

export type SharedMqttResourceFactory = ResourceFactory<
  [url: string | URL],
  SharedMqttResource,
  SharedMqttResourceOpenOptions
>;

export interface SharedMqttResourceOpenOptions
  extends MqttResourceOpenOptions, HavingMaintainAliveOption {}

/* INTERNAL TYPES */

interface ActiveConnection {
  readonly maintainAliveOptions: MaintainAliveOption[];
  readonly refCount: AsyncRefCount<MqttResource>;
}

/* CLASS */

export class SharedMqttResource extends Resource implements MqttResourceTrait {
  static #activeConnections = new Map<string /* key */, ActiveConnection>();

  static readonly #factory: SharedMqttResourceFactory = new ResourceFactory<
    [url: string | URL],
    SharedMqttResource,
    SharedMqttResourceOpenOptions
  >(
    async (
      url: string | URL,
      {
        clientId,
        username,
        password,
        maintainAlive = 1000,
        signal,
      }: SharedMqttResourceOpenOptions = {},
    ): Promise<SharedMqttResource> => {
      signal?.throwIfAborted();

      const key: string = uint8ArrayToHex(
        sha256(
          new TextEncoder().encode(JSON.stringify([url.toString(), clientId, username, password])),
        ),
      );

      let activeConnection: ActiveConnection | undefined = this.#activeConnections.get(key);

      if (activeConnection === undefined) {
        const maintainAliveOptions: MaintainAliveOption[] = [];

        activeConnection = {
          maintainAliveOptions,
          refCount: new AsyncRefCount<MqttResource>(
            async (signal: AbortSignal): Promise<ClosableValue<MqttResource>> => {
              const client: MqttResource = await MqttResource.open(url, {
                clientId,
                username,
                password,
                signal,
              });

              const close = async (reason?: unknown): Promise<void> => {
                return client.close(reason);
              };

              return {
                value: client,
                close: async (reason: unknown, hook: AcquireCloseHook): Promise<void> => {
                  const maintainAlive: number =
                    resolveMaxMaintainAliveOptions(maintainAliveOptions);

                  if (maintainAlive > 0) {
                    const { resolve, signal } = hook();
                    resolve(sleep(maintainAlive, { signal }).then(close));
                  } else {
                    await close(reason);
                  }
                },
              };
            },
          ),
        };

        this.#activeConnections.set(key, activeConnection);
      }

      activeConnection.maintainAliveOptions.push(maintainAlive);

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

  readonly #shared: MqttResource;

  private constructor({ value, close }: DerivedClosableValue<MqttResource>) {
    super(close);

    // TODO should probably use a close stack here?
    this.#shared = value;
    this.closesWith(value);
  }

  publish(
    topic: string,
    payload: MqttResourcePublishPayload,
    options?: MqttResourcePublishOptions,
  ): Promise<void> {
    return this.#shared.publish(topic, payload, options);
  }

  subscribe(
    topic: string,
    options?: MqttResourceSubscribeOptions,
  ): Promise<MqttSubscriptionResource> {
    return this.#shared.subscribe(topic, options);
  }
}
