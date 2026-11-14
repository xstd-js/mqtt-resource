import type { Resource } from '@xstd/resource';
import type { HavingMqttResourcePublishAbility } from './abilities/publish/having-mqtt-resource-publish-ability.ts';
import type { HavingMqttResourceSubscribeAbility } from './abilities/subscribe/having-mqtt-resource-subscribe-ability.ts';

export interface HavingMqttResourceAbilities
  extends Resource, HavingMqttResourcePublishAbility, HavingMqttResourceSubscribeAbility {}
