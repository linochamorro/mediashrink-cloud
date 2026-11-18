/**
 * Acceso a objetos del lote para descarga, ZIP y borrado (F02-T05, CA-05).
 *
 * Toda operación exige el `userId` del JWT: las claves se construyen con ese
 * prefijo y las listas/borrados se acotan a `<userId>/<jobId>/`, por lo que un
 * lote ajeno nunca puede leerse ni borrarse (PR-07, FR-21).
 *
 * Seguimiento T02-A-02 (`If-None-Match`): T05 no realiza escrituras ni
 * sobreescrituras de objetos. La descarga y el ZIP son lecturas (`GET`) y el
 * borrado es una eliminación deliberadamente incondicional acotada por
 * prefijo; `DeleteObjects` no admite condición `If-None-Match`. El control de
 * sobreescritura intra-usuario sigue competiendo a la única escritura de la
 * API (`PUT` a `raw` en `/presign/upload`).
 *
 * Loop 2: A-01 añade topes explícitos al ZIP (bytes y entradas) ANTES de
 * materializar los objetos; A-02 trata `Errors[]` de `DeleteObjects` como
 * fallo con reintento acotado, para no borrar la fila DynamoDB si quedan
 * objetos huérfanos.
 */

import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import type { AppConfig } from '../config/index';
import {
  defaultZipLimits,
  type ArchiveEntry,
  type ZipLimits,
  ZipLimitError,
} from './archive';
import { createS3ClientFromConfig } from './client';
import {
  assertKeyWithinPrefix,
  assertSafeKeySegment,
  optimizedImageKey,
  rawImageKey,
  UnsafeObjectKeyError,
  type OptimizedVariant,
} from './keys';
import {
  createPresignService,
  resolveExpiry,
  type PresignResult,
  type PresignService,
} from './presigner';

/** Variantes descargables: optimizadas, miniatura WebP y original (comparativa FR-15). */
export const DOWNLOAD_VARIANTS = ['webp', 'avif', 'thumbnail', 'original'] as const;
export type DownloadVariant = (typeof DOWNLOAD_VARIANTS)[number];

/** Variantes incluidas en el ZIP (A-05): WebP, AVIF y miniatura WebP. */
export const ZIP_VARIANTS: readonly OptimizedVariant[] = ['webp', 'avif', 'thumbnail'];

/** Reintentos de `DeleteObjects` para las claves que S3 reportó como fallidas. */
export const MAX_DELETE_ATTEMPTS = 3;

export interface JobObjectRequest {
  userId: string;
  jobId: string;
}

export interface ImageObjectRequest extends JobObjectRequest {
  imageId: string;
}

export interface PresignVariantRequest extends ImageObjectRequest {
  variant: DownloadVariant;
}

/** Fallo de borrado parcial: código estable, sin claves ni motivos internos. */
export class ObjectDeletionError extends Error {
  constructor(readonly failedCount: number) {
    super('No se pudieron borrar todos los objetos del lote');
    this.name = 'ObjectDeletionError';
  }
}

/** Salidas del worker en memoria: misma forma que `RenderedOutputs` (sin acoplar capas). */
export interface OptimizedVariantBytes {
  readonly webp: Uint8Array;
  readonly avif: Uint8Array;
  readonly thumbnail: Uint8Array;
}

/** Evidencia de persistencia real: claves y tamaños confirmados por `HeadObject`. */
export interface OptimizedWriteResult {
  readonly keys: Readonly<Record<OptimizedVariant, string>>;
  readonly bytesByVariant: Readonly<Record<OptimizedVariant, number>>;
  readonly totalBytes: number;
}

/** Fallo de escritura coherente: código estable, sin claves ni motivos internos (G-3). */
export class OptimizedWriteError extends Error {
  constructor(readonly variant: OptimizedVariant) {
    super('No se pudieron persistir todas las variantes optimizadas');
    this.name = 'OptimizedWriteError';
  }
}

export interface ObjectAccessService {
  presignVariant(request: PresignVariantRequest): Promise<PresignResult>;
  readOptimizedObjects(request: JobObjectRequest, imageIds: readonly string[]): Promise<ArchiveEntry[]>;
  /** Devuelve el número de objetos confirmados como borrados (0 es válido). */
  deleteJobObjects(request: JobObjectRequest): Promise<number>;
}

/**
 * Capacidad de escritura del worker. Se declara aparte de `ObjectAccessService`
 * para no obligar a los dobles de descarga/borrado (tests unitarios de T05) a
 * implementar una operación que no les compete.
 */
