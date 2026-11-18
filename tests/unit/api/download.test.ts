/**
 * Descarga individual (F02-T05, CA-05, FR-17): URL presignada por variante,
 * validada con esquemas congelados y siempre con el `userId` del JWT.
 */

import { describe, expect, it } from 'vitest';

import { createDownloadTestApp, getBinary, jsonOf } from './object-access-fixture';

const jobId = '11111111-1111-4111-8111-111111111111';
const imageId = 'img_100x100';

describe('GET /jobs/:id/download/:imageId (CA-05)', () => {
  it('devuelve una URL HTTPS presignada para la variante webp del usuario', async () => {
    const env = createDownloadTestApp();
    const { token, userId } = await env.register('t05.download.webp@example.com');
    env.seedJob(userId, jobId, [imageId]);

    const response = await getBinary(
      env.app,
      `/jobs/${jobId}/download/${imageId}?variant=webp`,
      token,
    );
    expect(response.status).toBe(200);
    const body = await jsonOf(response);
    expect(String(body.downloadUrl)).toMatch(/^https:\/\/127\.0\.0\.1:9297\//);
    expect(String(body.downloadUrl)).toContain(`${userId}/${jobId}/optimized/${imageId}.webp`);
    expect(String(body.downloadUrl)).toContain('X-Amz-Signature=');
    expect(typeof body.expiresAt).toBe('string');
    expect(Number.isNaN(Date.parse(String(body.expiresAt)))).toBe(false);
    expect(body).not.toHaveProperty('bytes');
    expect(env.objects.presignCalls).toHaveLength(1);
    expect(env.objects.presignCalls[0]).toMatchObject({ userId, jobId, imageId, variant: 'webp' });
  });

  it('genera URLs distintas para avif, thumbnail y original', async () => {
    const env = createDownloadTestApp();
    const { token, userId } = await env.register('t05.download.variants@example.com');
    env.seedJob(userId, jobId, [imageId]);

    for (const [variant, suffix] of [
      ['avif', `${imageId}.avif`],
      ['thumbnail', `${imageId}_thumb.webp`],
      ['original', `${imageId}`],
    ] as const) {
      const response = await getBinary(
        env.app,
        `/jobs/${jobId}/download/${imageId}?variant=${variant}`,
        token,
      );
      expect(response.status).toBe(200);
      const body = await jsonOf(response);
      expect(String(body.downloadUrl)).toContain(suffix);
      expect(String(body.downloadUrl)).toContain(
        variant === 'original' ? '/raw/' : '/optimized/',
      );
    }
    expect(env.objects.presignCalls.map((call) => call.variant)).toEqual([
      'avif',
      'thumbnail',
      'original',
    ]);
  });

  it('devuelve 404 indistinto para lote ajeno y lote inexistente', async () => {
    const env = createDownloadTestApp();
    const owner = await env.register('t05.download.owner@example.com');
    const attacker = await env.register('t05.download.attacker@example.com');
    env.seedJob(owner.userId, jobId, [imageId]);
    env.objects.seedOptimized(
      { userId: owner.userId, jobId },
      imageId,
      'webp',
      Buffer.from('binario-privado-del-dueno'),
    );

    const foreign = await getBinary(
      env.app,
      `/jobs/${jobId}/download/${imageId}?variant=webp`,
      attacker.token,
    );
    const missing = await getBinary(
      env.app,
      '/jobs/99999999-9999-4999-8999-999999999999/download/img_absente?variant=webp',
      attacker.token,
    );

    expect(foreign.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(await foreign.json()).toEqual(await missing.json());
    expect(env.objects.presignCalls).toHaveLength(0);
  });

  it('devuelve 404 para una imagen que no pertenece al lote propio', async () => {
    const env = createDownloadTestApp();
    const { token, userId } = await env.register('t05.download.image@example.com');
    env.seedJob(userId, jobId, [imageId]);

    const response = await getBinary(
      env.app,
      `/jobs/${jobId}/download/img_inexistente?variant=webp`,
      token,
    );
    expect(response.status).toBe(404);
    expect(env.objects.presignCalls).toHaveLength(0);
  });

  it('toma el userId del JWT aunque el cliente envíe cabeceras de suplantación', async () => {
    const env = createDownloadTestApp();
    const owner = await env.register('t05.download.jwt@example.com');
    env.seedJob(owner.userId, jobId, [imageId]);

    const response = await env.app.request(
      `/jobs/${jobId}/download/${imageId}?variant=webp`,
      {
        headers: {
          authorization: `Bearer ${owner.token}`,
          'x-user-id': 'usuario-ajeno',
          'x-forwarded-user': 'usuario-ajeno',
        },
      },
    );
    expect(response.status).toBe(200);
    expect(env.objects.presignCalls[0]?.userId).toBe(owner.userId);
  });

  it('rechaza variantes no permitidas e IDs inseguros con 400', async () => {
    const env = createDownloadTestApp();
    const { token, userId } = await env.register('t05.download.validation@example.com');
    env.seedJob(userId, jobId, [imageId]);

    expect(
      (await getBinary(env.app, `/jobs/${jobId}/download/${imageId}?variant=jpg`, token)).status,
    ).toBe(400);
    expect(
      (await getBinary(
        env.app,
        `/jobs/${jobId}/download/${encodeURIComponent('../victim')}?variant=webp`,
        token,
      )).status,
    ).toBe(400);
    expect(env.objects.presignCalls).toHaveLength(0);
  });

  it('sin autenticación responde 401 y no firma nada', async () => {
    const env = createDownloadTestApp();
    const { userId } = await env.register('t05.download.anon@example.com');
    env.seedJob(userId, jobId, [imageId]);

    const response = await getBinary(env.app, `/jobs/${jobId}/download/${imageId}?variant=webp`);
    expect(response.status).toBe(401);
    expect(env.objects.presignCalls).toHaveLength(0);
  });
});
