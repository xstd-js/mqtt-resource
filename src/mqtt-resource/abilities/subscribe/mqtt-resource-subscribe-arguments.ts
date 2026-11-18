import type { MqttResourceSubscribeOptions } from './mqtt-resource-subscribe-options.ts';

/**
 * Arguments of the _subscribe_ stream of a MQTT resource.
 */
export type MqttResourceSubscribeArguments = readonly [
  /** The topic filter to subscribe to (may include the `+` and `#` wildcards). */
  topic: string,
  /** The subscription options. */
  options?: MqttResourceSubscribeOptions,
];
