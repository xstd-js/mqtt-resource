import type { Abortable } from '@xstd/abortable';
import type { ISubscriptionGrant, MqttClient } from 'mqtt';
import type { MqttQos } from '../../mqtt-resource/types/mqtt-qos.ts';

export interface SubscribeToMqttClientSubscriptionOptions extends Abortable {
  readonly qos?: MqttQos;
  readonly noLocal?: boolean;
  readonly retainAsPublished?: boolean;
  readonly retainHandling?: 0 | 1 | 2;
}

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
