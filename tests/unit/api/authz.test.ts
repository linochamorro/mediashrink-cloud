import { describe, expect, it } from 'vitest';

import { createApiTestApp, getJson, postJson, validBatch } from './fixtures';

type JsonObject = Record<string, unknown>;
const jsonOf = async (response: Response): Promise<JsonObject> =>
  (await response.json()) as JsonObject;
const codeOf = (body: JsonObject): unknown => (body.error as JsonObject).code;

describe('autorización y aislamiento de /jobs (FR-21, PR-07, T03-A-01)', () => {
  it('las cuatro rutas responden 401 sin token, antes que cualquier otra guarda', async () => {
    const { app } = createApiTestApp();

    const created = await postJson(app, '/jobs', validBatch);
    const confirm = await postJson(app, '/jobs/job_inexistente/confirm', {});
    const list = await getJson(app, '/jobs');
    const detail = await getJson(app, '/jobs/job_inexistente');

    for (const response of [created, confirm, list, detail]) {
      expect(response.status).toBe(401);
      expect(codeOf(await jsonOf(response))).toBe('UNAUTHORIZED');
    }
  });

  it('un token manipulado y un refresh token no autorizan /jobs', async () => {
    const { app, register } = createApiTestApp();
    const { token } = await register('owner@example.com');
    const parts = token.split('.');
    parts[2] = (parts[2].at(0) === 'a' ? 'b' : 'a') + parts[2].slice(1);

    const manipulated = await getJson(app, '/jobs', parts.join('.'));
    expect(manipulated.status).toBe(401);
    expect(codeOf(await jsonOf(manipulated))).toBe('INVALID_TOKEN');

    const refreshResponse = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'owner@example.com', password: 'Segura1234' }),
    });
    const refreshToken = ((await refreshResponse.json()) as { refreshToken: string }).refreshToken;
    const wrongKind = await getJson(app, '/jobs', refreshToken);
    expect(wrongKind.status).toBe(401);
  });

  it('GET /jobs/:id de un lote ajeno devuelve 404 idéntico al inexistente', async () => {
    const { app, register } = createApiTestApp();
    const owner = await register('owner@example.com');
    const other = await register('other@example.com');
    const created = await jsonOf(await postJson(app, '/jobs', validBatch, owner.token));
    const jobId = (created.job as JsonObject).jobId as string;

    const foreign = await getJson(app, `/jobs/${jobId}`, other.token);
    const missing = await getJson(app, '/jobs/no_existe', other.token);

    expect(foreign.status).toBe(404);
    const foreignBody = await jsonOf(foreign);
    const missingBody = await jsonOf(missing);
    expect(JSON.stringify(foreignBody)).toBe(JSON.stringify(missingBody));
    expect(codeOf(missingBody)).toBe('RESOURCE_NOT_FOUND');
  });

  it('POST /jobs/:id/confirm ajeno devuelve 404 y no publica', async () => {
    const { app, register, publisher } = createApiTestApp();
    const owner = await register('owner@example.com');
    const other = await register('other@example.com');
    const created = await jsonOf(await postJson(app, '/jobs', validBatch, owner.token));
    const jobId = (created.job as JsonObject).jobId as string;

    const foreign = await postJson(app, `/jobs/${jobId}/confirm`, {}, other.token);
    expect(foreign.status).toBe(404);
    expect(publisher.messages).toHaveLength(0);

    const missing = await postJson(app, '/jobs/no_existe/confirm', {}, other.token);
    expect(await foreign.text()).toBe(await missing.text());
  });

  it('el userId del token no se puede suplantar con x-user-id ni con el path', async () => {
    const { app, register } = createApiTestApp();
    const a = await register('a@example.com');
    const b = await register('b@example.com');
    const created = await jsonOf(await postJson(app, '/jobs', validBatch, a.token));
    const jobId = (created.job as JsonObject).jobId as string;

    const spoofed = await getJson(app, `/jobs/${jobId}`, b.token, {
      'x-user-id': a.userId,
    });
    expect(spoofed.status).toBe(404);

    const own = await getJson(app, `/jobs/${jobId}`, a.token);
    expect(own.status).toBe(200);
  });
});
