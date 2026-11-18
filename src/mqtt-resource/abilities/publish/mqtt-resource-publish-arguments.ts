import type { MqttResourcePublishOptions } from './mqtt-resource-publish-options.ts';
import type { MqttResourcePublishPayload } from './mqtt-resource-publish-payload.ts';

/**
 * Arguments of the _publish_ action of a MQTT resource.
 */
export type MqttResourcePublishArguments = readonly [
  /** The topic to publish the message on. */
  topic: string,
  /** The message payload. */
  payload: MqttResourcePublishPayload,
  /** The publication options. */
  options?: MqttResourcePublishOptions,
];
