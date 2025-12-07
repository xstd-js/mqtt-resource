import { type MqttSubscriptionResourceTrait } from '../../../../subscription/traits/mqtt-subscription-resource.trait.js';
import { type MqttResourceSubscribeOptions } from './mqtt-resource-subscribe-options.js';

export interface MqttResourceSubscribeTrait {
  subscribe(
    topic: string,
    options?: MqttResourceSubscribeOptions,
  ): Promise<MqttSubscriptionResourceTrait>;
}
