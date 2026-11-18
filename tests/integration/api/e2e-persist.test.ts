/**
 * Corrección loop 2/3 — Auditoría `A-01` (CA-06, PR-12, FR-17/FR-18).
 *
 * El worker debe persistir WebP, AVIF y miniatura en el bucket `optimized` con
 * las claves que firman los GET presignados de T02. `bytesAfter` debe anclarse
 * a los bytes realmente almacenados (HeadObject), y las rutas de descarga
 * individual y ZIP de T05 deben devolver esos mismos objetos.
 *
 * Fase RED: se ejecuta ANTES de implementar la escritura, con el mismo flujo
 * E2E que ya funciona; falla porque no existen los objetos en `optimized`.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

import { computeSavings } from '../../../backend/src/domain/index';
import type { Job } from '../../../backend/src/contracts/index';
import { optimizedImageKey, type OptimizedVariant } from '../../../backend/src/storage/keys';
import { drainQueue } from '../../../backend/src/worker/index';
import { createJpegWithMetadata } from '../../unit/worker/fixtures';
import { readZip } from '../../unit/api/zip-reader';
import { createE2eEnv, getJson, type E2eEnv } from './e2e-fixture';
import { getViaPresignedUrl } from './presign-fixture';

const VARIANTS: readonly OptimizedVariant[] = ['webp', 'avif', 'thumbnail'];

const itPersist = (name: string, fn: () => Promise<void>): void => {
  it(name, fn, 40_000);
};

let env: E2eEnv;

beforeEach(async () => {
  env = await createE2eEnv('e2epersist');
});

afterEach(async () => {
  if (env !== undefined) await env.dispose();
});

async function completedJobWithOneImage(): Promise<{
  token: string;
  userId: string;
  jobId: string;
  imageId: string;
  job: Job;
}> {
  const { token, userId } = await env.register('e2e.persist@example.com');
  const imageId = 'img-persist-1';
  const { jobId } = await env.createUploadedJob({
    token,
    preset: 'HIGH',
    images: [{ imageId, declaredBytes: 1, bytes: await createJpegWithMetadata(100, 90) }],
  });
  expect((await env.confirm(token, jobId)).status).toBe(200);
  const results = await drainQueue(
    { config: env.config, sqs: env.queues.sqs, jobs: env.jobs },
    { maxRounds: 1, waitTimeSeconds: 0 },
  );
  expect(results[0]?.completed).toBe(1);
  const detail = await env.detail(token, jobId);
  expect(detail.job?.status).toBe('COMPLETED');
  return { token, userId, jobId, imageId, job: detail.job as Job };
}

async function storedBytes(userId: string, jobId: string, imageId: string, variant: OptimizedVariant) {
  const key = optimizedImageKey({ userId, jobId, imageId }, variant);
  const object = await env.buckets.client.send(
    new GetObjectCommand({ Bucket: env.buckets.optimizedBucket, Key: key }),
  );
  return { key, bytes: Buffer.from(await object.Body!.transformToByteArray()) };
}

describe('F02-T06 loop 2 — variantes persistidas y métricas ancladas a S3 (A-01)', () => {
  itPersist('las 3 variantes existen en optimized y suma(HeadObject.ContentLength) === job.bytesAfter', async () => {
    const { userId, jobId, imageId, job } = await completedJobWithOneImage();
    let persistedTotal = 0;

    for (const variant of VARIANTS) {
      const key = optimizedImageKey({ userId, jobId, imageId }, variant);
      const head = await env.buckets.client.send(
        new HeadObjectCommand({ Bucket: env.buckets.optimizedBucket, Key: key }),
      );
      expect(head.ContentLength).toBeGreaterThan(0);
      persistedTotal += head.ContentLength ?? 0;
    }

    expect(persistedTotal).toBe(job.bytesAfter);
    expect(job.savingsPct).toBe(
      computeSavings({ bytesBefore: job.bytesBefore, bytesAfter: persistedTotal }).savingsPct,
    );
  });

  itPersist('GET /jobs/:id/download/:imageId devuelve los bytes exactos de cada objeto persistido', async () => {
    const { token, userId, jobId, imageId } = await completedJobWithOneImage();

    for (const variant of VARIANTS) {
      const response = await getJson(
        env.app,
        `/jobs/${jobId}/download/${imageId}?variant=${variant}`,
        token,
      );
      expect(response.status).toBe(200);
      const body = (await response.json()) as { downloadUrl: string; url: string };
      expect(body.downloadUrl).toBe(body.url);
      const downloaded = await getViaPresignedUrl(body.downloadUrl);
      expect(downloaded.status).toBe(200);

      const stored = await storedBytes(userId, jobId, imageId, variant);
      expect(new URL(body.downloadUrl).pathname).toContain(stored.key);
      expect(downloaded.body.equals(stored.bytes)).toBe(true);
      expect(stored.bytes.length).toBeGreaterThan(0);
    }
  });

  itPersist('GET /jobs/:id/download.zip contiene WebP, AVIF y miniatura idénticos a los objetos persistidos', async () => {
    const { token, userId, jobId, imageId } = await completedJobWithOneImage();

    const response = await getJson(env.app, `/jobs/${jobId}/download.zip`, token);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/zip');
    const entries = readZip(Buffer.from(await response.arrayBuffer()));
    expect(entries.map((entry) => entry.name).sort()).toEqual(
      [`${imageId}.webp`, `${imageId}.avif`, `${imageId}_thumb.webp`].sort(),
    );

    for (const variant of VARIANTS) {
      const name = variant === 'thumbnail' ? `${imageId}_thumb.webp` : `${imageId}.${variant}`;
      const stored = await storedBytes(userId, jobId, imageId, variant);
      expect(entries.find((entry) => entry.name === name)?.bytes.equals(stored.bytes)).toBe(true);
    }
  });
});
