import type { AsyncFunction } from '@xstd/async-function';
import type { HavingMqttResourceAbilities } from '../../having-mqtt-resource-abilities.ts';
import type { MqttResourceOpenArguments } from './mqtt-resource-open-arguments.ts';

/**
 * The _open_ action of a MQTT resource: connects to a MQTT broker and resolves with a live
 * instance of `GMqttResource` managing the connection.
 *
 * Like any `AsyncFunction`, it is called with an `AbortSignal` first, aborting the establishment
 * of the connection only.
 *
 * @template GMqttResource - The concrete resource type created by the action.
 */
export type MqttResourceOpenAction<GMqttResource extends HavingMqttResourceAbilities> =
  AsyncFunction<MqttResourceOpenArguments, GMqttResource>;
