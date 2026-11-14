import type { EventHandler } from './event-handler.ts';
import type { TypedEventEmitter } from './typed-event-emitter.ts';

// export type InferTypedEventEvents<GTarget extends TypedEventEmitter<any>> =
//   GTarget extends TypedEventEmitter<infer TEvents> ? TEvents : never;

export function listenTypedEventEmitter<
  TEvents extends Record<keyof TEvents, EventHandler>,
  TEvent extends keyof TEvents,
>(target: TypedEventEmitter<TEvents>, event: TEvent, callback: TEvents[TEvent]): Disposable {
  target.on<TEvent>(event, callback);

  return {
    [Symbol.dispose](): void {
      target.off<TEvent>(event, callback);
    },
  };
}

// export function listenTypedEventEmitter<
//   GTarget extends TypedEventEmitter<any>,
//   TEvent extends InferTypedEventEvents<GTarget>,
// >(target: GTarget, event: TEvent, callback: InferTypedEventEvents<GTarget>[TEvent]): Disposable {
//   target.on<TEvent>(event, callback);
//
//   return {
//     [Symbol.dispose](): void {
//       target.off<TEvent>(event, callback);
//     },
//   };
// }
