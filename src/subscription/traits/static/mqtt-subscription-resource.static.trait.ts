import { type MqttSubscriptionResourceTrait } from '../mqtt-subscription-resource.trait.js';
import { type MqttSubscriptionResourceOpenTrait } from './types/methods/open/mqtt-subscription-resource.open.trait.js';
import { type MqttSubscriptionResourceFactoryTrait } from './types/properties/factory/mqtt-subscription-resource.factory.trait.js';

export interface MqttSubscriptionResourceStaticTrait<
  GMqttSubscriptionResource extends MqttSubscriptionResourceTrait,
>
  extends
    MqttSubscriptionResourceOpenTrait<GMqttSubscriptionResource>,
    MqttSubscriptionResourceFactoryTrait<GMqttSubscriptionResource> {}
