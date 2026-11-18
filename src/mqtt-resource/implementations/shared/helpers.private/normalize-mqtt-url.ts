const DEFAULT_PORTS: ReadonlyMap<string, string> = new Map<string, string>([
  ['mqtt:', '1883'],
  ['mqtts:', '8883'],
  ['ws:', '80'],
  ['wss:', '443'],
]);

/**
 * Normalizes an MQTT broker url so that equivalent urls share the same connection key:
 * lowercases the host, removes the explicit default port of the protocol, and
 * canonicalizes the path.
 */
export function normalizeMqttUrl(url: string): string {
  const parsed: URL = new URL(url);
  if (DEFAULT_PORTS.get(parsed.protocol) === parsed.port) {
    parsed.port = '';
  }
  // unlike special schemes (ws, wss...), non-special schemes (mqtt, mqtts...) do not
  // lowercase the hostname nor serialize an empty path with a trailing slash:
  // canonicalize both for consistency.
  parsed.hostname = parsed.hostname.toLowerCase();
  if (parsed.pathname === '') {
    parsed.pathname = '/';
  }
  return parsed.toString();
}
