import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TestTable } from '../db/table-fixture';
import { createApiIntegrationEnv, getJson, postJson, type ApiIntegrationEnv } from './fixtures';

type JsonObject = Record<string, unknown>;
const jsonOf = async (response: Response): Promise<JsonObject> =>
  (await response.json()) as JsonObject;

describe('rutas /jobs con DynamoDB real en aws-emulator (CA-01)', () => {
  let env: ApiIntegrationEnv;
  let table: TestTable;

  beforeAll(async () => {
    env = await createApiIntegrationEnv('api-routes');
    table = env.table;
  });

  afterAll(async () => {
    if (table !== undefined) await table.dispose();
  });

  it('registro, creación, listado y detalle respetan el userId del JWT', async () => {
    const a = await env.register('a.integration@example.com');
    const b = await env.register('b.integration@example.com');
    const job = await env.createJob(a.token);

    expect(job).toMatchObject({ userId: a.userId, status: 'PENDING', preset: 'HIGH' });

    const listA = await jsonOf(await getJson(env.app, '/jobs', a.token));
    const listB = await jsonOf(await getJson(env.app, '/jobs', b.token));
    expect((listA.jobs as JsonObject[]).map((item) => item.jobId)).toEqual([job.jobId]);
    expect(listB.jobs).toEqual([]);

    const detail = await jsonOf(await getJson(env.app, `/jobs/${job.jobId}`, a.token));
    expect(detail.job).toMatchObject({ jobId: job.jobId, userId: a.userId });
  });

  it('un lote ajeno devuelve 404 idéntico al inexistente', async () => {
    const a = await env.register('owner.integration@example.com');
    const b = await env.register('other.integration@example.com');
    const job = await env.createJob(a.token);

    const foreign = await getJson(env.app, `/jobs/${job.jobId}`, b.token);
    const missing = await getJson(env.app, '/jobs/no_existe', b.token);
    expect(foreign.status).toBe(404);
    expect(await foreign.text()).toBe(await missing.text());
  });

  it('confirm es idempotente contra la tabla real y publica una sola vez', async () => {
    const a = await env.register('confirm.integration@example.com');
    const job = await env.createJob(a.token);
    const jobId = job.jobId as string;
    const before = env.publisher.messages.length;

    const first = await postJson(env.app, `/jobs/${jobId}/confirm`, {}, a.token);
    const second = await postJson(env.app, `/jobs/${jobId}/confirm`, {}, a.token);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(((await jsonOf(first)).job as JsonObject).status).toBe('PROCESSING');
    expect(env.publisher.messages.length).toBe(before + 1);
    expect(env.publisher.messages.at(-1)).toEqual({ userId: a.userId, jobId });
  });

  it('dos confirms HTTP en paralelo sobre DynamoDB real publican una sola vez', async () => {
    const a = await env.register('concurrent.integration@example.com');
    const job = await env.createJob(a.token);
    const jobId = job.jobId as string;
    const before = env.publisher.messages.length;

    const [first, second] = await Promise.all([
      postJson(env.app, `/jobs/${jobId}/confirm`, {}, a.token),
      postJson(env.app, `/jobs/${jobId}/confirm`, {}, a.token),
    ]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(env.publisher.messages.length).toBe(before + 1);
    expect(env.publisher.messages.at(-1)).toEqual({ userId: a.userId, jobId });
  });

  it('si falla la publicación contra DynamoDB real, el lote vuelve a PENDING', async () => {
    const a = await env.register('rollback.integration@example.com');
    const job = await env.createJob(a.token);
    const jobId = job.jobId as string;
    env.publisher.failNext = true;

    const failed = await postJson(env.app, `/jobs/${jobId}/confirm`, {}, a.token);
    expect(failed.status).toBe(503);
    expect(((await jsonOf(failed)).error as JsonObject).code).toBe('PUBLISH_FAILED');

    const detail = await jsonOf(await getJson(env.app, `/jobs/${jobId}`, a.token));
    expect((detail.job as JsonObject).status).toBe('PENDING');
  });

  it('sin token, las cuatro rutas devuelven 401', async () => {
    const responses = [
      await postJson(env.app, '/jobs', {
        preset: 'HIGH',
        files: [{ fileName: 'foto.jpg', contentType: 'image/jpeg', sizeBytes: 1024 }],
      }),
      await postJson(env.app, '/jobs/x/confirm', {}),
      await getJson(env.app, '/jobs'),
      await getJson(env.app, '/jobs/x'),
    ];
    for (const response of responses) expect(response.status).toBe(401);
  });
});
