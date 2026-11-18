import type { MqttResourceOpenOptions } from './mqtt-resource-open-options.ts';

/**
 * Arguments of the _open_ action of a MQTT resource: the url of a broker and the connection options.
 */
export type MqttResourceOpenArguments = readonly [
  /** The url of the MQTT broker to connect to (e.g. `mqtt://localhost:1883`). Credentials may be embedded in it. */
  url: string | URL,
  /** The connection options. */
  options?: MqttResourceOpenOptions,
];