export interface OptimizedObjectWriter {
  /** Persiste las 3 variantes y devuelve sus bytes REALES confirmados por HeadObject. */
  writeOptimizedVariants(
    request: ImageObjectRequest,
    outputs: OptimizedVariantBytes,
  ): Promise<OptimizedWriteResult>;
}

export interface ObjectAccessServiceDeps {
  client: S3Client;
  presign: PresignService;
  rawBucket: string;
  optimizedBucket: string;
  now?: () => number;
  /** A-01: topes explícitos del ZIP; por defecto, `defaultZipLimits()`. */
  zipLimits?: ZipLimits;
}

function isMissingObject(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as {
    name?: string;
    $metadata?: { httpStatusCode?: number };
  };
  return (
    candidate.name === 'NoSuchKey' ||
    candidate.name === 'NotFound' ||
    candidate.$metadata?.httpStatusCode === 404
  );
}

function jobPrefix(request: JobObjectRequest): string {
  assertSafeKeySegment(request.userId, 'userId');
  assertSafeKeySegment(request.jobId, 'jobId');
  return `${request.userId}/${request.jobId}/`;
}

/** Topes derivados de la ingesta, sin tocar la configuración ni `.env` (G-3). */
export function resolveZipLimits(config: AppConfig): ZipLimits {
  const defaults = defaultZipLimits();
  const maxImages = config.limits.maxImagesPerBatch;
  return {
    maxEntries: Math.min(defaults.maxEntries, maxImages * ZIP_VARIANTS.length),
    maxBytes: Math.min(
      defaults.maxBytes,
      maxImages * config.limits.maxFileSizeMb * 1024 * 1024,
    ),
  };
}

