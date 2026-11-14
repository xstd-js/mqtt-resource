import type { MqttResourcePublishOptions } from './mqtt-resource-publish-options.ts';
import type { MqttResourcePublishPayload } from './mqtt-resource-publish-payload.ts';

export type MqttResourcePublishArguments = readonly [
  topic: string,
  payload: MqttResourcePublishPayload,
  options?: MqttResourcePublishOptions,
];
