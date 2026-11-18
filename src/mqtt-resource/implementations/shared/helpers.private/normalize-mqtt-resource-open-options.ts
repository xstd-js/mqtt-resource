import type { MqttResourceOpenOptions } from '../../../abilities/open/mqtt-resource-open-options.ts';

const DEFAULT_PORTS: ReadonlyMap<string, string> = new Map<string, string>([
  ['mqtt:', '1883'],
  ['mqtts:', '8883'],
  ['ws:', '80'],
  ['wss:', '443'],
]);

export interface NormalizedMqttResourceOpenOptions {
  /** The canonicalized url, stripped of its credentials. */
  readonly url: string;
  /** The options, with the credentials extracted from the url merged in. */
  readonly options: MqttResourceOpenOptions;
}

/**
 * Normalizes an MQTT resource open call so that equivalent opens share the same connection:
 * canonicalizes the url (lowercased host, explicit default port removed, path canonicalized,
 * credentials stripped) and extracts the credentials embedded in the url into the options,
 * where they take precedence over the `username` and `password` options (mirroring mqtt.js).
 */
export function normalizeMqttResourceOpenOptions(
  url: string | URL,
  { clientId, username, password }: MqttResourceOpenOptions = {},
): NormalizedMqttResourceOpenOptions {
  const parsedUrl: URL = new URL(url.toString());

  const effectiveUsername: string | undefined =
    parsedUrl.username !== '' ? parsedUrl.username : username;
  const effectivePassword: string | undefined =
    parsedUrl.password !== '' ? parsedUrl.password : password;

  // the credentials are part of the options now: they must not stay in the url.
  parsedUrl.username = '';
  parsedUrl.password = '';

  // unlike special schemes (ws, wss...), non-special schemes (mqtt, mqtts...) do not
  // lowercase the hostname nor serialize an empty path with a trailing slash:
  // canonicalize both for consistency.
  parsedUrl.hostname = parsedUrl.hostname.toLowerCase();
  if (parsedUrl.pathname === '') {
    parsedUrl.pathname = '/';
  }
  if (DEFAULT_PORTS.get(parsedUrl.protocol) === parsedUrl.port) {
    parsedUrl.port = '';
  }

  return {
    url: parsedUrl.toString(),
    options: { clientId, username: effectiveUsername, password: effectivePassword },
  };
}
