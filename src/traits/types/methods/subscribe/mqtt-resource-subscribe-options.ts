import { type Abortable } from '@xstd/abortable';
import { type MqttSubscriptionResourceOptions } from '../../../../subscription/traits/static/types/mqtt-subscription-resource-options.ts';

export interface MqttResourceSubscribeOptions extends MqttSubscriptionResourceOptions, Abortable {}
