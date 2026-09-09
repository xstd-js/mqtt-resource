import { type MqttSubscriptionResourceTrait } from '../../../../mqtt-subscription-resource.trait.ts';
import { type MqttSubscriptionResourceFactory } from './mqtt-subscription-resource-factory.ts';

export interface MqttSubscriptionResourceFactoryTrait<
  GMqttSubscriptionResource extends MqttSubscriptionResourceTrait,
> {
  readonly factory: MqttSubscriptionResourceFactory<GMqttSubscriptionResource>;
}