/** Firma una URL de descarga de cualquiera de las variantes permitidas. */
export function createObjectAccessService(
  deps: ObjectAccessServiceDeps,
): ObjectAccessService & OptimizedObjectWriter {
  const now = deps.now ?? (() => Date.now());
  const zipLimits = deps.zipLimits ?? defaultZipLimits();

  return {
    async presignVariant(request) {
      assertSafeKeySegment(request.imageId, 'imageId');
      if (request.variant === 'original') {
        const key = rawImageKey(request);
        assertKeyWithinPrefix(key, request.userId);
        const expiresIn = resolveExpiry(undefined);
        const url = await getSignedUrl(
          deps.client,
          new GetObjectCommand({ Bucket: deps.rawBucket, Key: key }),
          { expiresIn },
        );
        return {
          url,
          key,
          method: 'GET',
          bucket: deps.rawBucket,
          expiresIn,
          expiresAt: new Date(now() + expiresIn * 1000).toISOString(),
        };
      }
      return deps.presign.presignDownload({
        userId: request.userId,
        jobId: request.jobId,
        imageId: request.imageId,
        variant: request.variant,
      });
    },

    async readOptimizedObjects(request, imageIds) {
      const prefix = jobPrefix(request);
      const entries: ArchiveEntry[] = [];
      let totalBytes = 0;

      // Peor caso: una entrada por variante e imagen. Se rechaza antes de
      // cualquier GetObject para no materializar un lote sobredimensionado.
      if (imageIds.length * ZIP_VARIANTS.length > zipLimits.maxEntries) {
        throw new ZipLimitError('entries', zipLimits.maxEntries, imageIds.length * ZIP_VARIANTS.length);
      }

      for (const imageId of imageIds) {
        for (const variant of ZIP_VARIANTS) {
          if (entries.length + 1 > zipLimits.maxEntries) {
            throw new ZipLimitError('entries', zipLimits.maxEntries, entries.length + 1);
          }
          const key = optimizedImageKey({ ...request, imageId }, variant);
          // Doble comprobación: la clave construida sigue dentro del prefijo.
          if (!key.startsWith(prefix)) continue;
          assertKeyWithinPrefix(key, request.userId);
          try {
            const result = await deps.client.send(
              new GetObjectCommand({ Bucket: deps.optimizedBucket, Key: key }),
            );
            if (result.Body === undefined) continue;
            // A-01: el tamaño declarado se comprueba ANTES de materializar.
            const declared = typeof result.ContentLength === 'number' ? result.ContentLength : 0;
            if (totalBytes + declared > zipLimits.maxBytes) {
              throw new ZipLimitError('bytes', zipLimits.maxBytes, totalBytes + declared);
            }
            const bytes = Buffer.from(await result.Body.transformToByteArray());
            if (totalBytes + bytes.length > zipLimits.maxBytes) {
              throw new ZipLimitError('bytes', zipLimits.maxBytes, totalBytes + bytes.length);
            }
            totalBytes += bytes.length;
            const name =
              variant === 'thumbnail' ? `${imageId}_thumb.webp` : `${imageId}.${variant}`;
            entries.push({ name, bytes });
          } catch (error) {
            // Un lote PARCIAL puede no tener todas las variantes: se omiten.
            if (isMissingObject(error)) continue;
            throw error;
          }
        }
      }
      return entries;
    },

    async writeOptimizedVariants(request, outputs) {
      const prefix = jobPrefix(request);
      assertSafeKeySegment(request.imageId, 'imageId');
      const sources: ReadonlyArray<readonly [OptimizedVariant, Uint8Array, string]> = [
        ['webp', outputs.webp, 'image/webp'],
        ['avif', outputs.avif, 'image/avif'],
        ['thumbnail', outputs.thumbnail, 'image/webp'],
      ];
      const keys = {} as Record<OptimizedVariant, string>;
      const bytesByVariant = {} as Record<OptimizedVariant, number>;
      let totalBytes = 0;

      for (const [variant, bytes, contentType] of sources) {
        const key = optimizedImageKey(request, variant);
        // Doble comprobación de confinamiento al prefijo del usuario (PR-07).
        if (!key.startsWith(prefix)) throw new UnsafeObjectKeyError('key');
        assertKeyWithinPrefix(key, request.userId);

        await deps.client.send(
          new PutObjectCommand({
            Bucket: deps.optimizedBucket,
            Key: key,
            Body: bytes,
            ContentType: contentType,
          }),
        );
        // Ancla la métrica al objeto REAL persistido: si el tamaño confirmado
        // por S3 no coincide con el buffer, se falla cerrado en vez de estimar.
        const head = await deps.client.send(
          new HeadObjectCommand({ Bucket: deps.optimizedBucket, Key: key }),
        );
        const persisted = head.ContentLength;
        if (persisted === undefined || persisted !== bytes.byteLength) {
          throw new OptimizedWriteError(variant);
        }
        keys[variant] = key;
        bytesByVariant[variant] = persisted;
        totalBytes += persisted;
      }
      return { keys, bytesByVariant, totalBytes };
    },

    async deleteJobObjects(request) {
      const prefix = jobPrefix(request);
      let deleted = 0;

      for (const bucket of [deps.rawBucket, deps.optimizedBucket]) {
        let continuationToken: string | undefined;
        do {
          const listed = await deps.client.send(
            new ListObjectsV2Command({
              Bucket: bucket,
              Prefix: prefix,
              ContinuationToken: continuationToken,
            }),
          );
          const keys = (listed.Contents ?? [])
            .map((item) => item.Key)
            .filter((key): key is string => typeof key === 'string');
          for (const key of keys) {
            // Defensa en profundidad: nunca borrar fuera del prefijo del usuario.
            assertKeyWithinPrefix(key, request.userId);
          }

          for (let index = 0; index < keys.length; index += 1000) {
            let pending = keys.slice(index, index + 1000).map((Key) => ({ Key }));
            for (let attempt = 0; attempt < MAX_DELETE_ATTEMPTS; attempt += 1) {
              const result = (await deps.client.send(
                new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: pending } }),
              )) as { Deleted?: Array<{ Key?: string }>; Errors?: Array<{ Key?: string }> };

              deleted += (result.Deleted ?? []).length;

              // A-02: un HTTP 200 con `Errors[]` NO es éxito. Se reintentan
              // solo las claves fallidas; si agotan los intentos, se lanza.
              const failedKeys = new Set(
                (result.Errors ?? [])
                  .map((error) => error.Key)
                  .filter((key): key is string => typeof key === 'string'),
              );
              if ((result.Errors ?? []).length === 0) {
                pending = [];
                break;
              }
              pending = failedKeys.size === 0 ? pending : pending.filter((item) => failedKeys.has(item.Key));
            }
            if (pending.length > 0) throw new ObjectDeletionError(pending.length);
          }
          continuationToken = listed.IsTruncated === true ? listed.NextContinuationToken : undefined;
        } while (continuationToken !== undefined);
      }
      return deleted;
    },
  };
}

/** Fábrica real a partir de la configuración validada. */
export function createObjectAccessServiceFromConfig(
  config: AppConfig,
): ObjectAccessService & OptimizedObjectWriter {
  const client = createS3ClientFromConfig(config);
  const rawBucket = config.resources.s3BucketRaw;
  const optimizedBucket = config.resources.s3BucketOptimized;
  return createObjectAccessService({
    client,
    presign: createPresignService({ client, rawBucket, optimizedBucket }),
    rawBucket,
    optimizedBucket,
    zipLimits: resolveZipLimits(config),
  });
}
