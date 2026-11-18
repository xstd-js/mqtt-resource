/**
 * Options of a MQTT connection, provided when opening a MQTT resource.
 */
export interface MqttResourceOpenOptions {
  /** The client identifier presented to the broker. When omitted, the client generates one. */
  readonly clientId?: string;
  /** The username used to authenticate against the broker. */
  readonly username?: string;
  /** The password used to authenticate against the broker. */
  readonly password?: string;

  // readonly keepalive?: number;
  // readonly clean?: boolean;
}
