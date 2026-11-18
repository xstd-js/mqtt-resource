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
  it('rejects with a descriptive error when the broker grants nothing', async () => {
    const client: MqttClient = createClientMock(); // subscribeAsync resolves with no grant

    await expect(
      subscribeToMqttClientSubscription(client, 'test/topic', { qos: 1 }),
    ).rejects.toThrow('the broker granted no subscription');
  });

  it('rejects with a SuppressedError when the rollback unsubscribe fails on abort', async () => {
    const abortController: AbortController = new AbortController();
    const client: MqttClient = createClientMock();
    const unsubscribeError: Error = new Error('unsubscribe failed');
    let resolveSubscribeAsync!: () => void;
    client.subscribeAsync = vi.fn(
      (): Promise<ISubscriptionGrant[]> =>
        new Promise<ISubscriptionGrant[]>(
          (resolve: (grants: ISubscriptionGrant[]) => void): void => {
            resolveSubscribeAsync = (): void => {
              resolve([{ topic: 'test/topic', qos: 1 }]);
            };
          },
        ),
    );
    client.unsubscribeAsync = vi.fn(async (): Promise<undefined> => {
      throw unsubscribeError;
    });

    const promise: Promise<void> = subscribeToMqttClientSubscription(client, 'test/topic', {
      qos: 1,
      signal: abortController.signal,
    });

    abortController.abort();
    resolveSubscribeAsync();

    const rejection: unknown = await promise.then(
      (): unknown => undefined,
      (error: unknown): unknown => error,
    );

    expect(rejection).toBeInstanceOf(SuppressedError);
    const suppressedError: SuppressedError = rejection as SuppressedError;
    expect(suppressedError.error).toBe(unsubscribeError);
    expect(suppressedError.suppressed).toBe(abortController.signal.reason);
  });

  it('rejects with a SuppressedError when the rollback unsubscribe fails on qos downgrade', async () => {
    const client: MqttClient = createClientMock();
    client.subscribeAsync = vi.fn(async (): Promise<ISubscriptionGrant[]> => [
      { topic: 'test/topic', qos: 0 },
    ]);
    const unsubscribeError: Error = new Error('unsubscribe failed');
    client.unsubscribeAsync = vi.fn(async (): Promise<undefined> => {
      throw unsubscribeError;
    });

    const rejection: unknown = await subscribeToMqttClientSubscription(client, 'test/topic', {
      qos: 2,
    }).then(
      (): unknown => undefined,
      (error: unknown): unknown => error,
    );

    expect(rejection).toBeInstanceOf(SuppressedError);
    const suppressedError: SuppressedError = rejection as SuppressedError;
    expect(suppressedError.error).toBe(unsubscribeError);
    expect((suppressedError.suppressed as Error).message).toBe(
      'Cannot subscribe to "test/topic" with a qos of 2. Granted 0.',
    );
  });

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
