import { ListenerResource } from '@xstd/listener-resource';
import type { MqttPublishPacket } from '../../mqtt-resource/types/mqtt-publish-packet.ts';

export interface MqttSubscriptionResourceTrait extends ListenerResource<MqttPublishPacket> {}
