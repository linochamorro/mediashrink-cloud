/** F01-T02 — Aislamiento estricto por userId (PR-07, CA-02, spec §6). */

import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createJobStore,
  ImageNotFoundError,
  JobNotFoundError,
  type JobStore,
} from '../../../backend/src/db/index';
import { makeImage, makeJob } from './factories';
import { createTestTable, type TestTable } from './table-fixture';

describe('F01-T02 — usuario B nunca ve ni toca los lotes de A', () => {
  let table: TestTable;
  let store: JobStore;
  const userA = `user-A-${randomUUID()}`;
  const userB = `user-B-${randomUUID()}`;

  beforeAll(async () => {
    table = await createTestTable('isolation');
    store = createJobStore({ tableName: table.tableName, client: table.documentClient });
  });

  afterAll(async () => {
    await table?.dispose();
  });

  it('B no lee el job de A: la persistencia responde null (404 lógico)', async () => {
    const jobA = makeJob({ userId: userA });
    await store.createJob(jobA);

    await expect(store.getJob(userB, jobA.jobId)).resolves.toBeNull();
    await expect(store.getJob(userA, jobA.jobId)).resolves.toEqual(jobA);
  });

  it('B no modifica el job de A: falla y el original queda intacto', async () => {
    const jobA = makeJob({ userId: userA, status: 'PENDING' });
    await store.createJob(jobA);

    await expect(
      store.updateJob(userB, jobA.jobId, { status: 'COMPLETED', bytesAfter: 1, savingsPct: 99.9 }),
    ).rejects.toBeInstanceOf(JobNotFoundError);
    await expect(store.getJob(userA, jobA.jobId)).resolves.toEqual(jobA);
  });

  it('B no borra el job de A: falla y el job sigue existiendo', async () => {
    const jobA = makeJob({ userId: userA });
    await store.createJob(jobA);

    await expect(store.deleteJob(userB, jobA.jobId)).rejects.toBeInstanceOf(JobNotFoundError);
    await expect(store.getJob(userA, jobA.jobId)).resolves.toEqual(jobA);
    await expect(store.deleteJobWithImages(userB, jobA.jobId)).rejects.toBeInstanceOf(
      JobNotFoundError,
    );
    await expect(store.getJob(userA, jobA.jobId)).resolves.toEqual(jobA);
  });

  it('B no ve ni modifica las imágenes de A', async () => {
    const jobA = makeJob({ userId: userA });
    await store.createJob(jobA);
    await store.putImage(userA, jobA.jobId, makeImage({ imageId: 'img-privada' }));

    await expect(store.listImages(userB, jobA.jobId)).resolves.toEqual([]);
    await expect(store.getImage(userB, jobA.jobId, 'img-privada')).resolves.toBeNull();
    await expect(
      store.updateImage(userB, jobA.jobId, 'img-privada', { status: 'FAILED' }),
    ).rejects.toBeInstanceOf(JobNotFoundError);
    await expect(store.deleteImages(userB, jobA.jobId)).resolves.toBeUndefined();
    await expect(store.listImages(userA, jobA.jobId)).resolves.toHaveLength(1);
  });

  it('un imageId ajeno no puede consultarse con otro userId ni otro jobId', async () => {
    const jobA = makeJob({ userId: userA });
    await store.createJob(jobA);
    await store.putImage(userA, jobA.jobId, makeImage({ imageId: 'img-unica' }));

    await expect(store.getImage(userA, jobA.jobId, 'img-inexistente')).resolves.toBeNull();
    await expect(store.getImage(userA, 'job-otro', 'img-unica')).resolves.toBeNull();
    await expect(store.updateImage(userA, jobA.jobId, 'img-inexistente', {})).rejects.toBeInstanceOf(
      ImageNotFoundError,
    );
  });

  it('A y B pueden usar el mismo jobId sin colisión ni fuga de datos', async () => {
    const sharedJobId = `job-compartido-${randomUUID()}`;
    const jobA = makeJob({ userId: userA, jobId: sharedJobId, bytesBefore: 1000, bytesAfter: 900 });
    const jobB = makeJob({ userId: userB, jobId: sharedJobId, bytesBefore: 1000, bytesAfter: 100 });

    await store.createJob(jobA);
    await store.createJob(jobB);
    await store.putImage(userA, sharedJobId, makeImage({ imageId: 'img-de-A' }));
    await store.putImage(userB, sharedJobId, makeImage({ imageId: 'img-de-B' }));

    await expect(store.getJob(userA, sharedJobId)).resolves.toEqual(jobA);
    await expect(store.getJob(userB, sharedJobId)).resolves.toEqual(jobB);
    await expect(store.listImages(userA, sharedJobId).then((xs) => xs.map((x) => x.imageId))).resolves.toEqual([
      'img-de-A',
    ]);
    await expect(store.listImages(userB, sharedJobId).then((xs) => xs.map((x) => x.imageId))).resolves.toEqual([
      'img-de-B',
    ]);
  });
});
