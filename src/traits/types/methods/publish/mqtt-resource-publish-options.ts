import { type Abortable } from '@xstd/abortable';
import { type MqttQos } from '../../mqtt-qos.js';

export interface MqttResourcePublishOptions extends Abortable {
  readonly qos?: MqttQos;
  readonly retain?: boolean;
  readonly dup?: boolean;
}
