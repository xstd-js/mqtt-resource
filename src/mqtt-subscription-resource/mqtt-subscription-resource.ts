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
import type { MqttResourceSubscribeOptions } from '../mqtt-resource/abilities/subscribe/mqtt-resource-subscribe-options.ts';

import { sleep } from '@xstd/abortable';
import type { MqttResourceSubscribeArguments } from '../mqtt-resource/abilities/subscribe/mqtt-resource-subscribe-arguments.ts';
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
    const { client, nativeClient }: MqttSubscriptionResourceContext =
      getMqttSubscriptionResourceContext();

    super(
      async (
        signal: AbortSignal,
        topic: string,
        {
          qos = 0,
          noLocal = false,
          retainAsPublished = false,
          retainHandling = 0,
        }: MqttResourceSubscribeOptions = {},
      ): Promise<ListenerResource<MqttPublishPacket>> => {
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

        const sharedSubscription: SharedAsyncDisposableRef<void> =
          await activeSubscription.refCount.open({
            signal,
          });

        const topicMatcher: MqttTopic = new MqttTopic(topic);

        return new ListenerResource<MqttPublishPacket>(
          (emit: EmitValue<MqttPublishPacket>, closeSignal: AbortSignal): OnCloseResource => {
            const onClientMessage = (
              topic: string,
              payload: Buffer,
              _packet: IPublishPacket,
            ): void => {
              if (topicMatcher.matches(topic)) {
                emit({
                  topic,
                  payload,
                });
              }
            };

            nativeClient.on('message', onClientMessage);

            closeSignal.addEventListener(
              'abort',
              (): void => {
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
        ).closesWith(client);
      },
    );

    this.#activeSubscriptions = new Map();
  }
}

/* INTERNAL */

interface ActiveSubscription extends Required<MqttResourceSubscribeOptions> {
  readonly refCount: AsyncRefCount<void>;
}
