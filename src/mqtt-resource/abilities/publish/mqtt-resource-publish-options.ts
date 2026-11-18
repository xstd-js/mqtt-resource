import type { MqttPublishProperties } from '../../types/mqtt-publish-properties.ts';
import type { MqttQos } from '../../types/mqtt-qos.ts';

export interface MqttResourcePublishOptions {
  readonly qos?: MqttQos;
  readonly retain?: boolean;
  readonly dup?: boolean;
  readonly properties?: MqttPublishProperties;
}
