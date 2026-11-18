import type { MqttPublishProperties } from '../../types/mqtt-publish-properties.ts';
import type { MqttQos } from '../../types/mqtt-qos.ts';

/**
 * Options of a message publication.
 */
export interface MqttResourcePublishOptions {
  /** The QoS level to publish with. Defaults to `0`. */
  readonly qos?: MqttQos;
  /** Asks the broker to retain the message: future subscribers receive it upon subscription. */
  readonly retain?: boolean;
  /** Marks the publication as a duplicate of an earlier, unacknowledged delivery. */
  readonly dup?: boolean;
  /** The MQTT 5 properties attached to the message. */
  readonly properties?: MqttPublishProperties;
}
