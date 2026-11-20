/**
 * F05-AUDIT-FULL — integración real contra aws/aws-emulator.
 *
 * Cubre de extremo a extremo: imagen real > 400 KiB, nombre de lote persistido,
 * Claim Check (sobre SQS sin contentBase64), worker sharp leyendo desde S3 raw,
 * variantes WebP/AVIF/miniatura en optimized y recuperación del nombre en
 * GET /jobs y GET /jobs/:id.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ReceiveMessageCommand } from '@aws-sdk/client-sqs';
import { HeadObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';

import type { Job } from '../../../backend/src/contracts/index';
import { optimizedImageKey, type OptimizedVariant } from '../../../backend/src/storage/keys';
import { handleJobMessage } from '../../../backend/src/worker/index';
import { createE2eEnv, getJson, type E2eEnv } from './e2e-fixture';

const BATCH_NAME = 'Vacaciones Prueba Real';
const VARIANTS: readonly OptimizedVariant[] = ['webp', 'avif', 'thumbnail'];

async function createLargeJpeg(): Promise<Uint8Array> {
  const width = 900;
  const height = 900;
  const channels = 3;
  const pixels = Buffer.alloc(width * height * channels);
  // Ruido determinista de alta entropía: JPEG grande (> 400 KiB) sin depender
  // de archivos binarios versionados.
  let seed = 123456789;
  for (let index = 0; index < pixels.length; index += 1) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    pixels[index] = seed & 0xff;
  }
  const buffer = await sharp(pixels, { raw: { width, height, channels } })
    .jpeg({ quality: 100 })
    .toBuffer();
  return buffer;
}

let env: E2eEnv;

beforeEach(async () => {
  env = await createE2eEnv('f05large');
});

afterEach(async () => {
  if (env !== undefined) await env.dispose();
});

describe('F05-AUDIT-FULL — imagen > 400 KiB + Claim Check + name persistido', () => {
  it(
    'completa el lote, conserva name y genera las 3 variantes',
    async () => {
      const { token, userId } = await env.register('f05.large@example.com');
      const bytes = await createLargeJpeg();
      expect(bytes.byteLength).toBeGreaterThan(400_000);

      const imageId = 'img-large-1';
      const { jobId } = await env.createUploadedJob({
        token,
        preset: 'BALANCED',
        name: BATCH_NAME,
        images: [{ imageId, declaredBytes: 1, bytes }],
      });

      const confirmed = await env.confirm(token, jobId);
      expect(confirmed.status).toBe(200);
      const confirmedBody = (await confirmed.json()) as { job: Job };
      expect(confirmedBody.job.name).toBe(BATCH_NAME);

      // Claim Check: el sobre SQS no debe llevar los bytes (> 256 KiB).
      const received = await env.queues.sqs.send(
        new ReceiveMessageCommand({
          QueueUrl: env.queues.queueUrl,
          MaxNumberOfMessages: 1,
          WaitTimeSeconds: 2,
        }),
      );
      const rawBody = received.Messages?.[0]?.Body;
      expect(rawBody).toBeDefined();
      expect(Buffer.byteLength(rawBody!, 'utf8')).toBeLessThan(200_000);
      expect(rawBody!).not.toContain('contentBase64');

      const result = await handleJobMessage(rawBody, {
        config: env.config,
        sqs: env.queues.sqs,
        jobs: env.jobs,
      });
      expect(result.completed).toBe(1);

      const detail = await env.detail(token, jobId);
      expect(detail.status).toBe(200);
      expect(detail.job?.status).toBe('COMPLETED');
      expect(detail.job?.name).toBe(BATCH_NAME);
      expect(detail.job?.bytesBefore).toBeGreaterThan(400_000);
      expect(detail.job?.bytesAfter).toBeGreaterThan(0);
      expect(detail.job?.exifStripped).toBe(true);

      const listed = await getJson(env.app, '/jobs', token);
      expect(listed.status).toBe(200);
      const listBody = (await listed.json()) as { jobs: Job[] };
      expect(listBody.jobs.find((job) => job.jobId === jobId)?.name).toBe(BATCH_NAME);

      for (const variant of VARIANTS) {
        const head = await env.buckets.client.send(
          new HeadObjectCommand({
            Bucket: env.buckets.optimizedBucket,
            Key: optimizedImageKey({ userId, jobId, imageId }, variant),
          }),
        );
        expect(head.ContentLength ?? 0).toBeGreaterThan(0);
      }
    },
    90_000,
  );
});
