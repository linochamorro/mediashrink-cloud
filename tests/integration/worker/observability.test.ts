/**
 * Observabilidad del consumidor en integración real (F02-T06 / CA-06).
 *
 * Verifica que `summarizeConsumeResult` expone `dlqFailures`,
 * `dlqDeliveryFailed` y `skippedAsDuplicate` a partir de un consumo real con
 * DLQ caída y una redelivery de un lote ya terminal (T04 A-01/A-02).
 */

import { afterEach, describe, expect, it } from 'vitest';

import type { SQSClient } from '@aws-sdk/client-sqs';

import { loadConfig } from '../../../backend/src/config/index';
import { createJobStore, type JobStore } from '../../../backend/src/db/index';
import {
  handleJobMessage,
  processImage,
  summarizeConsumeResult,
  type ImageProcessor,
} from '../../../backend/src/worker/index';
import { createJpegWithMetadata, testEnv } from '../../unit/worker/fixtures';
import { makeJob } from '../db/factories';
import { createTestTable, type TestTable } from '../db/table-fixture';
import { createTestBuckets, type TestBuckets } from '../api/presign-fixture';
import { createTestQueues, type TestQueues } from './sqs-fixture';

interface Context {
  readonly table: TestTable;
  readonly queues: TestQueues;
  readonly buckets: TestBuckets;
  readonly jobs: JobStore;
  readonly config: ReturnType<typeof loadConfig>;
  readonly userId: string;
  readonly jobId: string;
}

const contexts: Context[] = [];

async function setup(): Promise<Context> {
  const table = await createTestTable('obssum');
  const queues = await createTestQueues('obssum');
  const buckets = await createTestBuckets('obssum');
  const config = loadConfig(
    testEnv({
      DYNAMODB_TABLE_JOBS: table.tableName,
      SQS_QUEUE_URL: queues.queueUrl,
      SQS_DLQ_URL: queues.dlqUrl,
      S3_BUCKET_RAW: buckets.rawBucket,
      S3_BUCKET_OPTIMIZED: buckets.optimizedBucket,
    }),
  );
  const jobs = createJobStore({ tableName: table.tableName, client: table.documentClient });
  const userId = `user-obs-${Date.now()}`;
  const jobId = `job-obs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  await jobs.createJob(makeJob({ userId, jobId, status: 'PROCESSING' }));
  const context: Context = { table, queues, buckets, jobs, config, userId, jobId };
  contexts.push(context);
  return context;
}

afterEach(async () => {
  while (contexts.length > 0) {
    const context = contexts.pop()!;
    await context.queues.dispose();
    await context.buckets.dispose();
    await context.table.dispose();
  }
});

function bodyFor(ctx: Context, imageId: string, bytes: Uint8Array): string {
  return JSON.stringify({
    userId: ctx.userId,
    jobId: ctx.jobId,
    images: [{ imageId, contentBase64: Buffer.from(bytes).toString('base64') }],
  });
}

describe('summarizeConsumeResult — observabilidad E2E (CA-06)', () => {
  it('expone los tres campos de resiliencia de T04 en un snapshot serializable', async () => {
    const ctx = await setup();
    const bytes = await createJpegWithMetadata(80, 80);
    const processor: ImageProcessor = async (imageBytes, options) => {
      if (options.imageId === 'img-dlq') throw new Error('fallo permanente simulado');
      return processImage(imageBytes, options);
    };
    const failingDlq = {
      send: async () => {
        throw new Error('DLQ no disponible');
      },
    } as unknown as Pick<SQSClient, 'send'>;
    const result = await handleJobMessage(
      JSON.stringify({
        userId: ctx.userId,
        jobId: ctx.jobId,
        images: [
          { imageId: 'img-dlq', contentBase64: Buffer.from(bytes).toString('base64') },
          { imageId: 'img-ok', contentBase64: Buffer.from(bytes).toString('base64') },
        ],
      }),
      { config: ctx.config, sqs: ctx.queues.sqs, jobs: ctx.jobs, processor, dlqClient: failingDlq },
    );

    const snapshot = summarizeConsumeResult(result);
    expect(snapshot).toMatchObject({
      userId: ctx.userId,
      jobId: ctx.jobId,
      batchStatus: 'PARTIAL',
      completed: 1,
      failed: 1,
      dlqFailures: 1,
      dlqDeliveryFailed: true,
      skippedAsDuplicate: false,
    });
    expect(() => JSON.stringify(snapshot)).not.toThrow();

    // Redelivery de un lote terminal: el snapshot lo marca como duplicado.
    const duplicate = await handleJobMessage(bodyFor(ctx, 'img-dlq', bytes), {
      config: ctx.config,
      sqs: ctx.queues.sqs,
      jobs: ctx.jobs,
      processor,
      dlqClient: failingDlq,
    });
    const duplicateSnapshot = summarizeConsumeResult(duplicate);
    expect(duplicateSnapshot.skippedAsDuplicate).toBe(true);
    expect(duplicateSnapshot.dlqFailures).toBe(0);
    expect(duplicateSnapshot.dlqDeliveryFailed).toBe(false);
  }, 30_000);
});
