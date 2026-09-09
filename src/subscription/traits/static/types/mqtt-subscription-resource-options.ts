import { type MqttQos } from '../../../../traits/types/mqtt-qos.ts';

export interface MqttSubscriptionResourceOptions {
  readonly qos?: MqttQos;
  readonly noLocal?: boolean;
  readonly retainAsPublished?: boolean;
  readonly retainHandling?: 0 | 1 | 2;
}
