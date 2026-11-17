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
      } as IPublishPacket);
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

    expect(received).toEqual([{ topic: 'test/topic', payload: Buffer.from('retained') }]);
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
});
