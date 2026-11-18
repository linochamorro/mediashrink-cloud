/**
 * Reglas puras de claves S3 y expiración (F02-T02, CA-02).
 * Sin emulador: se ejecutan en la fase RED antes del código productivo.
 */

import { describe, expect, it } from 'vitest';

import {
  assertKeyWithinPrefix,
  assertSafeKeySegment,
  optimizedImageKey,
  rawImageKey,
  UnsafeObjectKeyError,
} from '../../../backend/src/storage/keys';
import {
  PRESIGN_DEFAULT_EXPIRY_SECONDS,
  PRESIGN_MAX_EXPIRY_SECONDS,
  PRESIGN_MIN_EXPIRY_SECONDS,
  resolveExpiry,
} from '../../../backend/src/storage/presigner';

const identity = {
  userId: '11111111-1111-4111-8111-111111111111',
  jobId: '22222222-2222-4222-8222-222222222222',
  imageId: 'img_1',
};

describe('claves S3 con prefijo por usuario (CA-02)', () => {
  it('la clave raw empieza por el userId del JWT y separa jobId, raw e imageId', () => {
    expect(rawImageKey(identity)).toBe(
      `${identity.userId}/${identity.jobId}/raw/${identity.imageId}`,
    );
  });

  it.each([
    ['webp', `${identity.imageId}.webp`],
    ['avif', `${identity.imageId}.avif`],
    ['thumbnail', `${identity.imageId}_thumb.webp`],
  ] as const)('la clave optimized de %s termina en %s', (variant, expectedFile) => {
    expect(optimizedImageKey(identity, variant)).toBe(
      `${identity.userId}/${identity.jobId}/optimized/${expectedFile}`,
    );
  });

  it.each([
    '..',
    '.',
    '',
    'a/b',
    '/abs',
    'C:\\temp',
    '..%2fotro',
    'con espacio',
    'nul\u0000byte',
  ])('rechaza el segmento inseguro %j', (value) => {
    expect(() => assertSafeKeySegment(value, 'imageId')).toThrow(UnsafeObjectKeyError);
  });

  it.each(['img_1', identity.userId, 'foto.jpg', 'a-b_c.9'])(
    'acepta el segmento seguro %j',
    (value) => {
      expect(() => assertSafeKeySegment(value, 'imageId')).not.toThrow();
    },
  );

  it('rechaza tipos no cadena como segmento', () => {
    expect(() => assertSafeKeySegment(42, 'jobId')).toThrow(UnsafeObjectKeyError);
    expect(() => assertSafeKeySegment(null, 'userId')).toThrow(UnsafeObjectKeyError);
  });

  it('rechaza una clave construida que escapa del prefijo del usuario', () => {
    const prefix = identity.userId;
    expect(() =>
      assertKeyWithinPrefix(`${prefix}/../otro/raw/img_1`, prefix),
    ).toThrow(UnsafeObjectKeyError);
    expect(() => assertKeyWithinPrefix(`/otro/${identity.jobId}/raw/img_1`, prefix)).toThrow(
      UnsafeObjectKeyError,
    );
    expect(() =>
      assertKeyWithinPrefix(`${prefix}x/${identity.jobId}/raw/img_1`, prefix),
    ).toThrow(UnsafeObjectKeyError);
  });

  it('acepta claves dentro del prefijo y delimitadas por el separador', () => {
    const key = rawImageKey(identity);
    expect(() => assertKeyWithinPrefix(key, identity.userId)).not.toThrow();
    expect(key.startsWith(`${identity.userId}/`)).toBe(true);
  });
});

describe('expiración acotada de URLs firmadas', () => {
  it('usa un valor por defecto razonable', () => {
    expect(resolveExpiry(undefined)).toBe(PRESIGN_DEFAULT_EXPIRY_SECONDS);
    expect(PRESIGN_DEFAULT_EXPIRY_SECONDS).toBeGreaterThanOrEqual(PRESIGN_MIN_EXPIRY_SECONDS);
    expect(PRESIGN_DEFAULT_EXPIRY_SECONDS).toBeLessThanOrEqual(PRESIGN_MAX_EXPIRY_SECONDS);
  });

  it.each([PRESIGN_MIN_EXPIRY_SECONDS, 120, PRESIGN_MAX_EXPIRY_SECONDS])(
    'acepta %s segundos configurables',
    (value) => {
      expect(resolveExpiry(value)).toBe(value);
    },
  );

  it.each([0, 59, 3601, 999999, 1.5, Number.NaN])(
    'rechaza expiración fuera de rango: %s',
    (value) => {
      expect(() => resolveExpiry(value)).toThrow();
    },
  );
});
