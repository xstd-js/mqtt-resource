import { type ResourceFactory } from '@xstd/resource';
import { type MqttResource } from '../../../../../../implementations/default/mqtt-resource.js';
import { type MqttSubscriptionResourceTrait } from '../../../../mqtt-subscription-resource.trait.js';
import { type MqttSubscriptionResourceOpenOptions } from '../../methods/open/mqtt-subscription-resource-open-options.js';

export type MqttSubscriptionResourceFactory<
  GMqttSubscriptionResource extends MqttSubscriptionResourceTrait,
> = ResourceFactory<
  [client: MqttResource, topic: string],
  GMqttSubscriptionResource,
  MqttSubscriptionResourceOpenOptions
>;
