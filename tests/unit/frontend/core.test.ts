import { afterEach, describe, expect, it, vi } from 'vitest';

import { createAuthClient, serializeStoredRefreshToken } from '../../../frontend/src/api/auth';
import { createJobsClient, validateSecureUrl } from '../../../frontend/src/api/jobs';
import { validateFiles } from '../../../frontend/src/upload/validation';
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
