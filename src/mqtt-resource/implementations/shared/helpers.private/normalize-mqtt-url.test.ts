import { describe, expect, it } from 'vitest';

import { normalizeMqttUrl } from './normalize-mqtt-url.ts';

describe('normalizeMqttUrl', () => {
  it.each([
    { url: 'mqtt://localhost', normalized: 'mqtt://localhost/' },
    { url: 'mqtt://localhost/', normalized: 'mqtt://localhost/' },
    { url: 'mqtt://localhost:1883', normalized: 'mqtt://localhost/' },
    { url: 'mqtt://LOCALHOST', normalized: 'mqtt://localhost/' },
    { url: 'mqtts://localhost', normalized: 'mqtts://localhost/' },
    { url: 'mqtts://localhost:8883', normalized: 'mqtts://localhost/' },
    { url: 'ws://localhost', normalized: 'ws://localhost/' },
    { url: 'wss://localhost:443', normalized: 'wss://localhost/' },
    { url: 'mqtt://localhost:1884', normalized: 'mqtt://localhost:1884/' },
    { url: 'mqtt://localhost:1883/test/path', normalized: 'mqtt://localhost/test/path' },
  ])('normalizes $url to $normalized', ({ url, normalized }): void => {
    expect(normalizeMqttUrl(url)).toBe(normalized);
  });
});
