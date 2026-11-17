import { NEVER_ABORTED } from '@xstd/abortable';
import { type MqttClient } from 'mqtt';
import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SharedMqttResource } from './shared-mqtt-resource.ts';

const connectAsyncMock = vi.hoisted(() => vi.fn());

vi.mock('mqtt', () => {
  return { default: { connectAsync: connectAsyncMock } };
});

function createClientMock(): MqttClient {
  const client: MqttClient = new EventEmitter() as unknown as MqttClient;
  Object.assign(client, {
    connected: true,
    setMaxListeners: vi.fn(),
    endAsync: vi.fn(async (): Promise<void> => undefined),
    publishAsync: vi.fn(async (): Promise<void> => undefined),
  });
  return client;
}

describe('SharedMqttResource', () => {
  afterEach(() => {
    connectAsyncMock.mockReset();
  });

  it('shares one connection for identical options in any property order', async () => {
    const previousMaintainAlive: number = SharedMqttResource.maintainAlive;
    SharedMqttResource.maintainAlive = 0;
    try {
      connectAsyncMock.mockImplementation(async (): Promise<MqttClient> => createClientMock());

      const first = await SharedMqttResource.open.call(NEVER_ABORTED, 'mqtt://localhost', {
        username: 'user',
        password: 'secret',
      });
      const second = await SharedMqttResource.open.call(NEVER_ABORTED, 'mqtt://localhost', {
        password: 'secret',
        username: 'user',
      });

      expect(connectAsyncMock).toHaveBeenCalledOnce();
      expect(second.publish).not.toBe(first.publish); // distinct wrappers, same connection

      await first.close();
      await second.close();
    } finally {
      SharedMqttResource.maintainAlive = previousMaintainAlive;
    }
  });

  it('does not share connections when the credentials differ', async () => {
    const previousMaintainAlive: number = SharedMqttResource.maintainAlive;
    SharedMqttResource.maintainAlive = 0;
    try {
      connectAsyncMock.mockImplementation(async (): Promise<MqttClient> => createClientMock());

      const first = await SharedMqttResource.open.call(NEVER_ABORTED, 'mqtt://localhost', {
        username: 'user',
        password: 'secret',
      });
      const second = await SharedMqttResource.open.call(NEVER_ABORTED, 'mqtt://localhost', {
        username: 'other-user',
        password: 'secret',
      });
      const third = await SharedMqttResource.open.call(NEVER_ABORTED, 'mqtt://localhost');

      expect(connectAsyncMock).toHaveBeenCalledTimes(3);
      expect(connectAsyncMock).toHaveBeenNthCalledWith(1, 'mqtt://localhost', {
        clientId: undefined,
        username: 'user',
        password: 'secret',
        reconnectPeriod: 0,
        autoUseTopicAlias: true,
        autoAssignTopicAlias: true,
      });

      await first.close();
      await second.close();
      await third.close();
    } finally {
      SharedMqttResource.maintainAlive = previousMaintainAlive;
    }
  });
});
