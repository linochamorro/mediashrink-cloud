/**
 * Integración real del consumidor SQS + DLQ (F02-T04 / CA-04, FR-13, IN-08).
 *
 * Ejecuta contra `aws/aws-emulator`: cola + DLQ reales y tabla DynamoDB real.
 * Cubre reintentos, DLQ, fallo parcial, borrado del mensaje válido, ausencia de
 * duplicados y el uso obligatorio de `processImage` (guarda A-05 + strip real).
 */

import { afterEach, describe, expect, it } from 'vitest';

import {
  ReceiveMessageCommand,
  type Message,
  type SQSClient,
} from '@aws-sdk/client-sqs';

import { loadConfig, type AppConfig } from '../../../backend/src/config/index';
import type { Preset } from '../../../backend/src/contracts/index';
import { createJobStore, type JobStore } from '../../../backend/src/db/index';
import {
  drainQueue,
  handleJobMessage,
  processImage,
  SqsJobQueuePublisher,
  type ConsumeDependencies,
  type ImageProcessor,
} from '../../../backend/src/worker/index';
import { createTestTable, type TestTable } from '../db/table-fixture';
import { makeImage, makeJob } from '../db/factories';
import { createJpegWithMetadata, oversizedBuffer, testEnv } from '../../unit/worker/fixtures';
import { createTestBuckets, type TestBuckets } from '../api/presign-fixture';
import { createTestQueues, type TestQueues } from './sqs-fixture';

interface Context {
  readonly config: AppConfig;
  readonly tables: TestTable;
  readonly queues: TestQueues;
  readonly buckets: TestBuckets;
  readonly jobs: JobStore;
  readonly userId: string;
  readonly jobId: string;
}

const contexts: Context[] = [];

/** La fixture crea tabla + TTL + dos colas reales: el timeout por defecto (5 s) es insuficiente. */
const itIntegration = (name: string, fn: () => Promise<void>): void => {
  it(name, fn, 30_000);
};

