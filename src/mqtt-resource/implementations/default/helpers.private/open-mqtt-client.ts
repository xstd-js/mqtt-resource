import mqtt, { type MqttClient } from 'mqtt';
import type { MqttResourceOpenOptions } from '../../../abilities/open/mqtt-resource-open-options.ts';

/**
 * Opens an `mqtt` client and waits for its CONNACK, mirroring `mqtt.connectAsync` semantics
 * (a premature 'close' or 'error' rejects), but abortable: when `signal` aborts, the socket
 * is destroyed synchronously instead of waiting for the connect to settle.
 */
export function openMqttClient(
  signal: AbortSignal | undefined,
  url: string,
  options?: MqttResourceOpenOptions,
): Promise<MqttClient> {
  signal?.throwIfAborted();

  const client: MqttClient = mqtt.connect(url, {
    ...options,
    reconnectPeriod: 0,
    autoUseTopicAlias: true,
    autoAssignTopicAlias: true,
  });

  return new Promise<MqttClient>(
    (resolve: (client: MqttClient) => void, reject: (reason: unknown) => void): void => {
      const removeListeners = (): void => {
        client.off('connect', onConnect);
        client.off('error', onError);
        client.off('close', onClose);
        client.off('end', onEnd);
        signal?.removeEventListener('abort', onAbort);
      };
      const settleWithClient = (): void => {
        removeListeners();
        resolve(client);
      };
      const onConnect = settleWithClient;
      const onEnd = settleWithClient;
      const onError = (error: unknown): void => {
        removeListeners();
        client.end(true);
        reject(error);
      };
      const onClose = (): void => {
        removeListeners();
        client.end(true);
        reject(new Error("Couldn't connect to server"));
      };
      const onAbort = (): void => {
        removeListeners();
        client.end(true);
        reject(signal?.reason);
      };

      signal?.addEventListener('abort', onAbort);
      client.on('connect', onConnect);
      client.on('error', onError);
      client.on('close', onClose);
      client.on('end', onEnd);
    },
  );
}
