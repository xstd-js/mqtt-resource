import type { Resource } from '@xstd/resource';
import type { HavingMqttResourcePublishAbility } from './abilities/publish/having-mqtt-resource-publish-ability.ts';
import type { HavingMqttResourceSubscribeAbility } from './abilities/subscribe/having-mqtt-resource-subscribe-ability.ts';

/**
 * The abilities that a MQTT resource instance must expose: the _publish_ action and the
 * _subscribe_ stream, on top of the base `Resource` abilities.
 *
 * The static side of the implementations is typed with {@link HavingMqttResourceStaticAbilities}.
 */
export interface HavingMqttResourceAbilities
  extends Resource, HavingMqttResourcePublishAbility, HavingMqttResourceSubscribeAbility {}
