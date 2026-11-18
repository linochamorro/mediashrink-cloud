import { describe, expect, it } from 'vitest';

import { createApiTestApp, postJson, validBatch } from './fixtures';

type JsonObject = Record<string, unknown>;
const jsonOf = async (response: Response): Promise<JsonObject> =>
  (await response.json()) as JsonObject;

async function createJob(app: ReturnType<typeof createApiTestApp>['app'], token: string) {
  const body = await jsonOf(await postJson(app, '/jobs', validBatch, token));
  return (body.job as JsonObject).jobId as string;
}

describe('confirmación de lotes bajo concurrencia y fallos (A-01/A-02)', () => {
  it('dos confirms en paralelo publican una sola vez', async () => {
    const { app, register, publisher, jobs } = createApiTestApp();
    const { token } = await register('owner@example.com');
    const jobId = await createJob(app, token);
    jobs.delayNextUpdate = true;

    const [first, second] = await Promise.all([
      postJson(app, `/jobs/${jobId}/confirm`, {}, token),
      postJson(app, `/jobs/${jobId}/confirm`, {}, token),
    ]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(publisher.messages).toHaveLength(1);
    expect(publisher.messages[0]).toEqual({ userId: expect.any(String), jobId });
    expect(((await jsonOf(first)).job as JsonObject).status).toBe('PROCESSING');
  });

  it('si falla la publicación y la reversión funciona, responde PUBLISH_FAILED y el reintento publica', async () => {
    const { app, register, publisher, jobs } = createApiTestApp();
    const { token, userId } = await register('owner@example.com');
    const jobId = await createJob(app, token);
    publisher.failNext = true;

    const failed = await postJson(app, `/jobs/${jobId}/confirm`, {}, token);
    expect(failed.status).toBe(503);
    expect(((await jsonOf(failed)).error as JsonObject).code).toBe('PUBLISH_FAILED');
    expect(await jobs.getJob(userId, jobId)).toMatchObject({ status: 'PENDING' });

    const retried = await postJson(app, `/jobs/${jobId}/confirm`, {}, token);
    expect(retried.status).toBe(200);
    expect(publisher.messages).toHaveLength(1);
  });

  it('si fallan publicación y reversión, responde 503 CONFIRM_INCONSISTENT sin confirmed true', async () => {
    const { app, register, publisher, jobs } = createApiTestApp();
    const { token, userId } = await register('owner@example.com');
    const jobId = await createJob(app, token);
    publisher.failNext = true;
    jobs.failNextUpdate = true;

    const response = await postJson(app, `/jobs/${jobId}/confirm`, {}, token);
    const body = await jsonOf(response);

    expect(response.status).toBe(503);
    expect((body.error as JsonObject).code).toBe('CONFIRM_INCONSISTENT');
    expect(body).not.toHaveProperty('confirmed');
    expect(await jobs.getJob(userId, jobId)).toMatchObject({ status: 'PROCESSING' });
    expect(publisher.messages).toHaveLength(0);
  });
});
