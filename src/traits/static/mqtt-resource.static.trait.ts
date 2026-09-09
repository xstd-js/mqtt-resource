import { type MqttResourceTrait } from '../mqtt-resource.trait.ts';
import { type MqttResourceOpenTrait } from './types/methods/mqtt-resource.open.trait.ts';

export interface MqttResourceStaticTrait<
  GMqttResource extends MqttResourceTrait,
> extends MqttResourceOpenTrait<GMqttResource> {}
