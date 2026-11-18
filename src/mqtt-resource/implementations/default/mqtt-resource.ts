import { abortify } from '@xstd/abortable';
import { AsyncFunction } from '@xstd/async-function';
import { CompleteError } from '@xstd/custom-error';
import { CloseStack, Resource } from '@xstd/resource';
import { type IDisconnectPacket, type MqttClient } from 'mqtt';
import { newMqttSubscriptionResource } from '../../../mqtt-subscription-resource/helpers.private/mqtt-subscription-resource-context.ts';
import type { MqttResourceOpenAction } from '../../abilities/open/mqtt-resource-open-action.ts';
import type { MqttResourceOpenArguments } from '../../abilities/open/mqtt-resource-open-arguments.ts';
import type { MqttResourceOpenOptions } from '../../abilities/open/mqtt-resource-open-options.ts';
import type { MqttResourcePublishAction } from '../../abilities/publish/mqtt-resource-publish-action.ts';
import type { MqttResourcePublishOptions } from '../../abilities/publish/mqtt-resource-publish-options.ts';
import type { MqttResourcePublishPayload } from '../../abilities/publish/mqtt-resource-publish-payload.ts';
import type { MqttResourceSubscribeStream } from '../../abilities/subscribe/mqtt-resource-subscribe-stream.ts';
import type { HavingMqttResourceAbilities } from '../../having-mqtt-resource-abilities.ts';
import { openMqttClient } from './helpers.private/open-mqtt-client.ts';

export class MqttResource extends Resource implements HavingMqttResourceAbilities {
  static #open: MqttResourceOpenAction<MqttResource> = new AsyncFunction<
    MqttResourceOpenArguments,
    MqttResource
  >(
    async (
      signal: AbortSignal,
      url: string | URL,
      options?: MqttResourceOpenOptions,
    ): Promise<MqttResource> => {
      signal?.throwIfAborted();

      const client: MqttClient = await openMqttClient(signal, url.toString(), options);

      // One 'message' listener is registered per active subscription; their lifecycle is
      // managed by the subscription resources, so no arbitrary cap must apply.
      client.setMaxListeners(0);

      if (signal?.aborted) {
        await client.endAsync();
        throw signal.reason;
      }

      if (!client.connected) {
        await client.endAsync();
        throw new Error('MqttClient not open.');
      }

      return new MqttResource(client);
    },
  );

  static get open(): MqttResourceOpenAction<MqttResource> {
    return this.#open;
  }

  readonly #client: MqttClient;
  readonly #closeStack: CloseStack;

  readonly #publish: MqttResourcePublishAction;
  readonly #subscribe: MqttResourceSubscribeStream;

  private constructor(client: MqttClient) {
    super((reason: unknown): Promise<void> => {
      return this.#closeStack.close(reason);
    });

    this.#client = client;

    // Event-triggered closes may fail (e.g. 'endAsync' rejecting on an already dead
    // connection); their error is reported since no caller observes the close promise.
    const onClientDisconnect = (packet: IDisconnectPacket): void => {
      const reason: unknown =
        packet.reasonCode === undefined || packet.reasonCode === 0x00
          ? new CompleteError()
          : new Error('Disconnected', { cause: packet });
      void this.close(reason).catch(reportCloseError);
    };

    const onClientError = (error: unknown): void => {
      void this.close(error).catch(reportCloseError);
    };

    const onClientEnd = (): void => {
      void this.close(new Error('Client ended')).catch(reportCloseError);
    };

    // A clean TCP disconnection emits only 'close': no 'error', 'disconnect' nor 'end'.
    const onClientClose = (): void => {
      void this.close(new Error('Connection lost')).catch(reportCloseError);
    };

    this.#client.on('disconnect', onClientDisconnect);
    this.#client.on('error', onClientError);
    this.#client.on('end', onClientEnd);
    this.#client.on('close', onClientClose);

    this.closeSignal.addEventListener(
      'abort',
      (): void => {
        this.#client.off('disconnect', onClientDisconnect);
        this.#client.off('error', onClientError);
        this.#client.off('end', onClientEnd);
        this.#client.off('close', onClientClose);
      },
      {
        once: true,
      },
    );

    this.#closeStack = new CloseStack(this);

    this.#closeStack.addTeardown((): Promise<void> => {
      return this.#client.endAsync();
    });

    this.#publish = new AsyncFunction(
      (
        signal: AbortSignal,
        topic: string,
        payload: MqttResourcePublishPayload,
        options?: MqttResourcePublishOptions,
      ): Promise<void> => {
        return this.#closeStack.runTask(
          async (signal: AbortSignal): Promise<void> => {
            // NOTE: mqtt.js types the message as `string | Buffer`, but mqtt-packet
            // serializes any Uint8Array: the wider type is passed through intentionally.
            await abortify(this.#client.publishAsync(topic, payload as string | Buffer, options), {
              signal,
            });
          },
          { signal },
        );
      },
    );

    this.#subscribe = newMqttSubscriptionResource({
      nativeClient: this.#client,
      closeStack: this.#closeStack,
    });
  }

  get publish(): MqttResourcePublishAction {
    return this.#publish;
  }

  get subscribe(): MqttResourceSubscribeStream {
    return this.#subscribe;
  }
}

/* INTERNAL */

/**
 * Reports the error of a close operation triggered by a client event, which no
 * caller observes.
 */
function reportCloseError(error: unknown): void {
  (globalThis.reportError ?? console.error)(error);
}
