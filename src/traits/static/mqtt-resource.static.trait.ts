import { type MqttResourceTrait } from '../mqtt-resource.trait.js';
import { type MqttResourceOpenTrait } from './types/methods/mqtt-resource.open.trait.js';

export interface MqttResourceStaticTrait<
  GMqttResource extends MqttResourceTrait,
> extends MqttResourceOpenTrait<GMqttResource> {}
