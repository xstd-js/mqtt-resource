export type MqttUserProperties = { readonly [key: string]: string | readonly string[] };

export interface MqttPublishProperties {
  readonly payloadFormatIndicator?: boolean;
  readonly messageExpiryInterval?: number;
  readonly topicAlias?: number;
  readonly responseTopic?: string;
  readonly correlationData?: Uint8Array;
  readonly userProperties?: MqttUserProperties;
  readonly subscriptionIdentifier?: number | readonly number[];
  readonly contentType?: string;
}
