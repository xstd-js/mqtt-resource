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
import { normalizeMqttUrl } from './helpers.private/normalize-mqtt-url.ts';

export class SharedMqttResource extends Resource implements HavingMqttResourceAbilities {
  /**
   * The delay, in milliseconds, before the underlying connection is closed after its last
   * sharer closes.
   *
   * - `> 0` (default): the close runs in the background after this delay, and an open with the
   *   same url and credentials within the window reuses the live connection (the delayed close
   *   is aborted). The sharer's `close()` resolves immediately without waiting for the
   *   connection to end; close failures are reported, not propagated.
   * - `<= 0`: the connection closes synchronously during `close()`, and its failure propagates
   *   to the closer.
   *
   * NOTE: connections never auto-reconnect: when the connection dies, every sharer closes and
   * the next open establishes a new connection.
   */
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
        new TextEncoder().encode(
          JSON.stringify([normalizeMqttUrl(url.toString()), clientId, username, password]),
        ),
      ).toHex();

      let activeConnection: ActiveConnection | undefined = this.#activeConnections.get(key);

      if (activeConnection === undefined) {
        const removeActiveConnection = (): void => {
          // deletes by identity: a newer connection may have replaced this one in the
          // meantime, and must not be removed by this stale cleanup.
          if (this.#activeConnections.get(key) === activeConnection) {
            this.#activeConnections.delete(key);
          }
        };

        activeConnection = {
          refCount: new AsyncRefCount<MqttResource>(
            async (signal: AbortSignal): Promise<AsyncDisposableRef<MqttResource>> => {
              const client: MqttResource = await MqttResource.open.call(signal, url, {
                clientId,
                username,
                password,
              });

              // A closed connection is unusable: the entry is deleted as soon as the underlying
              // client starts closing (including when the connection dies), so that a concurrent
              // or subsequent open establishes a fresh connection instead of reusing a dead one
              // within the maintain-alive window.
              client.closeSignal.addEventListener('abort', removeActiveConnection, {
                once: true,
              });

              const close = async (reason?: unknown): Promise<void> => {
                await client.close(reason);
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
