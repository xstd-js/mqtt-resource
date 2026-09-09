import { type MqttSubscriptionResourceTrait } from '../mqtt-subscription-resource.trait.ts';
import { type MqttSubscriptionResourceOpenTrait } from './types/methods/open/mqtt-subscription-resource.open.trait.ts';
import { type MqttSubscriptionResourceFactoryTrait } from './types/properties/factory/mqtt-subscription-resource.factory.trait.ts';

export interface MqttSubscriptionResourceStaticTrait<
  GMqttSubscriptionResource extends MqttSubscriptionResourceTrait,
>
  extends
    MqttSubscriptionResourceOpenTrait<GMqttSubscriptionResource>,
    MqttSubscriptionResourceFactoryTrait<GMqttSubscriptionResource> {}
