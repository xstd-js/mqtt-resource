import type { MqttQos } from '../../types/mqtt-qos.ts';

export interface MqttResourcePublishOptions {
  readonly qos?: MqttQos;
  readonly retain?: boolean;
  readonly dup?: boolean;
}
