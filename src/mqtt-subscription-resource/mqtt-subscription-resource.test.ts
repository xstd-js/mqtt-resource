import { NEVER_ABORTED } from '@xstd/abortable';
import { type ListenerResource } from '@xstd/listener-resource';
import { Resource } from '@xstd/resource';
import { type IPublishPacket, type ISubscriptionGrant, type MqttClient } from 'mqtt';
import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';

import { CloseStack } from '@xstd/resource';
import type { MqttPublishPacket } from '../mqtt-resource/types/mqtt-publish-packet.ts';
import { newMqttSubscriptionResource } from './helpers.private/mqtt-subscription-resource-context.ts';
import { MqttSubscriptionResource } from './mqtt-subscription-resource.ts';

function createClientMock(): MqttClient {
  const client: MqttClient = new EventEmitter() as unknown as MqttClient;
  Object.assign(client, {
    connected: true,
    disconnecting: false,
    subscribeAsync: vi.fn(async (): Promise<ISubscriptionGrant[]> => []),
    unsubscribeAsync: vi.fn(async (): Promise<undefined> => undefined),
  });
  return client;
}

function createCloseStack(): { readonly resource: Resource; readonly closeStack: CloseStack } {
  let closeStack: CloseStack | undefined;
  const resource: Resource = new Resource((reason: unknown): Promise<void> => {
    return closeStack!.close(reason);
  });
  closeStack = new CloseStack(resource);
  return { resource, closeStack };
}

