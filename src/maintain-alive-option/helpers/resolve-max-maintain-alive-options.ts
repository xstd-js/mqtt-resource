import { type MaintainAliveOption } from '../maintain-alive-option.js';
import { resolveMaintainAliveOption } from './resolve-maintain-alive-option.js';

export function resolveMaxMaintainAliveOptions(inputs: Iterable<MaintainAliveOption>): number {
  let max: number = 0;

  for (const input of inputs) {
    max = Math.max(max, resolveMaintainAliveOption(input));
  }

  return max;
}
