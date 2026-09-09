import type { EventHandler } from './event-handler.ts';
import type { TypedEventEmitter } from './typed-event-emitter.ts';

export function addTypedEventEmitterListener<
  GEvents extends Record<keyof GEvents, EventHandler>,
  GEvent extends keyof GEvents,
>(
  target: TypedEventEmitter<GEvents>,
  event: GEvent,
  callback: GEvents[GEvent],
  signal: AbortSignal,
): void {
  if (signal.aborted) {
    return;
  }
  target.on<GEvent>(event, callback);

  signal.addEventListener(
    'abort',
    (): void => {
      target.off<GEvent>(event, callback);
    },
    {
      once: true,
    },
  );
}
