import { type MqttClient } from 'mqtt';
import { type MqttResource } from './mqtt-resource.js';

const MQTT_RESOURCE_CLIENT_MAP = new WeakMap<MqttResource, MqttClient>();

export function setMqttResourceClient(mqttResource: MqttResource, mqttClient: MqttClient): void {
  if (MQTT_RESOURCE_CLIENT_MAP.has(mqttResource)) {
    throw new Error('MQTT client already set');
  }
  MQTT_RESOURCE_CLIENT_MAP.set(mqttResource, mqttClient);
}

export function getMqttResourceClient(mqttResource: MqttResource): MqttClient {
  if (!MQTT_RESOURCE_CLIENT_MAP.has(mqttResource)) {
    throw new Error('MQTT client not set');
  }
  return MQTT_RESOURCE_CLIENT_MAP.get(mqttResource)!;
}
