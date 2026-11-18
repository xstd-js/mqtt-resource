import type { MqttResourceSubscribeStream } from './mqtt-resource-subscribe-stream.ts';

/**
 * The _subscribe_ ability of a MQTT resource instance.
 */
export interface HavingMqttResourceSubscribeAbility {
  /** Establishes a subscription, resolving with a resource emitting the received messages. */
  readonly subscribe: MqttResourceSubscribeStream;
}
