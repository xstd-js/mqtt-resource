import type { AsyncFunction } from '@xstd/async-function';
import type { MqttResourcePublishArguments } from './mqtt-resource-publish-arguments.ts';

/**
 * The _publish_ action of a MQTT resource: sends a message to the broker on the given topic.
 *
 * Resolves once the message is handed over to the broker, according to the requested QoS.
 * Like any `AsyncFunction`, it is called with an `AbortSignal` first, aborting the publication.
 */
export type MqttResourcePublishAction = AsyncFunction<MqttResourcePublishArguments, void>;
