/**
 * A-02 (loop 2): `DeleteObjects` con `Errors[]` debe tratarse como fallo.
 * En RED el loop 1 contabilizaba el chunk como éxito y borraba la fila.
 */

import { describe, expect, it } from 'vitest';

import { createS3FaultApp } from './s3-fault-fixture';

const jobId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const imageId = 'img_partial';

async function deleteRequest(app: import('hono').Hono, token: string): Promise<Response> {
  return app.request(`/jobs/${jobId}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${token}` },
  });
}

describe('A-02 — errores parciales de DeleteObjects (loop 2)', () => {
  it('fallo parcial permanente: conserva fila y objeto fallido, responde error acotado', async () => {
    const env = createS3FaultApp({ deletePlan: { failCalls: Number.POSITIVE_INFINITY } });
    const { token, userId } = await env.register('t05.loop2.delete.partial@example.com');
    await env.seedJob(userId, jobId, [imageId]);
    const rawKey = `${userId}/${jobId}/raw/${imageId}`;
    const failedKey = `${userId}/${jobId}/optimized/${imageId}.webp`;
    env.s3.seed(rawKey, Buffer.from('raw'));
    env.s3.seed(failedKey, Buffer.from('webp'));
    env.s3.deletePlan.failKeys = new Set([failedKey]);

    const response = await deleteRequest(env.app, token);
    expect(response.status).toBeGreaterThanOrEqual(500);
    const body = (await response.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('PARTIAL_DELETE_FAILED');
    expect(body.error.message).not.toContain(userId);
    expect(body.error.message).not.toContain(failedKey);
    expect(await env.jobs.getJob(userId, jobId)).not.toBeNull();
    expect(env.s3.objects.has(failedKey)).toBe(true);
    // Reintento acotado: dos buckets × como máximo 3 intentos por lote.
    expect(env.s3.deleteCommands.length).toBeLessThanOrEqual(6);
  });

  it('fallo parcial transitorio: reintenta, borra todo y devuelve 204', async () => {
    const env = createS3FaultApp({ deletePlan: { failCalls: 1 } });
    const { token, userId } = await env.register('t05.loop2.delete.retry@example.com');
    await env.seedJob(userId, jobId, [imageId]);
    const rawKey = `${userId}/${jobId}/raw/${imageId}`;
    const failedKey = `${userId}/${jobId}/optimized/${imageId}.webp`;
    const thumbKey = `${userId}/${jobId}/optimized/${imageId}_thumb.webp`;
    env.s3.seed(rawKey, Buffer.from('raw'));
    env.s3.seed(failedKey, Buffer.from('webp'));
    env.s3.seed(thumbKey, Buffer.from('thumb'));
    env.s3.deletePlan.failKeys = new Set([failedKey]);

    const response = await deleteRequest(env.app, token);
    expect(response.status).toBe(204);
    expect(await env.jobs.getJob(userId, jobId)).toBeNull();
    expect([...env.s3.objects.keys()]).toHaveLength(0);
    expect(env.s3.deleteCommands.length).toBeLessThanOrEqual(4);
  });

  it('solo contabiliza claves confirmadas como borradas', async () => {
    const env = createS3FaultApp({ deletePlan: { failCalls: Number.POSITIVE_INFINITY } });
    const { userId } = await env.register('t05.loop2.delete.count@example.com');
    await env.seedJob(userId, jobId, [imageId]);
    const failedKey = `${userId}/${jobId}/raw/${imageId}`;
    env.s3.seed(failedKey, Buffer.from('raw'));
    env.s3.deletePlan.failKeys = new Set([failedKey]);

    await expect(env.objectAccess.deleteJobObjects({ userId, jobId })).rejects.toThrow();
    expect(env.s3.objects.has(failedKey)).toBe(true);
  });
});
