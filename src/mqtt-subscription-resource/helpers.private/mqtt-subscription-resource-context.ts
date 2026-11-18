import type { CloseStack } from '@xstd/resource';
import type { MqttClient } from 'mqtt';
import { MqttSubscriptionResource } from '../mqtt-subscription-resource.ts';

/**
 * The dependencies a `MqttSubscriptionResource` requires: the native mqtt client whose
 * subscriptions it manages, and the close stack it runs its tasks into.
 */
export interface MqttSubscriptionResourceContext {
  readonly nativeClient: MqttClient;
  readonly closeStack: CloseStack;
}

let MQTT_SUBSCRIPTION_RESOURCE_CONTEXT: MqttSubscriptionResourceContext | undefined = undefined;

/**
 * Creates a `MqttSubscriptionResource`, provisionally providing it the given context, which
 * its constructor retrieves with {@link getMqttSubscriptionResourceContext}.
 *
 * Fails when a context is already available (a resource is being constructed concurrently).
 */
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

/**
 * Returns the context provisioned by {@link newMqttSubscriptionResource} for the
 * `MqttSubscriptionResource` being constructed.
 *
 * Fails when called outside of a `MqttSubscriptionResource` construction.
 */
export function getMqttSubscriptionResourceContext(): MqttSubscriptionResourceContext {
  if (MQTT_SUBSCRIPTION_RESOURCE_CONTEXT === undefined) {
    throw new Error('MqttSubscriptionResourceContext not available');
  }

  return MQTT_SUBSCRIPTION_RESOURCE_CONTEXT;
}
