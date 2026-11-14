import type { ObservableAsyncFunction } from '@xstd/observable-async-function';
import type { MqttPublishPacket } from '../../types/mqtt-publish-packet.ts';
import type { MqttResourceSubscribeOptions } from './mqtt-resource-subscribe-options.ts';

export type MqttResourceSubscribeArguments = readonly [
  topic: string,
  options?: MqttResourceSubscribeOptions,
];

export interface HavingMqttResourceSubscribeAbility {
  readonly subscribe: ObservableAsyncFunction<MqttPublishPacket, MqttResourceSubscribeArguments>;
}
