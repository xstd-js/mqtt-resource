import { NEVER_ABORTED } from '@xstd/abortable';
import { type MqttClient } from 'mqtt';
import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SharedMqttResource } from './shared-mqtt-resource.ts';

const connectMock = vi.hoisted(() => vi.fn());

vi.mock('mqtt', () => {
  return { default: { connect: connectMock } };
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

let lastCreatedClient: MqttClient | undefined;

function mockOpenClient(): void {
  connectMock.mockImplementation((): MqttClient => {
    const client: MqttClient = createClientMock();
    lastCreatedClient = client;
    // emits the CONNACK asynchronously, like a real client
    queueMicrotask((): void => {
      client.emit('connect', { cmd: 'connack', sessionPresent: false });
    });
    return client;
  });
}

describe('SharedMqttResource', () => {
  afterEach(() => {
    connectMock.mockReset();
  });

  it('shares one connection for identical options in any property order', async () => {
    const previousMaintainAlive: number = SharedMqttResource.maintainAlive;
    SharedMqttResource.maintainAlive = 0;
    try {
      mockOpenClient();

      const first = await SharedMqttResource.open.call(NEVER_ABORTED, 'mqtt://localhost', {
        username: 'user',
        password: 'secret',
      });
      const second = await SharedMqttResource.open.call(NEVER_ABORTED, 'mqtt://localhost', {
        password: 'secret',
        username: 'user',
      });

      expect(connectMock).toHaveBeenCalledOnce();
      expect(second.publish).not.toBe(first.publish); // distinct wrappers, same connection

      await first.close();
      await second.close();
    } finally {
      SharedMqttResource.maintainAlive = previousMaintainAlive;
    }
  });

  it('shares one connection for equivalent urls with an explicit default port', async () => {
    const previousMaintainAlive: number = SharedMqttResource.maintainAlive;
    SharedMqttResource.maintainAlive = 0;
    try {
      mockOpenClient();

      const first = await SharedMqttResource.open.call(NEVER_ABORTED, 'mqtt://localhost', {
        username: 'user',
        password: 'secret',
      });
      const second = await SharedMqttResource.open.call(NEVER_ABORTED, 'mqtt://localhost:1883', {
        username: 'user',
        password: 'secret',
      });

      await first.close();
      await second.close();

      expect(connectMock).toHaveBeenCalledOnce();
    } finally {
      SharedMqttResource.maintainAlive = previousMaintainAlive;
    }
  });

  it('reuses the connection within the maintain-alive window after a close', async () => {
    const previousMaintainAlive: number = SharedMqttResource.maintainAlive;
    SharedMqttResource.maintainAlive = 50;
    try {
      mockOpenClient();

      const first = await SharedMqttResource.open.call(NEVER_ABORTED, 'mqtt://localhost', {
        username: 'user',
        password: 'secret',
      });
      await first.close();
      const second = await SharedMqttResource.open.call(NEVER_ABORTED, 'mqtt://localhost', {
        username: 'user',
        password: 'secret',
      });
      const third = await SharedMqttResource.open.call(NEVER_ABORTED, 'mqtt://localhost', {
        username: 'user',
        password: 'secret',
      });

      // the delayed close of `first` was aborted by `second`: `third` shares the same connection
      expect(connectMock).toHaveBeenCalledOnce();

      await second.close();
      await third.close();

      // let the maintain-alive window elapse (background close)
      await new Promise<void>((resolve: () => void): void => {
        setTimeout(resolve, 100);
      });
    } finally {
      SharedMqttResource.maintainAlive = previousMaintainAlive;
    }
  });

  it('closes the sharers when the underlying connection dies', async () => {
    const previousMaintainAlive: number = SharedMqttResource.maintainAlive;
    SharedMqttResource.maintainAlive = 0; // deterministic synchronous close
    try {
      mockOpenClient();

      const first = await SharedMqttResource.open.call(NEVER_ABORTED, 'mqtt://shared-death.test');
      const second = await SharedMqttResource.open.call(NEVER_ABORTED, 'mqtt://shared-death.test');

      // a clean TCP disconnection emits only 'close': the underlying resource closes,
      // and the sharers close with it
      lastCreatedClient!.emit('close');

      await first.closed;
      await second.closed;
    } finally {
      SharedMqttResource.maintainAlive = previousMaintainAlive;
    }
  });

  it('does not share connections when the credentials differ', async () => {
    const previousMaintainAlive: number = SharedMqttResource.maintainAlive;
    SharedMqttResource.maintainAlive = 0;
    try {
      mockOpenClient();

      const first = await SharedMqttResource.open.call(NEVER_ABORTED, 'mqtt://localhost', {
        username: 'user',
        password: 'secret',
      });
      const second = await SharedMqttResource.open.call(NEVER_ABORTED, 'mqtt://localhost', {
        username: 'other-user',
        password: 'secret',
      });
      const third = await SharedMqttResource.open.call(NEVER_ABORTED, 'mqtt://localhost');

      expect(connectMock).toHaveBeenCalledTimes(3);
      expect(connectMock).toHaveBeenNthCalledWith(1, 'mqtt://localhost', {
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
