import type { MqttClient } from 'mqtt';
import type { MqttResource } from '../../mqtt-resource/implementations/default/mqtt-resource.ts';
import { MqttSubscriptionResource } from '../mqtt-subscription-resource.ts';

export interface MqttSubscriptionResourceContext {
  readonly client: MqttResource;
  readonly nativeClient: MqttClient;
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
