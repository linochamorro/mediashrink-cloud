/**
 * Rutas de presign (F02-T02, FR-08/FR-09/FR-17).
 *
 * Solo devuelven metadatos de la URL firmada: el navegador sube el binario
 * directamente a S3. El `userId` sale exclusivamente del JWT verificado; el
 * cuerpo se valida con los esquemas congelados y se rechazan claves desconocidas.
 */

import { Hono } from 'hono';

import { rateLimited, validationError } from '../auth/errors';
import { requireAuth, authErrorResponse } from '../auth/middleware';
import type { FixedWindowRateLimiter } from '../auth/rate-limit';
import type { UserStore } from '../auth/user-store';
import type { AppConfig } from '../config/index';
import { schemas } from '../contracts/index';
import {
  assertSafeKeySegment,
  InvalidExpiryError,
  PRESIGN_MAX_EXPIRY_SECONDS,
  PRESIGN_MIN_EXPIRY_SECONDS,
  type OptimizedVariant,
  type PresignService,
  UnsafeObjectKeyError,
} from '../storage/index';

export interface PresignRoutesDeps {
  config: AppConfig;
  users: UserStore;
  service: PresignService;
  limiter?: FixedWindowRateLimiter;
}

const UPLOAD_BODY_KEYS = new Set(['jobId', 'imageId', 'expiresIn']);
const DOWNLOAD_BODY_KEYS = new Set(['jobId', 'imageId', 'variant', 'expiresIn']);

interface ParsedBody {
  jobId: string;
  imageId: string;
  variant?: OptimizedVariant;
  expiresIn?: number;
}

/** Reutiliza el formato `nonempty` congelado de `ImageRecord.imageId`. */
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

/** `webp`/`avif` vienen de `OutputFormat`; `thumbnail` es WebP (A-04). */
function isVariant(value: unknown): value is OptimizedVariant {
  return schemas.OutputFormat.safeParse(value).success || value === 'thumbnail';
}

function parseExpiry(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < PRESIGN_MIN_EXPIRY_SECONDS ||
    value > PRESIGN_MAX_EXPIRY_SECONDS
  ) {
    throw validationError();
  }
  return value;
}

function parseBody(raw: unknown, allowed: ReadonlySet<string>): Record<string, unknown> | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const body = raw as Record<string, unknown>;
  if (Object.keys(body).some((key) => !allowed.has(key))) return null;
  return body;
}

/** Único punto de validación de entrada de ambas rutas. */
function parsePresignBody(
  raw: unknown,
  allowed: ReadonlySet<string>,
  withVariant: boolean,
): ParsedBody | null {
  const body = parseBody(raw, allowed);
  if (
    body === null ||
    !isFrozenId(body.jobId) ||
    !isFrozenId(body.imageId) ||
    !isSafeId(body.jobId) ||
    !isSafeId(body.imageId)
  ) {
    return null;
  }

  let expiresIn: number | undefined;
  try {
    expiresIn = parseExpiry(body.expiresIn);
  } catch {
    return null;
  }

  if (withVariant) {
    if (!isVariant(body.variant)) return null;
    return {
      jobId: body.jobId,
      imageId: body.imageId,
      variant: body.variant,
      ...(expiresIn === undefined ? {} : { expiresIn }),
    };
  }
  return {
    jobId: body.jobId,
    imageId: body.imageId,
    ...(expiresIn === undefined ? {} : { expiresIn }),
  };
}

export function mountPresignRoutes(app: Hono, deps: PresignRoutesDeps): Hono {
  const router = new Hono();

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

  router.post('/upload', async (c) => {
    let input: ParsedBody | null;
    try {
      input = parsePresignBody(await c.req.json(), UPLOAD_BODY_KEYS, false);
    } catch {
      return authErrorResponse(validationError());
    }
    if (input === null) return authErrorResponse(validationError());

    try {
      const result = await deps.service.presignUpload({
        userId: c.get('userId'),
        jobId: input.jobId,
        imageId: input.imageId,
        ...(input.expiresIn === undefined ? {} : { expiresIn: input.expiresIn }),
      });
      return c.json(result);
    } catch (error) {
      if (error instanceof UnsafeObjectKeyError || error instanceof InvalidExpiryError) {
        return authErrorResponse(validationError());
      }
      return authErrorResponse(error);
    }
  });

  router.post('/download', async (c) => {
    let input: ParsedBody | null;
    try {
      input = parsePresignBody(await c.req.json(), DOWNLOAD_BODY_KEYS, true);
    } catch {
      return authErrorResponse(validationError());
    }
    if (input === null || input.variant === undefined) {
      return authErrorResponse(validationError());
    }

    try {
      const result = await deps.service.presignDownload({
        userId: c.get('userId'),
        jobId: input.jobId,
        imageId: input.imageId,
        variant: input.variant,
        ...(input.expiresIn === undefined ? {} : { expiresIn: input.expiresIn }),
      });
      return c.json(result);
    } catch (error) {
      if (error instanceof UnsafeObjectKeyError || error instanceof InvalidExpiryError) {
        return authErrorResponse(validationError());
      }
      return authErrorResponse(error);
    }
  });

  app.route('/presign', router);
  return app;
}
