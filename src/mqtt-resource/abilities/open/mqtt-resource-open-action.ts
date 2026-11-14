import type { AsyncFunction } from '@xstd/async-function';
import type { HavingMqttResourceAbilities } from '../../having-mqtt-resource-abilities.ts';
import type { MqttResourceOpenArguments } from './mqtt-resource-open-arguments.ts';

export type MqttResourceOpenAction<GMqttResource extends HavingMqttResourceAbilities> =
  AsyncFunction<MqttResourceOpenArguments, GMqttResource>;
