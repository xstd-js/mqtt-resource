import { sleep } from '@xstd/abortable';
import { AsyncFunction } from '@xstd/async-function';
import {
  type AsyncDisposableRef,
  AsyncRefCount,
  type SharedAsyncDisposableRef,
} from '@xstd/async-ref-count';
import { Resource } from '@xstd/resource';
import { sha256 } from '@xstd/sha256';
import type { MqttResourceOpenAction } from '../../abilities/open/mqtt-resource-open-action.ts';
import type { MqttResourceOpenArguments } from '../../abilities/open/mqtt-resource-open-arguments.ts';

import type { MqttResourceOpenOptions } from '../../abilities/open/mqtt-resource-open-options.ts';
import type { MqttResourcePublishAction } from '../../abilities/publish/mqtt-resource-publish-action.ts';
import type { MqttResourcePublishArguments } from '../../abilities/publish/mqtt-resource-publish-arguments.ts';
import type { MqttResourcePublishOptions } from '../../abilities/publish/mqtt-resource-publish-options.ts';
import type { MqttResourcePublishPayload } from '../../abilities/publish/mqtt-resource-publish-payload.ts';
import type { MqttResourceSubscribeArguments } from '../../abilities/subscribe/mqtt-resource-subscribe-arguments.ts';
import type { MqttResourceSubscribeOptions } from '../../abilities/subscribe/mqtt-resource-subscribe-options.ts';
import type { MqttResourceSubscribeStream } from '../../abilities/subscribe/mqtt-resource-subscribe-stream.ts';
import type { HavingMqttResourceAbilities } from '../../having-mqtt-resource-abilities.ts';
import { MqttResource } from '../default/mqtt-resource.ts';

export class SharedMqttResource extends Resource implements HavingMqttResourceAbilities {
  static maintainAlive: number = 1000;

  static #activeConnections = new Map<string /* key */, ActiveConnection>();

  static #open: MqttResourceOpenAction<SharedMqttResource> = new AsyncFunction<
    MqttResourceOpenArguments,
    SharedMqttResource
  >(
    async (
      signal: AbortSignal,
      url: string | URL,
      { clientId, username, password }: MqttResourceOpenOptions = {},
    ): Promise<SharedMqttResource> => {
      const key: string = sha256(
        new TextEncoder().encode(JSON.stringify([url.toString(), clientId, username, password])),
      ).toHex();

      let activeConnection: ActiveConnection | undefined = this.#activeConnections.get(key);

      if (activeConnection === undefined) {
        activeConnection = {
          refCount: new AsyncRefCount<MqttResource>(
            async (signal: AbortSignal): Promise<AsyncDisposableRef<MqttResource>> => {
              const client: MqttResource = await MqttResource.open.call(signal, url, {
                clientId,
                username,
                password,
              });

              const close = async (reason?: unknown): Promise<void> => {
                return client.close(reason);
              };

              const maintainAlive: number = this.maintainAlive;

              if (maintainAlive <= 0) {
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

  static get open(): MqttResourceOpenAction<SharedMqttResource> {
    return this.#open;
  }

  readonly #shared: SharedAsyncDisposableRef<MqttResource>;

  readonly #publish: MqttResourcePublishAction;
  readonly #subscribe: MqttResourceSubscribeStream;

  private constructor(shared: SharedAsyncDisposableRef<MqttResource>) {
    super((reason: unknown): Promise<void> => shared.close(reason));

    // TODO should probably use a close stack here?
    this.#shared = shared;
    this.closesWith(shared.value);

    this.#publish = this.#shared.value.publish.mapArguments(
      (
        topic: string,
        payload: MqttResourcePublishPayload,
        options?: MqttResourcePublishOptions,
      ): MqttResourcePublishArguments => {
        this.throwIfClosed();
        return [topic, payload, options];
      },
    );

    this.#subscribe = this.#shared.value.subscribe.mapArguments(
      (topic: string, options?: MqttResourceSubscribeOptions): MqttResourceSubscribeArguments => {
        this.throwIfClosed();
        return [topic, options];
      },
    );
  }

  get publish(): MqttResourcePublishAction {
    return this.#publish;
  }

  get subscribe(): MqttResourceSubscribeStream {
    return this.#subscribe;
  }
}

/* INTERNAL */

interface ActiveConnection {
  readonly refCount: AsyncRefCount<MqttResource>;
}
