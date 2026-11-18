[![npm (scoped)](https://img.shields.io/npm/v/@xstd/mqtt-resource.svg)](https://www.npmjs.com/package/@xstd/mqtt-resource)
![npm](https://img.shields.io/npm/dm/@xstd/mqtt-resource.svg)
![NPM](https://img.shields.io/npm/l/@xstd/mqtt-resource.svg)
![npm type definitions](https://img.shields.io/npm/types/@xstd/mqtt-resource.svg)
![AI generation](https://img.shields.io/badge/AI_generation-medium-yellow)

<picture>
  <source height="64" media="(prefers-color-scheme: dark)" srcset="https://github.com/thingmate/website/blob/main/assets/logo/png/logo-large-dark.png?raw=true">
  <source height="64" media="(prefers-color-scheme: light)" srcset="https://github.com/thingmate/website/blob/main/assets/logo/png/logo-large-light.png?raw=true">
  <img height="64" alt="Shows a black logo in light color mode and a white one in dark color mode." src="https://github.com/thingmate/website/blob/main/assets/logo/png/logo-large-light.png?raw=true">
</picture>

## @xstd/mqtt-resource

An MQTT client based on the Resource primitive: publish and subscribe with abortable, shared connections

## 📦 Installation

```shell
yarn add @xstd/mqtt-resource
# or
npm install @xstd/mqtt-resource --save
```

## 🚀 Usage

```ts
import { MqttResource } from '@xstd/mqtt-resource';

const controller: AbortController = new AbortController();

// Open a connection to the broker (resolves once the CONNACK is received):
const resource: MqttResource = await MqttResource.open.call(
  controller.signal,
  'mqtt://localhost:1883',
);

// Subscribe to a topic filter, resolving with a live listener resource:
const subscription = await resource.subscribe.call(controller.signal, 'sensors/#');
subscription.listen((packet): void => console.log(packet.topic, packet.payload));

// Publish a message:
await resource.publish.call(controller.signal, 'sensors/temperature', '21.5');

// Close the connection (cascades to the subscriptions):
await resource.close();
```

## 📜 Documentation

This library exposes two implementations of the same contract:

- `MqttResource` — a connection to a MQTT broker, exposed as a `Resource` from [`@xstd/resource`](https://www.npmjs.com/package/@xstd/resource).
- `SharedMqttResource` — the same resource, sharing its connection between instances.

Every action follows the [`@xstd/async-function`](https://www.npmjs.com/package/@xstd/async-function) convention: it is called with a leading `AbortSignal`, through `.call(signal, ...args)`. The signal aborts the action's _establishment_ only: once the call resolved, the returned resource's lifetime is managed explicitly (`close()`, the async-disposal protocol `await using`, or `closesWith()`).

### 🏗️ Opening a connection

```ts
const resource: MqttResource = await MqttResource.open.call(
  controller.signal,
  'mqtt://localhost:1883',
  { clientId: 'my-client', username: 'admin', password: 'secret' },
);
```

- The url supports the `mqtt:`, `mqtts:`, `ws:` and `wss:` schemes. Credentials may be embedded in it (`mqtt://user:password@localhost`); they take precedence over the `username` and `password` options, mirroring mqtt.js.
- The call resolves once the connection is established. It rejects when the broker refuses the connection, when the connection dies while establishing, or when the provided signal aborts — in which case the socket is destroyed synchronously.
- Connections never auto-reconnect: when the connection dies, the resource closes. Opening again establishes a new connection.

### 📤 Publishing

```ts
await resource.publish.call(controller.signal, 'sensors/temperature', '21.5', {
  qos: 1,
  retain: true,
  properties: { contentType: 'text/plain' },
});
```

Resolves once the message is handed over to the broker, according to the requested QoS.

- `payload` — the message payload, as `string` or `Uint8Array`.
- `options.qos` — the QoS level to publish with. Defaults to `0`.
- `options.retain` — asks the broker to retain the message: future subscribers receive it upon subscription.
- `options.dup` — marks the publication as a duplicate of an earlier, unacknowledged delivery.
- `options.properties` — the MQTT 5 properties attached to the message.

### 📥 Subscribing

`subscribe` establishes a subscription and resolves with a live `ListenerResource` from [`@xstd/listener-resource`](https://www.npmjs.com/package/@xstd/listener-resource), emitting the received messages as `MqttPublishPacket`s. As it is an async iterable, the received packets are consumed with `for await...of`:

```ts
const subscription = await resource.subscribe.call(controller.signal, 'sensors/+/temperature', {
  qos: 1,
});

for await (const packet of subscription) {
  console.log(packet.topic, packet.payload, packet.qos, packet.retain, packet.properties);
}
```

- The topic filter supports the `+` and `#` wildcards.
- `options.qos`, `options.noLocal`, `options.retainAsPublished` and `options.retainHandling` map to the underlying SUBSCRIBE options.
- The loop throws with the close reason when the subscription closes (e.g. when the connection dies). An `AbortSignal` can stop it as well: `for await (const packet of subscription.values({ signal }))`.
- Breaking out of the loop only detaches the consumer: the subscription stays open. Unsubscribe explicitly with `await subscription.close()`.
- Messages received while the subscription is establishing are buffered until the iteration starts.
- With the default edge queueing policy, messages arriving while the consumer is busy processing the previous one are dropped: to observe every message, register a listener with `subscription.listen(...)` instead (see [`@xstd/listener-resource`](https://www.npmjs.com/package/@xstd/listener-resource)).

Each received `MqttPublishPacket` exposes:

- `topic` — the topic the message was published on.
- `payload` — the message payload, as raw bytes.
- `qos` — the QoS level the message was delivered with.
- `retain` — whether the message is a retained message delivered upon subscription.
- `properties` — the MQTT 5 properties attached to the message, when any.

### 💥 Lifecycle

Closing the resource ends the underlying connection, and cascades to its subscriptions:

```ts
await resource.close();

// or, with the async-disposal protocol:
await using resource = await MqttResource.open.call(controller.signal, 'mqtt://localhost:1883');
```

Conversely, the resource closes itself when the connection dies: a broker disconnection, an error, an end, or the socket closing. Observe it with `resource.closeSignal` (aborted with the close reason) and `resource.closed` (settled when the resource is fully closed).

### 🔗 Sharing connections with `SharedMqttResource`

```ts
import { SharedMqttResource } from '@xstd/mqtt-resource';

const resource: SharedMqttResource = await SharedMqttResource.open.call(
  controller.signal,
  'mqtt://localhost:1883',
);
```

`SharedMqttResource` instances opened with the same connection parameters — the normalized url (stripped of its credentials) and the `clientId`, `username` and `password` options — share the same underlying connection: an url with embedded credentials and an equivalent url using the options share the same connection.

The connection closes when the last sharer closes, after `SharedMqttResource.maintainAlive` milliseconds (default `1000`):

- `> 0` (default): the close runs in the background after this delay, and an open with the same parameters within the window reuses the live connection. Close failures are reported, not propagated.
- `<= 0`: the connection closes synchronously with the last sharer, and close failures propagate to it.

When the shared connection dies, every sharer closes; the next open establishes a new connection.

### 🔁 Sharing subscriptions

Listeners of the same resource opened on the same topic filter share the same underlying broker subscription:

- The options of the first listener are locked for the lifetime of the subscription: a listener opened with different options is rejected.
- With the default `retainHandling: 0`, retained messages are delivered on the first SUBSCRIBE only: listeners joining later do not receive them.
- The subscription is released when its last listener closes, after `MqttSubscriptionResource.maintainAlive` milliseconds (default `1000`): a listener opened within the window reuses the live subscription.
