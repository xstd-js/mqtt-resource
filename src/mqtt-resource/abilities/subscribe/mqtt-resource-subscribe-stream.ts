import type { ObservableAsyncFunction } from '@xstd/observable-async-function';
import type { MqttPublishPacket } from '../../types/mqtt-publish-packet.ts';
import type { MqttResourceSubscribeArguments } from './mqtt-resource-subscribe-arguments.ts';

/**
 * The _subscribe_ stream of a MQTT resource: establishes a subscription and resolves with a live
 * `ListenerResource` emitting the received messages, as {@link MqttPublishPacket}s.
 *
 * The call's `AbortSignal` aborts the establishment of the subscription only; once established,
 * closing the returned resource unsubscribes.
 */
export type MqttResourceSubscribeStream = ObservableAsyncFunction<
  MqttPublishPacket,
  MqttResourceSubscribeArguments
>;
