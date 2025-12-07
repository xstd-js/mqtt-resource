import { type Abortable } from '@xstd/abortable';

export interface MqttResourceOpenOptions extends Abortable {
  readonly clientId?: string;
  readonly username?: string;
  readonly password?: string;

  // readonly keepalive?: number;
  // readonly clean?: boolean;
}
