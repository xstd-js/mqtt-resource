import { NEVER_ABORTED } from '@xstd/abortable';
import { type MqttClient } from 'mqtt';
import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';

import { openMqttClient } from './open-mqtt-client.ts';

const connectMock = vi.hoisted(() => vi.fn());

vi.mock('mqtt', () => {
  return { default: { connect: connectMock } };
});

function createClientMock(): MqttClient {
  const client: MqttClient = new EventEmitter() as unknown as MqttClient;
  Object.assign(client, {
    connected: true,
    end: vi.fn((): MqttClient => client),
    endAsync: vi.fn(async (): Promise<void> => undefined),
  });
  return client;
}

function mockOpenClient(client: MqttClient): void {
  connectMock.mockImplementation((): MqttClient => {
    // emits the CONNACK asynchronously, like a real client
    queueMicrotask((): void => {
      client.emit('connect', { cmd: 'connack', sessionPresent: false });
    });
    return client;
  });
}

describe('openMqttClient', () => {
  it('resolves with the client when the CONNACK is received', async () => {
    const client: MqttClient = createClientMock();
    mockOpenClient(client);

    await expect(openMqttClient(NEVER_ABORTED, 'mqtt://localhost')).resolves.toBe(client);
  });

  it('rejects with the client error and closes the client when the connection fails', async () => {
    const client: MqttClient = createClientMock();
    connectMock.mockReturnValue(client); // never emits 'connect'

    const clientPromise: Promise<MqttClient> = openMqttClient(NEVER_ABORTED, 'mqtt://localhost');

    client.emit('error', new Error('connect failed'));

    await expect(clientPromise).rejects.toThrow('connect failed');
    expect(client.end).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('rejects and closes the client when the connection closes before the CONNACK', async () => {
    const client: MqttClient = createClientMock();
    connectMock.mockReturnValue(client); // never emits 'connect'

    const clientPromise: Promise<MqttClient> = openMqttClient(NEVER_ABORTED, 'mqtt://localhost');

    client.emit('close');

    await expect(clientPromise).rejects.toThrow("Couldn't connect to server");
    expect(client.end).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('rejects with the abort reason when the signal aborts while connecting', async () => {
    const abortController: AbortController = new AbortController();
    connectMock.mockReturnValue(createClientMock()); // never emits 'connect'

    const clientPromise: Promise<MqttClient> = openMqttClient(
      abortController.signal,
      'mqtt://localhost',
    );

    let rejection: unknown = undefined;
    clientPromise.catch((error: unknown): void => {
      rejection = error;
    });

    abortController.abort();

    // let the macrotasks run (rejection dispatch...)
    await new Promise<void>((resolve: () => void): void => {
      setTimeout(resolve, 20);
    });

    expect(rejection).toBe(abortController.signal.reason);
  });

  it('closes the client synchronously when the signal aborts while connecting', async () => {
    const abortController: AbortController = new AbortController();
    const client: MqttClient = createClientMock();
    connectMock.mockReturnValue(client); // never emits 'connect'

    const clientPromise: Promise<MqttClient> = openMqttClient(
      abortController.signal,
      'mqtt://localhost',
    );

    abortController.abort();
    await expect(clientPromise).rejects.toThrow();

    expect(client.end).toHaveBeenCalledExactlyOnceWith(true);
  });
});
