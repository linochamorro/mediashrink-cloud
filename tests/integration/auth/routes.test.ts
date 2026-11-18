import { describe, expect, it } from 'vitest';

import { createAuthTestApp, getWithToken, postJson } from './fixtures';

const credentials = { email: 'demo@example.com', password: 'Segura1234' };

type JsonObject = Record<string, unknown>;

interface RegisteredBody extends JsonObject {
  user: { userId: string; email: string };
  accessToken: string;
  refreshToken: string;
}

const jsonOf = async (response: Response): Promise<JsonObject> => (await response.json()) as JsonObject;
const registeredOf = async (response: Response): Promise<RegisteredBody> =>
  (await response.json()) as RegisteredBody;
const errorCodeOf = (body: JsonObject): unknown => (body.error as JsonObject).code;

describe('rutas HTTP de autenticación (src/auth/routes.ts)', () => {
  it('POST /auth/register responde 201 con usuario sin hash y tokens Bearer', async () => {
    const { app, config } = createAuthTestApp();
    const response = await postJson(app, '/auth/register', credentials);

    expect(response.status).toBe(201);
    const body = await jsonOf(response);
    expect(body.user).toMatchObject({ email: credentials.email });
    expect(body.user).not.toHaveProperty('passwordHash');
    expect(body.tokenType).toBe('Bearer');
    expect(body.expiresIn).toBe(config.jwt.accessTtlSeconds);
    expect(body.accessToken).toBeTypeOf('string');
    expect(body.refreshToken).toBeTypeOf('string');
  });

  it('POST /auth/register rechaza duplicado (409) y contraseña fuera de 8–128 (400)', async () => {
    const { app } = createAuthTestApp();
    await postJson(app, '/auth/register', credentials);

    const duplicate = await postJson(app, '/auth/register', credentials);
    expect(duplicate.status).toBe(409);
    expect(errorCodeOf(await jsonOf(duplicate))).toBe('REGISTRATION_FAILED');

    for (const password of ['a'.repeat(7), 'a'.repeat(129)]) {
      const weak = await postJson(app, '/auth/register', { email: 'otro@example.com', password });
      expect(weak.status).toBe(400);
      expect(errorCodeOf(await jsonOf(weak))).toBe('VALIDATION_ERROR');
    }
  });

  it('POST /auth/login devuelve tokens y rechaza credenciales inválidas', async () => {
    const { app } = createAuthTestApp();
    await postJson(app, '/auth/register', credentials);

    const ok = await postJson(app, '/auth/login', credentials);
    expect(ok.status).toBe(200);
    expect((await jsonOf(ok)).accessToken).toBeTypeOf('string');

    const bad = await postJson(app, '/auth/login', { ...credentials, password: 'Incorrecta123' });
    expect(bad.status).toBe(401);
    expect(errorCodeOf(await jsonOf(bad))).toBe('INVALID_CREDENTIALS');
  });

  it('POST /auth/refresh devuelve un par nuevo y rechaza un token inválido', async () => {
    const { app } = createAuthTestApp();
    const registered = await registeredOf(await postJson(app, '/auth/register', credentials));

    const ok = await postJson(app, '/auth/refresh', { refreshToken: registered.refreshToken });
    expect(ok.status).toBe(200);
    expect((await jsonOf(ok)).tokenType).toBe('Bearer');

    const bad = await postJson(app, '/auth/refresh', { refreshToken: 'token.manipulado' });
    expect(bad.status).toBe(401);
    expect(errorCodeOf(await jsonOf(bad))).toBe('INVALID_TOKEN');
  });

  it('una ruta privada sin token responde 401', async () => {
    const { app } = createAuthTestApp();
    const response = await getWithToken(app, '/private/resources/user_local_001');

    expect(response.status).toBe(401);
    expect(errorCodeOf(await jsonOf(response))).toBe('UNAUTHORIZED');
  });

  it('una ruta privada con token manipulado responde 401', async () => {
    const { app } = createAuthTestApp();
    const registered = await registeredOf(await postJson(app, '/auth/register', credentials));
    const parts = registered.accessToken.split('.');
    parts[2] = (parts[2].at(0) === 'a' ? 'b' : 'a') + parts[2].slice(1);

    const response = await getWithToken(app, `/private/resources/${registered.user.userId}`, parts.join('.'));

    expect(response.status).toBe(401);
    expect(errorCodeOf(await jsonOf(response))).toBe('INVALID_TOKEN');
  });

  it('el middleware expone userId y el recurso propio responde 200', async () => {
    const { app } = createAuthTestApp();
    const registered = await registeredOf(await postJson(app, '/auth/register', credentials));

    const response = await getWithToken(
      app,
      `/private/resources/${registered.user.userId}`,
      registered.accessToken,
    );

    expect(response.status).toBe(200);
    expect(await jsonOf(response)).toMatchObject({
      userId: registered.user.userId,
      email: credentials.email,
    });
  });

  it('el rate limit configurable responde 429 con Retry-After y se renueva en la ventana siguiente', async () => {
    const { app, config, setLimiterNow } = createAuthTestApp({ RATE_LIMIT_AUTH_MAX: '2' });
    const start = Date.now();

    const first = await postJson(app, '/auth/login', credentials);
    const second = await postJson(app, '/auth/login', credentials);
    const third = await postJson(app, '/auth/login', credentials);

    expect(first.status).toBe(401);
    expect(second.status).toBe(401);
    expect(third.status).toBe(429);
    expect(third.headers.get('Retry-After')).toBeTypeOf('string');
    expect(errorCodeOf(await jsonOf(third))).toBe('RATE_LIMITED');
    expect(config.rateLimit.authMax).toBe(2);

    setLimiterNow(start + config.rateLimit.authWindowMs + 1);
    const renewed = await postJson(app, '/auth/login', credentials);
    expect(renewed.status).toBe(401);
  });

  it('los errores no exponen secretos ni rutas internas', async () => {
    const { app } = createAuthTestApp();
    const response = await postJson(app, '/auth/login', { correo: credentials.email, clave: 'x' });
    const text = await response.text();

    expect(response.status).toBe(400);
    for (const leaked of [
      'JWT_ACCESS_SECRET',
      'JWT_REFRESH_SECRET',
      'backend/src',
      '.env',
      'REPLACE_WITH_',
      credentials.password,
    ]) {
      expect(text).not.toContain(leaked);
    }
  });
});
