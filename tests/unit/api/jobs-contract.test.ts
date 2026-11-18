/**
 * F02-AUD-01 — contrato interoperable de `POST /jobs` con F03.
 *
 * RED por comportamiento: el handler vigente todavía lee `body.images` y
 * responde `{ job }`; estas pruebas exigen `{ preset, files }` y `{ job, uploads }`.
 * El doble `RecordingUploadPresign` permite comprobar la clave `raw` y el
 * `userId` del JWT sin arrancar el emulador.
 */

import { describe, expect, it } from 'vitest';

import { createApiTestApp, postJson, validBatch } from './fixtures';

type JsonObject = Record<string, unknown>;
const jsonOf = async (response: Response): Promise<JsonObject> =>
  (await response.json()) as JsonObject;

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const;

const file = (overrides: Partial<JsonObject> = {}): JsonObject => ({
  fileName: 'foto.jpg',
  contentType: 'image/jpeg',
  sizeBytes: 2048,
  ...overrides,
});

describe('F02-AUD-01 — POST /jobs contrato { files } → { job, uploads }', () => {
  it('201 devuelve job PENDING y uploads con imageId seguro, URL HTTPS PUT y sin bucket/key', async () => {
    const { app, register, presign, jobs } = createApiTestApp();
    const { token, userId } = await register('owner@example.com');

    const response = await postJson(app, '/jobs', validBatch, token);
    expect(response.status).toBe(201);

    const body = await jsonOf(response);
    const job = body.job as JsonObject;
    const uploads = body.uploads as JsonObject[];

    expect(job).toMatchObject({
      userId,
      status: 'PENDING',
      preset: 'BALANCED',
      bytesBefore: 0,
      bytesAfter: 0,
      savingsPct: 0,
      exifStripped: false,
    });
    expect(uploads).toHaveLength(1);

    const upload = uploads[0];
    expect(UUID_V4.test(upload.imageId as string)).toBe(true);
    expect(upload.method).toBe('PUT');
    expect(upload.uploadUrl).toMatch(/^https:\/\//);
    for (const secret of ['key', 'bucket', 'expiresIn', 'expiresAt']) {
      expect(upload).not.toHaveProperty(secret);
    }

    // La URL apunta a raw/<userId-del-JWT>/<jobId>/<imageId> generado por el servidor.
    expect(new URL(upload.uploadUrl as string).pathname).toContain(
      `${userId}/${job.jobId}/raw/${upload.imageId}`,
    );
    expect(presign.uploads).toEqual([
      { userId, jobId: job.jobId, imageId: upload.imageId },
    ]);
    expect(jobs.jobs.size).toBe(1);
  });

  it('genera un imageId nuevo por archivo con randomUUID y nunca lo deriva del fileName', async () => {
    const { app, register, presign } = createApiTestApp();
    const { token } = await register('multi@example.com');

    const response = await postJson(
      app,
      '/jobs',
      {
        preset: 'HIGH',
        files: [file({ fileName: 'foto.jpg' }), file({ fileName: 'foto.jpg' })],
      },
      token,
    );
    expect(response.status).toBe(201);

    const uploads = (await jsonOf(response)).uploads as JsonObject[];
    expect(uploads).toHaveLength(2);
    expect(UUID_V4.test(uploads[0].imageId as string)).toBe(true);
    expect(UUID_V4.test(uploads[1].imageId as string)).toBe(true);
    expect(uploads[0].imageId).not.toBe(uploads[1].imageId);
    expect(uploads[0].imageId).not.toBe('foto.jpg');
    expect(presign.uploads.map((request) => request.imageId)).toEqual([
      uploads[0].imageId,
      uploads[1].imageId,
    ]);
    expect(new Set(presign.uploads.map((request) => request.jobId)).size).toBe(1);
  });

  it('acepta todos los MIME raster permitidos y rechaza SVG/GIF/no-raster', async () => {
    for (const [index, contentType] of ALLOWED_MIMES.entries()) {
      const { app, register } = createApiTestApp();
      const { token } = await register(`mime-ok-${index}@example.com`);
      const response = await postJson(
        app,
        '/jobs',
        { preset: 'BALANCED', files: [file({ contentType })] },
        token,
      );
      expect(response.status, contentType).toBe(201);
    }

    const forbiddenMimes = [
      'image/svg+xml',
      'image/gif',
      'application/pdf',
      'IMAGE/JPEG',
      'image/jpeg; charset=binary',
      '',
    ];
    for (const [index, contentType] of forbiddenMimes.entries()) {
      const { app, register, jobs, presign } = createApiTestApp();
      const { token } = await register(`mime-bad-${index}@example.com`);
      const response = await postJson(
        app,
        '/jobs',
        { preset: 'BALANCED', files: [file({ contentType })] },
        token,
      );
      expect(response.status, String(contentType)).toBe(400);
      expect(jobs.jobs.size).toBe(0);
      expect(presign.uploads).toHaveLength(0);
    }
  });

  it('valida fileName no vacío sin separadores, NUL ni %xx (sin usarlo en la clave)', async () => {
    for (const [index, fileName] of [
      '',
      '   ',
      '../victim.jpg',
      '..\\victim.jpg',
      'a/b.jpg',
      'a\\b.jpg',
      'foto\0.jpg',
      '%2e%2e%2ffoto.jpg',
      'foto%20.jpg',
    ].entries()) {
      const { app, register, jobs, presign } = createApiTestApp();
      const { token } = await register(`name-bad-${index}@example.com`);
      const response = await postJson(
        app,
        '/jobs',
        { preset: 'BALANCED', files: [file({ fileName })] },
        token,
      );
      expect(response.status, JSON.stringify(fileName)).toBe(400);
      expect(jobs.jobs.size).toBe(0);
      expect(presign.uploads).toHaveLength(0);
    }

    const { app, register, presign } = createApiTestApp();
    const { token, userId } = await register('name-ok@example.com');
    const safeName = 'mi foto.2026.jpg';
    const response = await postJson(
      app,
      '/jobs',
      { preset: 'BALANCED', files: [file({ fileName: safeName })] },
      token,
    );
    expect(response.status).toBe(201);
    const uploads = (await jsonOf(response)).uploads as JsonObject[];
    expect(new URL(uploads[0].uploadUrl as string).pathname).not.toContain(safeName);
    expect(presign.uploads[0].userId).toBe(userId);
  });

  it('rechaza preset inválido, lote vacío y lote que excede maxImagesPerBatch', async () => {
    const { app, register, jobs, presign } = createApiTestApp({ MAX_IMAGES_PER_BATCH: '2' });
    const { token } = await register('limits@example.com');

    const invalid = [
      { preset: 'ULTRA', files: [file()] },
      { preset: 'BALANCED', files: [] },
      { preset: 'BALANCED', files: [file(), file(), file()] },
      { files: [file()] },
    ];
    for (const body of invalid) {
      const response = await postJson(app, '/jobs', body, token);
      expect(response.status).toBe(400);
    }
    expect(jobs.jobs.size).toBe(0);
    expect(presign.uploads).toHaveLength(0);

    const ok = await postJson(
      app,
      '/jobs',
      { preset: 'MAX_COMPRESSION', files: [file(), file()] },
      token,
    );
    expect(ok.status).toBe(201);
    expect(((await jsonOf(ok)).uploads as JsonObject[])).toHaveLength(2);
  });

  it('valida sizeBytes entero > 0 y dentro de maxFileSizeMb reutilizando JobMetrics', async () => {
    const { app, register, jobs, presign } = createApiTestApp({ MAX_FILE_SIZE_MB: '1' });
    const { token } = await register('bytes@example.com');
    const maxBytes = 1024 * 1024;

    for (const sizeBytes of [0, -1, 1.5, maxBytes + 1, '2048' as unknown as number]) {
      const response = await postJson(
        app,
        '/jobs',
        { preset: 'BALANCED', files: [file({ sizeBytes })] },
        token,
      );
      expect(response.status, String(sizeBytes)).toBe(400);
    }
    expect(jobs.jobs.size).toBe(0);
    expect(presign.uploads).toHaveLength(0);

    const ok = await postJson(
      app,
      '/jobs',
      { preset: 'BALANCED', files: [file({ sizeBytes: maxBytes })] },
      token,
    );
    expect(ok.status).toBe(201);
  });

  it('rechaza claves desconocidas en el cuerpo y en cada archivo', async () => {
    const { app, register, jobs, presign } = createApiTestApp();
    const { token } = await register('unknown@example.com');

    for (const body of [
      { preset: 'BALANCED', files: [file()], userId: 'victim' },
      { preset: 'BALANCED', files: [file()], images: [] },
      { preset: 'BALANCED', files: [{ ...file(), bytes: 1 }] },
      { preset: 'BALANCED', files: [{ ...file(), imageId: 'forzado' }] },
    ]) {
      const response = await postJson(app, '/jobs', body, token);
      expect(response.status).toBe(400);
    }
    expect(jobs.jobs.size).toBe(0);
    expect(presign.uploads).toHaveLength(0);
  });

  it('la suplantación de userId por cabeceras no afecta a la clave presignada', async () => {
    const { app, register, presign } = createApiTestApp();
    const { token, userId } = await register('headers@example.com');

    const response = await postJson(
      app,
      '/jobs',
      { preset: 'BALANCED', files: [file()] },
      token,
      { 'x-forwarded-for': '203.0.113.9', 'x-real-ip': 'victim' },
    );
    expect(response.status).toBe(201);
    expect(presign.uploads).toHaveLength(1);
    expect(presign.uploads[0].userId).toBe(userId);
    expect(presign.uploads[0].userId).not.toBe('victim');
  });

  it('sin autenticación no se crea el lote ni se presigna', async () => {
    const { app, jobs, presign } = createApiTestApp();
    const response = await postJson(app, '/jobs', validBatch);
    expect(response.status).toBe(401);
    expect(jobs.jobs.size).toBe(0);
    expect(presign.uploads).toHaveLength(0);
  });
});
