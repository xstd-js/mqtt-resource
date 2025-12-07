import { type Abortable } from '@xstd/abortable';
import { type MqttSubscriptionResourceListener } from './mqtt-subscription-resource-listener.js';

export interface MqttSubscriptionResourceListenTrait {
  listen(listener: MqttSubscriptionResourceListener, options?: Abortable): void;
}
