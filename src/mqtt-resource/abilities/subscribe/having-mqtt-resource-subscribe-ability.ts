import type { MqttResourceSubscribeStream } from './mqtt-resource-subscribe-stream.ts';

export interface HavingMqttResourceSubscribeAbility {
  readonly subscribe: MqttResourceSubscribeStream;
}
