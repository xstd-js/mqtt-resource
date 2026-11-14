import type { MqttQos } from '../../types/mqtt-qos.ts';

export interface MqttResourceSubscribeOptions {
  readonly qos?: MqttQos;
  readonly noLocal?: boolean;
  readonly retainAsPublished?: boolean;
  readonly retainHandling?: 0 | 1 | 2;
}
