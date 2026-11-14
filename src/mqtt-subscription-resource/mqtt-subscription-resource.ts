import { AsyncRefCount } from '@xstd/async-ref-count';
import { type EmitValue, ListenerResource } from '@xstd/listener-resource';
import { MqttTopic } from '@xstd/mqtt-topic';
import { ObservableAsyncFunction } from '@xstd/observable-async-function';
import type { OnCloseResource } from '@xstd/resource';
import type { IPublishPacket, MqttClient } from 'mqtt';
import type { MqttResourceSubscribeArguments } from '../mqtt-resource/abilities/subscribe/having-mqtt-resource-subscribe-ability.ts';
import type { MqttResourceSubscribeOptions } from '../mqtt-resource/abilities/subscribe/mqtt-resource-subscribe-options.ts';
import { getMqttResourceClient } from '../mqtt-resource/implementations/default/mqtt-resource.internals.private.ts';

import { MqttResource } from '../mqtt-resource/implementations/default/mqtt-resource.ts';
import type { MqttPublishPacket } from '../mqtt-resource/types/mqtt-publish-packet.ts';
import type { MqttSubscriptionResourceOptions } from '../subscription/traits/static/types/mqtt-subscription-resource-options.ts';

/* INTERNAL TYPES */

interface ActiveSubscription extends Required<MqttSubscriptionResourceOptions> {
  readonly refCount: AsyncRefCount<MqttSubscription>;
}

interface MqttSubscription {
  readonly client: MqttResource;
  readonly topic: string;
}

/* CLASS */

export class MqttSubscriptionResource extends ObservableAsyncFunction<
  MqttPublishPacket,
  MqttResourceSubscribeArguments
> {
  static maintainAlive: number = 1000;

  readonly #activeSubscriptions: Map<string /* topic */, ActiveSubscription>;

  constructor(client: MqttResource) {
    super(
      async (
        signal: AbortSignal,
        topic: string,
        options?: MqttResourceSubscribeOptions,
      ): Promise<ListenerResource<MqttPublishPacket>> => {
        const nativeClient: MqttClient = getMqttResourceClient(client);
        const topicMatcher: MqttTopic = new MqttTopic(topic);

        this.closeSignal.addEventListener(
          'abort',
          (): void => {
            nativeClient.off('message', onClientMessage);
          },
          {
            once: true,
          },
        );

        this.closesWith(shared.value.client);

        return new ListenerResource<MqttPublishPacket>(
          (emit: EmitValue<MqttPublishPacket>): OnCloseResource => {
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

            return (): void => {
              nativeClient.off('message', onClientMessage);
            };
          },
        );
      },
    );

    this.#activeSubscriptions = new Map();
  }
}
