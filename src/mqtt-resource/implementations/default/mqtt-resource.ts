import { abortify } from '@xstd/abortable';
import { CompleteError } from '@xstd/custom-error';
import { CloseStack, Resource } from '@xstd/resource';
import mqtt, { type IDisconnectPacket, type MqttClient } from 'mqtt';

import { AsyncFunction } from '@xstd/async-function';
import { newMqttSubscriptionResource } from '../../../mqtt-subscription-resource/helpers.private/mqtt-subscription-resource-context.ts';
import { type MqttResourceOpenOptions } from '../../abilities/open/mqtt-resource-open-options.ts';
import type { MqttResourcePublishAction } from '../../abilities/publish/mqtt-resource-publish-action.ts';
import { type MqttResourcePublishOptions } from '../../abilities/publish/mqtt-resource-publish-options.ts';
import { type MqttResourcePublishPayload } from '../../abilities/publish/mqtt-resource-publish-payload.ts';
import type { MqttResourceSubscribeStream } from '../../abilities/subscribe/mqtt-resource-subscribe-stream.ts';
import { type HavingMqttResourceAbilities } from '../../having-mqtt-resource-abilities.ts';
import { setMqttResourceClient } from './mqtt-resource.internals.private.ts';

export class MqttResource extends Resource implements HavingMqttResourceAbilities {
  static async open(
    url: string | URL,
    { signal, ...options }: MqttResourceOpenOptions = {},
  ): Promise<MqttResource> {
    signal?.throwIfAborted();

    const client: MqttClient = await mqtt.connectAsync(url.toString(), {
      ...options,
      reconnectPeriod: 0,
      autoUseTopicAlias: true,
      autoAssignTopicAlias: true,
    });

    // TODO
    client.setMaxListeners(20);
    // client.setMaxListeners(50);

    if (signal?.aborted) {
      await client.endAsync();
      throw signal.reason;
    }

    return new MqttResource(client);
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

    setMqttResourceClient(this, client);

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
      ) => {
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
      client: this,
      nativeClient: this.#client,
    });
  }

  get publish(): MqttResourcePublishAction {
    return this.#publish;
  }

  get subscribe(): MqttResourceSubscribeStream {
    return this.#subscribe;
  }

  // subscribe(
  //   topic: string,
  //   { signal, ...options }: MqttResourceSubscribeOptions = {},
  // ): Promise<MqttSubscriptionResource> {
  //   return this.#closeStack.runTask(
  //     async (signal: AbortSignal): Promise<MqttSubscriptionResource> => {
  //       return this.#closeStack.adoptResource(
  //         await MqttSubscriptionResource.open(this, topic, {
  //           ...options,
  //           signal,
  //         }),
  //       );
  //     },
  //     { signal },
  //   );
  // }
}
