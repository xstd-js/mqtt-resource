import type { MqttResourcePublishAction } from './mqtt-resource-publish-action.ts';

export interface HavingMqttResourcePublishAbility {
  readonly publish: MqttResourcePublishAction;
}
