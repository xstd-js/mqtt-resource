import type { MqttClient } from 'mqtt';

/**
 * Swallows the errors emitted by an `mqtt` client being torn down: its `'error'` listeners
 * were removed, and an error emitted without any listener would throw uncaught.
 */
export function swallowMqttClientErrors(client: MqttClient): void {
  client.on('error', (): void => {});
}
