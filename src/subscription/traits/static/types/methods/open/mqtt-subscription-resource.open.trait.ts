import { type MqttClient } from 'mqtt';
import { type MqttSubscriptionResourceTrait } from '../../../../mqtt-subscription-resource.trait.js';
import { type MqttSubscriptionResourceOpenOptions } from './mqtt-subscription-resource-open-options.js';

export interface MqttSubscriptionResourceOpenTrait<
  GMqttSubscriptionResource extends MqttSubscriptionResourceTrait,
> {
  open(
    client: MqttClient,
    topic: string,
    options?: MqttSubscriptionResourceOpenOptions,
  ): Promise<GMqttSubscriptionResource>;
}
