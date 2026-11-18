import type { Abortable } from '@xstd/abortable';
import type { ISubscriptionGrant, MqttClient } from 'mqtt';
import type { MqttQos } from '../../mqtt-resource/types/mqtt-qos.ts';

/**
 * Options of a MQTT broker subscription, passed as is to the underlying SUBSCRIBE packet.
 */
export interface SubscribeToMqttClientSubscriptionOptions extends Abortable {
  /** The maximum QoS level requested for the subscription. Defaults to `0`. */
  readonly qos?: MqttQos;
  /** Does not deliver the messages published by this very client. Defaults to `false`. */
  readonly noLocal?: boolean;
  /** Keeps the messages' retain flag as published, instead of clearing it. Defaults to `false`. */
  readonly retainAsPublished?: boolean;
  /** Controls how retained messages are delivered when the subscription is established. Defaults to `0`. */
  readonly retainHandling?: 0 | 1 | 2;
}

/**
 * Subscribes a native mqtt client to the given topic, and waits for its SUBACK.
 *
 * Verifies the granted subscription: when the signal aborted, the broker granted no
 * subscription, rejected the subscription, or downgraded the requested QoS, the subscription
 * is unsubscribed (rolled back) and the call rejects.
 */
export async function subscribeToMqttClientSubscription(
  client: MqttClient,
  topic: string,
  {
    qos = 0,
    noLocal = false,
    retainAsPublished = false,
    retainHandling = 0,
    signal,
  }: SubscribeToMqttClientSubscriptionOptions = {},
): Promise<void> {
  const [granted]: readonly (ISubscriptionGrant | undefined)[] = await client.subscribeAsync(
    topic,
    {
      qos,
      nl: noLocal,
      rap: retainAsPublished,
      rh: retainHandling,
    },
  );

  if (signal?.aborted) {
    const reason: unknown = signal.reason;
    await rollbackUnsubscribe(client, topic, reason);
    throw reason;
  }

  if (granted === undefined) {
    throw new Error(`Cannot subscribe to "${topic}": the broker granted no subscription.`);
  }

  if (granted.qos > 2) {
    // The broker rejected the subscription (granted qos 0x80 or any MQTT5 error code):
    // nothing was subscribed, so there is nothing to roll back.
    throw new Error(
      `Cannot subscribe to "${topic}": the broker rejected the subscription (granted ${granted.qos}).`,
    );
  }

  if (granted.qos < qos) {
    const downgradeError: Error = new Error(
      `Cannot subscribe to "${topic}" with a qos of ${qos}. Granted ${granted.qos}.`,
    );
    await rollbackUnsubscribe(client, topic, downgradeError);
    throw downgradeError;
  }
}

/* INTERNAL */

/**
 * Unsubscribes as a rollback. A rollback failure is wrapped into a `SuppressedError`
 * (the rollback error being primary, the primary error being suppressed): nothing
 * is dropped, and the rollback error surfaces to the caller.
 */
async function rollbackUnsubscribe(
  client: MqttClient,
  topic: string,
  primaryError: unknown,
): Promise<void> {
  try {
    await client.unsubscribeAsync(topic);
  } catch (rollbackError: unknown) {
    throw new SuppressedError(
      rollbackError,
      primaryError,
      `Failed to unsubscribe from "${topic}" during the rollback.`,
    );
  }
}
