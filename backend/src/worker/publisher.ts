/**
 * Publicador SQS real (F02-T04).
 *
 * Implementa el puerto `JobQueuePublisher` que T01 dejó inyectado, para que T06
 * lo inyecte en `createApiApp()`. No se modifica `backend/src/api/**`: solo se
 * importa el tipo del contrato. El cliente apunta al emulador por
 * `AWS_ENDPOINT_URL` (transporte) y usa QueueUrls canónicas.
 */

import { SendMessageCommand, type SQSClient } from '@aws-sdk/client-sqs';

import type { JobConfirmationMessage, JobQueuePublisher } from '../api/publisher';
import type { AppConfig } from '../config/index';
import type { DeadLetterMessage, JobQueueMessage } from './messages';
import { createSqsClientFromConfig } from './sqs-client';

export interface SqsPublisherOptions {
  readonly sqs: SQSClient;
  readonly queueUrl: string;
  readonly dlqUrl: string;
}

/**
 * Implementación concreta del puerto. `publish` respeta el mensaje mínimo de
 * T01; `publishJob` y `publishToDeadLetter` son extensiones retrocompatibles
 * que T06 puede usar para el sobre enriquecido y la DLQ.
 */
export class SqsJobQueuePublisher implements JobQueuePublisher {
  private readonly sqs: SQSClient;
  private readonly queueUrl: string;
  private readonly dlqUrl: string;

  constructor(options: SqsPublisherOptions) {
    this.sqs = options.sqs;
    this.queueUrl = options.queueUrl;
    this.dlqUrl = options.dlqUrl;
  }

  async publish(message: JobConfirmationMessage): Promise<void> {
    await this.sqs.send(
      new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify({ userId: message.userId, jobId: message.jobId }),
      }),
    );
  }

  async publishJob(message: JobQueueMessage): Promise<void> {
    await this.sqs.send(
      new SendMessageCommand({ QueueUrl: this.queueUrl, MessageBody: JSON.stringify(message) }),
    );
  }

  async publishToDeadLetter(message: DeadLetterMessage): Promise<void> {
    await this.sqs.send(
      new SendMessageCommand({ QueueUrl: this.dlqUrl, MessageBody: JSON.stringify(message) }),
    );
  }
}

/** Fábrica lista para inyectar en `createApiApp()` desde T06. */
export function createJobQueuePublisherFromConfig(config: AppConfig): SqsJobQueuePublisher {
  return new SqsJobQueuePublisher({
    sqs: createSqsClientFromConfig(config),
    queueUrl: config.resources.sqsQueueUrl,
    dlqUrl: config.resources.sqsDlqUrl,
  });
}
