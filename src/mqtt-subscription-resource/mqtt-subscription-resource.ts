import { sleep } from '@xstd/abortable';
import {
  type AsyncDisposableRef,
  AsyncRefCount,
  type SharedAsyncDisposableRef,
} from '@xstd/async-ref-count';
import { type EmitValue, ListenerResource } from '@xstd/listener-resource';
import { MqttTopic } from '@xstd/mqtt-topic';
import { ObservableAsyncFunction } from '@xstd/observable-async-function';
import type { OnCloseResource } from '@xstd/resource';
import type { IPublishPacket } from 'mqtt';
import type { MqttResourceSubscribeArguments } from '../mqtt-resource/abilities/subscribe/mqtt-resource-subscribe-arguments.ts';
import type { MqttResourceSubscribeOptions } from '../mqtt-resource/abilities/subscribe/mqtt-resource-subscribe-options.ts';
import type { MqttPublishPacket } from '../mqtt-resource/types/mqtt-publish-packet.ts';
import {
  getMqttSubscriptionResourceContext,
  type MqttSubscriptionResourceContext,
} from './helpers.private/mqtt-subscription-resource-context.ts';
import { subscribeToMqttClientSubscription } from './helpers.private/subscribe-to-mqtt-client-subscription.ts';

/**
 * NOTE: internal: must be created through `newMqttSubscriptionResource`, which provides the
 * underlying mqtt client and the close stack. Direct construction is unsupported.
 */
export class MqttSubscriptionResource extends ObservableAsyncFunction<
  MqttPublishPacket,
  MqttResourceSubscribeArguments
> {
  /**
   * The delay, in milliseconds, before the underlying broker subscription is released after
   * its last listener closes.
   *
   * - `> 0` (default): the unsubscribe runs in the background after this delay, and a listener
   *   opened for the same topic within the window reuses the live subscription (the delayed
   *   release is aborted). The listener's `close()` resolves immediately without waiting for
   *   the unsubscribe; unsubscribe failures are reported, not propagated. When the connection
   *   is already gone when the delay elapses, the unsubscribe is skipped: the broker already
   *   dropped the subscription with its `clean` session.
   * - `<= 0`: the unsubscribe runs synchronously during `close()`, and its failure propagates
   *   to the closer.
   */
  static maintainAlive: number = 1000;

  readonly #activeSubscriptions: Map<string /* topic */, ActiveSubscription>;

  constructor() {
    const { nativeClient, closeStack }: MqttSubscriptionResourceContext =
      getMqttSubscriptionResourceContext();

    super(
      (
        signal: AbortSignal,
        topic: string,
        {
          qos = 0,
          noLocal = false,
          retainAsPublished = false,
          retainHandling = 0,
        }: MqttResourceSubscribeOptions = {},
      ): Promise<ListenerResource<MqttPublishPacket>> => {
        return closeStack.runTask(
          async (signal: AbortSignal): Promise<ListenerResource<MqttPublishPacket>> => {
            signal.throwIfAborted();

            let activeSubscription: ActiveSubscription | undefined =
              this.#activeSubscriptions.get(topic);

            if (activeSubscription === undefined) {
              const removeActiveSubscription = (): void => {
                this.#activeSubscriptions.delete(topic);
              };

              activeSubscription = {
                qos,
                noLocal,
                retainAsPublished,
                retainHandling,
                refCount: new AsyncRefCount<void>(
                  async (signal: AbortSignal): Promise<AsyncDisposableRef<void>> => {
                    try {
                      await subscribeToMqttClientSubscription(nativeClient, topic, {
                        qos,
                        noLocal,
                        retainAsPublished,
                        retainHandling,
                        signal,
                      });
                    } catch (error: unknown) {
                      removeActiveSubscription();
                      throw error;
                    }

                    const close = async (_reason: unknown): Promise<void> => {
                      try {
                        // When the connection is gone or closing, the broker already dropped the
                        // subscription with its session: unsubscribing would only fail.
                        if (nativeClient.connected && !nativeClient.disconnecting) {
                          await nativeClient.unsubscribeAsync(topic);
                        }
                      } finally {
                        removeActiveSubscription();
                      }
                    };

                    const maintainAlive: number = MqttSubscriptionResource.maintainAlive;

                    if (maintainAlive <= 0) {
                      return {
                        value: undefined,
                        close,
                      };
                    } else {
                      return {
                        value: undefined,
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

              this.#activeSubscriptions.set(topic, activeSubscription);
            } else if (
              activeSubscription.qos !== qos ||
              activeSubscription.noLocal !== noLocal ||
              activeSubscription.retainAsPublished !== retainAsPublished ||
              activeSubscription.retainHandling !== retainHandling
            ) {
              throw new Error(`Subscription to "${topic}" already locked.`);
            }

            const topicMatcher: MqttTopic = new MqttTopic(topic);

            // Messages delivered while the subscription is establishing are buffered:
            // mqtt.js emits them before the 'subscribeAsync' promise continuations run,
            // hence before this task resolves and the consumer can register a listener.
            let emitFunction: EmitValue<MqttPublishPacket> | undefined = undefined;
            let established: boolean = false;
            const pendingMessages: MqttPublishPacket[] = [];

            const onClientMessage = (
              topic: string,
              payload: Buffer,
              packet: IPublishPacket,
            ): void => {
              if (!topicMatcher.matches(topic)) {
                return;
              }
              const publishPacket: MqttPublishPacket = {
                topic,
                payload,
                qos: packet.qos,
                retain: packet.retain,
                properties: packet.properties,
              };
              if (established && emitFunction !== undefined) {
                emitFunction(publishPacket);
              } else {
                pendingMessages.push(publishPacket);
              }
            };

            nativeClient.on('message', onClientMessage);

            try {
              const sharedSubscription: SharedAsyncDisposableRef<void> =
                await activeSubscription.refCount.open({
                  signal,
                });

              return closeStack.adoptResource(
                new ListenerResource<MqttPublishPacket>(
                  (
                    emit: EmitValue<MqttPublishPacket>,
                    closeSignal: AbortSignal,
                  ): OnCloseResource => {
                    emitFunction = emit;

                    // Flushes the buffered messages on the next macrotask: it is guaranteed to run
                    // after the consumer registered its listener, since promise continuations are
                    // microtasks and always run before macrotasks.
                    const flushTimer: ReturnType<typeof setTimeout> = setTimeout((): void => {
                      established = true;
                      for (const message of pendingMessages.splice(0)) {
                        if (closeSignal.aborted) {
                          return;
                        }
                        emit(message);
                      }
                    }, 0);

                    closeSignal.addEventListener(
                      'abort',
                      (): void => {
                        clearTimeout(flushTimer);
                        nativeClient.off('message', onClientMessage);
                      },
                      {
                        once: true,
                      },
                    );

                    return (reason: unknown): Promise<void> => {
                      return sharedSubscription.close(reason);
                    };
                  },
                ),
              );
            } catch (error: unknown) {
              nativeClient.off('message', onClientMessage);
              throw error;
            }
          },
          { signal },
        );
      },
    );

    this.#activeSubscriptions = new Map();
  }
}

/* INTERNAL */

interface ActiveSubscription extends Required<MqttResourceSubscribeOptions> {
  readonly refCount: AsyncRefCount<void>;
}
