import { ListenerResource } from '@xstd/listener-resource';
import type { MqttPublishPacket } from './types/mqtt-publish-packet.ts';

export interface MqttSubscriptionResourceTrait extends ListenerResource<MqttPublishPacket> {}
