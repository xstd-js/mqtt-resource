import type { ObservableAsyncFunction } from '@xstd/observable-async-function';
import type { MqttPublishPacket } from '../../types/mqtt-publish-packet.ts';
import type { MqttResourceSubscribeArguments } from './mqtt-resource-subscribe-arguments.ts';

export type MqttResourceSubscribeStream = ObservableAsyncFunction<
  MqttPublishPacket,
  MqttResourceSubscribeArguments
>;
