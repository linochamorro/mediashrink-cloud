/**
 * F05-H01 (Bloque 2, RED) — hardening defensivo de la API HTTP:
 * cabeceras de seguridad globales y límite de tamaño del body JSON.
 */

import { describe, expect, it } from 'vitest';

import { createApiTestApp, getJson, postJson } from './fixtures';

const EXPECTED_HEADERS: Readonly<Record<string, string>> = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
};

function expectSecurityHeaders(response: Response): void {
  for (const [name, value] of Object.entries(EXPECTED_HEADERS)) {
    expect(response.headers.get(name), `cabecera ${name}`).toBe(value);
  }
}

describe('F05-H01 — cabeceras de seguridad globales (RED)', () => {
  it('las incluye en 200/201 de /jobs', async () => {
    const { app, register } = createApiTestApp();
    const { token } = await register('owner@example.com');

    const created = await postJson(
      app,
      '/jobs',
      { preset: 'BALANCED', files: [{ fileName: 'f.jpg', contentType: 'image/jpeg', sizeBytes: 8 }] },
      token,
    );
    expect(created.status).toBe(201);
    expectSecurityHeaders(created);

    const listed = await getJson(app, '/jobs', token);
    expect(listed.status).toBe(200);
    expectSecurityHeaders(listed);
  });

  it('las incluye en respuestas de error 400/401/404/429', async () => {
    const { app, register } = createApiTestApp({}, 2);
    const { token } = await register('owner@example.com');
    const badBody = { preset: 'NOPE', files: [] };

    const bad = await postJson(app, '/jobs', badBody, token);
    expect(bad.status).toBe(400);
    expectSecurityHeaders(bad);

    const unauth = await postJson(app, '/jobs', badBody);
    expect(unauth.status).toBe(401);
    expectSecurityHeaders(unauth);

    const notFound = await app.request('/ruta-que-no-existe');
    expect(notFound.status).toBe(404);
    expectSecurityHeaders(notFound);

    // Con jobsMax=2, la tercera creación supera el límite del limitador
    // (la petición 400 anterior también consume un token: el límite se
    // controla antes de validar el body).
    const first = await postJson(
      app,
      '/jobs',
      { preset: 'BALANCED', files: [{ fileName: 'f.jpg', contentType: 'image/jpeg', sizeBytes: 8 }] },
      token,
    );
    expect(first.status).toBe(201);
    const limited = await postJson(
      app,
      '/jobs',
      { preset: 'BALANCED', files: [{ fileName: 'f.jpg', contentType: 'image/jpeg', sizeBytes: 8 }] },
      token,
    );
    expect(limited.status).toBe(429);
    expectSecurityHeaders(limited);
  });
});

describe('F05-H01 — límite de tamaño del body JSON (RED)', () => {
  it('un body mayor de 1 MiB se rechaza con 413 y no llega al handler', async () => {
    const { app } = createApiTestApp();
    const huge = 'y'.repeat(1_100_000);
    const response = await postJson(app, '/auth/register', {
      email: 'grande@example.com',
      password: huge,
    });
    expect(response.status).toBe(413);
    expect((await response.json()) as unknown).toMatchObject({
      error: { code: 'PAYLOAD_TOO_LARGE' },
    });
    expectSecurityHeaders(response);
  });

  it('un body por debajo de 1 MiB no se rechaza por tamaño', async () => {
    const { app } = createApiTestApp();
    // ~500 KB: supera cualquier uso legítimo pero queda bajo el límite.
    const response = await postJson(app, '/auth/register', {
      email: 'mediano@example.com',
      password: `Corta1!${'z'.repeat(500_000)}`,
    });
    expect(response.status).not.toBe(413);
  });
});
