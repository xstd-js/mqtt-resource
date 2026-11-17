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

export class MqttSubscriptionResource extends ObservableAsyncFunction<
  MqttPublishPacket,
  MqttResourceSubscribeArguments
> {
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
                        await nativeClient.unsubscribeAsync(topic);
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
              _packet: IPublishPacket,
            ): void => {
              if (!topicMatcher.matches(topic)) {
                return;
              }
              if (established && emitFunction !== undefined) {
                emitFunction({ topic, payload });
              } else {
                pendingMessages.push({ topic, payload });
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

                    return (reason: unknown): void => {
                      sharedSubscription.close(reason);
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
