import { sleep } from '@xstd/abortable';
import {
  type AsyncDisposableRef,
  AsyncRefCount,
  SharedAsyncDisposableRef,
} from '@xstd/async-ref-count';
import { type EmitValue, ListenerResource } from '@xstd/listener-resource';
import { MqttTopic } from '@xstd/mqtt-topic';
import { type OnCloseResource, ResourceFactory } from '@xstd/resource';
import type { IPublishPacket, MqttClient } from 'mqtt';

import { getMqttResourceClient } from '../../../../implementations/default/mqtt-resource.internals.private.ts';
import { MqttResource } from '../../../../implementations/default/mqtt-resource.ts';
import type { MqttSubscriptionResourceTrait } from '../../../traits/mqtt-subscription-resource.trait.ts';
import type { MqttSubscriptionResourceOpenOptions } from '../../../traits/static/types/methods/open/mqtt-subscription-resource-open-options.ts';
import type { MqttSubscriptionResourceOptions } from '../../../traits/static/types/mqtt-subscription-resource-options.ts';
import type { MqttSubscriptionResourceFactory } from '../../../traits/static/types/properties/factory/mqtt-subscription-resource-factory.ts';
import type { MqttPublishPacket } from '../../../traits/types/mqtt-publish-packet.ts';
import { subscribeToMqttClientSubscription } from './functions.private/subscribe-to-mqtt-client-subscription.ts';

/* INTERNAL TYPES */

interface ActiveSubscription extends Required<MqttSubscriptionResourceOptions> {
  readonly refCount: AsyncRefCount<MqttSubscription>;
}

interface MqttSubscription {
  readonly client: MqttResource;
  readonly topic: string;
}

/* CLASS */

export class MqttSubscriptionResource
  extends ListenerResource<MqttPublishPacket>
  implements MqttSubscriptionResourceTrait
{
  static maintainAlive: number = 1000;

  static #activeSubscriptions = new WeakMap<
    MqttResource,
    Map<string /* topic */, ActiveSubscription>
  >();

  static readonly #factory: MqttSubscriptionResourceFactory<MqttSubscriptionResource> =
    new ResourceFactory<
      [client: MqttResource, topic: string],
      MqttSubscriptionResource,
      MqttSubscriptionResourceOpenOptions
    >(
      async (
        client: MqttResource,
        topic: string,
        {
          qos = 0,
          noLocal = false,
          retainAsPublished = false,
          retainHandling = 0,
          signal,
        }: MqttSubscriptionResourceOpenOptions = {},
      ): Promise<MqttSubscriptionResource> => {
        signal?.throwIfAborted();

        let activeSubscriptions: Map<string, ActiveSubscription> | undefined =
          this.#activeSubscriptions.get(client);

        if (activeSubscriptions === undefined) {
          activeSubscriptions = new Map<string, ActiveSubscription>();
          this.#activeSubscriptions.set(client, activeSubscriptions);
        }

        let activeSubscription: ActiveSubscription | undefined = activeSubscriptions.get(topic);

        if (activeSubscription === undefined) {
          const removeActiveSubscription = (): void => {
            activeSubscriptions.delete(topic);
            if (activeSubscriptions.size === 0) {
              this.#activeSubscriptions.delete(client);
            }
          };

          activeSubscription = {
            qos,
            noLocal,
            retainAsPublished,
            retainHandling,
            refCount: new AsyncRefCount<MqttSubscription>(
              async (signal: AbortSignal): Promise<AsyncDisposableRef<MqttSubscription>> => {
                const nativeClient: MqttClient = getMqttResourceClient(client);

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

                const value: MqttSubscription = {
                  client,
                  topic,
                };

                const close = async (_reason: unknown): Promise<void> => {
                  try {
                    await nativeClient.unsubscribeAsync(topic);
                  } finally {
                    removeActiveSubscription();
                  }
                };

                const maintainAlive: number = MqttSubscriptionResource.maintainAlive;

                if (maintainAlive === 0) {
                  return {
                    value,
                    close,
                  };
                } else {
                  return {
                    value,
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

          activeSubscriptions.set(topic, activeSubscription);
        } else if (
          activeSubscription.qos !== qos ||
          activeSubscription.noLocal !== noLocal ||
          activeSubscription.retainAsPublished !== retainAsPublished ||
          activeSubscription.retainHandling !== retainHandling
        ) {
          throw new Error(`Subscription to "${topic}" already locked.`);
        }

        return new MqttSubscriptionResource(
          await activeSubscription.refCount.open({
            signal,
          }),
        );
      },
    );

  static get factory(): MqttSubscriptionResourceFactory<MqttSubscriptionResource> {
    return this.#factory;
  }

  static open(
    client: MqttResource,
    topic: string,
    options?: MqttSubscriptionResourceOpenOptions,
  ): Promise<MqttSubscriptionResource> {
    return this.#factory.open(client, topic, options);
  }

  readonly #client: MqttClient;
  readonly #topic: MqttTopic;

  private constructor(shared: SharedAsyncDisposableRef<MqttSubscription>) {
    let emit: EmitValue<MqttPublishPacket>;
    super((_emit: EmitValue<MqttPublishPacket>): OnCloseResource => {
      emit = _emit;
      return (reason: unknown): Promise<void> => {
        return shared.close(reason);
      };
    });

    this.#client = getMqttResourceClient(shared.value.client);
    this.#topic = new MqttTopic(shared.value.topic);

    const onClientMessage = (topic: string, payload: Buffer, _packet: IPublishPacket): void => {
      if (this.#topic.matches(topic)) {
        emit({
          topic,
          payload,
        });
      }
    };

    this.#client.on('message', onClientMessage);

    this.closeSignal.addEventListener(
      'abort',
      (): void => {
        this.#client.off('message', onClientMessage);
      },
      {
        once: true,
      },
    );

    this.closesWith(shared.value.client);
  }
}
