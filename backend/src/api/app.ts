/**
 * Punto de entrada HTTP de la Fase 2 (F02-T01).
 *
 * `backend/src/index.ts` permanece intacto: el wiring del servidor real se
 * consolidará en F05. Los tests importan `createApiApp()` desde aquí.
 */

import { Hono } from 'hono';

import { FixedWindowRateLimiter } from '../auth/rate-limit';
import { mountAuthRoutes } from '../auth/routes';
import { AuthService } from '../auth/service';
import type { UserStore } from '../auth/user-store';
import type { AppConfig } from '../config/index';
import { createDynamoDbDocumentClientFromConfig } from '../db/index';
import type { JobStore } from '../db/types';
import {
  ANONYMOUS_PRINCIPAL,
  NonSpoofableAuthLimiter,
  withPrincipal,
} from './rate-limit';
import { createDynamoJobListStore, type JobListStore } from './job-list-store';
import { createDynamoJobTransitionStore, type JobTransitionStore } from './job-transition';
import { mountDownloadRoutes } from './download';
import { mountJobsRoutes } from './jobs';
import { mountPresignRoutes } from './presign';
import type { JobQueuePublisher } from './publisher';
import { jsonBodyLimit, securityHeaders } from './security';
import {
  createObjectAccessServiceFromConfig,
  createPresignServiceFromConfig,
  type ObjectAccessService,
  type PresignService,
} from '../storage/index';
import { createS3EnrichedPublisher, supportsJobEnvelope } from './enriched-publisher';

export interface ApiAppDeps {
  config: AppConfig;
  users: UserStore;
  jobs: JobStore;
  publisher: JobQueuePublisher;
  authService?: AuthService;
  authLimiter?: FixedWindowRateLimiter;
  jobsLimiter?: FixedWindowRateLimiter;
  jobLister?: JobListStore;
  jobTransition?: JobTransitionStore;
  presignService?: PresignService;
  presignLimiter?: FixedWindowRateLimiter;
  objectAccess?: ObjectAccessService;
  downloadLimiter?: FixedWindowRateLimiter;
  now?: () => number;
}

export function createApiApp(deps: ApiAppDeps): Hono {
  const { config, users, jobs, publisher } = deps;
  const now = deps.now ?? (() => Date.now());

  const service = deps.authService ?? new AuthService({ config, users, now });
  const authLimiter =
    deps.authLimiter ??
    new NonSpoofableAuthLimiter(config.rateLimit.authMax, config.rateLimit.authWindowMs, now);
  const jobsLimiter =
    deps.jobsLimiter ??
    new FixedWindowRateLimiter(config.rateLimit.apiMax, config.rateLimit.authWindowMs, now);
  // Cliente DynamoDB perezoso: los tests unitarios inyectan ambos puertos y
  // no deben depender del certificado/emulador (G-4/G-7).
  let documentClient: ReturnType<typeof createDynamoDbDocumentClientFromConfig> | undefined;
  const getDocumentClient = () =>
    (documentClient ??= createDynamoDbDocumentClientFromConfig(config));

  // Servicio S3 perezoso: los tests unitarios inyectan un doble y no leen el CA
  // del emulador; el wiring real se construye solo cuando se usa /presign.
  let presignService: PresignService | undefined = deps.presignService;
  const getPresignService = () => (presignService ??= createPresignServiceFromConfig(config));
  const presignLimiter =
    deps.presignLimiter ??
    new FixedWindowRateLimiter(config.rateLimit.apiMax, config.rateLimit.authWindowMs, now);

  // Servicio de objetos de T05: perezoso por el mismo motivo que el de presign.
  let objectAccess: ObjectAccessService | undefined = deps.objectAccess;
  const getObjectAccess = () => (objectAccess ??= createObjectAccessServiceFromConfig(config));
  const downloadLimiter =
    deps.downloadLimiter ??
    new FixedWindowRateLimiter(config.rateLimit.apiMax, config.rateLimit.authWindowMs, now);

  const lister =
    deps.jobLister ??
    createDynamoJobListStore({
      tableName: config.resources.dynamodbTableJobs,
      client: getDocumentClient(),
    });
  const jobTransition =
    deps.jobTransition ??
    createDynamoJobTransitionStore({
      tableName: config.resources.dynamodbTableJobs,
      client: getDocumentClient(),
    });

  // F02-T06: si el publicador inyectado es el real de worker/** (ofrece
  // `publishJob`), se adapta aquí para que `confirm` envíe el sobre enriquecido
  // con los bytes leídos de S3 raw. Los dobles que solo tienen `publish()`
  // (tests unitarios) siguen funcionando sin cambios.
  const effectivePublisher = supportsJobEnvelope(publisher)
    ? createS3EnrichedPublisher({ delegate: publisher, config, jobs })
    : publisher;

  const app = new Hono();

  // F05-H01: hardening defensivo global (cabeceras + tope de body 1 MiB con
  // 413). Van primero para cubrir todas las rutas y todos los errores.
  app.use('*', securityHeaders);
  app.use('*', jsonBodyLimit);

  // T03-A-01: la clave de /auth nunca sale de x-forwarded-for/x-real-ip.
  app.use('/auth/*', async (_c, next) => withPrincipal(ANONYMOUS_PRINCIPAL, () => next()));
  mountAuthRoutes(app, { config, users, service, limiter: authLimiter });

  mountJobsRoutes(app, {
    config,
    users,
    jobs,
    lister,
    jobTransition,
    publisher: effectivePublisher,
    limiter: jobsLimiter,
    // F02-AUD-01: POST /jobs firma las PUT de subida con el mismo servicio que
    // /presign. Perezoso para no construir el cliente S3 en tests unitarios.
    presign: {
      presignUpload: (request) => getPresignService().presignUpload(request),
    },
    now,
  });

  mountPresignRoutes(app, {
    config,
    users,
    limiter: presignLimiter,
    service: {
      presignUpload: (request) => getPresignService().presignUpload(request),
      presignDownload: (request) => getPresignService().presignDownload(request),
    },
  });

  mountDownloadRoutes(app, {
    config,
    users,
    jobs,
    limiter: downloadLimiter,
    service: {
      presignVariant: (request) => getObjectAccess().presignVariant(request),
      readOptimizedObjects: (request, imageIds) =>
        getObjectAccess().readOptimizedObjects(request, imageIds),
      deleteJobObjects: (request) => getObjectAccess().deleteJobObjects(request),
    },
  });

  return app;
}
