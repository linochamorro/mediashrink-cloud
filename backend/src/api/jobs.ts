/**
 * Rutas Hono `/jobs` (F02-T01, contrato interoperable F02-AUD-01): creación,
 * confirmación idempotente, listado y detalle. Todas las operaciones usan el
 * `userId` del JWT, nunca parámetros ni cabeceras del cliente (FR-21, PR-07).
 *
 * `POST /jobs` acepta `{ preset, files: [{ fileName, contentType, sizeBytes }] }`
 * y responde 201 `{ job, uploads: [{ imageId, uploadUrl, method: 'PUT' }] }`:
 * el `imageId` se genera con `randomUUID` en el servidor (nunca se deriva del
 * `fileName`) y la URL PUT se firma con el `PresignService` inyectado.
 */

import { randomUUID } from 'node:crypto';

import { Hono } from 'hono';

import { requireAuth, authErrorResponse } from '../auth/middleware';
import { rateLimited, resourceNotFound, validationError } from '../auth/errors';
import type { FixedWindowRateLimiter } from '../auth/rate-limit';
import type { UserStore } from '../auth/user-store';
import type { AppConfig } from '../config/index';
import {
  computeTtl,
  schemas,
  type Job,
  type Preset,
} from '../contracts/index';
import type { JobStore } from '../db/types';
import { rawImageKey } from '../storage/keys';
import type { PresignResult, PresignService } from '../storage/index';
import { JobAlreadyConfirmedError, type JobTransitionStore } from './job-transition';
import type { JobListStore } from './job-list-store';
import type { JobQueuePublisher } from './publisher';

export interface JobsRoutesDeps {
  config: AppConfig;
  users: UserStore;
  jobs: JobStore;
  lister: JobListStore;
  jobTransition: JobTransitionStore;
  publisher: JobQueuePublisher;
  limiter: FixedWindowRateLimiter;
  /** Firma las PUT de subida a `raw`; se inyecta perezosamente desde `app.ts`. */
  presign: Pick<PresignService, 'presignUpload'>;
  now: () => number;
}

/** Tipos locales del contrato de subida (los contratos congelados no se tocan). */
interface NewFile {
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

interface CreateJobInput {
  preset: Preset;
  files: NewFile[];
  name?: string;
}

export interface JobUploadPlanItem {
  imageId: string;
  uploadUrl: string;
  method: 'PUT';
  headers?: Record<string, string>;
}

export interface CreateJobResponse {
  job: Job;
  uploads: JobUploadPlanItem[];
}

const BODY_KEYS = new Set(['preset', 'files', 'name']);
const FILE_KEYS = new Set(['fileName', 'contentType', 'sizeBytes']);
/** MIME raster permitidos (D-11/IN-10): SVG, GIF y no-raster se rechazan. */
const ALLOWED_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
]);

/** El fileName se valida pero nunca se usa en la clave S3 (anti-traversal). */
function isSafeFileName(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    !value.includes('/') &&
    !value.includes('\\') &&
    !value.includes('\0') &&
    !/%[0-9a-fA-F]{2}/.test(value)
  );
}

/** Valida un campo con un esquema congelado, sin redefinirlo. */
function parseWith<T>(schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } }, value: unknown): T | null {
  const result = schema.safeParse(value);
  return result.success ? result.data : null;
}

function parseCreateBody(raw: unknown, config: AppConfig): CreateJobInput | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  if (!schemas.LimitsConfig.safeParse(config.limits).success) return null;

  const body = raw as Record<string, unknown>;
  // Rechazo de claves desconocidas en el cuerpo y en cada archivo.
  if (Object.keys(body).some((key) => !BODY_KEYS.has(key))) return null;

  const preset = parseWith<Preset>(schemas.Preset, body.preset);
  if (preset === null) return null;

  let name: string | undefined;
  if (body.name !== undefined) {
    if (typeof body.name !== 'string') return null;
    const trimmed = body.name.trim();
    if (trimmed.length === 0) {
      name = undefined;
    } else {
      if (trimmed.length > 80) return null;
      name = trimmed;
    }
  }
  if (!Array.isArray(body.files)) return null;
  if (body.files.length < 1 || body.files.length > config.limits.maxImagesPerBatch) return null;

  const maxBytes = config.limits.maxFileSizeMb * 1024 * 1024;
  const files: NewFile[] = [];

  for (const entry of body.files) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return null;
    const item = entry as Record<string, unknown>;
    if (Object.keys(item).some((key) => !FILE_KEYS.has(key))) return null;
    if (!isSafeFileName(item.fileName)) return null;
    if (typeof item.contentType !== 'string' || !ALLOWED_CONTENT_TYPES.has(item.contentType)) {
      return null;
    }

    // `JobMetrics` es un contrato congelado: se reutiliza para validar
    // `sizeBytes` como `bytesBefore` (entero no negativo), y se añade el
    // requisito del addendum de ser > 0 y estar dentro del límite configurado.
    const metric = schemas.JobMetrics.safeParse({
      bytesBefore: item.sizeBytes,
      bytesAfter: 0,
      // El refinamiento congelado `savings-coherence` exige coherencia entre
      // bytesBefore/bytesAfter/savingsPct aunque solo se lea `bytesBefore`.
      savingsPct: item.sizeBytes === 0 ? 0 : 100,
      exifStripped: false,
    });
    if (!metric.success) return null;
    const sizeBytes = metric.data.bytesBefore;
    if (sizeBytes <= 0 || sizeBytes > maxBytes) return null;

    files.push({ fileName: item.fileName, contentType: item.contentType, sizeBytes });
  }

  return { preset, files, ...(name === undefined ? {} : { name }) };
}

