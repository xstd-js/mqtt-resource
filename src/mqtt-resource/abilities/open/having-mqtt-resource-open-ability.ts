import { type HavingMqttResourceAbilities } from '../../having-mqtt-resource-abilities.ts';
import type { MqttResourceOpenAction } from './mqtt-resource-open-action.ts';

/**
 * The _open_ ability of a MQTT resource: the static `open` action exposed by implementations
 * (their static side being typed by `HavingMqttResourceStaticAbilities`).
 *
 * @template GMqttResource - The concrete resource type created by the `open` action.
 */
export interface HavingMqttResourceOpenAbility<GMqttResource extends HavingMqttResourceAbilities> {
  /** Opens a connection to a MQTT broker, resolving with a new {@link GMqttResource} instance. */
  readonly open: MqttResourceOpenAction<GMqttResource>;
}
