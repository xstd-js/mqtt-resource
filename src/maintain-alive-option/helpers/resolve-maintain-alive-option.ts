import { type MaintainAliveOption } from '../maintain-alive-option.js';

export function resolveMaintainAliveOption(input: MaintainAliveOption): number {
  return typeof input === 'number' ? input : input();
}
