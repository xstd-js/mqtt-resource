import type { MqttResourceSubscribeOptions } from './mqtt-resource-subscribe-options.ts';

export type MqttResourceSubscribeArguments = readonly [
  topic: string,
  options?: MqttResourceSubscribeOptions,
];
