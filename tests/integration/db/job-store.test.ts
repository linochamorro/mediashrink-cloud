/** F01-T02 — CRUD de jobs e ítems hijos contra el emulador (CA-02). */

import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createJobStore,
  ImageNotFoundError,
  JobAlreadyExistsError,
  JobNotFoundError,
  type JobStore,
} from '../../../backend/src/db/index';
import { makeImage, makeJob, FIXED_CREATED_AT } from './factories';
import { createTestTable, type TestTable } from './table-fixture';

describe('F01-T02 — CRUD DynamoDB con aislamiento por userId', () => {
  let table: TestTable;
  let store: JobStore;

  beforeAll(async () => {
    table = await createTestTable('crud');
    store = createJobStore({ tableName: table.tableName, client: table.documentClient });
  });

  afterAll(async () => {
    await table?.dispose();
  });

  it('crea un job y lo recupera por userId + jobId', async () => {
    const job = makeJob();
    await store.createJob(job);

    await expect(store.getJob(job.userId, job.jobId)).resolves.toEqual(job);
  });

  it('rechaza crear dos veces el mismo job (misma partición y clave)', async () => {
    const job = makeJob();
    await store.createJob(job);

    await expect(store.createJob(job)).rejects.toBeInstanceOf(JobAlreadyExistsError);
  });

  it('actualiza estado y métricas sin perder claves ni TTL', async () => {
    const job = makeJob();
    await store.createJob(job);

    const updated = await store.updateJob(job.userId, job.jobId, {
      status: 'COMPLETED',
      bytesAfter: 400,
      savingsPct: 60,
      updatedAt: '2026-11-17T10:01:00.000Z',
    });

    expect(updated).toMatchObject({
      userId: job.userId,
      jobId: job.jobId,
      status: 'COMPLETED',
      bytesAfter: 400,
      savingsPct: 60,
      ttl: job.ttl,
      createdAt: FIXED_CREATED_AT,
      updatedAt: '2026-11-17T10:01:00.000Z',
    });
    await expect(store.getJob(job.userId, job.jobId)).resolves.toEqual(updated);
  });

  it('falla al actualizar un job inexistente', async () => {
    const userId = `user-${randomUUID()}`;
    const jobId = `job-${randomUUID()}`;

    await expect(store.updateJob(userId, jobId, { status: 'PROCESSING' })).rejects.toBeInstanceOf(
      JobNotFoundError,
    );
  });

  it('borra un job; leerlo devuelve null y borrarlo de nuevo falla', async () => {
    const job = makeJob();
    await store.createJob(job);

    await store.deleteJob(job.userId, job.jobId);
    await expect(store.getJob(job.userId, job.jobId)).resolves.toBeNull();
    await expect(store.deleteJob(job.userId, job.jobId)).rejects.toBeInstanceOf(JobNotFoundError);
  });

  it('guarda y lista ítems hijos por imagen con estado, bytes y EXIF', async () => {
    const job = makeJob();
    await store.createJob(job);
    const first = makeImage({ imageId: 'img-a', status: 'COMPLETED' });
    const second = makeImage({
      imageId: 'img-b',
      status: 'FAILED',
      bytesAfter: undefined,
      failureReason: 'FORMATO_NO_SOPORTADO',
    });

    await store.putImage(job.userId, job.jobId, first);
    await store.putImage(job.userId, job.jobId, second);

    const images = await store.listImages(job.userId, job.jobId);
    expect(images).toHaveLength(2);
    expect(images).toEqual(expect.arrayContaining([first, second]));
    await expect(store.getImage(job.userId, job.jobId, 'img-a')).resolves.toEqual(first);
  });

  it('actualiza y elimina un ítem hijo sin afectar al job', async () => {
    const job = makeJob();
    await store.createJob(job);
    await store.putImage(job.userId, job.jobId, makeImage({ imageId: 'img-c' }));

    const updated = await store.updateImage(job.userId, job.jobId, 'img-c', {
      status: 'PARTIAL',
      bytesAfter: 250,
    });
    expect(updated).toMatchObject({ imageId: 'img-c', status: 'PARTIAL', bytesAfter: 250 });

    await expect(store.updateImage(job.userId, job.jobId, 'img-inexistente', {})).rejects.toBeInstanceOf(
      ImageNotFoundError,
    );
    await store.deleteImages(job.userId, job.jobId);
    await expect(store.listImages(job.userId, job.jobId)).resolves.toEqual([]);
    await expect(store.getJob(job.userId, job.jobId)).resolves.toEqual(job);
  });

  it('borra el job y todas sus imágenes en una sola operación', async () => {
    const job = makeJob();
    await store.createJob(job);
    await store.putImage(job.userId, job.jobId, makeImage({ imageId: 'img-d' }));

    await store.deleteJobWithImages(job.userId, job.jobId);

    await expect(store.getJob(job.userId, job.jobId)).resolves.toBeNull();
    await expect(store.listImages(job.userId, job.jobId)).resolves.toEqual([]);
  });
});
