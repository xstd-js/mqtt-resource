import type { HavingMqttResourceOpenAbility } from './abilities/open/having-mqtt-resource-open-ability.ts';
import type { HavingMqttResourceAbilities } from './having-mqtt-resource-abilities.ts';

export type HavingMqttResourceStaticAbilities<GMqttResource extends HavingMqttResourceAbilities> =
  HavingMqttResourceOpenAbility<GMqttResource>;
