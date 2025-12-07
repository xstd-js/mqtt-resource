import { type Abortable, mergeAbortSignals, sleep } from '@xstd/abortable';
import { type AcquireCloseHook, AsyncRefCount, type ClosableValue } from '@xstd/async-ref-count';
import { MqttTopic } from '@xstd/mqtt-topic';
import { type OnCloseResource, Resource, ResourceFactory } from '@xstd/resource';
import { type IPublishPacket, type MqttClient } from 'mqtt';

import { getMqttResourceClient } from '../../../../implementations/default/mqtt-resource.internals.private.js';
import { MqttResource } from '../../../../implementations/default/mqtt-resource.js';
import { resolveMaxMaintainAliveOptions } from '../../../../maintain-alive-option/helpers/resolve-max-maintain-alive-options.js';
import { type MaintainAliveOption } from '../../../../maintain-alive-option/maintain-alive-option.js';
import { type MqttSubscriptionResourceTrait } from '../../../traits/mqtt-subscription-resource.trait.js';
import { type MqttSubscriptionResourceOpenOptions } from '../../../traits/static/types/methods/open/mqtt-subscription-resource-open-options.js';
import { type MqttSubscriptionResourceOptions } from '../../../traits/static/types/mqtt-subscription-resource-options.js';
import { type MqttSubscriptionResourceFactory } from '../../../traits/static/types/properties/factory/mqtt-subscription-resource-factory.js';
import { type MqttSubscriptionResourceListener } from '../../../traits/types/methods/listen/mqtt-subscription-resource-listener.js';
import { subscribeToMqttClientSubscription } from './functions.private/subscribe-to-mqtt-client-subscription.js';

/* INTERNAL TYPES */

interface ActiveSubscription extends Omit<
  Required<MqttSubscriptionResourceOptions>,
  'maintainAlive'
> {
  readonly maintainAliveOptions: MaintainAliveOption[];
  readonly refCount: AsyncRefCount<void>;
}

/* CLASS */

export class MqttSubscriptionResource extends Resource implements MqttSubscriptionResourceTrait {
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
          maintainAlive = 0,
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
          const maintainAliveOptions: MaintainAliveOption[] = [];

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
            maintainAliveOptions,
            refCount: new AsyncRefCount<void>(
              async (signal: AbortSignal): Promise<ClosableValue<void>> => {
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

                const close = async (_reason: unknown): Promise<void> => {
                  try {
                    await nativeClient.unsubscribeAsync(topic);
                  } finally {
                    removeActiveSubscription();
                  }
                };

                return {
                  value: undefined,
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

          activeSubscriptions.set(topic, activeSubscription);
        } else if (
          activeSubscription.qos !== qos ||
          activeSubscription.noLocal !== noLocal ||
          activeSubscription.retainAsPublished !== retainAsPublished ||
          activeSubscription.retainHandling !== retainHandling
        ) {
          throw new Error(`Subscription to "${topic}" already locked.`);
        }

        activeSubscription!.maintainAliveOptions.push(maintainAlive);

        return new MqttSubscriptionResource(
          client,
          topic,
          (
            await activeSubscription.refCount.open({
              signal,
            })
          ).close,
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

  private constructor(client: MqttResource, topic: string, close: OnCloseResource) {
    super(close);

    this.#client = getMqttResourceClient(client);
    this.#topic = new MqttTopic(topic);

    this.closesWith(client);
  }

  listen(listener: MqttSubscriptionResourceListener, { signal }: Abortable = {}): void {
    if (signal?.aborted) {
      throw signal.reason;
    }

    this.throwIfClosed();

    const onClientMessage = (topic: string, payload: Buffer, _packet: IPublishPacket): void => {
      if (this.#topic.matches(topic)) {
        listener({
          topic,
          payload,
        });
      }
    };

    this.#client.on('message', onClientMessage);

    mergeAbortSignals([this.closeSignal, signal]).addEventListener(
      'abort',
      (): void => {
        this.#client.off('message', onClientMessage);
      },
      { once: true },
    );
  }
}
