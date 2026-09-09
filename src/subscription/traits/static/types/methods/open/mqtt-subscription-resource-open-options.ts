import { type Abortable } from '@xstd/abortable';
import { type MqttSubscriptionResourceOptions } from '../../mqtt-subscription-resource-options.ts';

export interface MqttSubscriptionResourceOpenOptions
  extends MqttSubscriptionResourceOptions, Abortable {}
