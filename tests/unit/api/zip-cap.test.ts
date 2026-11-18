/**
 * A-01 (loop 2): tope explícito del ZIP. Las pruebas fallan en RED porque el
 * loop 1 materializaba todas las variantes sin acotar tamaño ni entradas.
 */

import { describe, expect, it } from 'vitest';

import { createS3FaultApp, type S3FaultApp } from './s3-fault-fixture';

const jobId = '99999999-9999-4999-8999-999999999999';
const imageId = 'img_big';

async function zipRequest(env: S3FaultApp, token: string): Promise<Response> {
  return env.app.request(`/jobs/${jobId}/download.zip`, {
    headers: { authorization: `Bearer ${token}` },
  });
}

describe('A-01 — tope explícito del ZIP (loop 2)', () => {
  it('rechaza 413 por bytes sumados antes de materializar ningún objeto', async () => {
    const env = createS3FaultApp({ maxZipBytes: 100 });
    const { token, userId } = await env.register('t05.loop2.zip.bytes@example.com');
    await env.seedJob(userId, jobId, [imageId]);
    env.s3.seed(
      `${userId}/${jobId}/optimized/${imageId}.webp`,
      Buffer.alloc(200, 1),
      200,
    );

    await expect(
      env.objectAccess.readOptimizedObjects({ userId, jobId }, [imageId]),
    ).rejects.toThrow();
    expect(env.s3.materializations).toHaveLength(0);

    const response = await zipRequest(env, token);
    expect(response.status).toBe(413);
    const body = (await response.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('ZIP_TOO_LARGE');
    expect(body.error.message).not.toContain(userId);
    expect(env.s3.materializations).toHaveLength(0);
  });

  it('rechaza 413 por número de entradas antes de materializar', async () => {
    const env = createS3FaultApp({ maxZipEntries: 1 });
    const { token, userId } = await env.register('t05.loop2.zip.entries@example.com');
    await env.seedJob(userId, jobId, [imageId]);
    env.s3.seed(`${userId}/${jobId}/optimized/${imageId}.webp`, Buffer.from('a'));
    env.s3.seed(`${userId}/${jobId}/optimized/${imageId}.avif`, Buffer.from('b'));

    await expect(
      env.objectAccess.readOptimizedObjects({ userId, jobId }, [imageId]),
    ).rejects.toThrow();
    expect(env.s3.materializations).toHaveLength(0);
    expect((await zipRequest(env, token)).status).toBe(413);
  });

  it('se fija en ContentLength declarado, no solo en los bytes ya leídos', async () => {
    const env = createS3FaultApp({ maxZipBytes: 100 });
    const { token, userId } = await env.register('t05.loop2.zip.declared@example.com');
    await env.seedJob(userId, jobId, [imageId]);
    env.s3.seed(`${userId}/${jobId}/optimized/${imageId}.webp`, Buffer.from('corto'), 1000);

    expect((await zipRequest(env, token)).status).toBe(413);
    expect(env.s3.materializations).toHaveLength(0);
  });

  it('un lote dentro del tope sigue generando el ZIP completo', async () => {
    const env = createS3FaultApp({ maxZipBytes: 1024, maxZipEntries: 3 });
    const { token, userId } = await env.register('t05.loop2.zip.ok@example.com');
    await env.seedJob(userId, jobId, [imageId]);
    env.s3.seed(`${userId}/${jobId}/optimized/${imageId}.webp`, Buffer.from('webp'));
    env.s3.seed(`${userId}/${jobId}/optimized/${imageId}.avif`, Buffer.from('avif'));
    env.s3.seed(`${userId}/${jobId}/optimized/${imageId}_thumb.webp`, Buffer.from('thumb'));

    const response = await zipRequest(env, token);
    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer()).subarray(0, 2).toString('ascii')).toBe('PK');
    expect(env.s3.materializations).toHaveLength(3);
  });
});
