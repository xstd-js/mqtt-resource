import type { MqttPublishProperties } from './mqtt-publish-properties.ts';
import type { MqttQos } from './mqtt-qos.ts';

export interface MqttPublishPacket {
  readonly topic: string;
  readonly payload: Uint8Array;
  readonly qos: MqttQos;
  readonly retain: boolean;
  readonly properties?: MqttPublishProperties;
}
