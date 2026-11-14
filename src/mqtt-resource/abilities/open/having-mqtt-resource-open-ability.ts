import { type HavingMqttResourceAbilities } from '../../having-mqtt-resource-abilities.ts';
import type { MqttResourceOpenAction } from './mqtt-resource-open-action.ts';

export interface HavingMqttResourceOpenAbility<GMqttResource extends HavingMqttResourceAbilities> {
  readonly open: MqttResourceOpenAction<GMqttResource>;
}
