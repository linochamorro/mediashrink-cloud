import { describe, expect, it } from 'vitest';

import { computeTtl, schemas } from '../../../backend/src/contracts/index';
import { createApiTestApp, getJson, postJson, validBatch } from './fixtures';

type JsonObject = Record<string, unknown>;
const jsonOf = async (response: Response): Promise<JsonObject> =>
  (await response.json()) as JsonObject;

describe('rutas /jobs (F02-T01, CA-01)', () => {
  it('POST /jobs crea un PENDING con userId del token, formatos congelados y TTL válido', async () => {
    const { app, register } = createApiTestApp();
    const { token, userId } = await register('owner@example.com');

    const response = await postJson(app, '/jobs', validBatch, token);
    expect(response.status).toBe(201);

    const body = await jsonOf(response);
    const job = body.job as JsonObject;
    expect(schemas.Job.parse(job)).toMatchObject({
      userId,
      status: 'PENDING',
      preset: 'BALANCED',
      formats: ['webp', 'avif'],
      // Lote PENDING: sin medición real, el contrato exige 0/0/0 (PR-12).
      bytesBefore: 0,
      bytesAfter: 0,
      savingsPct: 0,
      exifStripped: false,
    });
    expect(job.ttl).toBe(computeTtl(job.createdAt as string));
    expect(job).not.toHaveProperty('passwordHash');
  });

  it('POST /jobs rechaza preset inválido con 400 y no crea el lote', async () => {
    const { app, register, jobs } = createApiTestApp();
    const { token } = await register('owner@example.com');

    const response = await postJson(
      app,
      '/jobs',
      { preset: 'ULTRA', files: validBatch.files },
      token,
    );
    expect(response.status).toBe(400);
    expect(((await jsonOf(response)).error as JsonObject).code).toBe('VALIDATION_ERROR');
    expect(jobs.jobs.size).toBe(0);
  });

  it('POST /jobs rechaza lote vacío, fileName inválido y sizeBytes no enteros', async () => {
    const { app, register, jobs } = createApiTestApp();
    const { token } = await register('owner@example.com');

    for (const body of [
      { preset: 'HIGH', files: [] },
      { preset: 'HIGH', files: [{ fileName: '', contentType: 'image/jpeg', sizeBytes: 1 }] },
      { preset: 'HIGH', files: [{ fileName: 'a.jpg', contentType: 'image/jpeg', sizeBytes: -1 }] },
      { preset: 'HIGH', files: [{ fileName: 'a.jpg', contentType: 'image/jpeg', sizeBytes: 1.5 }] },
    ]) {
      const response = await postJson(app, '/jobs', body, token);
      expect(response.status).toBe(400);
    }
    expect(jobs.jobs.size).toBe(0);
  });

  it('GET /jobs devuelve solo los lotes del usuario autenticado', async () => {
    const { app, register } = createApiTestApp();
    const a = await register('a@example.com');
    const b = await register('b@example.com');

    await postJson(app, '/jobs', validBatch, a.token);
    await postJson(app, '/jobs', validBatch, b.token);

    const response = await getJson(app, '/jobs', a.token);
    expect(response.status).toBe(200);
    const body = await jsonOf(response);
    const jobs = body.jobs as JsonObject[];
    expect(jobs).toHaveLength(1);
    expect(jobs[0].userId).toBe(a.userId);
  });

  it('GET /jobs/:id devuelve el lote propio con sus imágenes', async () => {
    const { app, register, jobs } = createApiTestApp();
    const { token, userId } = await register('owner@example.com');
    const created = await jsonOf(await postJson(app, '/jobs', validBatch, token));
    const jobId = (created.job as JsonObject).jobId as string;

    await jobs.putImage(userId, jobId, {
      imageId: 'img_1',
      status: 'PENDING',
      exifStripped: false,
    });

    const response = await getJson(app, `/jobs/${jobId}`, token);
    expect(response.status).toBe(200);
    const body = await jsonOf(response);
    expect((body.job as JsonObject).jobId).toBe(jobId);
    expect((body.images as JsonObject[])[0].imageId).toBe('img_1');
  });

  it('POST /jobs/:id/confirm publica una vez y pasa a PROCESSING', async () => {
    const { app, register, publisher } = createApiTestApp();
    const { token, userId } = await register('owner@example.com');
    const created = await jsonOf(await postJson(app, '/jobs', validBatch, token));
    const jobId = (created.job as JsonObject).jobId as string;

    const response = await postJson(app, `/jobs/${jobId}/confirm`, {}, token);
    expect(response.status).toBe(200);
    expect(((await jsonOf(response)).job as JsonObject).status).toBe('PROCESSING');
    expect(publisher.messages).toEqual([{ userId, jobId }]);
  });

  it('POST /jobs/:id/confirm es idempotente: la segunda llamada no republica', async () => {
    const { app, register, publisher } = createApiTestApp();
    const { token } = await register('owner@example.com');
    const created = await jsonOf(await postJson(app, '/jobs', validBatch, token));
    const jobId = (created.job as JsonObject).jobId as string;

    await postJson(app, `/jobs/${jobId}/confirm`, {}, token);
    const second = await postJson(app, `/jobs/${jobId}/confirm`, {}, token);

    expect(second.status).toBe(200);
    expect(publisher.messages).toHaveLength(1);
  });

  it('si el publicador falla, revierte a PENDING para permitir el reintento', async () => {
    const { app, register, publisher, jobs } = createApiTestApp();
    const { token, userId } = await register('owner@example.com');
    const created = await jsonOf(await postJson(app, '/jobs', validBatch, token));
    const jobId = (created.job as JsonObject).jobId as string;
    publisher.failNext = true;

    const failed = await postJson(app, `/jobs/${jobId}/confirm`, {}, token);
    expect(failed.status).toBe(503);
    expect(await jobs.getJob(userId, jobId)).toMatchObject({ status: 'PENDING' });
    expect(publisher.messages).toHaveLength(0);

    const retried = await postJson(app, `/jobs/${jobId}/confirm`, {}, token);
    expect(retried.status).toBe(200);
    expect(publisher.messages).toHaveLength(1);
  });
});
