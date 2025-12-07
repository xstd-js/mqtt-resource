import { type Resource } from '@xstd/resource';
import { type MqttResourcePublishTrait } from './types/methods/publish/mqtt-resource-publish.trait.js';
import { type MqttResourceSubscribeTrait } from './types/methods/subscribe/mqtt-resource-subscribe.trait.js';

export interface MqttResourceTrait
  extends Resource, MqttResourcePublishTrait, MqttResourceSubscribeTrait {}
