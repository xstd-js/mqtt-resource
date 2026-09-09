import { type MqttResourcePublishOptions } from './mqtt-resource-publish-options.ts';
import { type MqttResourcePublishPayload } from './mqtt-resource-publish.payload.ts';

export interface MqttResourcePublishTrait {
  publish(
    topic: string,
    payload: MqttResourcePublishPayload,
    options: MqttResourcePublishOptions,
  ): Promise<void>;
}
