import type { AsyncFunction } from '@xstd/async-function';
import type { MqttResourcePublishArguments } from './mqtt-resource-publish-arguments.ts';

export type MqttResourcePublishAction = AsyncFunction<MqttResourcePublishArguments, void>;
