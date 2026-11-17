import { abortify } from '@xstd/abortable';
import { AsyncFunction } from '@xstd/async-function';
import { CompleteError } from '@xstd/custom-error';
import { CloseStack, Resource } from '@xstd/resource';
import mqtt, { type IDisconnectPacket, type MqttClient } from 'mqtt';
import { newMqttSubscriptionResource } from '../../../mqtt-subscription-resource/helpers.private/mqtt-subscription-resource-context.ts';
import type { MqttResourceOpenAction } from '../../abilities/open/mqtt-resource-open-action.ts';
import type { MqttResourceOpenArguments } from '../../abilities/open/mqtt-resource-open-arguments.ts';
import type { MqttResourceOpenOptions } from '../../abilities/open/mqtt-resource-open-options.ts';
import type { MqttResourcePublishAction } from '../../abilities/publish/mqtt-resource-publish-action.ts';
import type { MqttResourcePublishOptions } from '../../abilities/publish/mqtt-resource-publish-options.ts';
import type { MqttResourcePublishPayload } from '../../abilities/publish/mqtt-resource-publish-payload.ts';
import type { MqttResourceSubscribeStream } from '../../abilities/subscribe/mqtt-resource-subscribe-stream.ts';
import type { HavingMqttResourceAbilities } from '../../having-mqtt-resource-abilities.ts';

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

      const client: MqttClient = await mqtt.connectAsync(url.toString(), {
        ...options,
        reconnectPeriod: 0,
        autoUseTopicAlias: true,
        autoAssignTopicAlias: true,
      });

      client.setMaxListeners(20);
      // client.setMaxListeners(50);

      if (signal?.aborted) {
        await client.endAsync();
        throw signal.reason;
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

    if (!this.#client.connected) {
      throw new Error('MqttClient not open.');
    }

    const onClientDisconnect = (packet: IDisconnectPacket): void => {
      if (packet.reasonCode === undefined || packet.reasonCode === 0x00) {
        void this.close(new CompleteError());
      } else {
        void this.close(new Error('Disconnected', { cause: packet }));
      }
    };

    const onClientError = (error: unknown): void => {
      void this.close(error);
    };

    const onClientEnd = (): void => {
      void this.close(new Error('Client ended'));
    };

    this.#client.on('disconnect', onClientDisconnect);
    this.#client.on('error', onClientError);
    this.#client.on('end', onClientEnd);

    this.closeSignal.addEventListener(
      'abort',
      (): void => {
        this.#client.off('disconnect', onClientDisconnect);
        this.#client.off('error', onClientError);
        this.#client.off('end', onClientEnd);
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
            await abortify(this.#client.publishAsync(topic, payload as any, options), {
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
