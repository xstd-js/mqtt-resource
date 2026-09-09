import { type MqttResourceTrait } from '../../../mqtt-resource.trait.ts';
import { type MqttResourceOpenOptions } from './mqtt-resource-open-options.ts';

export interface MqttResourceOpenTrait<GMqttResource extends MqttResourceTrait> {
  open(url: string | URL, options?: MqttResourceOpenOptions): Promise<GMqttResource>;
}
