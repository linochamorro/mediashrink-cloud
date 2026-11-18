/**
 * Integración E2E real del backend (F02-T06 / CA-06, FR-12/FR-14, PR-12, IN-08).
 *
 * Flujo completo contra `aws/aws-emulator` y `app.request()`:
 *   register → create job → presign/upload a S3 raw → confirm
 *   → publicación con `SqsJobQueuePublisher.publishJob` (enriquecida en api/**)
 *   → consumidor SQS → `processImage` → métricas en DynamoDB → GET /jobs/:id.
 *
 * Las aserciones de métricas usan los bytes REALES del objeto S3 (verify con
 * `HeadObject`), no el tamaño declarado por el cliente, y validan con los
 * esquemas congelados (`savings-coherence`). El 0 % y el ahorro negativo se
 * reportan tal cual (PR-12): nunca se recortan.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ReceiveMessageCommand, type SQSClient } from '@aws-sdk/client-sqs';

import { createApiApp } from '../../../backend/src/api/app';
import { createDynamoJobListStore } from '../../../backend/src/api/job-list-store';
import { createDynamoJobTransitionStore } from '../../../backend/src/api/job-transition';
import type { JobQueuePublisher } from '../../../backend/src/api/publisher';
import { computeSavings } from '../../../backend/src/domain/index';
import { schemas, type ImageRecord, type Job } from '../../../backend/src/contracts/index';
import { createDynamoUserStore } from '../../../backend/src/db/user-store-adapter';
import {
  drainQueue,
  handleJobMessage,
  processImage,
  type ConsumeDependencies,
  type ConsumeResult,
  type ImageProcessor,
} from '../../../backend/src/worker/index';
import { createJpegWithMetadata, hasMetadataMarker } from '../../unit/worker/fixtures';
import { createE2eEnv, postJson, type E2eEnv } from './e2e-fixture';

/** La fixture crea tabla + TTL + colas + buckets: el timeout por defecto es insuficiente. */
const itE2e = (name: string, fn: () => Promise<void>): void => {
  it(name, fn, 40_000);
};

let env: E2eEnv;

beforeEach(async () => {
  env = await createE2eEnv('e2e');
});

afterEach(async () => {
  if (env !== undefined) await env.dispose();
});

function consumeDeps(): ConsumeDependencies {
  return { config: env.config, sqs: env.queues.sqs, jobs: env.jobs };
}

async function queueDepth(url: string): Promise<number> {
  const result = await env.queues.sqs.send(
    new ReceiveMessageCommand({ QueueUrl: url, MaxNumberOfMessages: 10, WaitTimeSeconds: 0 }),
  );
  return result.Messages?.length ?? 0;
}

