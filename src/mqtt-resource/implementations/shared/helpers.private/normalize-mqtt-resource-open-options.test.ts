import { describe, expect, it } from 'vitest';

import { normalizeMqttResourceOpenOptions } from './normalize-mqtt-resource-open-options.ts';

describe('normalizeMqttResourceOpenOptions', () => {
  it.each([
    {
      url: 'mqtt://localhost',
      options: {},
      normalizedUrl: 'mqtt://localhost/',
      username: undefined,
      password: undefined,
    },
    {
      url: 'mqtt://localhost/',
      options: {},
      normalizedUrl: 'mqtt://localhost/',
      username: undefined,
      password: undefined,
    },
    {
      url: 'mqtt://localhost:1883',
      options: {},
      normalizedUrl: 'mqtt://localhost/',
      username: undefined,
      password: undefined,
    },
    {
      url: 'mqtt://LOCALHOST',
      options: {},
      normalizedUrl: 'mqtt://localhost/',
      username: undefined,
      password: undefined,
    },
    {
      url: 'mqtts://localhost',
      options: {},
      normalizedUrl: 'mqtts://localhost/',
      username: undefined,
      password: undefined,
    },
    {
      url: 'mqtts://localhost:8883',
      options: {},
      normalizedUrl: 'mqtts://localhost/',
      username: undefined,
      password: undefined,
    },
    {
      url: 'ws://localhost',
      options: {},
      normalizedUrl: 'ws://localhost/',
      username: undefined,
      password: undefined,
    },
    {
      url: 'wss://localhost:443',
      options: {},
      normalizedUrl: 'wss://localhost/',
      username: undefined,
      password: undefined,
    },
    {
      url: 'mqtt://localhost:1884',
      options: {},
      normalizedUrl: 'mqtt://localhost:1884/',
      username: undefined,
      password: undefined,
    },
    {
      url: 'mqtt://localhost:1883/test/path',
      options: {},
      normalizedUrl: 'mqtt://localhost/test/path',
      username: undefined,
      password: undefined,
    },
    {
      url: 'mqtt://user:secret@localhost',
      options: {},
      normalizedUrl: 'mqtt://localhost/',
      username: 'user',
      password: 'secret',
    },
    {
      url: 'mqtt://user@localhost',
      options: {},
      normalizedUrl: 'mqtt://localhost/',
      username: 'user',
      password: undefined,
    },
    {
      url: 'mqtt://localhost',
      options: { username: 'user', password: 'secret' },
      normalizedUrl: 'mqtt://localhost/',
      username: 'user',
      password: 'secret',
    },
    {
      url: 'mqtt://urluser:urlsecret@localhost',
      options: { username: 'optuser', password: 'optsecret' },
      normalizedUrl: 'mqtt://localhost/',
      username: 'urluser',
      password: 'urlsecret',
    },
    {
      url: 'mqtt://user@localhost',
      options: { password: 'optsecret' },
      normalizedUrl: 'mqtt://localhost/',
      username: 'user',
      password: 'optsecret',
    },
  ])(
    'normalizes $url (credentials from url take precedence)',
    ({ url, options, normalizedUrl, username, password }): void => {
      const normalized = normalizeMqttResourceOpenOptions(url, options);

      expect(normalized.url).toBe(normalizedUrl);
      expect(normalized.options.username).toBe(username);
      expect(normalized.options.password).toBe(password);
    },
  );

  it('passes the client id through', (): void => {
    const normalized = normalizeMqttResourceOpenOptions('mqtt://localhost', { clientId: 'client' });

    expect(normalized.url).toBe('mqtt://localhost/');
    expect(normalized.options.clientId).toBe('client');
  });
});