describe('MqttSubscriptionResource', () => {
  it('receives a message delivered during the subscription establishment', async () => {
    const client: MqttClient = createClientMock();
    const { closeStack } = createCloseStack();
    const subscriptionResource = newMqttSubscriptionResource({
      nativeClient: client,
      closeStack,
    });

    // Simulate a retained message delivered in the same TCP chunk as the SUBACK:
    // mqtt.js dispatches the PUBLISH packet (and emits 'message') before the
    // 'subscribeAsync' promise continuations run.
    client.subscribeAsync = vi.fn(async (): Promise<ISubscriptionGrant[]> => {
      client.emit('message', 'test/topic', Buffer.from('retained'), {
        cmd: 'publish',
        dup: false,
        qos: 0,
        retain: true,
        topic: 'test/topic',
        payload: Buffer.from('retained'),
      });
      return [{ topic: 'test/topic', qos: 0 }];
    });

    const listener: ListenerResource<MqttPublishPacket> = await subscriptionResource.call(
      NEVER_ABORTED,
      'test/topic',
    );

    const received: MqttPublishPacket[] = [];
    listener.listen((packet: MqttPublishPacket): void => {
      received.push(packet);
    });

    // let the macrotasks run (message dispatch, buffered values flush...)
    await new Promise<void>((resolve: () => void): void => {
      setTimeout(resolve, 10);
    });

    expect(received).toEqual([
      {
        topic: 'test/topic',
        payload: Buffer.from('retained'),
        qos: 0,
        retain: true,
      },
    ]);
  });

  it('delivers messages published to the parent level of a multi-level wildcard subscription', async () => {
    const client: MqttClient = createClientMock();
    const { closeStack } = createCloseStack();
    const subscriptionResource = newMqttSubscriptionResource({
      nativeClient: client,
      closeStack,
    });

    client.subscribeAsync = vi.fn(async (): Promise<ISubscriptionGrant[]> => [
      { topic: 'test/#', qos: 0 },
    ]);

    const listener: ListenerResource<MqttPublishPacket> = await subscriptionResource.call(
      NEVER_ABORTED,
      'test/#',
    );

    const received: MqttPublishPacket[] = [];
    listener.listen((packet: MqttPublishPacket): void => {
      received.push(packet);
    });

    // per MQTT 4.7.1.2, 'test/#' also matches the parent level 'test'
    client.emit('message', 'test', Buffer.from('parent'), { cmd: 'publish' } as IPublishPacket);

    // let the macrotasks run (message dispatch, buffered values flush...)
    await new Promise<void>((resolve: () => void): void => {
      setTimeout(resolve, 10);
    });

    expect(received).toEqual([{ topic: 'test', payload: Buffer.from('parent') }]);
  });

  it('delivers messages published to an empty level matched by a single-level wildcard', async () => {
    const client: MqttClient = createClientMock();
    const { closeStack } = createCloseStack();
    const subscriptionResource = newMqttSubscriptionResource({
      nativeClient: client,
      closeStack,
    });

    client.subscribeAsync = vi.fn(async (): Promise<ISubscriptionGrant[]> => [
      { topic: 'test/+', qos: 0 },
    ]);

    const listener: ListenerResource<MqttPublishPacket> = await subscriptionResource.call(
      NEVER_ABORTED,
      'test/+',
    );

    const received: MqttPublishPacket[] = [];
    listener.listen((packet: MqttPublishPacket): void => {
      received.push(packet);
    });

    // per MQTT 4.7.1.2, 'test/+' also matches 'test/' (zero-length level)
    client.emit('message', 'test/', Buffer.from('empty'), { cmd: 'publish' } as IPublishPacket);

    // let the macrotasks run (message dispatch, buffered values flush...)
    await new Promise<void>((resolve: () => void): void => {
      setTimeout(resolve, 10);
    });

    expect(received).toEqual([{ topic: 'test/', payload: Buffer.from('empty') }]);
  });

  it('forwards the publish packet metadata (qos, retain, properties)', async () => {
    const client: MqttClient = createClientMock();
    const { closeStack } = createCloseStack();
    const subscriptionResource = newMqttSubscriptionResource({
      nativeClient: client,
      closeStack,
    });

    client.subscribeAsync = vi.fn(async (): Promise<ISubscriptionGrant[]> => [
      { topic: 'test/topic', qos: 0 },
    ]);

    const listener: ListenerResource<MqttPublishPacket> = await subscriptionResource.call(
      NEVER_ABORTED,
      'test/topic',
    );

    const received: MqttPublishPacket[] = [];
    listener.listen((packet: MqttPublishPacket): void => {
      received.push(packet);
    });

    client.emit('message', 'test/topic', Buffer.from('hello'), {
      cmd: 'publish',
      dup: false,
      qos: 1,
      retain: true,
      topic: 'test/topic',
      payload: Buffer.from('hello'),
      properties: { userProperties: { source: 'sensor' } },
    });

    // let the macrotasks run (message dispatch, buffered values flush...)
    await new Promise<void>((resolve: () => void): void => {
      setTimeout(resolve, 10);
    });

    expect(received).toEqual([
      {
        topic: 'test/topic',
        payload: Buffer.from('hello'),
        qos: 1,
        retain: true,
        properties: { userProperties: { source: 'sensor' } },
      },
    ]);
  });

  it('delays the unsubscribe within the maintain-alive window and reuses the subscription', async () => {
    const previousMaintainAlive: number = MqttSubscriptionResource.maintainAlive;
    MqttSubscriptionResource.maintainAlive = 50;
    try {
      const client: MqttClient = createClientMock();
      client.subscribeAsync = vi.fn(async (topic: string): Promise<ISubscriptionGrant[]> => [
        { topic, qos: 0 },
      ]);
      const { closeStack } = createCloseStack();
      const subscriptionResource = newMqttSubscriptionResource({
        nativeClient: client,
        closeStack,
      });

      const first: ListenerResource<MqttPublishPacket> = await subscriptionResource.call(
        NEVER_ABORTED,
        'test/topic',
      );
      await first.close();

      // within the window: the unsubscribe is delayed, not performed yet
      expect(client.unsubscribeAsync).not.toHaveBeenCalled();

      const second: ListenerResource<MqttPublishPacket> = await subscriptionResource.call(
        NEVER_ABORTED,
        'test/topic',
      );

      // the live subscription is reused: no additional subscribe
      expect(client.subscribeAsync).toHaveBeenCalledOnce();
      expect(client.unsubscribeAsync).not.toHaveBeenCalled();

      await second.close();

      // let the maintain-alive window elapse (background unsubscribe)
      await new Promise<void>((resolve: () => void): void => {
        setTimeout(resolve, 100);
      });

      expect(client.unsubscribeAsync).toHaveBeenCalledExactlyOnceWith('test/topic');
    } finally {
      MqttSubscriptionResource.maintainAlive = previousMaintainAlive;
    }
  });

  it('shares the underlying subscription between listeners on the same topic', async () => {
    const previousMaintainAlive: number = MqttSubscriptionResource.maintainAlive;
    MqttSubscriptionResource.maintainAlive = 0; // deterministic synchronous close
    try {
      const client: MqttClient = createClientMock();
      client.subscribeAsync = vi.fn(async (topic: string): Promise<ISubscriptionGrant[]> => [
        { topic, qos: 0 },
      ]);
      const { closeStack } = createCloseStack();
      const subscriptionResource = newMqttSubscriptionResource({
        nativeClient: client,
        closeStack,
      });

      const first: ListenerResource<MqttPublishPacket> = await subscriptionResource.call(
        NEVER_ABORTED,
        'test/topic',
      );
      const second: ListenerResource<MqttPublishPacket> = await subscriptionResource.call(
        NEVER_ABORTED,
        'test/topic',
      );

      // one native subscription backs both listeners
      expect(client.subscribeAsync).toHaveBeenCalledOnce();

      const firstReceived: MqttPublishPacket[] = [];
      const secondReceived: MqttPublishPacket[] = [];
      first.listen((packet: MqttPublishPacket): void => {
        firstReceived.push(packet);
      });
      second.listen((packet: MqttPublishPacket): void => {
        secondReceived.push(packet);
      });

      client.emit('message', 'test/topic', Buffer.from('hello'), {
        cmd: 'publish',
        dup: false,
        qos: 0,
        retain: false,
        topic: 'test/topic',
        payload: Buffer.from('hello'),
      });

      // let the macrotasks run (message dispatch, buffered values flush...)
      await new Promise<void>((resolve: () => void): void => {
        setTimeout(resolve, 10);
      });

      expect(firstReceived).toEqual([
        { topic: 'test/topic', payload: Buffer.from('hello'), qos: 0, retain: false },
      ]);
      expect(secondReceived).toEqual(firstReceived);

      await first.close();
      // the native subscription stays alive while `second` is open
      expect(client.unsubscribeAsync).not.toHaveBeenCalled();

      await second.close();
      expect(client.unsubscribeAsync).toHaveBeenCalledExactlyOnceWith('test/topic');
    } finally {
      MqttSubscriptionResource.maintainAlive = previousMaintainAlive;
    }
  });

  it('rejects a second listener with different options on the same topic', async () => {
    const client: MqttClient = createClientMock();
    client.subscribeAsync = vi.fn(async (topic: string): Promise<ISubscriptionGrant[]> => [
      { topic, qos: 0 },
    ]);
    const { closeStack } = createCloseStack();
    const subscriptionResource = newMqttSubscriptionResource({
      nativeClient: client,
      closeStack,
    });

    const first: ListenerResource<MqttPublishPacket> = await subscriptionResource.call(
      NEVER_ABORTED,
      'test/topic',
    );

    await expect(
      subscriptionResource.call(NEVER_ABORTED, 'test/topic', { qos: 1 }),
    ).rejects.toThrow('already locked');

    await first.close();
  });

  it('cleans up when the signal aborts during the subscription establishment', async () => {
    const client: MqttClient = createClientMock();
    let resolveSubscribeAsync!: () => void;
    client.subscribeAsync = vi.fn(
      (): Promise<ISubscriptionGrant[]> =>
        new Promise<ISubscriptionGrant[]>(
          (resolve: (grants: ISubscriptionGrant[]) => void): void => {
            resolveSubscribeAsync = (): void => {
              resolve([{ topic: 'test/topic', qos: 0 }]);
            };
          },
        ),
    );
    const { closeStack } = createCloseStack();
    const subscriptionResource = newMqttSubscriptionResource({
      nativeClient: client,
      closeStack,
    });

    const abortController: AbortController = new AbortController();
    const promise: Promise<ListenerResource<MqttPublishPacket>> = subscriptionResource.call(
      abortController.signal,
      'test/topic',
    );

    abortController.abort();
    resolveSubscribeAsync();

    await expect(promise).rejects.toBe(abortController.signal.reason);

    // the 'message' listener is detached and the rollback unsubscribe ran
    expect(client.listenerCount('message')).toBe(0);
    expect(client.unsubscribeAsync).toHaveBeenCalledExactlyOnceWith('test/topic');
  });

  it('rejects when the underlying unsubscribe fails on close', async () => {
    const previousMaintainAlive: number = MqttSubscriptionResource.maintainAlive;
    MqttSubscriptionResource.maintainAlive = 0; // close() awaits the full unsubscribe
    try {
      const client: MqttClient = createClientMock();
      const { closeStack } = createCloseStack();
      const subscriptionResource = newMqttSubscriptionResource({
        nativeClient: client,
        closeStack,
      });

      client.subscribeAsync = vi.fn(async (): Promise<ISubscriptionGrant[]> => [
        { topic: 'test/topic', qos: 0 },
      ]);
      client.unsubscribeAsync = vi.fn(async (): Promise<undefined> => {
        throw new Error('unsubscribe failed');
      });

      const listener: ListenerResource<MqttPublishPacket> = await subscriptionResource.call(
        NEVER_ABORTED,
        'test/topic',
      );

      await expect(listener.close()).rejects.toThrow('unsubscribe failed');
    } finally {
      MqttSubscriptionResource.maintainAlive = previousMaintainAlive;
    }
  });

  it('does not unsubscribe when the client is no longer connected on delayed close', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((): void => {});
    const previousMaintainAlive: number = MqttSubscriptionResource.maintainAlive;
    MqttSubscriptionResource.maintainAlive = 5; // delayed close, shortened for the test
    try {
      const client: MqttClient = createClientMock();
      // mirrors mqtt.js: unsubscribing from a disconnected client rejects
      client.unsubscribeAsync = vi.fn(async (): Promise<undefined> => {
        if (!client.connected) {
          throw new Error('client disconnecting');
        }
        return undefined;
      });
      const { closeStack } = createCloseStack();
      const subscriptionResource = newMqttSubscriptionResource({
        nativeClient: client,
        closeStack,
      });

      client.subscribeAsync = vi.fn(async (): Promise<ISubscriptionGrant[]> => [
        { topic: 'test/topic', qos: 0 },
      ]);

      const listener: ListenerResource<MqttPublishPacket> = await subscriptionResource.call(
        NEVER_ABORTED,
        'test/topic',
      );

      await listener.close();

      // simulate the connection dying while the maintain-alive delay elapses
      client.connected = false;
      await new Promise<void>((resolve: () => void): void => {
        setTimeout(resolve, 50);
      });

      expect(client.unsubscribeAsync).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    } finally {
      MqttSubscriptionResource.maintainAlive = previousMaintainAlive;
      consoleErrorSpy.mockRestore();
    }
  });
});