describe('F02-T06 — métricas reales e integración E2E del backend (CA-06)', () => {
  itE2e('flujo completo: los bytes persistidos son los reales de S3, con savingsPct exacto y exifStripped real', async () => {
    const { token } = await env.register('e2e.metrics@example.com');
    const imageBytes = await createJpegWithMetadata(100, 100);
    const declaredBytes = 1; // estimación deliberadamente errónea del cliente
    const { jobId, realBytes } = await env.createUploadedJob({
      token,
      preset: 'HIGH',
      images: [{ imageId: 'img-real-1', declaredBytes, bytes: imageBytes }],
    });

    // El byte real del objeto S3 nunca coincide con la estimación del cliente.
    expect(realBytes['img-real-1']).toBe(imageBytes.byteLength);
    expect(realBytes['img-real-1']).not.toBe(declaredBytes);

    const confirmed = await env.confirm(token, jobId);
    expect(confirmed.status).toBe(200);

    const results = await drainQueue(consumeDeps(), { maxRounds: 1, waitTimeSeconds: 0 });
    expect(results).toHaveLength(1);
    expect(results[0]?.completed).toBe(1);
    expect(results[0]?.failed).toBe(0);
    expect(results[0]?.batchStatus).toBe('COMPLETED');
    expect(results[0]?.messageDeleted).toBe(true);

    const detail = await env.detail(token, jobId);
    expect(detail.status).toBe(200);
    const job = detail.job as Job;
    expect(job.status).toBe('COMPLETED');
    expect(job.bytesBefore).toBe(realBytes['img-real-1']);
    expect(job.bytesAfter).toBeGreaterThan(0);
    expect(job.exifStripped).toBe(true);

    const expected = computeSavings({
      bytesBefore: realBytes['img-real-1']!,
      bytesAfter: job.bytesAfter,
    });
    expect(job.bytesAfter).toBe(expected.bytesAfter);
    expect(job.savingsPct).toBe(expected.savingsPct);
    // PR-12: si el ahorro es negativo (tres salidas > original), se conserva.
    if (expected.savingsPct < 0) expect(job.savingsPct).toBeLessThan(0);

    // Esquemas congelados: savings-coherence y ttl-coherence.
    expect(schemas.Job.safeParse(job).success).toBe(true);
    expect(
      schemas.JobMetrics.safeParse({
        bytesBefore: job.bytesBefore,
        bytesAfter: job.bytesAfter,
        savingsPct: job.savingsPct,
        exifStripped: job.exifStripped,
      }).success,
    ).toBe(true);

    const images = detail.images as ImageRecord[];
    expect(images).toHaveLength(1);
    expect(images[0]).toMatchObject({
      imageId: 'img-real-1',
      status: 'COMPLETED',
      bytesBefore: realBytes['img-real-1'],
      exifStripped: true,
    });
    expect(images[0]?.bytesAfter).toBeGreaterThan(0);
  });

  itE2e('exifStripped: true solo después de verificar que las tres salidas no contienen metadatos', async () => {
    const { token } = await env.register('e2e.strip@example.com');
    const source = await createJpegWithMetadata(110, 90);
    expect(hasMetadataMarker(source)).toBe(true); // control positivo: la entrada SÍ tiene marcadores
    const { jobId } = await env.createUploadedJob({
      token,
      preset: 'HIGH',
      images: [{ imageId: 'img-strip', declaredBytes: 1, bytes: source }],
    });
    expect((await env.confirm(token, jobId)).status).toBe(200);

    const captured: Uint8Array[] = [];
    const processor: ImageProcessor = async (bytes, options) => {
      const result = await processImage(bytes, options);
      if (result.ok) captured.push(result.outputs.webp, result.outputs.avif, result.outputs.thumbnail);
      return result;
    };
    const results = await drainQueue(
      { ...consumeDeps(), processor },
      { maxRounds: 1, waitTimeSeconds: 0 },
    );
    expect(results[0]?.completed).toBe(1);
    expect(captured).toHaveLength(3);
    expect(captured.every((output) => !hasMetadataMarker(output))).toBe(true);
    const renderedSum = captured.reduce((sum, output) => sum + output.byteLength, 0);

    const detail = await env.detail(token, jobId);
    // bytesAfter es la suma exacta de las tres salidas reales, nunca una estimación.
    expect(detail.job?.bytesAfter).toBe(renderedSum);
    expect(detail.job?.exifStripped).toBe(true);
    expect((detail.images as ImageRecord[])[0]?.exifStripped).toBe(true);
  });

  itE2e('estados coherentes: una imagen FAILED produce PARTIAL y todas FAILED producen FAILED', async () => {
    const { token } = await env.register('e2e.states@example.com');
    const bytes = await createJpegWithMetadata(80, 80);
    const { jobId, realBytes } = await env.createUploadedJob({
      token,
      preset: 'BALANCED',
      images: [
        { imageId: 'img-good', declaredBytes: 7, bytes },
        { imageId: 'img-bad', declaredBytes: 9, bytes },
      ],
    });
    expect((await env.confirm(token, jobId)).status).toBe(200);

    const partialProcessor: ImageProcessor = async (imageBytes, options) => {
      if (options.imageId === 'img-bad') throw new Error('fallo permanente simulado');
      return processImage(imageBytes, options);
    };
    const partial = await drainQueue(
      { ...consumeDeps(), processor: partialProcessor },
      { maxRounds: 1, waitTimeSeconds: 0 },
    );
    expect(partial).toHaveLength(1);
    expect(partial[0]?.batchStatus).toBe('PARTIAL');
    expect(partial[0]?.completed).toBe(1);
    expect(partial[0]?.failed).toBe(1);

    const partialDetail = await env.detail(token, jobId);
    expect(partialDetail.job?.status).toBe('PARTIAL');
    expect(schemas.Job.safeParse(partialDetail.job).success).toBe(true);
    const partialImages = partialDetail.images as ImageRecord[];
    expect(partialImages.find((image) => image.imageId === 'img-good')?.status).toBe('COMPLETED');
    expect(partialImages.find((image) => image.imageId === 'img-bad')?.status).toBe('FAILED');
    // Las métricas agregadas solo suman las imágenes completadas con éxito.
    expect(partialDetail.job?.bytesBefore).toBe(realBytes['img-good']);

    // Segundo lote: todas las imágenes fallan → FAILED.
    const { token: token2 } = await env.register('e2e.states-all@example.com');
    const allBytes = await createJpegWithMetadata(60, 60);
    const { jobId: jobId2 } = await env.createUploadedJob({
      token: token2,
      preset: 'MAX_COMPRESSION',
      images: [{ imageId: 'img-fail', declaredBytes: 3, bytes: allBytes }],
    });
    expect((await env.confirm(token2, jobId2)).status).toBe(200);
    const alwaysFails: ImageProcessor = async () => {
      throw new Error('fallo permanente simulado');
    };
    const failed = await drainQueue(
      { ...consumeDeps(), processor: alwaysFails },
      { maxRounds: 1, waitTimeSeconds: 0 },
    );
    expect(failed[0]?.batchStatus).toBe('FAILED');
    const failedDetail = await env.detail(token2, jobId2);
    expect(failedDetail.job?.status).toBe('FAILED');
    expect(schemas.Job.safeParse(failedDetail.job).success).toBe(true);
  });

  itE2e('observabilidad: dlqFailures y dlqDeliveryFailed se aíslan y skippedAsDuplicate se reporta', async () => {
    const { token } = await env.register('e2e.observability@example.com');
    const bytes = await createJpegWithMetadata(70, 70);
    const { jobId } = await env.createUploadedJob({
      token,
      preset: 'HIGH',
      images: [
        { imageId: 'img-dlq-down', declaredBytes: 5, bytes },
        { imageId: 'img-ok', declaredBytes: 5, bytes },
      ],
    });
    expect((await env.confirm(token, jobId)).status).toBe(200);

    const failingDlq = {
      send: async () => {
        throw new Error('DLQ no disponible');
      },
    } as unknown as Pick<SQSClient, 'send'>;
    const processor: ImageProcessor = async (imageBytes, options) => {
      if (options.imageId === 'img-dlq-down') throw new Error('fallo permanente simulado');
      return processImage(imageBytes, options);
    };
    const result = await drainQueue(
      { ...consumeDeps(), processor, dlqClient: failingDlq },
      { maxRounds: 1, waitTimeSeconds: 0 },
    );

    expect(result).toHaveLength(1);
    const snapshot = result[0] as ConsumeResult;
    expect(snapshot.dlqFailures).toBe(1);
    expect(snapshot.skippedAsDuplicate).toBe(false);
    const bad = snapshot.outcomes.find((outcome) => outcome.imageId === 'img-dlq-down');
    expect(bad?.dlqDeliveryFailed).toBe(true);
    expect(bad?.deadLettered).toBe(false);
    expect(snapshot.batchStatus).toBe('PARTIAL');
    expect((await env.detail(token, jobId)).job?.status).toBe('PARTIAL');

    // Redelivery de un sobre ya terminal: no se reprocesa ni se reenvía a DLQ.
    const body = JSON.stringify({
      userId: snapshot.userId,
      jobId: snapshot.jobId,
      images: [{ imageId: 'img-dlq-down', contentBase64: Buffer.from(bytes).toString('base64') }],
    });
    const redelivered = await handleJobMessage(body, {
      ...consumeDeps(),
      processor,
      dlqClient: failingDlq,
    });
    expect(redelivered.skippedAsDuplicate).toBe(true);
    expect(redelivered.outcomes).toHaveLength(0);
    expect(redelivered.dlqFailures).toBe(0);
  });

  itE2e('CONFIRM_INCONSISTENT: política at-most-once, sin reparación automática', async () => {
    const { token, userId } = await env.register('e2e.inconsistent@example.com');
    let publishCalls = 0;
    const failingPublisher: JobQueuePublisher = {
      publish: async () => {
        publishCalls += 1;
        throw new Error('SQS no disponible');
      },
    };
    const transition = createDynamoJobTransitionStore({
      tableName: env.table.tableName,
      client: env.table.documentClient,
    });
    let revertFails = true;
    const app = createApiApp({
      config: env.config,
      users: createDynamoUserStore({ tableName: env.table.tableName, client: env.table.documentClient }),
      jobs: env.jobs,
      publisher: failingPublisher,
      jobLister: createDynamoJobListStore({
        tableName: env.table.tableName,
        client: env.table.documentClient,
      }),
      jobTransition: {
        confirmPending: (user, job, at) => transition.confirmPending(user, job, at),
        revertToPending: async (user, job, at) => {
          if (revertFails) {
            revertFails = false;
            throw new Error('DynamoDB no disponible al revertir');
          }
          return transition.revertToPending(user, job, at);
        },
      },
    });

    const created = await postJson(
      app,
      '/jobs',
      {
        preset: 'HIGH',
        files: [{ fileName: 'img-x.jpg', contentType: 'image/jpeg', sizeBytes: 1 }],
      },
      token,
    );
    const jobId = ((await created.json()) as { job: Job }).job.jobId;
    const first = await postJson(app, `/jobs/${jobId}/confirm`, {}, token);
    expect(first.status).toBe(503);
    expect(((await first.json()) as { error: { code: string } }).error.code).toBe('CONFIRM_INCONSISTENT');
    expect((await env.jobs.getJob(userId, jobId))?.status).toBe('PROCESSING');

    // Reintento: at-most-once. El lote no está PENDING, así que NO se publica
    // de nuevo y se devuelve confirmed: true aunque el publicador ya esté sano.
    const retry = await postJson(app, `/jobs/${jobId}/confirm`, {}, token);
    expect(retry.status).toBe(200);
    expect(((await retry.json()) as { confirmed: boolean }).confirmed).toBe(true);
    expect(publishCalls).toBe(1);
    expect(await queueDepth(env.queues.queueUrl)).toBe(0);
  });
});
