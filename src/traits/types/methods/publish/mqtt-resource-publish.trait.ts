import { type MqttResourcePublishOptions } from './mqtt-resource-publish-options.js';
import { type MqttResourcePublishPayload } from './mqtt-resource-publish.payload.js';

export interface MqttResourcePublishTrait {
  publish(
    topic: string,
    payload: MqttResourcePublishPayload,
    options: MqttResourcePublishOptions,
  ): Promise<void>;
}
