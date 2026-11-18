/**
 * The MQTT Quality of Service level of a message or a subscription:
 *
 * - `0` (_at most once_): fire-and-forget; no acknowledgement nor retry.
 * - `1` (_at least once_): acknowledged by the receiver, but may be delivered more than once.
 * - `2` (_exactly once_): a two-phase handshake guarantees a single delivery.
 */
export type MqttQos = 0 | 1 | 2;
