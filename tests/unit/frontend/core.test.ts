import { afterEach, describe, expect, it, vi } from 'vitest';

import { createAuthClient, serializeStoredRefreshToken } from '../../../frontend/src/api/auth';
import { createJobsClient, validateSecureUrl } from '../../../frontend/src/api/jobs';
import { failedImageMessage, pendingImageMessage, shouldLoadOptimized } from '../../../frontend/src/api/image-availability';
import type { ImageRecord } from '../../../frontend/src/api/types.generated';
import { selectValidFiles, validateFiles } from '../../../frontend/src/upload/validation';
import { readTheme, saveTheme } from '../../../frontend/src/theme';

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('preferencia de tema', () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, clear: () => values.clear() };
  vi.stubGlobal('localStorage', storage);
  afterEach(() => storage.clear());

  it('empieza claro y persiste una elección oscura', () => {
    expect(readTheme()).toBe('light');
    saveTheme('dark');
    expect(readTheme()).toBe('dark');
  });

  it('ignora valores guardados que no sean temas admitidos', () => {
    localStorage.setItem('mediashrink-theme', 'blue');
    expect(readTheme()).toBe('light');
  });
});

describe('cliente de autenticación', () => {
  it('registra y envía credenciales solo al endpoint de auth', async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ user: { userId: 'u1', email: 'a@b.co', createdAt: '2026-01-01T00:00:00.000Z' }, accessToken: 'a', refreshToken: 'r', tokenType: 'Bearer', expiresIn: 900 }, 201));
    const client = createAuthClient('http://localhost:3000', fetcher);
    const result = await client.register({ email: 'a@b.co', password: 'password123' });
    expect(result.accessToken).toBe('a');
    expect(fetcher).toHaveBeenCalledWith('http://localhost:3000/auth/register', expect.objectContaining({ method: 'POST' }));
  });

  it('renueva con refresh token, nunca con credenciales', async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ user: { userId: 'u1', email: 'a@b.co', createdAt: '2026-01-01T00:00:00.000Z' }, accessToken: 'a2', refreshToken: 'r2', tokenType: 'Bearer', expiresIn: 900 }));
    await createAuthClient('/api', fetcher).refresh('r1');
    expect(JSON.parse(fetcher.mock.calls[0][1].body as string)).toEqual({ refreshToken: 'r1' });
  });

  it('persiste solo refresh token, no el access token ni datos de usuario', () => {
    expect(JSON.parse(serializeStoredRefreshToken({ refreshToken: 'refresh-secret' }))).toEqual({ refreshToken: 'refresh-secret' });
  });

  it('mapea códigos públicos conocidos y no refleja cuerpos arbitrarios', async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ error: { code: 'INVALID_CREDENTIALS', message: 'stack secret token' } }, 401));
    const client = createAuthClient('/api', fetcher);
    await expect(client.login({ email: 'a@b.co', password: 'secret' })).rejects.toMatchObject({ message: 'El correo o la contraseña no son correctos.', status: 401 });
    fetcher.mockResolvedValue(response({ error: { code: 'OTHER', message: 'stack secret token' } }, 500));
    await expect(client.login({ email: 'a@b.co', password: 'secret' })).rejects.toMatchObject({ message: 'No se pudo completar la solicitud. Inténtalo de nuevo.' });
  });

  it('mapea REGISTRATION_FAILED a un mensaje claro sin reflejar el texto hostil del backend', async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ error: { code: 'REGISTRATION_FAILED', message: 'stack secret token' } }, 409));
    const client = createAuthClient('/api', fetcher);
    const request = client.register({ email: 'ana.demo@example.com', password: 'ClaveSegura2026!' });
    await expect(request).rejects.toMatchObject({ message: 'No se pudo completar el registro. Revisa tus datos o inicia sesión si ya tienes cuenta.', status: 409 });
    const error = await request.then(
      () => { throw new Error('Expected request to reject'); },
      (e) => e as Error,
    );
    expect(error.message).not.toContain('stack secret');
  });

  it('mapea INVALID_TOKEN a un mensaje claro sin reflejar el texto hostil del backend', async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ error: { code: 'INVALID_TOKEN', message: 'stack secret token' } }, 401));
    const client = createAuthClient('/api', fetcher);
    const request = client.refresh('refresh-invalido');
    await expect(request).rejects.toMatchObject({ message: 'Tu sesión no es válida. Inicia sesión otra vez.', status: 401 });
    const error = await request.then(
      () => { throw new Error('Expected request to reject'); },
      (e) => e as Error,
    );
    expect(error.message).not.toContain('stack secret');
  });

  it('mapea TOKEN_EXPIRED a un mensaje claro sin reflejar el texto hostil del backend', async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ error: { code: 'TOKEN_EXPIRED', message: 'stack secret token' } }, 401));
    const client = createAuthClient('/api', fetcher);
    const request = client.refresh('refresh-caducado');
    await expect(request).rejects.toMatchObject({ message: 'Tu sesión ha caducado. Inicia sesión otra vez.', status: 401 });
    const error = await request.then(
      () => { throw new Error('Expected request to reject'); },
      (e) => e as Error,
    );
    expect(error.message).not.toContain('stack secret');
  });
});

