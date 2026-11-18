import type { MqttResourcePublishAction } from './mqtt-resource-publish-action.ts';

/**
 * The _publish_ ability of a MQTT resource instance.
 */
export interface HavingMqttResourcePublishAbility {
  /** Publishes a message on the broker. */
  readonly publish: MqttResourcePublishAction;
}
