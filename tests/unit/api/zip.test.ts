/**
 * Descarga ZIP (F02-T05, CA-05, FR-18 / A-05): optimizadas WebP + AVIF y
 * miniaturas del lote en un Buffer en memoria, sin archivos temporales.
 */

import { describe, expect, it } from 'vitest';

import { createDownloadTestApp, getBinary, jsonOf } from './object-access-fixture';
import { readZip } from './zip-reader';

const jobId = '33333333-3333-4333-8333-333333333333';
const otherJobId = '44444444-4444-4444-8444-444444444444';
const imageA = 'img_alpha';
const imageB = 'img_beta';

describe('GET /jobs/:id/download.zip (CA-05)', () => {
  it('devuelve un ZIP con WebP, AVIF y miniatura de cada imagen del lote', async () => {
    const env = createDownloadTestApp();
    const { token, userId } = await env.register('t05.zip.owner@example.com');
    env.seedJob(userId, jobId, [imageA, imageB]);

    const scope = { userId, jobId };
    env.objects.seedOptimized(scope, imageA, 'webp', Buffer.from('alpha-webp'));
    env.objects.seedOptimized(scope, imageA, 'avif', Buffer.from('alpha-avif'));
    env.objects.seedOptimized(scope, imageA, 'thumbnail', Buffer.from('alpha-thumb'));
    env.objects.seedOptimized(scope, imageB, 'webp', Buffer.from('beta-webp'));
    env.objects.seedOptimized(scope, imageB, 'avif', Buffer.from('beta-avif'));
    env.objects.seedOptimized(scope, imageB, 'thumbnail', Buffer.from('beta-thumb'));

    const response = await getBinary(env.app, `/jobs/${jobId}/download.zip`, token);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/zip');
    expect(response.headers.get('content-disposition')).toContain(`${jobId}.zip`);
    expect(response.headers.get('cache-control')).toContain('no-store');

    const bytes = Buffer.from(await response.arrayBuffer());
    expect(bytes.subarray(0, 2).toString('ascii')).toBe('PK');
    const entries = readZip(bytes);
    expect(entries.map((entry) => entry.name)).toEqual([
      `${imageA}.webp`,
      `${imageA}.avif`,
      `${imageA}_thumb.webp`,
      `${imageB}.webp`,
      `${imageB}.avif`,
      `${imageB}_thumb.webp`,
    ]);
    expect(entries.map((entry) => entry.bytes.toString('utf8'))).toEqual([
      'alpha-webp',
      'alpha-avif',
      'alpha-thumb',
      'beta-webp',
      'beta-avif',
      'beta-thumb',
    ]);
    expect(env.objects.readCalls[0]).toMatchObject({
      request: { userId, jobId },
      imageIds: [imageA, imageB],
    });
  });

  it('omite variantes ausentes de un lote parcial sin fallar', async () => {
    const env = createDownloadTestApp();
    const { token, userId } = await env.register('t05.zip.partial@example.com');
    env.seedJob(userId, jobId, [imageA, imageB]);
    const scope = { userId, jobId };
    env.objects.seedOptimized(scope, imageA, 'webp', Buffer.from('solo-webp'));
    env.objects.seedOptimized(scope, imageB, 'avif', Buffer.from('solo-avif'));

    const response = await getBinary(env.app, `/jobs/${jobId}/download.zip`, token);
    expect(response.status).toBe(200);
    expect(readZip(Buffer.from(await response.arrayBuffer())).map((entry) => entry.name)).toEqual([
      `${imageA}.webp`,
      `${imageB}.avif`,
    ]);
  });

  it('no incluye binarios de otro usuario ni de otro lote', async () => {
    const env = createDownloadTestApp();
    const owner = await env.register('t05.zip.isolation.owner@example.com');
    const attacker = await env.register('t05.zip.isolation.attacker@example.com');
    env.seedJob(owner.userId, jobId, [imageA]);
    env.objects.seedOptimized(
      { userId: owner.userId, jobId },
      imageA,
      'webp',
      Buffer.from('secreto-del-propietario'),
    );
    env.objects.seedOptimized(
      { userId: attacker.userId, jobId },
      imageA,
      'webp',
      Buffer.from('secreto-del-atacante'),
    );

    const response = await getBinary(env.app, `/jobs/${jobId}/download.zip`, attacker.token);
    expect(response.status).toBe(404);
    expect(env.objects.readCalls).toHaveLength(0);

    const own = await getBinary(env.app, `/jobs/${jobId}/download.zip`, owner.token);
    expect(own.status).toBe(200);
    const names = readZip(Buffer.from(await own.arrayBuffer())).map((entry) => entry.name);
    expect(names).toEqual([`${imageA}.webp`]);
    expect(env.objects.readCalls[0]?.request.userId).toBe(owner.userId);
  });

  it('acota la lectura al lote propio aunque exista otro lote del mismo usuario', async () => {
    const env = createDownloadTestApp();
    const { token, userId } = await env.register('t05.zip.scope@example.com');
    env.seedJob(userId, jobId, [imageA]);
    env.seedJob(userId, otherJobId, [imageB]);
    env.objects.seedOptimized({ userId, jobId }, imageA, 'webp', Buffer.from('propio'));
    env.objects.seedOptimized({ userId, jobId: otherJobId }, imageB, 'webp', Buffer.from('otro'));

    const response = await getBinary(env.app, `/jobs/${jobId}/download.zip`, token);
    const names = readZip(Buffer.from(await response.arrayBuffer())).map((entry) => entry.name);
    expect(names).toEqual([`${imageA}.webp`]);
    expect(env.objects.readCalls[0]?.request.jobId).toBe(jobId);
  });

  it('404 indistinto para lote ajeno e inexistente', async () => {
    const env = createDownloadTestApp();
    const owner = await env.register('t05.zip.404.owner@example.com');
    const attacker = await env.register('t05.zip.404.attacker@example.com');
    env.seedJob(owner.userId, jobId, [imageA]);

    const foreign = await getBinary(env.app, `/jobs/${jobId}/download.zip`, attacker.token);
    const missing = await getBinary(
      env.app,
      '/jobs/99999999-9999-4999-8999-999999999999/download.zip',
      attacker.token,
    );
    const foreignBody = await jsonOf(foreign);
    const missingBody = await jsonOf(missing);
    expect(foreign.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(foreignBody).toEqual(missingBody);
    expect(foreignBody).not.toHaveProperty('images');
  });

  it('sin JWT responde 401', async () => {
    const env = createDownloadTestApp();
    const { userId } = await env.register('t05.zip.anon@example.com');
    env.seedJob(userId, jobId, [imageA]);

    expect((await getBinary(env.app, `/jobs/${jobId}/download.zip`)).status).toBe(401);
    expect(env.objects.readCalls).toHaveLength(0);
  });
});
