import type { CloseStack } from '@xstd/resource';
import type { MqttClient } from 'mqtt';
import { MqttSubscriptionResource } from '../mqtt-subscription-resource.ts';

export interface MqttSubscriptionResourceContext {
  readonly nativeClient: MqttClient;
  readonly closeStack: CloseStack;
}

let MQTT_SUBSCRIPTION_RESOURCE_CONTEXT: MqttSubscriptionResourceContext | undefined = undefined;

export function newMqttSubscriptionResource(
  context: MqttSubscriptionResourceContext,
): MqttSubscriptionResource {
  if (MQTT_SUBSCRIPTION_RESOURCE_CONTEXT !== undefined) {
    throw new Error('MqttSubscriptionResourceContext already available');
  }

  MQTT_SUBSCRIPTION_RESOURCE_CONTEXT = context;

  try {
    return new MqttSubscriptionResource();
  } finally {
    MQTT_SUBSCRIPTION_RESOURCE_CONTEXT = undefined;
  }
}

export function getMqttSubscriptionResourceContext(): MqttSubscriptionResourceContext {
  if (MQTT_SUBSCRIPTION_RESOURCE_CONTEXT === undefined) {
    throw new Error('MqttSubscriptionResourceContext not available');
  }

  return MQTT_SUBSCRIPTION_RESOURCE_CONTEXT;
}
