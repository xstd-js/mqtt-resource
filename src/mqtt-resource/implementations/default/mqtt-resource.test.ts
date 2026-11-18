import { NEVER_ABORTED } from '@xstd/abortable';
import { CompleteError } from '@xstd/custom-error';
import { type ISubscriptionGrant, type MqttClient } from 'mqtt';
import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';

import { MqttSubscriptionResource } from '../../../mqtt-subscription-resource/mqtt-subscription-resource.ts';
import { MqttResource } from './mqtt-resource.ts';

const connectMock = vi.hoisted(() => vi.fn());

vi.mock('mqtt', () => {
  return { default: { connect: connectMock } };
});

function createClientMock(): MqttClient {
  const client: MqttClient = new EventEmitter() as unknown as MqttClient;
  Object.assign(client, {
    connected: true,
    // NOTE: `setMaxListeners` is intentionally NOT stubbed: the real EventEmitter
    // implementation must be used so that the production cap actually applies.
    end: vi.fn((): MqttClient => client),
    endAsync: vi.fn(async (): Promise<void> => undefined),
    publishAsync: vi.fn(async (): Promise<void> => undefined),
    subscribeAsync: vi.fn(async (topic: string): Promise<ISubscriptionGrant[]> => [
      { topic, qos: 0 },
    ]),
    unsubscribeAsync: vi.fn(async (): Promise<undefined> => undefined),
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

describe('MqttResource', () => {
  it('publishes and closes', async () => {
    const client: MqttClient = createClientMock();
    mockOpenClient(client);

    const resource: MqttResource = await MqttResource.open.call(NEVER_ABORTED, 'mqtt://localhost');

    resource.throwIfClosed();

    await resource.publish.call(NEVER_ABORTED, 'test/topic', 'hello');

    expect(client.publishAsync).toHaveBeenCalledExactlyOnceWith('test/topic', 'hello', undefined);

    await resource.close(new CompleteError());

    await resource.closed;
    expect(client.endAsync).toHaveBeenCalledExactlyOnceWith();
  });

  it('publishes uint8array payloads unchanged', async () => {
    const client: MqttClient = createClientMock();
    mockOpenClient(client);

    const resource: MqttResource = await MqttResource.open.call(NEVER_ABORTED, 'mqtt://localhost');

    const payload: Uint8Array = new Uint8Array([1, 2, 3]);
    await resource.publish.call(NEVER_ABORTED, 'test/topic', payload);

    // mqtt.js types the message as `string | Buffer`, but mqtt-packet serializes any
    // Uint8Array: the payload is passed through without copy.
    expect(vi.mocked(client.publishAsync).mock.calls[0]?.[1]).toBe(payload);

    await resource.close(new CompleteError());
  });

  it('publishes mqtt v5 properties unchanged', async () => {
    const client: MqttClient = createClientMock();
    mockOpenClient(client);

    const resource: MqttResource = await MqttResource.open.call(NEVER_ABORTED, 'mqtt://localhost');

    const correlationData: Uint8Array = new Uint8Array([1, 2, 3]);
    await resource.publish.call(NEVER_ABORTED, 'test/topic', 'hello', {
      qos: 1,
      properties: {
        payloadFormatIndicator: true,
        responseTopic: 'test/response',
        correlationData,
        userProperties: { source: 'sensor' },
      },
    });

    // the properties are passed through to the native client as-is
    expect(client.publishAsync).toHaveBeenCalledExactlyOnceWith('test/topic', 'hello', {
      qos: 1,
      properties: {
        payloadFormatIndicator: true,
        responseTopic: 'test/response',
        correlationData,
        userProperties: { source: 'sensor' },
      },
    });

    await resource.close(new CompleteError());
  });

  it('does not emit MaxListenersExceededWarning with many subscriptions', async () => {
    const previousMaintainAlive: number = MqttSubscriptionResource.maintainAlive;
    MqttSubscriptionResource.maintainAlive = 0;
    const warnings: Error[] = [];
    const onWarning = (warning: Error): void => {
      warnings.push(warning);
    };
    process.on('warning', onWarning);
    try {
      const client: MqttClient = createClientMock();
      mockOpenClient(client);

      const resource: MqttResource = await MqttResource.open.call(
        NEVER_ABORTED,
        'mqtt://localhost',
      );

      const listeners = await Promise.all(
        Array.from({ length: 25 }, (_: unknown, index: number): Promise<unknown> => {
          return resource.subscribe.call(NEVER_ABORTED, `test/topic-${index}`);
        }),
      );

      // process warnings are emitted asynchronously
      await new Promise<void>((resolve: () => void): void => {
        setTimeout(resolve, 20);
      });

      expect(
        warnings.filter((warning: Error): boolean => {
          return warning.name === 'MaxListenersExceededWarning';
        }),
      ).toEqual([]);

      await Promise.all(
        listeners.map((listener: unknown): Promise<void> => {
          return (listener as { close(): Promise<void> }).close();
        }),
      );
      await resource.close(new CompleteError());
    } finally {
      process.off('warning', onWarning);
      MqttSubscriptionResource.maintainAlive = previousMaintainAlive;
    }
  });

  it('closes when the client emits close (clean connection loss)', async () => {
    const client: MqttClient = createClientMock();
    mockOpenClient(client);

    const resource: MqttResource = await MqttResource.open.call(NEVER_ABORTED, 'mqtt://localhost');

    // a clean TCP disconnection emits only 'close': no 'error', 'disconnect' nor 'end'
    client.emit('close');

    await resource.closed;
    expect(client.endAsync).toHaveBeenCalledExactlyOnceWith();
  });

  it('closes the client when it is not connected after the connect', async () => {
    const client: MqttClient = createClientMock();
    client.connected = false;
    connectMock.mockReturnValue(client); // never emits 'connect'

    const clientPromise: Promise<MqttResource> = MqttResource.open.call(
      NEVER_ABORTED,
      'mqtt://localhost',
    );

    // mirrors mqtt.js 'connectAsync' semantics: the wait resolves on 'end'
    client.emit('end');

    await expect(clientPromise).rejects.toThrow('MqttClient not open.');
    expect(client.endAsync).toHaveBeenCalledExactlyOnceWith();
  });

  it('rejects with the abort reason when the socket errors during the teardown of an aborted open', async () => {
    const abortController: AbortController = new AbortController();
    const client: MqttClient = createClientMock();
    client.endAsync = vi.fn(async (): Promise<void> => {
      // a socket error emitted while no 'error' listener is attached would throw uncaught
      client.emit('error', new Error('socket error during teardown'));
    });
    connectMock.mockReturnValue(client); // never emits 'connect' by itself

    const clientPromise: Promise<MqttResource> = MqttResource.open.call(
      abortController.signal,
      'mqtt://localhost',
    );

    // resolves the wait, then aborts before the open continuation runs: the open must
    // tear the client down
    client.emit('connect', { cmd: 'connack', sessionPresent: false });
    abortController.abort();

    await expect(clientPromise).rejects.toBe(abortController.signal.reason);
  });

  it('does not produce unhandled rejections when an event-triggered close fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((): void => {});
    const client: MqttClient = createClientMock();
    client.endAsync = vi.fn(async (): Promise<void> => {
      throw new Error('end failed');
    });
    mockOpenClient(client);

    await MqttResource.open.call(NEVER_ABORTED, 'mqtt://localhost');

    const unhandledRejections: unknown[] = [];
    const onUnhandledRejection = (reason: unknown): void => {
      unhandledRejections.push(reason);
    };
    process.on('unhandledRejection', onUnhandledRejection);
    try {
      // triggers the close through the client 'error' event handler
      client.emit('error', new Error('client error'));

      await new Promise<void>((resolve: () => void): void => {
        setTimeout(resolve, 20);
      });

      expect(unhandledRejections).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandledRejection);
      consoleErrorSpy.mockRestore();
    }
  });
});
