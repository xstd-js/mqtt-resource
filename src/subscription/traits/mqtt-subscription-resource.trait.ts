import { type Resource } from '@xstd/resource';
import { type MqttSubscriptionResourceListenTrait } from './types/methods/listen/mqtt-subscription-resource.listen.trait.js';

export interface MqttSubscriptionResourceTrait
  extends Resource, MqttSubscriptionResourceListenTrait {}
