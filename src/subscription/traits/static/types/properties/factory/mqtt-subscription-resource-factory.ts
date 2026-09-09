import { type ResourceFactory } from '@xstd/resource';
import { type MqttResource } from '../../../../../../implementations/default/mqtt-resource.ts';
import { type MqttSubscriptionResourceTrait } from '../../../../mqtt-subscription-resource.trait.ts';
import { type MqttSubscriptionResourceOpenOptions } from '../../methods/open/mqtt-subscription-resource-open-options.ts';

export type MqttSubscriptionResourceFactory<
  GMqttSubscriptionResource extends MqttSubscriptionResourceTrait,
> = ResourceFactory<
  [client: MqttResource, topic: string],
  GMqttSubscriptionResource,
  MqttSubscriptionResourceOpenOptions
>;
