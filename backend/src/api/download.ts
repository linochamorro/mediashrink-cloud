/**
 * Rutas de descarga individual, ZIP y borrado de lote (F02-T05, CA-05).
 *
 * Las tres operaciones usan el `userId` del JWT verificado, nunca parámetros
 * ni cabeceras del cliente. Un lote ajeno e inexistente devuelven el mismo
 * 404 genérico (spec §6, FR-21, PR-07). Los identificadores se validan con los
 * esquemas congelados y con la lista blanca de segmentos de clave S3.
 */

import { Hono } from 'hono';

import { rateLimited, resourceNotFound, validationError } from '../auth/errors';
import { requireAuth, authErrorResponse } from '../auth/middleware';
import type { FixedWindowRateLimiter } from '../auth/rate-limit';
import type { UserStore } from '../auth/user-store';
import type { AppConfig } from '../config/index';
import { schemas } from '../contracts/index';
import { JobNotFoundError } from '../db/errors';
import type { JobStore } from '../db/types';
import {
  assertSafeKeySegment,
  createZipArchive,
  type DownloadVariant,
  ObjectDeletionError,
  type ObjectAccessService,
  resolveZipLimits,
  UnsafeObjectKeyError,
  ZipLimitError,
} from '../storage/index';

export interface DownloadRoutesDeps {
  config: AppConfig;
  users: UserStore;
  jobs: JobStore;
  service: ObjectAccessService;
  limiter?: FixedWindowRateLimiter;
}

/** Reutiliza el `nonempty` congelado de `ImageRecord.imageId` sin redefinirlo. */
function isFrozenId(value: unknown): value is string {
  return schemas.ImageRecord.safeParse({
    imageId: value,
    status: 'PENDING',
    exifStripped: false,
  }).success;
}

/** El contrato congelado exige `nonempty`; la capa S3 exige segmento seguro. */
function isSafeId(value: unknown): value is string {
  try {
    assertSafeKeySegment(value, 'id');
    return true;
  } catch {
    return false;
  }
}

function isVariant(value: unknown): value is DownloadVariant {
  if (typeof value !== 'string') return false;
  if (value === 'thumbnail' || value === 'original') return true;
  return schemas.OutputFormat.safeParse(value).success;
}

/** Un ID debe cumplir el contrato congelado y ser un segmento de clave seguro. */
function isValidId(value: unknown): value is string {
  return isFrozenId(value) && isSafeId(value);
}

function notFound(): Response {
  return authErrorResponse(resourceNotFound());
}

/** Error explícito y genérico: ni claves S3, ni userId, ni mensajes del SDK. */
function explicitError(status: number, code: string, message: string): Response {
  return new Response(
    JSON.stringify({ error: { code, message } }),
    { status, headers: { 'content-type': 'application/json; charset=UTF-8' } },
  );
}

/** Traduce errores de dominio a códigos HTTP sin filtrar detalles internos. */
function failure(error: unknown): Response {
  if (error instanceof JobNotFoundError) return notFound();
  if (error instanceof UnsafeObjectKeyError) return authErrorResponse(validationError());
  if (error instanceof ZipLimitError) {
    return explicitError(413, 'ZIP_TOO_LARGE', 'El ZIP del lote supera el tamaño permitido');
  }
  if (error instanceof ObjectDeletionError) {
    return explicitError(
      502,
      'PARTIAL_DELETE_FAILED',
      'No se pudieron borrar todos los objetos del lote; reintente la operación',
    );
  }
  return authErrorResponse(error);
}

export function mountDownloadRoutes(app: Hono, deps: DownloadRoutesDeps): Hono {
  const router = new Hono();
  // A-01: defensa en profundidad en el límite HTTP, aunque el servicio ya
  // compruebe los topes antes de materializar los objetos.
  const zipLimits = resolveZipLimits(deps.config);

  // Orden de guardas: autenticación (401) → límite por userId (429) → resto.
  router.use('*', requireAuth({ config: deps.config, users: deps.users }));
  if (deps.limiter !== undefined) {
    const limiter = deps.limiter;
    router.use('*', async (c, next) => {
      const decision = limiter.check(c.get('userId'));
      if (!decision.allowed) {
        return authErrorResponse(rateLimited(decision.retryAfterSeconds), {
          'Retry-After': String(decision.retryAfterSeconds),
        });
      }
      await next();
    });
  }

  router.get('/:id/download/:imageId', async (c) => {
    const jobId = c.req.param('id') ?? '';
    const imageId = c.req.param('imageId') ?? '';
    const requested = c.req.query('variant') ?? 'webp';
    if (!isValidId(jobId) || !isValidId(imageId) || !isVariant(requested)) {
      return authErrorResponse(validationError());
    }

    const userId = c.get('userId');
    try {
      // Comprobar el job y la imagen con el userId del JWT: un lote ajeno o
      // una imagen inexistente son indistinguibles para el cliente.
      const job = await deps.jobs.getJob(userId, jobId);
      if (job === null) return notFound();
      const image = await deps.jobs.getImage(userId, jobId, imageId);
      if (image === null) return notFound();

      const result = await deps.service.presignVariant({ userId, jobId, imageId, variant: requested });
      return c.json({
        downloadUrl: result.url,
        // Alias retrocompatible con el campo `url` de `/presign/download`.
        url: result.url,
        expiresAt: result.expiresAt,
      });
    } catch (error) {
      return failure(error);
    }
  });

  router.get('/:id/download.zip', async (c) => {
    const jobId = c.req.param('id') ?? '';
    if (!isValidId(jobId)) return authErrorResponse(validationError());

    const userId = c.get('userId');
    try {
      const job = await deps.jobs.getJob(userId, jobId);
      if (job === null) return notFound();
      const images = await deps.jobs.listImages(userId, jobId);
      const entries = await deps.service.readOptimizedObjects(
        { userId, jobId },
        images.map((image) => image.imageId),
      );
      const archive = createZipArchive(entries, zipLimits);
      const bytes = new Uint8Array(archive.bytes);
      return new Response(bytes, {
        status: 200,
        headers: {
          'content-type': 'application/zip',
          'content-disposition': `attachment; filename="${jobId}.zip"`,
          'cache-control': 'no-store',
          'content-length': String(bytes.length),
        },
      });
    } catch (error) {
      return failure(error);
    }
  });

  router.delete('/:id', async (c) => {
    const jobId = c.req.param('id') ?? '';
    if (!isValidId(jobId)) return authErrorResponse(validationError());

    const userId = c.get('userId');
    try {
      const job = await deps.jobs.getJob(userId, jobId);
      if (job === null) return notFound();
      await deps.service.deleteJobObjects({ userId, jobId });
      await deps.jobs.deleteJobWithImages(userId, jobId);
      return new Response(null, { status: 204 });
    } catch (error) {
      return failure(error);
    }
  });

  app.route('/jobs', router);
  return app;
}
