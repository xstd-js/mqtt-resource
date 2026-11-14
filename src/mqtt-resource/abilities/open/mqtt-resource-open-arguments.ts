import type { MqttResourceOpenOptions } from './mqtt-resource-open-options.ts';

export type MqttResourceOpenArguments = readonly [
  url: string | URL,
  options?: MqttResourceOpenOptions,
];