async function setup(imageIds: readonly string[], status: 'PENDING' | 'PROCESSING' = 'PROCESSING'): Promise<Context> {
  const tables = await createTestTable('sqscons');
  const queues = await createTestQueues('cons');
  const buckets = await createTestBuckets('cons');
  const config = loadConfig(
    testEnv({
      SQS_QUEUE_URL: queues.queueUrl,
      SQS_DLQ_URL: queues.dlqUrl,
      DYNAMODB_TABLE_JOBS: tables.tableName,
      S3_BUCKET_RAW: buckets.rawBucket,
      S3_BUCKET_OPTIMIZED: buckets.optimizedBucket,
    }),
  );
  const jobs = createJobStore({ tableName: tables.tableName, client: tables.documentClient });
  const userId = `user-${imageIds.length}-${Date.now()}`;
  const jobId = `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await jobs.createJob(makeJob({ userId, jobId, status }));
  for (const imageId of imageIds) {
    await jobs.putImage(userId, jobId, makeImage({ imageId, status: 'PENDING' }));
  }
  const context: Context = { config, tables, queues, buckets, jobs, userId, jobId };
  contexts.push(context);
  return context;
}

afterEach(async () => {
  while (contexts.length > 0) {
    const context = contexts.pop()!;
    await context.queues.dispose();
    await context.buckets.dispose();
    await context.tables.dispose();
  }
});

function base64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

function bodyFor(
  ctx: Context,
  images: ReadonlyArray<{ imageId: string; contentBase64: string; preset?: Preset }>,
): string {
  return JSON.stringify({
    userId: ctx.userId,
    jobId: ctx.jobId,
    images: images.map((image) => ({
      ...image,
      mimeType: 'image/jpeg',
      filename: `${image.imageId}.jpg`,
    })),
  });
}

async function dlqMessages(ctx: Context): Promise<readonly Message[]> {
  const result = await ctx.queues.sqs.send(
    new ReceiveMessageCommand({
      QueueUrl: ctx.queues.dlqUrl,
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 0,
    }),
  );
  return result.Messages ?? [];
}

async function mainQueueMessages(ctx: Context): Promise<readonly Message[]> {
  const result = await ctx.queues.sqs.send(
    new ReceiveMessageCommand({
      QueueUrl: ctx.queues.queueUrl,
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 0,
    }),
  );
  return result.Messages ?? [];
}

describe('consumidor SQS — reintentos y DLQ (CA-04)', () => {
  itIntegration('mensaje válido: procesa, marca COMPLETED con métricas y elimina el mensaje de la cola', async () => {
    const ctx = await setup(['img-ok-1', 'img-ok-2']);
    const bytes = await createJpegWithMetadata(100, 100);
    const body = bodyFor(ctx, [
      { imageId: 'img-ok-1', contentBase64: base64(bytes) },
      { imageId: 'img-ok-2', contentBase64: base64(bytes) },
    ]);
    const deps: ConsumeDependencies = { config: ctx.config, sqs: ctx.queues.sqs, jobs: ctx.jobs };

    const result = await handleJobMessage(body, deps);

    expect(result.batchStatus).toBe('COMPLETED');
    expect(result.completed).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.deadLettered).toBe(0);
    expect(result.outcomes.every((outcome) => outcome.status === 'COMPLETED')).toBe(true);
    expect(result.outcomes.every((outcome) => outcome.attempts === 1)).toBe(true);

    for (const imageId of ['img-ok-1', 'img-ok-2']) {
      const stored = await ctx.jobs.getImage(ctx.userId, ctx.jobId, imageId);
      expect(stored?.status).toBe('COMPLETED');
      expect(stored?.exifStripped).toBe(true);
      expect(stored?.bytesAfter).toBeGreaterThan(0);
    }
    const job = await ctx.jobs.getJob(ctx.userId, ctx.jobId);
    expect(job?.status).toBe('COMPLETED');
    expect(job?.bytesBefore).toBeGreaterThan(0);
    expect(job?.bytesAfter).toBeGreaterThan(0);
    expect(job?.savingsPct).toBeGreaterThanOrEqual(0);
  });

  itIntegration('reintento transitorio: 2 fallos y éxito en el 3º intento, sin DLQ', async () => {
    const ctx = await setup(['img-retry']);
    const bytes = await createJpegWithMetadata(100, 100);
    const body = bodyFor(ctx, [{ imageId: 'img-retry', contentBase64: base64(bytes) }]);
    const calls = new Map<string, number>();
    const processor: ImageProcessor = async (imageBytes, options) => {
      const n = (calls.get(options.imageId ?? '') ?? 0) + 1;
      calls.set(options.imageId ?? '', n);
      if (n < 3) throw new Error('fallo transitorio simulado');
      return processImage(imageBytes, options);
    };
    const deps: ConsumeDependencies = {
      config: ctx.config,
      sqs: ctx.queues.sqs,
      jobs: ctx.jobs,
      processor,
    };

    const result = await handleJobMessage(body, deps);

    expect(result.outcomes[0]?.attempts).toBe(3);
    expect(result.outcomes[0]?.status).toBe('COMPLETED');
    expect(result.deadLettered).toBe(0);
    expect(await dlqMessages(ctx)).toHaveLength(0);
    const stored = await ctx.jobs.getImage(ctx.userId, ctx.jobId, 'img-retry');
    expect(stored?.status).toBe('COMPLETED');
  });

  itIntegration('reintentos agotados: mensaje a DLQ e imagen FAILED (el lote no se aborta)', async () => {
    const ctx = await setup(['img-dlq']);
    const bytes = await createJpegWithMetadata(100, 100);
    const body = bodyFor(ctx, [{ imageId: 'img-dlq', contentBase64: base64(bytes) }]);
    let calls = 0;
    const processor: ImageProcessor = async () => {
      calls += 1;
      throw new Error('fallo permanente simulado');
    };
    const deps: ConsumeDependencies = {
      config: ctx.config,
      sqs: ctx.queues.sqs,
      jobs: ctx.jobs,
      processor,
    };

    const result = await handleJobMessage(body, deps);

    expect(calls).toBe(ctx.config.worker.sqsMaxRetries);
    expect(result.outcomes[0]?.attempts).toBe(ctx.config.worker.sqsMaxRetries);
    expect(result.outcomes[0]?.status).toBe('FAILED');
    expect(result.outcomes[0]?.deadLettered).toBe(true);
    expect(result.batchStatus).toBe('FAILED');
    expect(result.deadLettered).toBe(1);

    const stored = await ctx.jobs.getImage(ctx.userId, ctx.jobId, 'img-dlq');
    expect(stored?.status).toBe('FAILED');
    expect(stored?.exifStripped).toBe(false);
    expect(stored?.failureReason?.length).toBeGreaterThan(0);
    const job = await ctx.jobs.getJob(ctx.userId, ctx.jobId);
    expect(job?.status).toBe('FAILED');

    const letters = await dlqMessages(ctx);
    expect(letters).toHaveLength(1);
    const envelope = JSON.parse(letters[0]!.Body!);
    expect(envelope).toMatchObject({
      userId: ctx.userId,
      jobId: ctx.jobId,
      imageId: 'img-dlq',
      attempts: ctx.config.worker.sqsMaxRetries,
    });
  });

  itIntegration('fallo parcial: imagen fallida va a DLQ y FAILED; las demás del lote se completan', async () => {
    const ctx = await setup(['img-bad', 'img-good-a', 'img-good-b']);
    const bytes = await createJpegWithMetadata(100, 100);
    const body = bodyFor(ctx, [
      { imageId: 'img-bad', contentBase64: base64(bytes) },
      { imageId: 'img-good-a', contentBase64: base64(bytes) },
      { imageId: 'img-good-b', contentBase64: base64(bytes) },
    ]);
    const processor: ImageProcessor = async (imageBytes, options) => {
      if (options.imageId === 'img-bad') throw new Error('fallo permanente de una imagen');
      return processImage(imageBytes, options);
    };
    const deps: ConsumeDependencies = {
      config: ctx.config,
      sqs: ctx.queues.sqs,
      jobs: ctx.jobs,
      processor,
    };

    const result = await handleJobMessage(body, deps);

    expect(result.completed).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.deadLettered).toBe(1);
    expect(result.batchStatus).toBe('PARTIAL');
    expect(
      result.outcomes.find((outcome) => outcome.imageId === 'img-bad')?.status,
    ).toBe('FAILED');
    expect(
      result.outcomes
        .filter((outcome) => outcome.imageId !== 'img-bad')
        .every((outcome) => outcome.status === 'COMPLETED'),
    ).toBe(true);

    expect((await ctx.jobs.getImage(ctx.userId, ctx.jobId, 'img-bad'))?.status).toBe('FAILED');
    expect((await ctx.jobs.getImage(ctx.userId, ctx.jobId, 'img-good-a'))?.status).toBe('COMPLETED');
    expect((await ctx.jobs.getImage(ctx.userId, ctx.jobId, 'img-good-b'))?.status).toBe('COMPLETED');
    expect((await ctx.jobs.getJob(ctx.userId, ctx.jobId))?.status).toBe('PARTIAL');
    expect(await dlqMessages(ctx)).toHaveLength(1);
  });

  itIntegration('el mensaje válido se consume y elimina; no hay bucle infinito ni duplicados', async () => {
    const ctx = await setup(['img-drain']);
    const bytes = await createJpegWithMetadata(100, 100);
    const publisher = new SqsJobQueuePublisher({
      sqs: ctx.queues.sqs,
      queueUrl: ctx.queues.queueUrl,
      dlqUrl: ctx.queues.dlqUrl,
    });
    await publisher.publishJob({
      userId: ctx.userId,
      jobId: ctx.jobId,
      images: [{ imageId: 'img-drain', contentBase64: base64(bytes) }],
    });
    const deps: ConsumeDependencies = { config: ctx.config, sqs: ctx.queues.sqs, jobs: ctx.jobs };

    const results = await drainQueue(deps, { maxRounds: 3, waitTimeSeconds: 0 });

    expect(results).toHaveLength(1);
    expect(results[0]?.completed).toBe(1);
    expect(await mainQueueMessages(ctx)).toHaveLength(0);
    expect(await dlqMessages(ctx)).toHaveLength(0);

    // Reprocesar el mismo sobre no crea imágenes ni métricas duplicadas.
    await handleJobMessage(
      bodyFor(ctx, [{ imageId: 'img-drain', contentBase64: base64(bytes) }]),
      deps,
    );
    expect(await ctx.jobs.listImages(ctx.userId, ctx.jobId)).toHaveLength(1);
  });

  itIntegration('siempre usa processImage: la guarda A-05 y el strip real gobiernan el resultado', async () => {
    const ctx = await setup(['img-guard', 'img-strip']);
    const valid = await createJpegWithMetadata(100, 100);
    const oversized = oversizedBuffer(2 * 1024 * 1024);
    const deps: ConsumeDependencies = {
      config: loadConfig(
        testEnv({
          SQS_QUEUE_URL: ctx.queues.queueUrl,
          SQS_DLQ_URL: ctx.queues.dlqUrl,
          DYNAMODB_TABLE_JOBS: ctx.tables.tableName,
          S3_BUCKET_RAW: ctx.buckets.rawBucket,
          S3_BUCKET_OPTIMIZED: ctx.buckets.optimizedBucket,
          MAX_FILE_SIZE_MB: '1',
        }),
      ),
      sqs: ctx.queues.sqs,
      jobs: ctx.jobs,
      processor: processImage,
    };
    const body = bodyFor(ctx, [
      { imageId: 'img-guard', contentBase64: base64(oversized) },
      { imageId: 'img-strip', contentBase64: base64(valid) },
    ]);

    const result = await handleJobMessage(body, deps);

    expect(result.completed).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.batchStatus).toBe('PARTIAL');
    const guard = result.outcomes.find((outcome) => outcome.imageId === 'img-guard');
    expect(guard?.reasonCode).toBe('FILE_TOO_LARGE');
    const strip = result.outcomes.find((outcome) => outcome.imageId === 'img-strip');
    expect(strip?.metrics?.exifStripped).toBe(true);
  });

  // ---- Loop 2/3: corrección de A-01, A-02 y A-03 del Auditor -----------------

  itIntegration('A-01 redelivery: un job terminal no se reabre y la DLQ no se duplica', async () => {
    const ctx = await setup(['img-redelivery'], 'PENDING');
    const bytes = await createJpegWithMetadata(100, 100);
    const body = bodyFor(ctx, [{ imageId: 'img-redelivery', contentBase64: base64(bytes) }]);
    let calls = 0;
    const processor: ImageProcessor = async () => {
      calls += 1;
      throw new Error('fallo permanente simulado');
    };
    const deps: ConsumeDependencies = {
      config: ctx.config,
      sqs: ctx.queues.sqs,
      jobs: ctx.jobs,
      processor,
    };

    const first = await handleJobMessage(body, deps);
    const second = await handleJobMessage(body, deps);

    expect(first.batchStatus).toBe('FAILED');
    expect(first.deadLettered).toBe(1);
    expect(second.skippedAsDuplicate).toBe(true);
    expect(second.outcomes).toHaveLength(0);
    expect(second.batchStatus).toBe('FAILED');
    expect(calls).toBe(ctx.config.worker.sqsMaxRetries); // solo se procesó la 1ª entrega
    expect((await ctx.jobs.getJob(ctx.userId, ctx.jobId))?.status).toBe('FAILED');
    expect((await ctx.jobs.getImage(ctx.userId, ctx.jobId, 'img-redelivery'))?.status).toBe('FAILED');
    expect(await dlqMessages(ctx)).toHaveLength(1);
  });

  itIntegration('A-02 fallo de la DLQ: se aísla, se registra y el resto del lote continúa', async () => {
    const ctx = await setup(['img-dlq-down', 'img-still-ok']);
    const bytes = await createJpegWithMetadata(100, 100);
    const body = bodyFor(ctx, [
      { imageId: 'img-dlq-down', contentBase64: base64(bytes) },
      { imageId: 'img-still-ok', contentBase64: base64(bytes) },
    ]);
    const processor: ImageProcessor = async (imageBytes, options) => {
      if (options.imageId === 'img-dlq-down') throw new Error('fallo permanente simulado');
      return processImage(imageBytes, options);
    };
    const failingDlq = {
      send: async () => {
        throw new Error('DLQ no disponible');
      },
    } as unknown as Pick<SQSClient, 'send'>;
    const deps: ConsumeDependencies = {
      config: ctx.config,
      sqs: ctx.queues.sqs,
      jobs: ctx.jobs,
      processor,
      dlqClient: failingDlq,
    };

    const result = await handleJobMessage(body, deps);

    expect(result.completed).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.dlqFailures).toBe(1);
    const bad = result.outcomes.find((outcome) => outcome.imageId === 'img-dlq-down');
    expect(bad?.status).toBe('FAILED');
    expect(bad?.deadLettered).toBe(false);
    expect(bad?.dlqDeliveryFailed).toBe(true);
    expect(
      result.outcomes.find((outcome) => outcome.imageId === 'img-still-ok')?.status,
    ).toBe('COMPLETED');
    expect((await ctx.jobs.getJob(ctx.userId, ctx.jobId))?.status).toBe('PARTIAL');
    expect((await ctx.jobs.getImage(ctx.userId, ctx.jobId, 'img-dlq-down'))?.status).toBe('FAILED');
    expect((await ctx.jobs.getImage(ctx.userId, ctx.jobId, 'img-still-ok'))?.status).toBe('COMPLETED');
    expect(await dlqMessages(ctx)).toHaveLength(0);
  });

  itIntegration('A-03 precondición: el consumidor materializa el ImageRecord si falta', async () => {
    const ctx = await setup([]); // job creado sin ítems imagen
    const bytes = await createJpegWithMetadata(100, 100);
    const body = bodyFor(ctx, [{ imageId: 'img-sin-record', contentBase64: base64(bytes) }]);
    const deps: ConsumeDependencies = { config: ctx.config, sqs: ctx.queues.sqs, jobs: ctx.jobs };

    expect(await ctx.jobs.getImage(ctx.userId, ctx.jobId, 'img-sin-record')).toBeNull();
    const result = await handleJobMessage(body, deps);

    expect(result.batchStatus).toBe('COMPLETED');
    expect(result.completed).toBe(1);
    const stored = await ctx.jobs.getImage(ctx.userId, ctx.jobId, 'img-sin-record');
    expect(stored?.status).toBe('COMPLETED');
    expect(stored?.exifStripped).toBe(true);
    expect((await ctx.jobs.getJob(ctx.userId, ctx.jobId))?.status).toBe('COMPLETED');
    expect(await ctx.jobs.listImages(ctx.userId, ctx.jobId)).toHaveLength(1);
  });
});