describe('direcciones de almacenamiento', () => {
  it('acepta HTTPS absoluto sin credenciales y rechaza protocolos/credenciales no seguros', () => {
    expect(validateSecureUrl('https://bucket.example.test/file?signature=abc')).toContain('https://bucket.example.test/');
    for (const url of ['http://bucket.example.test/file', 'javascript:alert(1)', 'https://user:pass@bucket.example.test/file', '/relative/file'])
      expect(() => validateSecureUrl(url)).toThrow();
  });
});

describe('cliente de jobs con contrato operativo propuesto', () => {
  it('solicita la creación con metadatos, PUT binario, confirma y descarga la URL firmada', async () => {
    const job = { jobId: 'j1', userId: 'u1', status: 'PENDING', preset: 'BALANCED', formats: ['webp', 'avif'], bytesBefore: 0, bytesAfter: 0, savingsPct: 0, exifStripped: false, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', ttl: 1767225600 };
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response({ job, uploads: [{ imageId: 'i1', uploadUrl: 'https://upload.test', method: 'PUT' }] }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(response({ jobs: [job] }))
      .mockResolvedValueOnce(response({ downloadUrl: 'https://download.test', expiresAt: '2026-01-01T01:00:00.000Z' }));
    const client = createJobsClient('/api', fetcher);
    await client.create('jwt', { preset: 'BALANCED', files: [{ fileName: 'foto.webp', contentType: 'image/webp', sizeBytes: 12 }] });
    const uploadedFile = new Blob(['binary-data'], { type: 'image/webp' });
    const uploadResponse = await client.upload('https://upload.test', uploadedFile, { 'x-upload-token': 'signed' });
    expect(uploadResponse.ok).toBe(true);
    expect(fetcher.mock.calls[1][1]).toMatchObject({ method: 'PUT', body: uploadedFile, headers: { 'x-upload-token': 'signed' } });
    await client.confirm('jwt', 'j1', ['i1']);
    expect((await client.list('jwt')).jobs).toHaveLength(1);
    const link = await client.download('jwt', 'j1', 'i1', 'original');
    expect(link.downloadUrl).toBe('https://download.test/');
    expect(JSON.parse(fetcher.mock.calls[0][1].body as string)).toEqual({ preset: 'BALANCED', files: [{ fileName: 'foto.webp', contentType: 'image/webp', sizeBytes: 12 }] });
    expect(fetcher.mock.calls[2][1].method).toBe('POST');
    expect(fetcher.mock.calls[4][0]).toContain('variant=original');
  });

  it('consulta detalle, descarga ZIP y borra lote por los endpoints acordados', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response({ job: {}, images: [] }))
      .mockResolvedValueOnce(new Response('zip-data', { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const client = createJobsClient('/api', fetcher);
    await client.get('jwt', 'job 1');
    await client.zip('jwt', 'job 1');
    await client.remove('jwt', 'job 1');
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual(['/api/jobs/job%201', '/api/jobs/job%201/download.zip', '/api/jobs/job%201']);
    expect(fetcher.mock.calls[2][1]).toMatchObject({ method: 'DELETE' });
  });
});

describe('validación local de archivos', () => {
  const limits = { maxFileSizeMb: 1, maxImagesPerBatch: 2 };
  const file = (name: string, type: string, size = 10) => new File(['x'.repeat(size)], name, { type });

  it('acepta imágenes raster permitidas dentro de los límites', () => {
    expect(validateFiles([file('foto.webp', 'image/webp')], limits)).toEqual({ valid: true, errors: [] });
  });

  it('rechaza MIME no raster, tamaño y cantidad antes de enviar', () => {
    const result = validateFiles([file('vector.svg', 'image/svg+xml'), file('grande.jpg', 'image/jpeg', 1_048_577), file('otra.png', 'image/png')], limits);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(3);
  });
});

describe('selección de archivos válidos (QA-HUMAN-02, E2-04)', () => {
  const limits = { maxFileSizeMb: 1, maxImagesPerBatch: 2 };
  const file = (name: string, type: string, size = 10) => new File(['x'.repeat(size)], name, { type });

  it('conserva solo el archivo válido y reporta un error por el inválido en una selección mixta', () => {
    const result = selectValidFiles([file('valida.jpg', 'image/jpeg'), file('malo.txt', 'text/plain')], limits);
    expect(result.accepted.map((item) => item.name)).toEqual(['valida.jpg']);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('malo.txt');
    expect(result.errors[0]).toContain('formato no permitido');
  });

  it('no acepta ningún archivo cuando todos son inválidos y devuelve un error por cada uno', () => {
    const result = selectValidFiles([file('malo.txt', 'text/plain'), file('vector.svg', 'image/svg+xml')], limits);
    expect(result.accepted).toEqual([]);
    expect(result.errors).toHaveLength(2);
    expect(result.errors.some((message) => message.includes('malo.txt'))).toBe(true);
    expect(result.errors.some((message) => message.includes('vector.svg'))).toBe(true);
  });

  it('rechaza el lote completo al superar el tope de 20 imágenes (E2-03)', () => {
    const batchLimits = { maxFileSizeMb: 15, maxImagesPerBatch: 20 };
    const many = Array.from({ length: 21 }, (_, index) => file(`foto-${index}.jpg`, 'image/jpeg'));
    const result = selectValidFiles(many, batchLimits);
    expect(result.accepted).toEqual([]);
    expect(result.errors).toEqual(['El máximo es 20 imágenes por lote.']);
  });
});

describe('disponibilidad de la variante optimizada (QA-HUMAN-03, E7-01)', () => {
  it('no debe cargar la optimizada para una imagen FAILED', () => {
    expect(shouldLoadOptimized({ status: 'FAILED' })).toBe(false);
  });

  it('debe cargar la optimizada para una imagen COMPLETED', () => {
    expect(shouldLoadOptimized({ status: 'COMPLETED' })).toBe(true);
  });

  it('no debe cargar la optimizada para una imagen PARTIAL (artefacto aún no confirmado)', () => {
    expect(shouldLoadOptimized({ status: 'PARTIAL' })).toBe(false);
  });

  it('un failureReason presente no altera el booleano y estados desconocidos devuelven false', () => {
    expect(shouldLoadOptimized({ status: 'FAILED', failureReason: 'RENDER_FAILED' })).toBe(false);
    expect(shouldLoadOptimized({ status: 'COMPLETED', failureReason: 'RENDER_FAILED' })).toBe(true);
    const unknown = { status: 'UNKNOWN' } as unknown as Pick<ImageRecord, 'status' | 'failureReason'>;
    expect(shouldLoadOptimized(unknown)).toBe(false);
  });

  it('el aviso de imagen fallida está en español, incluye el motivo solo si existe y no filtra secretos', () => {
    const withReason = failedImageMessage({ status: 'FAILED', failureReason: 'RENDER_FAILED' });
    expect(withReason).toContain('Imagen no procesada');
    expect(withReason).toContain('Motivo: RENDER_FAILED');
    expect(withReason).not.toMatch(/Bearer|AKIA|accessToken|password|secret|token/i);
    const withoutReason = failedImageMessage({ status: 'FAILED' });
    expect(withoutReason).toBe('Imagen no procesada.');
    expect(withoutReason).not.toContain('Motivo');
  });
});

describe('matriz de estados de disponibilidad (QA-HUMAN-04, E5-01)', () => {
  it.each([
    ['PENDING', false],
    ['PROCESSING', false],
    ['FAILED', false],
    ['COMPLETED', true],
  ] as const)('estado %s → shouldLoadOptimized devuelve %s', (status, expected) => {
    expect(shouldLoadOptimized({ status })).toBe(expected);
  });

  it('el mensaje de espera es español, anuncia la comparativa y no filtra secretos', () => {
    const waiting = pendingImageMessage({ status: 'PROCESSING' });
    expect(waiting).toContain('procesamiento');
    expect(waiting).toMatch(/comparativa/i);
    expect(waiting).not.toMatch(/Bearer|AKIA|accessToken|password|secret|token/i);
    expect(pendingImageMessage({ status: 'PENDING' })).toBe(waiting);
  });

  it('failedImageMessage sigue incluyendo failureReason solo si está presente', () => {
    expect(failedImageMessage({ status: 'FAILED', failureReason: 'RENDER_FAILED' })).toContain('Motivo: RENDER_FAILED');
    expect(failedImageMessage({ status: 'FAILED' })).not.toContain('Motivo');
  });
});
