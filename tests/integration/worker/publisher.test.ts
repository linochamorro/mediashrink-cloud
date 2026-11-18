/**
 * Integración real del publicador SQS (F02-T04): implementación concreta del
 * puerto `JobQueuePublisher` que T01 dejó inyectado, sobre QueueUrls canónicas
 * con `AWS_ENDPOINT_URL` como transporte y credenciales `fromIni`.
 */

import { afterEach, describe, expect, it } from 'vitest';

import { ReceiveMessageCommand } from '@aws-sdk/client-sqs';

import type { JobQueuePublisher } from '../../../backend/src/api/publisher';
import { loadConfig } from '../../../backend/src/config/index';
import { schemas } from '../../../backend/src/contracts/index';
import {
  createJobQueuePublisherFromConfig,
  createSqsClient,
  createSqsClientFromConfig,
  SqsJobQueuePublisher,
} from '../../../backend/src/worker/index';
import { testEnv } from '../../unit/worker/fixtures';
import { createTestQueues, type TestQueues } from './sqs-fixture';

const disposables: TestQueues[] = [];

async function queues(): Promise<TestQueues> {
  const created = await createTestQueues('pub');
  disposables.push(created);
  return created;
}

afterEach(async () => {
  while (disposables.length > 0) {
    await disposables.pop()!.dispose();
  }
});

async function receive(q: TestQueues, url = q.queueUrl): Promise<Record<string, unknown>[]> {
  const result = await q.sqs.send(
    new ReceiveMessageCommand({ QueueUrl: url, MaxNumberOfMessages: 10, WaitTimeSeconds: 0 }),
  );
  return (result.Messages ?? []).map((message) => JSON.parse(message.Body ?? '{}'));
}

describe('publicador SQS y cliente del consumidor (F02-T04)', () => {
  it('createSqsClient habla con el emulador usando QueueUrl canónica y fromIni', async () => {
    const q = await queues();
    const config = loadConfig(
      testEnv({ SQS_QUEUE_URL: q.queueUrl, SQS_DLQ_URL: q.dlqUrl }),
    );
    const sqs = createSqsClient({
      region: config.aws.region,
      endpointUrl: config.aws.endpointUrl,
      sharedCredentialsFile: config.aws.sharedCredentialsFile,
      configFile: config.aws.configFile,
      caBundlePath: config.aws.caBundlePath,
      useSsl: config.aws.useSsl,
    });
    const { SendMessageCommand } = await import('@aws-sdk/client-sqs');
    await sqs.send(new SendMessageCommand({ QueueUrl: q.queueUrl, MessageBody: '{"probe":1}' }));
    await expect(receive(q)).resolves.toEqual([{ probe: 1 }]);
    sqs.destroy();
  });

  it('createSqsClientFromConfig usa la configuración validada y url canónica', async () => {
    const q = await queues();
    const config = loadConfig(
      testEnv({ SQS_QUEUE_URL: q.queueUrl, SQS_DLQ_URL: q.dlqUrl }),
    );
    const sqs = createSqsClientFromConfig(config);
    expect(sqs).toBeDefined();
    sqs.destroy();

    // El contrato canónico rechaza :9324 y el host del endpoint en la QueueUrl.
    expect(
      schemas.AwsTransport.safeParse({
        region: config.aws.region,
        accountId: config.aws.accountId,
        endpointUrl: config.aws.endpointUrl,
        queueUrl: config.resources.sqsQueueUrl,
        dlqUrl: config.resources.sqsDlqUrl,
      }).success,
    ).toBe(true);
  });

  it('publish() envía el mensaje mínimo { userId, jobId } del puerto de T01', async () => {
    const q = await queues();
    const publisher: JobQueuePublisher = new SqsJobQueuePublisher({
      sqs: q.sqs,
      queueUrl: q.queueUrl,
      dlqUrl: q.dlqUrl,
    });
    await publisher.publish({ userId: 'user-1', jobId: 'job-1' });
    expect(await receive(q)).toEqual([{ userId: 'user-1', jobId: 'job-1' }]);
  });

  it('publishJob() envía el sobre enriquecido que consume el worker', async () => {
    const q = await queues();
    const publisher = new SqsJobQueuePublisher({
      sqs: q.sqs,
      queueUrl: q.queueUrl,
      dlqUrl: q.dlqUrl,
    });
    await publisher.publishJob({
      userId: 'user-2',
      jobId: 'job-2',
      images: [{ imageId: 'img-1', contentBase64: 'AQID', mimeType: 'image/jpeg' }],
    });
    const messages = await receive(q);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      userId: 'user-2',
      jobId: 'job-2',
      images: [{ imageId: 'img-1', contentBase64: 'AQID' }],
    });
  });

  it('publishToDeadLetter() y createJobQueuePublisherFromConfig() usan la DLQ canónica', async () => {
    const q = await queues();
    const config = loadConfig(
      testEnv({ SQS_QUEUE_URL: q.queueUrl, SQS_DLQ_URL: q.dlqUrl }),
    );
    const publisher = createJobQueuePublisherFromConfig(config);
    await publisher.publishToDeadLetter({
      userId: 'user-3',
      jobId: 'job-3',
      imageId: 'img-3',
      attempts: 3,
      reasonCode: 'RENDER_FAILED',
      failureReason: 'No se pudo procesar la imagen con sharp',
    });
    const letters = await receive(q, q.dlqUrl);
    expect(letters).toHaveLength(1);
    expect(letters[0]).toMatchObject({
      userId: 'user-3',
      jobId: 'job-3',
      imageId: 'img-3',
      attempts: 3,
      reasonCode: 'RENDER_FAILED',
    });
    // La cola principal permanece intacta.
    expect(await receive(q)).toHaveLength(0);
  });
});
