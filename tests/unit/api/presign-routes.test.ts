/** Rutas de presign (F02-T02, FR-08/FR-09/FR-17): authz, validación y userId del JWT. */

import { describe, expect, it } from 'vitest';

import { createPresignTestApp } from './presign-fixtures';
import { getJson, postJson } from './fixtures';

const jsonOf = async (response: Response): Promise<Record<string, unknown>> =>
  (await response.json()) as Record<string, unknown>;

describe('rutas /presign con esquemas congelados y userId del JWT', () => {
  it('ambas rutas exigen autenticación antes que cualquier otra guarda', async () => {
    const { app } = createPresignTestApp();
    const upload = await postJson(app, '/presign/upload', { jobId: 'j1', imageId: 'img_1' });
    const download = await postJson(app, '/presign/download', {
      jobId: 'j1',
      imageId: 'img_1',
      variant: 'webp',
    });

    expect(upload.status).toBe(401);
    expect(download.status).toBe(401);
  });

  it('la URL de subida usa el userId del JWT y nunca incluye el binario', async () => {
    const { app, presign, register } = createPresignTestApp();
    const { token, userId } = await register('presign-upload@example.com');

    const response = await postJson(
      app,
      '/presign/upload',
      { jobId: 'job_1', imageId: 'img_1' },
      token,
    );
    expect(response.status).toBe(200);
    const body = await jsonOf(response);
    expect(body.key).toBe(`${userId}/job_1/raw/img_1`);
    expect(body.method).toBe('PUT');
    expect(body.expiresIn).toBe(900);
    expect(body.url).toContain('X-Amz-Signature');
    expect(body).not.toHaveProperty('body');
    expect(body).not.toHaveProperty('bytes');
    expect(presign.uploads).toHaveLength(1);
    expect(presign.uploads[0]).toMatchObject({ userId, jobId: 'job_1', imageId: 'img_1' });
  });

  it('un userId en el cuerpo o en cabeceras no suplanta al del token', async () => {
    const { app, presign, register } = createPresignTestApp();
    const { token, userId } = await register('presign-spoof@example.com');

    const spoofed = await postJson(
      app,
      '/presign/upload',
      { userId: 'victim', jobId: 'job_1', imageId: 'img_1' },
      token,
    );
    expect(spoofed.status).toBe(400);
    expect(presign.uploads).toHaveLength(0);

    const withHeader = await postJson(
      app,
      '/presign/upload',
      { jobId: 'job_1', imageId: 'img_1' },
      token,
      { 'x-user-id': 'victim', 'x-forwarded-user': 'victim' },
    );
    expect(withHeader.status).toBe(200);
    expect(presign.uploads[0].userId).toBe(userId);
  });

  it.each([
    ['../escape', 1],
    ['a/b', 2],
    ['/abs', 3],
    ['', 4],
    ['..', 5],
  ] as const)(
    'rechaza imageId inseguro %j con 400',
    async (imageId, index) => {
      const { app, presign, register } = createPresignTestApp();
      const { token } = await register(`presign-bad-${index}@example.com`);
      const response = await postJson(
        app,
        '/presign/upload',
        { jobId: 'job_1', imageId },
        token,
      );

      expect(response.status).toBe(400);
      expect(presign.uploads).toHaveLength(0);
    },
  );

  it('rechaza jobId no cadena y expiración fuera de rango', async () => {
    const { app, presign, register } = createPresignTestApp();
    const { token } = await register('presign-invalid@example.com');

    const badJob = await postJson(
      app,
      '/presign/upload',
      { jobId: 42, imageId: 'img_1' },
      token,
    );
    const badExpiry = await postJson(
      app,
      '/presign/upload',
      { jobId: 'job_1', imageId: 'img_1', expiresIn: 999_999 },
      token,
    );
    expect(badJob.status).toBe(400);
    expect(badExpiry.status).toBe(400);
    expect(presign.uploads).toHaveLength(0);
  });

  it('acepta expiresIn configurable dentro de los límites', async () => {
    const { app, presign, register } = createPresignTestApp();
    const { token } = await register('presign-expiry@example.com');
    const response = await postJson(
      app,
      '/presign/upload',
      { jobId: 'job_1', imageId: 'img_1', expiresIn: 120 },
      token,
    );

    expect(response.status).toBe(200);
    expect(presign.uploads[0].expiresIn).toBe(120);
  });

  it('la descarga valida el variant con el contrato congelado y acepta thumbnail', async () => {
    const { app, presign, register } = createPresignTestApp();
    const { token, userId } = await register('presign-download@example.com');

    const bad = await postJson(
      app,
      '/presign/download',
      { jobId: 'job_1', imageId: 'img_1', variant: 'gif' },
      token,
    );
    expect(bad.status).toBe(400);

    const good = await postJson(
      app,
      '/presign/download',
      { jobId: 'job_1', imageId: 'img_1', variant: 'thumbnail' },
      token,
    );
    expect(good.status).toBe(200);
    const body = await jsonOf(good);
    expect(body.method).toBe('GET');
    expect(body.key).toBe(`${userId}/job_1/optimized/img_1_thumb.webp`);
    expect(presign.downloads[0].variant).toBe('thumbnail');
  });

  it('GET sin token también queda protegido', async () => {
    const { app } = createPresignTestApp();
    const response = await getJson(app, '/presign/download');
    expect(response.status).toBe(401);
  });
});
