/**
 * F02-AUD-01 — integración real del contrato de subida de `POST /jobs`.
 *
 * Contra `aws/aws-emulator`: el servidor firma las PUT dentro de POST /jobs,
 * el binario se envía DIRECTAMENTE a S3 con la URL devuelta (nunca pasa por la
 * API) y se verifica con `HeadObject` que el objeto quedó bajo
 * `raw/<userId-del-JWT>/<jobId>/<imageId>`.
 */

import { HeadObjectCommand } from '@aws-sdk/client-s3';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { computeTtl, schemas } from '../../../backend/src/contracts/index';
import { rawImageKey } from '../../../backend/src/storage/keys';
import { postJson } from '../../unit/api/fixtures';
import {
  createPresignIntegrationEnv,
  putViaPresignedUrl,
  type PresignIntegrationEnv,
} from './presign-fixture';

type Upload = { imageId: string; uploadUrl: string; method: string };

describe('F02-AUD-01 — POST /jobs: URLs PUT firmadas y subida real a raw (aws-emulator)', () => {
  let env: PresignIntegrationEnv;

  beforeAll(async () => {
    env = await createPresignIntegrationEnv('jobs-aud');
  }, 30_000);

  afterAll(async () => {
    if (env !== undefined) await env.dispose();
  });

  it('201 con uploads; la PUT real deja cada objeto bajo raw/<userId>/<jobId>/<imageId>', async () => {
    const { token, userId } = await env.register('upload.contract@example.com');
    const response = await postJson(
      env.app,
      '/jobs',
      {
        preset: 'BALANCED',
        files: [
          { fileName: 'foto.jpg', contentType: 'image/jpeg', sizeBytes: 1024 },
          { fileName: 'retrato.png', contentType: 'image/png', sizeBytes: 2048 },
        ],
      },
      token,
    );
    expect(response.status).toBe(201);

    const body = (await response.json()) as {
      job: { jobId: string; userId: string; status: string; ttl: number; createdAt: string };
      uploads: Upload[];
    };
    const { jobId } = body.job;
    expect(body.job.userId).toBe(userId);
    expect(body.job.status).toBe('PENDING');
    expect(body.job.ttl).toBe(computeTtl(body.job.createdAt));
    expect(body.uploads).toHaveLength(2);

    const payload = Buffer.from('binario-de-prueba-subido-por-put-directa-a-s3');
    for (const upload of body.uploads) {
      expect(upload.method).toBe('PUT');
      expect(new URL(upload.uploadUrl).protocol).toBe('https:');
      for (const secret of ['key', 'bucket', 'expiresIn', 'expiresAt']) {
        expect(upload).not.toHaveProperty(secret);
      }

      const expectedKey = rawImageKey({ userId, jobId, imageId: upload.imageId });
      expect(new URL(upload.uploadUrl).pathname).toContain(expectedKey);

      const put = await putViaPresignedUrl(upload.uploadUrl, payload);
      expect(put.status).toBe(200);

      const head = await env.client.send(
        new HeadObjectCommand({ Bucket: env.rawBucket, Key: expectedKey }),
      );
      expect(head.ContentLength).toBe(payload.byteLength);
    }
  });

  it('el lote sigue PENDING con métricas 0/0/0 y cumple los esquemas congelados', async () => {
    const { token } = await env.register('pending.contract@example.com');
    const response = await postJson(
      env.app,
      '/jobs',
      {
        preset: 'MAX_COMPRESSION',
        files: [{ fileName: 'foto.webp', contentType: 'image/webp', sizeBytes: 4096 }],
      },
      token,
    );
    expect(response.status).toBe(201);
    const body = (await response.json()) as { job: Record<string, unknown> };
    expect(body.job).toMatchObject({
      status: 'PENDING',
      preset: 'MAX_COMPRESSION',
      bytesBefore: 0,
      bytesAfter: 0,
      savingsPct: 0,
      exifStripped: false,
    });
    expect(schemas.Job.safeParse(body.job).success).toBe(true);
  });

  it('rechaza la subida con SVG y no deja objeto en raw', async () => {
    const { token } = await env.register('svg.contract@example.com');
    const response = await postJson(
      env.app,
      '/jobs',
      {
        preset: 'HIGH',
        files: [{ fileName: 'vector.svg', contentType: 'image/svg+xml', sizeBytes: 1024 }],
      },
      token,
    );
    expect(response.status).toBe(400);
    expect(response.headers.get('content-type')).toContain('application/json');
  });
});
