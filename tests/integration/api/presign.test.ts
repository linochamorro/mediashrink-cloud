/**
 * Integración real de Presigned URLs contra aws-emulator (F02-T02, CA-02).
 * El fixture 100x100 se sube con la URL PUT; el binario nunca pasa por la API.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { GetObjectCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';

import { optimizedImageKey, UnsafeObjectKeyError } from '../../../backend/src/storage/keys';
import { postJson } from '../../unit/api/fixtures';
import {
  createPresignIntegrationEnv,
  getViaPresignedUrl,
  putViaPresignedUrl,
  type PresignIntegrationEnv,
} from './presign-fixture';

const jsonOf = async (response: Response): Promise<Record<string, unknown>> =>
  (await response.json()) as Record<string, unknown>;

const jobId = '22222222-2222-4222-8222-222222222222';
const imageId = 'img_100x100';

describe('Presigned URLs S3 reales en aws-emulator (CA-02)', () => {
  let env: PresignIntegrationEnv;

  beforeAll(async () => {
    env = await createPresignIntegrationEnv('presign');
  });

  afterAll(async () => {
    if (env !== undefined) await env.dispose();
  });

  it('PUT presignado sube un fixture 100x100 a raw y el objeto es verificable', async () => {
    const { token, userId } = await env.register('presign.real.upload@example.com');
    const response = await postJson(env.app, '/presign/upload', { jobId, imageId }, token);
    expect(response.status).toBe(200);

    const result = await jsonOf(response);
    const url = new URL(result.url as string);
    expect(url.protocol).toBe('https:');
    expect(url.hostname).toBe('127.0.0.1');
    expect(url.port).toBe('9297');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('900');
    expect(url.searchParams.get('X-Amz-Signature')).toBeTruthy();
    expect(result.method).toBe('PUT');
    expect(result.bucket).toBe(env.rawBucket);
    expect(result.key).toBe(`${userId}/${jobId}/raw/${imageId}`);
    expect(url.pathname).toContain(env.rawBucket);
    expect(url.pathname).toContain(result.key);
    expect(result.url).not.toContain(':9324');
    expect(Object.keys(result).sort()).toEqual(
      ['bucket', 'expiresAt', 'expiresIn', 'key', 'method', 'url'].sort(),
    );

    const fixture = await sharp({
      create: { width: 100, height: 100, channels: 3, background: '#336699' },
    })
      .jpeg()
      .toBuffer();
    const upload = await putViaPresignedUrl(result.url as string, fixture);
    expect(upload.status).toBe(200);

    const head = await env.client.send(
      new HeadObjectCommand({ Bucket: env.rawBucket, Key: result.key as string }),
    );
    expect(head.ContentLength).toBe(fixture.length);

    const stored = await env.client.send(
      new GetObjectCommand({ Bucket: env.rawBucket, Key: result.key as string }),
    );
    const bytes = Buffer.from(await stored.Body!.transformToByteArray());
    expect(bytes.equals(fixture)).toBe(true);
  });

  it('GET presignado permite descargar un optimizado con el contenido exacto', async () => {
    const { token, userId } = await env.register('presign.real.download@example.com');
    const key = optimizedImageKey({ userId, jobId, imageId }, 'webp');
    const optimized = Buffer.from('contenido-webp-de-prueba-100x100');
    await env.client.send(
      new PutObjectCommand({
        Bucket: env.optimizedBucket,
        Key: key,
        Body: optimized,
        ContentType: 'image/webp',
      }),
    );

    const response = await postJson(
      env.app,
      '/presign/download',
      { jobId, imageId, variant: 'webp' },
      token,
    );
    expect(response.status).toBe(200);
    const result = await jsonOf(response);
    expect(result.method).toBe('GET');
    expect(result.bucket).toBe(env.optimizedBucket);
    expect(result.key).toBe(key);
    expect(new URL(result.url as string).searchParams.get('X-Amz-Expires')).toBe('900');

    const downloaded = await getViaPresignedUrl(result.url as string);
    expect(downloaded.status).toBe(200);
    expect(downloaded.body.equals(optimized)).toBe(true);
  });

  it('la expiración es configurable dentro de límites y se refleja en la firma', async () => {
    const { token } = await env.register('presign.real.expiry@example.com');

    const bounded = await postJson(
      env.app,
      '/presign/upload',
      { jobId, imageId, expiresIn: 120 },
      token,
    );
    expect(bounded.status).toBe(200);
    const result = await jsonOf(bounded);
    expect(result.expiresIn).toBe(120);
    expect(new URL(result.url as string).searchParams.get('X-Amz-Expires')).toBe('120');

    const outOfRange = await postJson(
      env.app,
      '/presign/upload',
      { jobId, imageId, expiresIn: 3601 },
      token,
    );
    expect(outOfRange.status).toBe(400);
  });

  it('rechaza claves que intentan escapar del prefijo del usuario', async () => {
    const { token } = await env.register('presign.real.traversal@example.com');

    await expect(
      env.presign.presignUpload({ userId: '../victim', jobId, imageId }),
    ).rejects.toThrow(UnsafeObjectKeyError);
    await expect(
      env.presign.presignDownload({ userId: '/abs', jobId, imageId, variant: 'webp' }),
    ).rejects.toThrow(UnsafeObjectKeyError);

    const viaApi = await postJson(
      env.app,
      '/presign/upload',
      { jobId, imageId: '../../victim' },
      token,
    );
    expect(viaApi.status).toBe(400);
  });

  it('el binario no pasa por la API: la respuesta es solo JSON de metadatos', async () => {
    const { token } = await env.register('presign.real.no-binary@example.com');
    const response = await postJson(env.app, '/presign/upload', { jobId, imageId }, token);

    expect(response.headers.get('content-type')).toContain('application/json');
    const body = await jsonOf(response);
    expect(typeof body.url).toBe('string');
    expect(body).not.toHaveProperty('body');
    expect(body).not.toHaveProperty('bytes');
    expect(body).not.toHaveProperty('content');
  });
});
