import type { HavingMqttResourceOpenAbility } from './abilities/open/having-mqtt-resource-open-ability.ts';
import type { HavingMqttResourceAbilities } from './having-mqtt-resource-abilities.ts';

/**
 * The static abilities that a class whose instances implement {@link HavingMqttResourceAbilities}
 * must expose: the `open` action, creating instances from a broker url and options.
 *
 * `GMqttResource` is the concrete resource type created by `open`: it types the returned
 * instances with all their instance abilities.
 *
 * Intended as the public contract for `MqttResource`-like implementations (e.g.
 * `MqttResource` and `SharedMqttResource`): their static side is typed with this, so that
 * consumers open them the same way regardless of the implementation.
 */
export type HavingMqttResourceStaticAbilities<GMqttResource extends HavingMqttResourceAbilities> =
  HavingMqttResourceOpenAbility<GMqttResource>;
