import { describe, expect, it } from 'vitest';

import { createApiTestApp, getJson, postJson, validBatch } from './fixtures';

type JsonObject = Record<string, unknown>;
const jsonOf = async (response: Response): Promise<JsonObject> =>
  (await response.json()) as JsonObject;
const codeOf = (body: JsonObject): unknown => (body.error as JsonObject).code;

describe('rate limit no suplantable (cierra T03-A-01)', () => {
  it('la clave de /jobs deriva del userId: agotar A no afecta a B', async () => {
    const { app, register } = createApiTestApp({}, 2);
    const a = await register('a@example.com');
    const b = await register('b@example.com');

    expect((await postJson(app, '/jobs', validBatch, a.token)).status).toBe(201);
    expect((await postJson(app, '/jobs', validBatch, a.token)).status).toBe(201);
    const blocked = await postJson(app, '/jobs', validBatch, a.token);
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('Retry-After')).toBeTypeOf('string');
    expect(codeOf(await jsonOf(blocked))).toBe('RATE_LIMITED');

    expect((await postJson(app, '/jobs', validBatch, b.token)).status).toBe(201);
  });

  it('rotar x-forwarded-for y x-real-ip no crea cubos nuevos en /jobs', async () => {
    const { app, register } = createApiTestApp({}, 1);
    const { token } = await register('owner@example.com');

    expect((await postJson(app, '/jobs', validBatch, token)).status).toBe(201);
    for (const [header, value] of [
      ['x-forwarded-for', '203.0.113.10'],
      ['x-forwarded-for', '203.0.113.11, 10.0.0.1'],
      ['x-real-ip', '198.51.100.7'],
    ]) {
      const response = await postJson(app, '/jobs', validBatch, token, { [header]: value });
      expect(response.status).toBe(429);
    }
  });

  it('una cabecera con el userId ajeno no consume el cupo de ese usuario', async () => {
    const { app, register } = createApiTestApp({}, 1);
    const a = await register('a@example.com');
    const b = await register('b@example.com');

    expect((await postJson(app, '/jobs', validBatch, a.token)).status).toBe(201);
    const spoofed = await postJson(app, '/jobs', validBatch, b.token, {
      'x-forwarded-for': a.userId,
    });
    expect(spoofed.status).toBe(201);
  });

  it('/auth/login ignora x-forwarded-for: rotar la cabecera no elude el 429', async () => {
    const { app } = createApiTestApp({ RATE_LIMIT_AUTH_MAX: '2' });
    const credentials = { email: 'demo@example.com', password: 'Segura1234' };

    const first = await postJson(app, '/auth/login', credentials, undefined, {
      'x-forwarded-for': '203.0.113.1',
    });
    const second = await postJson(app, '/auth/login', credentials, undefined, {
      'x-forwarded-for': '203.0.113.2',
    });
    const third = await postJson(app, '/auth/login', credentials, undefined, {
      'x-forwarded-for': '203.0.113.3',
      'x-real-ip': '198.51.100.9',
    });

    expect(first.status).toBe(401);
    expect(second.status).toBe(401);
    expect(third.status).toBe(429);
    expect(third.headers.get('Retry-After')).toBeTypeOf('string');
    expect(codeOf(await jsonOf(third))).toBe('RATE_LIMITED');
  });

  it('la ventana se renueva con el reloj inyectado sin dormir', async () => {
    const { app, register, config, setNow } = createApiTestApp({}, 1);
    const { token } = await register('owner@example.com');

    expect((await getJson(app, '/jobs', token)).status).toBe(200);
    expect((await getJson(app, '/jobs', token)).status).toBe(429);

    setNow(Date.now() + config.rateLimit.apiWindowMs + 1);
    expect((await getJson(app, '/jobs', token)).status).toBe(200);
  });

  it('mantiene independientes las ventanas de auth y API', async () => {
    const authChanged = createApiTestApp(
      { RATE_LIMIT_AUTH_WINDOW_MS: '1000', RATE_LIMIT_API_MAX: '1' },
      undefined,
      true,
    );
    authChanged.setNow(0);
    const authChangedSession = await authChanged.register('auth-window@example.com');

    expect((await getJson(authChanged.app, '/jobs', authChangedSession.token)).status).toBe(200);
    expect((await getJson(authChanged.app, '/jobs', authChangedSession.token)).status).toBe(429);
    authChanged.setNow(1001);
    expect((await getJson(authChanged.app, '/jobs', authChangedSession.token)).status).toBe(429);

    const apiChanged = createApiTestApp(
      { RATE_LIMIT_API_WINDOW_MS: '2000', RATE_LIMIT_API_MAX: '1' },
      undefined,
      true,
    );
    apiChanged.setNow(0);
    const apiChangedSession = await apiChanged.register('api-window@example.com');

    expect((await getJson(apiChanged.app, '/jobs', apiChangedSession.token)).status).toBe(200);
    expect((await getJson(apiChanged.app, '/jobs', apiChangedSession.token)).status).toBe(429);
    apiChanged.setNow(2001);
    expect((await getJson(apiChanged.app, '/jobs', apiChangedSession.token)).status).toBe(200);

    const authOnly = createApiTestApp({
      RATE_LIMIT_API_WINDOW_MS: '2000',
      RATE_LIMIT_AUTH_WINDOW_MS: '1000',
      RATE_LIMIT_AUTH_MAX: '1',
    });
    authOnly.setNow(0);
    const credentials = { email: 'demo@example.com', password: 'Segura1234' };
    expect((await postJson(authOnly.app, '/auth/login', credentials)).status).toBe(401);
    expect((await postJson(authOnly.app, '/auth/login', credentials)).status).toBe(429);
    authOnly.setNow(1001);
    expect((await postJson(authOnly.app, '/auth/login', credentials)).status).toBe(401);
  });
});
