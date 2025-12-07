import { type HavingMaintainAliveOption } from '../../../../maintain-alive-option/having-maintain-alive-option.js';
import { type MqttQos } from '../../../../traits/types/mqtt-qos.js';

export interface MqttSubscriptionResourceOptions extends HavingMaintainAliveOption {
  readonly qos?: MqttQos;
  readonly noLocal?: boolean;
  readonly retainAsPublished?: boolean;
  readonly retainHandling?: 0 | 1 | 2;
}
