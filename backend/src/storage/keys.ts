/**
 * Claves S3 con prefijo por usuario (F02-T02, CA-02, FR-08/FR-17).
 *
 * El primer segmento de toda clave es el `userId` del JWT: así el prefijo
 * identifica al propietario y dos usuarios nunca comparten espacio de claves.
 * Cada segmento se valida con una lista blanca estricta antes de construir la
 * clave y se vuelve a comprobar la clave resultante (defensa en profundidad):
 * se rechazan `..`, rutas absolutas, separadores, NUL y codificaciones `%xx`.
 * El valor rechazado nunca se incluye en el mensaje de error (G-3).
 */

export const OPTIMIZED_VARIANTS = ['webp', 'avif', 'thumbnail'] as const;
export type OptimizedVariant = (typeof OPTIMIZED_VARIANTS)[number];

export interface ObjectIdentity {
  userId: string;
  jobId: string;
  imageId: string;
}

/** Segmento seguro de clave: alfanumérico inicial y guiones/puntos después. */
const SAFE_SEGMENT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export class UnsafeObjectKeyError extends Error {
  constructor(field: string) {
    super(`Valor inseguro para la clave S3 en el campo ${field}`);
    this.name = 'UnsafeObjectKeyError';
  }
}

export function assertSafeKeySegment(value: unknown, name: string): asserts value is string {
  if (
    typeof value !== 'string' ||
    value === '.' ||
    value === '..' ||
    !SAFE_SEGMENT_PATTERN.test(value)
  ) {
    throw new UnsafeObjectKeyError(name);
  }
}

function assertVariant(variant: unknown): asserts variant is OptimizedVariant {
  if (typeof variant !== 'string' || !OPTIMIZED_VARIANTS.includes(variant as OptimizedVariant)) {
    throw new UnsafeObjectKeyError('variant');
  }
}

export function rawImageKey(identity: ObjectIdentity): string {
  assertSafeKeySegment(identity.userId, 'userId');
  assertSafeKeySegment(identity.jobId, 'jobId');
  assertSafeKeySegment(identity.imageId, 'imageId');
  return `${identity.userId}/${identity.jobId}/raw/${identity.imageId}`;
}

export function optimizedImageKey(identity: ObjectIdentity, variant: OptimizedVariant): string {
  assertSafeKeySegment(identity.userId, 'userId');
  assertSafeKeySegment(identity.jobId, 'jobId');
  assertSafeKeySegment(identity.imageId, 'imageId');
  assertVariant(variant);
  const file =
    variant === 'thumbnail' ? `${identity.imageId}_thumb.webp` : `${identity.imageId}.${variant}`;
  return `${identity.userId}/${identity.jobId}/optimized/${file}`;
}

/** Verifica que una clave ya construida sigue confinada al prefijo del usuario. */
export function assertKeyWithinPrefix(key: unknown, prefix: string): void {
  assertSafeKeySegment(prefix, 'prefix');
  if (typeof key !== 'string') throw new UnsafeObjectKeyError('key');
  if (key.startsWith('/') || key.includes('\\') || key.includes('\0')) {
    throw new UnsafeObjectKeyError('key');
  }

  const expectedPrefix = `${prefix}/`;
  if (!key.startsWith(expectedPrefix) || key.length === expectedPrefix.length) {
    throw new UnsafeObjectKeyError('key');
  }

  for (const segment of key.split('/')) {
    assertSafeKeySegment(segment, 'key');
  }
}
