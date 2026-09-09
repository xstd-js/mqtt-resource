import { type MqttSubscriptionResourceTrait } from '../../../../subscription/traits/mqtt-subscription-resource.trait.ts';
import { type MqttResourceSubscribeOptions } from './mqtt-resource-subscribe-options.ts';

export interface MqttResourceSubscribeTrait {
  subscribe(
    topic: string,
    options?: MqttResourceSubscribeOptions,
  ): Promise<MqttSubscriptionResourceTrait>;
}
