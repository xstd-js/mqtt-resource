import { type MqttSubscriptionResourceTrait } from '../../../../mqtt-subscription-resource.trait.js';
import { type MqttSubscriptionResourceFactory } from './mqtt-subscription-resource-factory.js';

export interface MqttSubscriptionResourceFactoryTrait<
  GMqttSubscriptionResource extends MqttSubscriptionResourceTrait,
> {
  readonly factory: MqttSubscriptionResourceFactory<GMqttSubscriptionResource>;
}
