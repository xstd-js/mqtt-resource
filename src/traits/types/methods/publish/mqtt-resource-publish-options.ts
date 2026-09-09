import { type Abortable } from '@xstd/abortable';
import { type MqttQos } from '../../mqtt-qos.ts';

export interface MqttResourcePublishOptions extends Abortable {
  readonly qos?: MqttQos;
  readonly retain?: boolean;
  readonly dup?: boolean;
}
