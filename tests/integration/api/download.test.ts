/**
 * Integración real de descarga individual, ZIP y borrado (F02-T05, CA-05)
 * contra `aws/aws-emulator`: S3 + DynamoDB + API Hono sin dobles ni AWS real.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import type { Hono } from 'hono';

import { readZip } from '../../unit/api/zip-reader';
import { createDownloadIntegrationEnv, type DownloadIntegrationEnv } from './download-fixture';

const jobId = '77777777-7777-4777-8777-777777777777';
const otherJobId = '88888888-8888-4888-8888-888888888888';
const imageA = 'img_real_a';
const imageB = 'img_real_b';
const webpBytes = Buffer.from('contenido-webp-real-100x100');
const avifBytes = Buffer.from('contenido-avif-real-100x100');
const thumbBytes = Buffer.from('contenido-miniatura-real');
const rawBytes = Buffer.from('contenido-original-real');

async function get(app: Hono, path: string, token: string): Promise<Response> {
  return app.request(path, { headers: { authorization: `Bearer ${token}` } });
}

async function remove(app: Hono, path: string, token: string): Promise<Response> {
  return app.request(path, { method: 'DELETE', headers: { authorization: `Bearer ${token}` } });
}

async function keysWithPrefix(env: DownloadIntegrationEnv, bucket: string, prefix: string) {
  const listed = await env.buckets.client.send(
    new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }),
  );
  return (listed.Contents ?? []).map((item) => item.Key ?? '');
}

describe('Descarga/ZIP/borrado reales en aws-emulator (CA-05)', () => {
  let env: DownloadIntegrationEnv;

  beforeAll(async () => {
    env = await createDownloadIntegrationEnv('t05');
  }, 45_000);

  afterAll(async () => {
    if (env !== undefined) await env.dispose();
  }, 45_000);

  it('descarga individual: la URL firmada devuelve los bytes reales de cada variante', async () => {
    const { token, userId } = await env.register('t05.real.individual@example.com');
    await env.seedJob(userId, jobId, [imageA]);
    await env.putRaw(userId, jobId, imageA, rawBytes);
    await env.putOptimized(userId, jobId, imageA, 'webp', webpBytes);
    await env.putOptimized(userId, jobId, imageA, 'avif', avifBytes);
    await env.putOptimized(userId, jobId, imageA, 'thumbnail', thumbBytes);

    for (const [variant, expected] of [
      ['webp', webpBytes],
      ['avif', avifBytes],
      ['thumbnail', thumbBytes],
      ['original', rawBytes],
    ] as const) {
      const response = await get(
        env.app,
        `/jobs/${jobId}/download/${imageA}?variant=${variant}`,
        token,
      );
      expect(response.status).toBe(200);
      const body = (await response.json()) as { downloadUrl: string; expiresAt: string };
      const url = new URL(body.downloadUrl);
      expect(url.protocol).toBe('https:');
      expect(url.hostname).toBe('127.0.0.1');
      expect(url.port).toBe('9297');
      expect(url.pathname).toContain(
        env.objectKey(userId, jobId, imageA, variant),
      );
      expect(url.searchParams.get('X-Amz-Expires')).toBe('900');
      const downloaded = await env.download(body.downloadUrl);
      expect(downloaded.status).toBe(200);
      expect(downloaded.body.equals(expected)).toBe(true);
    }
  }, 30_000);

  it('ZIP: contiene WebP + AVIF + miniaturas reales del lote', async () => {
    const { token, userId } = await env.register('t05.real.zip@example.com');
    await env.seedJob(userId, jobId, [imageA, imageB]);
    await env.putOptimized(userId, jobId, imageA, 'webp', webpBytes);
    await env.putOptimized(userId, jobId, imageA, 'avif', avifBytes);
    await env.putOptimized(userId, jobId, imageA, 'thumbnail', thumbBytes);
    await env.putOptimized(userId, jobId, imageB, 'webp', Buffer.from('beta-webp-real'));
    await env.putOptimized(userId, jobId, imageB, 'avif', Buffer.from('beta-avif-real'));

    const response = await get(env.app, `/jobs/${jobId}/download.zip`, token);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/zip');
    const entries = readZip(Buffer.from(await response.arrayBuffer()));
    expect(entries.map((entry) => entry.name)).toEqual([
      `${imageA}.webp`,
      `${imageA}.avif`,
      `${imageA}_thumb.webp`,
      `${imageB}.webp`,
      `${imageB}.avif`,
    ]);
    expect(entries[0]?.bytes.equals(webpBytes)).toBe(true);
    expect(entries[2]?.bytes.equals(thumbBytes)).toBe(true);
  }, 30_000);

  it('DELETE: elimina raw + optimized y la fila DynamoDB; repetir da 404', async () => {
    const { token, userId } = await env.register('t05.real.delete@example.com');
    await env.seedJob(userId, otherJobId, [imageA]);
    await env.putRaw(userId, otherJobId, imageA, rawBytes);
    await env.putOptimized(userId, otherJobId, imageA, 'webp', webpBytes);
    await env.putOptimized(userId, otherJobId, imageA, 'thumbnail', thumbBytes);

    expect(
      (await keysWithPrefix(env, env.buckets.rawBucket, `${userId}/${otherJobId}/`)).length,
    ).toBe(1);
    const response = await remove(env.app, `/jobs/${otherJobId}`, token);
    expect(response.status).toBe(204);
    expect(
      await keysWithPrefix(env, env.buckets.rawBucket, `${userId}/${otherJobId}/`),
    ).toEqual([]);
    expect(
      await keysWithPrefix(env, env.buckets.optimizedBucket, `${userId}/${otherJobId}/`),
    ).toEqual([]);
    expect(await env.jobs.getJob(userId, otherJobId)).toBeNull();
    expect(await env.jobs.listImages(userId, otherJobId)).toEqual([]);
    expect((await remove(env.app, `/jobs/${otherJobId}`, token)).status).toBe(404);
  }, 30_000);

  it('aislamiento: otro usuario recibe 404 y no puede descargar ni borrar el lote ajeno', async () => {
    const owner = await env.register('t05.real.isolation.owner@example.com');
    const attacker = await env.register('t05.real.isolation.attacker@example.com');
    await env.seedJob(owner.userId, jobId, [imageA]);
    await env.putRaw(owner.userId, jobId, imageA, rawBytes);
    await env.putOptimized(owner.userId, jobId, imageA, 'webp', webpBytes);

    expect(
      (await get(env.app, `/jobs/${jobId}/download/${imageA}?variant=webp`, attacker.token)).status,
    ).toBe(404);
    expect((await get(env.app, `/jobs/${jobId}/download.zip`, attacker.token)).status).toBe(404);
    expect((await remove(env.app, `/jobs/${jobId}`, attacker.token)).status).toBe(404);
    expect(await env.jobs.getJob(owner.userId, jobId)).not.toBeNull();
    expect(
      await keysWithPrefix(env, env.buckets.optimizedBucket, `${owner.userId}/${jobId}/`),
    ).toHaveLength(1);
  }, 30_000);
});
