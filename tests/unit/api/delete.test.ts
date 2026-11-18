/**
 * Borrado manual de lote (F02-T05, CA-05, FR-19): objetos `raw` + `optimized`
 * del usuario y fila DynamoDB, con 404 indistinto y sin tocar lotes ajenos.
 */

import type { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import { createDownloadTestApp, jsonOf } from './object-access-fixture';

const jobId = '55555555-5555-4555-8555-555555555555';
const otherJobId = '66666666-6666-4666-8666-666666666666';
const imageA = 'img_gamma';
const imageB = 'img_delta';

async function deleteJob(app: Hono, path: string, token?: string): Promise<Response> {
  return app.request(path, {
    method: 'DELETE',
    headers: {
      ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
    },
  });
}

describe('DELETE /jobs/:id (CA-05)', () => {
  it('elimina objetos raw y optimized y la fila del lote', async () => {
    const env = createDownloadTestApp();
    const { token, userId } = await env.register('t05.delete.owner@example.com');
    env.seedJob(userId, jobId, [imageA, imageB]);

    const scope = { userId, jobId };
    env.objects.seedRaw(scope, imageA, Buffer.from('raw-a'));
    env.objects.seedRaw(scope, imageB, Buffer.from('raw-b'));
    env.objects.seedOptimized(scope, imageA, 'webp', Buffer.from('webp-a'));
    env.objects.seedOptimized(scope, imageA, 'avif', Buffer.from('avif-a'));
    env.objects.seedOptimized(scope, imageA, 'thumbnail', Buffer.from('thumb-a'));
    env.objects.seedOptimized(scope, imageB, 'webp', Buffer.from('webp-b'));

    const imagesBefore = await env.jobs.listImages(userId, jobId);
    expect(imagesBefore.map((image) => image.imageId)).toEqual([imageA, imageB]);

    const response = await deleteJob(env.app, `/jobs/${jobId}`, token);
    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
    expect([...env.objects.objects.keys()]).toHaveLength(0);
    expect(await env.jobs.getJob(userId, jobId)).toBeNull();
    expect(env.objects.deleteCalls).toEqual([{ userId, jobId }]);
  });

  it('404 indistinto para lote ajeno e inexistente, sin borrar nada', async () => {
    const env = createDownloadTestApp();
    const owner = await env.register('t05.delete.isolation.owner@example.com');
    const attacker = await env.register('t05.delete.isolation.attacker@example.com');
    env.seedJob(owner.userId, jobId, [imageA]);
    env.objects.seedRaw({ userId: owner.userId, jobId }, imageA, Buffer.from('raw-privado'));
    env.objects.seedOptimized(
      { userId: owner.userId, jobId },
      imageA,
      'webp',
      Buffer.from('webp-privado'),
    );

    const foreign = await deleteJob(env.app, `/jobs/${jobId}`, attacker.token);
    const missing = await deleteJob(
      env.app,
      '/jobs/99999999-9999-4999-8999-999999999999',
      attacker.token,
    );
    expect(foreign.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(await jsonOf(foreign)).toEqual(await jsonOf(missing));
    expect(env.objects.deleteCalls).toHaveLength(0);
    expect(await env.jobs.getJob(owner.userId, jobId)).not.toBeNull();
    expect([...env.objects.objects.keys()]).toHaveLength(2);
  });

  it('segunda llamada es segura: 404 sin efecto y sin borrar otros lotes', async () => {
    const env = createDownloadTestApp();
    const { token, userId } = await env.register('t05.delete.idempotent@example.com');
    env.seedJob(userId, jobId, [imageA]);
    env.seedJob(userId, otherJobId, [imageB]);
    env.objects.seedRaw({ userId, jobId }, imageA, Buffer.from('raw-a'));
    env.objects.seedRaw({ userId, jobId: otherJobId }, imageB, Buffer.from('raw-b'));
    env.objects.seedOptimized({ userId, jobId }, imageA, 'webp', Buffer.from('webp-a'));
    env.objects.seedOptimized({ userId, jobId: otherJobId }, imageB, 'avif', Buffer.from('avif-b'));

    expect((await deleteJob(env.app, `/jobs/${jobId}`, token)).status).toBe(204);
    const second = await deleteJob(env.app, `/jobs/${jobId}`, token);
    expect(second.status).toBe(404);
    expect(env.objects.deleteCalls).toHaveLength(1);
    expect(await env.jobs.getJob(userId, otherJobId)).not.toBeNull();
    const remaining = [...env.objects.objects.keys()].sort();
    expect(remaining).toHaveLength(2);
    expect(remaining.every((key) => key.startsWith(`${userId}/${otherJobId}/`))).toBe(true);
  });

  it('si falla el borrado S3, conserva la fila para poder reintentar', async () => {
    const env = createDownloadTestApp();
    const { token, userId } = await env.register('t05.delete.retry@example.com');
    env.seedJob(userId, jobId, [imageA]);
    env.objects.seedRaw({ userId, jobId }, imageA, Buffer.from('raw-a'));
    env.objects.failNextDelete = true;

    const response = await deleteJob(env.app, `/jobs/${jobId}`, token);
    expect(response.status).toBeGreaterThanOrEqual(500);
    expect(await env.jobs.getJob(userId, jobId)).not.toBeNull();
    expect([...env.objects.objects.keys()]).toHaveLength(1);

    const retry = await deleteJob(env.app, `/jobs/${jobId}`, token);
    expect(retry.status).toBe(204);
    expect(await env.jobs.getJob(userId, jobId)).toBeNull();
    expect([...env.objects.objects.keys()]).toHaveLength(0);
  });

  it('sin JWT responde 401', async () => {
    const env = createDownloadTestApp();
    const { userId } = await env.register('t05.delete.anon@example.com');
    env.seedJob(userId, jobId, [imageA]);

    expect((await deleteJob(env.app, `/jobs/${jobId}`)).status).toBe(401);
    expect(env.objects.deleteCalls).toHaveLength(0);
  });
});
