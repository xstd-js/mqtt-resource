import { type MqttResourceTrait } from '../../../mqtt-resource.trait.js';
import { type MqttResourceOpenOptions } from './mqtt-resource-open-options.js';

export interface MqttResourceOpenTrait<GMqttResource extends MqttResourceTrait> {
  open(url: string | URL, options?: MqttResourceOpenOptions): Promise<GMqttResource>;
}
