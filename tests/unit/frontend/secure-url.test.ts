/**
 * F05-T02 / F03-AUD-03 — allowlist de hosts para URLs presignadas.
 *
 * RED inicial: las tres primeras pruebas usaban solo los exports existentes y
 * fallaron por comportamiento (el segundo argumento y la opción del cliente se
 * ignoraban). GREEN: allowlist explícita > entorno > default local, con fallo
 * cerrado antes de cualquier PUT, preview o navegación.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createJobsClient,
  DEFAULT_ALLOWED_STORAGE_HOSTS,
  resolveAllowedStorageHosts,
  validateSecureUrl,
} from '../../../frontend/src/api/jobs';

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

afterEach(() => vi.unstubAllEnvs());

describe('F03-AUD-03 — allowlist de almacenamiento', () => {
  it('rechaza un host HTTPS ajeno cuando se pasa una allowlist explícita', () => {
    expect(() =>
      validateSecureUrl('https://evil.example.com/raw/foto?X-Amz-Signature=abc', [
        'storage.example.com',
      ]),
    ).toThrow(/no permitida/i);
  });

  it('acepta un host incluido en la allowlist explícita', () => {
    expect(validateSecureUrl('https://storage.example.com/raw/foto?sig=abc', ['storage.example.com'])).toContain(
      'https://storage.example.com/',
    );
  });

  it('el cliente rechaza la uploadUrl de un host ajeno antes de hacer la PUT', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const client = createJobsClient('/api', fetcher, { allowedStorageHosts: ['storage.example.com'] });
    await expect(client.upload('https://evil.example.com/foto', new Blob(['x']))).rejects.toThrow(
      /no permitida/i,
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('el cliente rechaza la downloadUrl de un host ajeno', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        response({ downloadUrl: 'https://evil.example.com/foto.webp', expiresAt: '2026-11-18T00:00:00.000Z' }),
      );
    const client = createJobsClient('/api', fetcher, { allowedStorageHosts: ['storage.example.com'] });
    await expect(client.download('jwt', 'j1', 'i1', 'webp')).rejects.toThrow(/no permitida/i);
  });

  it('falla de forma segura ante una respuesta de descarga malformada', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response({ expiresAt: '2026-11-18T00:00:00.000Z' }));
    const client = createJobsClient('/api', fetcher);
    await expect(client.download('jwt', 'j1', 'i1', 'webp')).rejects.toThrow(/no válido/i);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe('F03-AUD-03 — esquema, credenciales y formas malformadas', () => {
  const hostile = [
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'http://127.0.0.1:9297/raw/foto',
    'https://user:pass@127.0.0.1/raw/foto',
    'https://user@127.0.0.1/raw/foto',
    '/relative/file',
    '',
    '   ',
  ];
  it.each(hostile)('rechaza %j antes de cualquier uso', (url) => {
    expect(() => validateSecureUrl(url)).toThrow();
  });

  it.each([undefined, null, 123, {}, true])('rechaza un valor no cadena %j', (value) => {
    expect(() => validateSecureUrl(value as unknown as string)).toThrow(/no válida/i);
  });

  it('acepta el loopback del emulador y los TLD reservados por defecto', () => {
    expect(validateSecureUrl('https://127.0.0.1:9297/bucket/foto?sig=abc')).toContain('https://127.0.0.1:9297/');
    expect(validateSecureUrl('https://localhost/bucket/foto')).toContain('https://localhost/');
    expect(validateSecureUrl('https://upload.test/image')).toContain('https://upload.test/');
    expect(validateSecureUrl('https://storage.example/original.webp')).toContain('https://storage.example/');
  });

  it('normaliza mayúsculas y punto final del hostname', () => {
    expect(validateSecureUrl('https://STORAGE.EXAMPLE.COM./foto', ['storage.example.com'])).toContain(
      'https://storage.example.com./',
    );
  });
});

describe('F03-AUD-03 — resolución de la allowlist por entorno', () => {
  it('la allowlist explícita tiene prioridad sobre la variable de entorno', () => {
    vi.stubEnv('VITE_ALLOWED_STORAGE_HOSTS', 'env-host.example.com');
    expect(resolveAllowedStorageHosts(['explicit.example.com'])).toEqual(['explicit.example.com']);
    expect(() =>
      validateSecureUrl('https://env-host.example.com/foto', ['explicit.example.com']),
    ).toThrow(/no permitida/i);
  });

  it('usa VITE_ALLOWED_STORAGE_HOSTS cuando no hay override', () => {
    vi.stubEnv('VITE_ALLOWED_STORAGE_HOSTS', 'cdn.example.com, backup.example.com');
    expect(resolveAllowedStorageHosts()).toEqual(['cdn.example.com', 'backup.example.com']);
    expect(validateSecureUrl('https://backup.example.com/foto')).toContain('https://backup.example.com/');
    expect(() => validateSecureUrl('https://otro.example.com/foto')).toThrow(/no permitida/i);
  });

  it('cae al default local si la variable está vacía o ausente', () => {
    vi.stubEnv('VITE_ALLOWED_STORAGE_HOSTS', '   ');
    expect(resolveAllowedStorageHosts()).toEqual(DEFAULT_ALLOWED_STORAGE_HOSTS);
  });
});

describe('F03-AUD-03 — fallo cerrado en el cliente', () => {
  it('rechaza un plan de subida malformado antes de exponer las PUT', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response({ uploads: 'no-es-arreglo' }));
    const client = createJobsClient('/api', fetcher);
    await expect(
      client.create('jwt', { preset: 'BALANCED', files: [{ fileName: 'f.webp', contentType: 'image/webp', sizeBytes: 3 }] }),
    ).rejects.toThrow(/plan de subida no válido/i);
  });

  it('rechaza una uploadUrl hostil dentro de un plan por lo demás válido', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(
      response({
        job: { jobId: 'j1' },
        uploads: [{ imageId: 'i1', uploadUrl: 'https://evil.example.com/foto', method: 'PUT' }],
      }),
    );
    const client = createJobsClient('/api', fetcher, { allowedStorageHosts: ['storage.example.com'] });
    await expect(
      client.create('jwt', { preset: 'BALANCED', files: [{ fileName: 'f.webp', contentType: 'image/webp', sizeBytes: 3 }] }),
    ).rejects.toThrow(/no permitida/i);
  });

  it('el ZIP no es presignado: se sirve desde la API con auth y se comprueba response.ok', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('zip', { status: 200 }));
    const client = createJobsClient('/api', fetcher);
    const zip = await client.zip('jwt', 'j1');
    expect(zip.ok).toBe(true);
    expect(fetcher.mock.calls[0][0]).toBe('/api/jobs/j1/download.zip');
    expect(fetcher.mock.calls[0][1].headers.authorization).toBe('Bearer jwt');
    fetcher.mockResolvedValueOnce(new Response('no', { status: 404 }));
    await expect(client.zip('jwt', 'j1')).rejects.toMatchObject({ status: 404 });
  });
});
