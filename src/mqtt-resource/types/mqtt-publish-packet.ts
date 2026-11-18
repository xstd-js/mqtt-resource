import type { MqttPublishProperties } from './mqtt-publish-properties.ts';
import type { MqttQos } from './mqtt-qos.ts';

/**
 * A received MQTT PUBLISH packet: a message delivered by the broker to an active subscription.
 */
export interface MqttPublishPacket {
  /** The topic the message was published on. */
  readonly topic: string;
  /** The message payload, as raw bytes. */
  readonly payload: Uint8Array;
  /** The QoS level the message was delivered with. */
  readonly qos: MqttQos;
  /** Whether the message is a retained message delivered upon subscription. */
  readonly retain: boolean;
  /** The MQTT 5 properties attached to the message, when any. */
  readonly properties?: MqttPublishProperties;
}