/**
 * Verifica que el resultado del presign apunta exactamente a
 * `raw/<userId-del-JWT>/<jobId>/<imageId>` y es una PUT HTTPS. Devuelve la URL
 * o `null` si el resultado no es de confianza (bucket y key nunca se exponen).
 */
function verifiedUploadUrl(
  result: PresignResult,
  userId: string,
  jobId: string,
  imageId: string,
): string | null {
  let isHttps = false;
  try {
    const parsed = new URL(result.url);
    isHttps = parsed.protocol === 'https:' && parsed.username === '' && parsed.password === '';
  } catch {
    isHttps = false;
  }
  if (
    result.method !== 'PUT' ||
    result.key !== rawImageKey({ userId, jobId, imageId }) ||
    !isHttps
  ) {
    return null;
  }
  return result.url;
}

function notFound(): Response {
  return authErrorResponse(resourceNotFound());
}

export function mountJobsRoutes(app: Hono, deps: JobsRoutesDeps): Hono {
  const router = new Hono();

  // Orden de guardas: autenticación (401) → límite por userId (429) → resto.
  router.use('*', requireAuth({ config: deps.config, users: deps.users }));
  router.use('*', async (c, next) => {
    const decision = deps.limiter.check(c.get('userId'));
    if (!decision.allowed) {
      return authErrorResponse(rateLimited(decision.retryAfterSeconds), {
        'Retry-After': String(decision.retryAfterSeconds),
      });
    }
    await next();
  });

  router.post('/', async (c) => {
    try {
      let raw: unknown;
      try {
        raw = await c.req.json();
      } catch {
        return authErrorResponse(validationError());
      }
      const input = parseCreateBody(raw, deps.config);
      if (input === null) return authErrorResponse(validationError());

      const userId = c.get('userId');
      const jobId = randomUUID();
      const createdAt = new Date(deps.now()).toISOString();
      const job: Job = {
        jobId,
        userId,
        status: 'PENDING',
        ...(input.name === undefined ? {} : { name: input.name }),
        preset: input.preset,
        formats: ['webp', 'avif'],
        // Sin medición real todavía: el contrato congelado exige coherencia
        // savingsPct = f(bytesBefore, bytesAfter), así que el lote PENDING no
        // puede anunciar bytes de entrada con 0 de salida (falso 100 %).
        bytesBefore: 0,
        bytesAfter: 0,
        savingsPct: 0,
        exifStripped: false,
        createdAt,
        updatedAt: createdAt,
        ttl: computeTtl(createdAt),
      };

      // Firma las PUT antes de persistir: si la firma falla no queda un lote
      // huérfano. El imageId se genera siempre en el servidor con randomUUID.
      const uploads: JobUploadPlanItem[] = [];
      for (let index = 0; index < input.files.length; index += 1) {
        const imageId = randomUUID();
        const result = await deps.presign.presignUpload({ userId, jobId, imageId });
        const uploadUrl = verifiedUploadUrl(result, userId, jobId, imageId);
        if (uploadUrl === null) return authErrorResponse(validationError());
        uploads.push({ imageId, uploadUrl, method: 'PUT' });
      }

      const stored = await deps.jobs.createJob(schemas.Job.parse(job));
      const response: CreateJobResponse = { job: stored, uploads };
      return c.json(response, 201);
    } catch (error) {
      return authErrorResponse(error);
    }
  });

  router.get('/', async (c) => {
    try {
      const jobs = await deps.lister.listByUser(c.get('userId'));
      return c.json({ jobs });
    } catch (error) {
      return authErrorResponse(error);
    }
  });

  router.get('/:id', async (c) => {
    try {
      const userId = c.get('userId');
      const job = await deps.jobs.getJob(userId, c.req.param('id') ?? '');
      if (job === null) return notFound();
      const images = await deps.jobs.listImages(userId, job.jobId);
      return c.json({ job, images });
    } catch (error) {
      return authErrorResponse(error);
    }
  });

  router.post('/:id/confirm', async (c) => {
    const userId = c.get('userId');
    const jobId = c.req.param('id') ?? '';
    try {
      const current = await deps.jobs.getJob(userId, jobId);
      if (current === null) return notFound();
      // Idempotencia secuencial: un lote ya confirmado no se publica dos veces.
      if (current.status !== 'PENDING') return c.json({ job: current, confirmed: true });

      let updated: Job;
      try {
        updated = await deps.jobTransition.confirmPending(
          userId,
          jobId,
          new Date(deps.now()).toISOString(),
        );
      } catch (error) {
        if (error instanceof JobAlreadyConfirmedError) {
          // Otro confirm ganó la carrera: idempotente, sin publicar de nuevo.
          const concurrent = await deps.jobs.getJob(userId, jobId);
          if (concurrent === null) return notFound();
          return c.json({ job: concurrent, confirmed: true });
        }
        throw error;
      }

      try {
        await deps.publisher.publish({ userId, jobId });
      } catch {
        // La reversión también es condicional: si el estado ya cambió (o la
        // escritura falla), no se puede garantizar consistencia y hay que
        // reportarlo explícitamente en lugar de devolver confirmed: true.
        try {
          await deps.jobTransition.revertToPending(
            userId,
            jobId,
            new Date(deps.now()).toISOString(),
          );
        } catch {
          return c.json(
            {
              error: {
                code: 'CONFIRM_INCONSISTENT',
                message: 'No se pudo encolar el lote ni revertir su estado',
              },
            },
            503,
          );
        }
        return c.json(
          { error: { code: 'PUBLISH_FAILED', message: 'No se pudo encolar el lote' } },
          503,
        );
      }
      return c.json({ job: updated, confirmed: true });
    } catch (error) {
      return authErrorResponse(error);
    }
  });

  app.route('/jobs', router);
  return app;
}
