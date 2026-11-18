import type { MqttQos } from '../../types/mqtt-qos.ts';

/**
 * Options of a subscription, mirroring the MQTT 5 SUBSCRIBE options.
 */
export interface MqttResourceSubscribeOptions {
  /** The maximum QoS level requested for the subscription. The broker may grant less. Defaults to `0`. */
  readonly qos?: MqttQos;
  /** Does not deliver the messages published by this very client. Defaults to `false`. (MQTT 5) */
  readonly noLocal?: boolean;
  /** Keeps the messages' retain flag as published, instead of clearing it. Defaults to `false`. (MQTT 5) */
  readonly retainAsPublished?: boolean;
  /**
   * Controls how retained messages are delivered when the subscription is established (MQTT 5):
   *
   * - `0` (default): the retained messages are sent whenever the subscription is established.
   * - `1`: the retained messages are sent only if the subscription did not already exist.
   * - `2`: no retained messages are sent.
   */
  readonly retainHandling?: 0 | 1 | 2;
}
