import { NEVER_ABORTED } from '@xstd/abortable';
import { CompleteError } from '@xstd/custom-error';
import { type MqttClient } from 'mqtt';
import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';

import { MqttResource } from './mqtt-resource.ts';

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

describe('MqttResource', () => {
  it('publishes and closes', async () => {
    const client: MqttClient = createClientMock();
    connectAsyncMock.mockResolvedValue(client);

    const resource: MqttResource = await MqttResource.open.call(NEVER_ABORTED, 'mqtt://localhost');

    resource.throwIfClosed();

    await resource.publish.call(NEVER_ABORTED, 'test/topic', 'hello');

    expect(client.publishAsync).toHaveBeenCalledExactlyOnceWith('test/topic', 'hello', undefined);

    await resource.close(new CompleteError());

    await resource.closed;
    expect(client.endAsync).toHaveBeenCalledExactlyOnceWith();
  });
});
