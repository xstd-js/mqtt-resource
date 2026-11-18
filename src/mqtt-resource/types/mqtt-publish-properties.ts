/**
 * An MQTT 5 _user property_: an application-defined key-value pair transported with a message.
 *
 * A key may appear multiple times in a packet, hence the possible list of values.
 */
export type MqttUserProperties = Readonly<Record<string, string | readonly string[]>>;

/**
 * The MQTT 5 properties of a PUBLISH packet, both outbound (as the `MqttResourcePublishOptions`'
 * `properties` option) and inbound (as the `MqttPublishPacket`'s `properties` field).
 */
export interface MqttPublishProperties {
  /** Requests the receiver to interpret the payload as UTF-8 text instead of binary data. */
  readonly payloadFormatIndicator?: boolean;
  /** The lifetime, in seconds, of the message on the broker (e.g. a retained message) before it is discarded. */
  readonly messageExpiryInterval?: number;
  /** The alias standing in for the topic string on subsequent publications, reducing the packet size. */
  readonly topicAlias?: number;
  /** The topic on which a response is expected, for request/response patterns. */
  readonly responseTopic?: string;
  /** Binary data correlating a response message with its request. */
  readonly correlationData?: Uint8Array;
  /** The application-defined key-value pairs transported with the message. */
  readonly userProperties?: MqttUserProperties;
  /** The identifier(s) of the subscription(s) that matched this message. */
  readonly subscriptionIdentifier?: number | readonly number[];
  /** The MIME type of the payload (e.g. `text/plain`). */
  readonly contentType?: string;
}
