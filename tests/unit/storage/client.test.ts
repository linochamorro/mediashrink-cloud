/**
 * F05-AF-AUD-06 — host canónico del endpoint S3.
 *
 * El relay de desarrollo envía siempre `Host: 127.0.0.1:9297`; la firma S3
 * debe cubrir ese mismo host. Solo se canonicaliza el loopback textual
 * `localhost`; cualquier otro host permanece intacto.
 */

import { describe, expect, it } from 'vitest';

import * as storageClient from '../../../backend/src/storage/client';

type CanonicalizeStorageEndpoint = (endpointUrl: string) => string;

function canonicalizer(): CanonicalizeStorageEndpoint {
  const candidate = (
    storageClient as typeof storageClient & {
      canonicalizeStorageEndpoint?: CanonicalizeStorageEndpoint;
    }
  ).canonicalizeStorageEndpoint;
  expect(typeof candidate).toBe('function');
  if (typeof candidate !== 'function') {
    throw new Error('canonicalizeStorageEndpoint no está exportada');
  }
  return candidate;
}

describe('F05-AF-AUD-06 — canonicalización del endpoint S3', () => {
  it('convierte el loopback textual al host numérico firmado por el relay', () => {
    expect(canonicalizer()('https://localhost:9297')).toBe('https://127.0.0.1:9297');
  });

  it('deja intacto el endpoint loopback ya numérico', () => {
    expect(canonicalizer()('https://127.0.0.1:9297')).toBe('https://127.0.0.1:9297');
  });

  it('deja intactos los hosts no loopback, incluido AWS', () => {
    expect(canonicalizer()('https://s3.amazonaws.com')).toBe('https://s3.amazonaws.com');
    expect(canonicalizer()('https://storage.example.test/bucket')).toBe(
      'https://storage.example.test/bucket',
    );
  });

  it('preserva puerto, ruta, query y fragmento', () => {
    expect(canonicalizer()('https://localhost:9443/base/path?part=1#fragment')).toBe(
      'https://127.0.0.1:9443/base/path?part=1#fragment',
    );
  });

  it('el cliente S3 resuelve el endpoint canónico numérico', async () => {
    const client = storageClient.createS3Client({
      region: 'us-east-1',
      endpointUrl: 'https://localhost:9297',
      sharedCredentialsFile: 'unused-credentials',
      configFile: 'unused-config',
    });

    const endpoint = await client.config.endpoint?.();
    expect(endpoint?.hostname).toBe('127.0.0.1');
    expect(endpoint?.port).toBe(9297);
    expect(endpoint?.protocol).toBe('https:');
  });
});
