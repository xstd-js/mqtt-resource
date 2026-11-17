import { type ISubscriptionGrant, type MqttClient } from 'mqtt';
import { describe, expect, it, vi } from 'vitest';

import { subscribeToMqttClientSubscription } from './subscribe-to-mqtt-client-subscription.ts';

function createClientMock(): MqttClient {
  return {
    subscribeAsync: vi.fn(async (): Promise<ISubscriptionGrant[]> => []),
    unsubscribeAsync: vi.fn(async (): Promise<undefined> => undefined),
  } as unknown as MqttClient;
}

describe('subscribeToMqttClientSubscription', () => {
  it('subscribes and resolves when the broker grants the requested qos', async () => {
    const client: MqttClient = createClientMock();
    client.subscribeAsync = vi.fn(async (): Promise<ISubscriptionGrant[]> => [
      { topic: 'test/topic', qos: 2 },
    ]);

    await expect(
      subscribeToMqttClientSubscription(client, 'test/topic', { qos: 2 }),
    ).resolves.toBeUndefined();

    expect(client.subscribeAsync).toHaveBeenCalledExactlyOnceWith('test/topic', {
      qos: 2,
      nl: false,
      rap: false,
      rh: 0,
    });
  });

  it('unsubscribes and rejects when the broker grants a lower qos', async () => {
    const client: MqttClient = createClientMock();
    client.subscribeAsync = vi.fn(async (): Promise<ISubscriptionGrant[]> => [
      { topic: 'test/topic', qos: 0 },
    ]);

    await expect(
      subscribeToMqttClientSubscription(client, 'test/topic', { qos: 2 }),
    ).rejects.toThrow('Cannot subscribe to "test/topic"');

    expect(client.unsubscribeAsync).toHaveBeenCalledExactlyOnceWith('test/topic');
  });

  it('rejects when the broker rejects the subscription (granted qos 0x80)', async () => {
    const client: MqttClient = createClientMock();
    client.subscribeAsync = vi.fn(async (): Promise<ISubscriptionGrant[]> => [
      { topic: 'test/topic', qos: 0x80 },
    ]);

    await expect(
      subscribeToMqttClientSubscription(client, 'test/topic', { qos: 1 }),
    ).rejects.toThrow('Cannot subscribe to "test/topic"');
  });
});
