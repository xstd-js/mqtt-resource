import { type MqttClient } from 'mqtt';
import { type MqttSubscriptionResourceTrait } from '../../../../mqtt-subscription-resource.trait.ts';
import { type MqttSubscriptionResourceOpenOptions } from './mqtt-subscription-resource-open-options.ts';

export interface MqttSubscriptionResourceOpenTrait<
  GMqttSubscriptionResource extends MqttSubscriptionResourceTrait,
> {
  open(
    client: MqttClient,
    topic: string,
    options?: MqttSubscriptionResourceOpenOptions,
  ): Promise<GMqttSubscriptionResource>;
}
