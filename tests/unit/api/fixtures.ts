/**
 * Fixtures HTTP de la API (F02-T01): app Hono aislada, almacenes en memoria,
 * publicador grabador y reloj controlado. Sin Docker, sin emulador y sin
 * secretos reales (G-3). La app se construye con `createApiApp()`.
 */

import { Hono } from 'hono';

import { createApiApp } from '../../../backend/src/api/app';
import {
  JobAlreadyConfirmedError,
  JobStateConflictError,
  type JobTransitionStore,
} from '../../../backend/src/api/job-transition';
import type { JobQueuePublisher, JobConfirmationMessage } from '../../../backend/src/api/publisher';
import { FixedWindowRateLimiter } from '../../../backend/src/auth/rate-limit';
import { InMemoryUserStore } from '../../../backend/src/auth/user-store';
import { loadConfig, type AppConfig } from '../../../backend/src/config/index';
import type { ImageRecord, Job } from '../../../backend/src/contracts/index';
import type { ImagePatch, JobPatch, JobStore } from '../../../backend/src/db/types';
import { rawImageKey } from '../../../backend/src/storage/keys';
import type {
  DownloadPresignRequest,
  PresignResult,
  PresignService,
  UploadPresignRequest,
} from '../../../backend/src/storage/index';

export function apiTestEnv(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    NODE_ENV: 'test',
    JWT_ACCESS_SECRET: 'REPLACE_WITH_LOCAL_TEST_ACCESS_SECRET',
    JWT_REFRESH_SECRET: 'REPLACE_WITH_LOCAL_TEST_REFRESH_SECRET',
    JWT_ACCESS_TTL: '900',
    JWT_REFRESH_TTL: '604800',
    RATE_LIMIT_AUTH_MAX: '100',
    RATE_LIMIT_AUTH_WINDOW_MS: '60000',
    AWS_ENDPOINT_URL: 'https://127.0.0.1:9297',
    S3_BUCKET_RAW: 'mediashrink-raw-local',
    S3_BUCKET_OPTIMIZED: 'mediashrink-optimized-local',
    SQS_QUEUE_URL: 'https://sqs.us-east-1.amazonaws.com/000000000000/mediashrink-jobs',
    SQS_DLQ_URL: 'https://sqs.us-east-1.amazonaws.com/000000000000/mediashrink-jobs-dlq',
    DYNAMODB_TABLE_JOBS: 'mediashrink-jobs-test',
    ...overrides,
  };
}

function keyOf(userId: string, jobId: string): string {
  return `${userId}|${jobId}`;
}

/** Doble de `JobStore` con la misma semántica de aislamiento por userId. */
export class FakeJobStore implements JobStore {
  readonly jobs = new Map<string, Job>();
  readonly images = new Map<string, ImageRecord>();
  /** Permite simular un fallo de DynamoDB al revertir el estado del lote. */
  failNextUpdate = false;
  /** Fuerza entrelazamiento entre dos escrituras para exponer carreras. */
  delayNextUpdate = false;

  private requireJob(userId: string, jobId: string): Job {
    const job = this.jobs.get(keyOf(userId, jobId));
    if (job === undefined) throw new Error(`JobNotFoundError(${userId}, ${jobId})`);
    return job;
  }

  listByUser(userId: string): Job[] {
    return [...this.jobs.values()].filter((job) => job.userId === userId);
  }

  async createJob(job: Job): Promise<Job> {
    const key = keyOf(job.userId, job.jobId);
    if (this.jobs.has(key)) throw new Error('JobAlreadyExistsError');
    const stored = { ...job };
    this.jobs.set(key, stored);
    return { ...stored };
  }

  async getJob(userId: string, jobId: string): Promise<Job | null> {
    const job = this.jobs.get(keyOf(userId, jobId));
    return job === undefined ? null : { ...job };
  }

  async updateJob(userId: string, jobId: string, patch: JobPatch): Promise<Job> {
    if (this.failNextUpdate) {
      this.failNextUpdate = false;
      throw new Error('DynamoDB no disponible al actualizar');
    }
    if (this.delayNextUpdate) {
      this.delayNextUpdate = false;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    const current = this.requireJob(userId, jobId);
    const next: Job = {
      ...current,
      ...Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)),
      updatedAt: patch.updatedAt ?? new Date().toISOString(),
    } as Job;
    this.jobs.set(keyOf(userId, jobId), next);
    return { ...next };
  }

  async deleteJob(userId: string, jobId: string): Promise<void> {
    this.requireJob(userId, jobId);
    this.jobs.delete(keyOf(userId, jobId));
  }

  async putImage(userId: string, jobId: string, image: ImageRecord): Promise<ImageRecord> {
    this.requireJob(userId, jobId);
    const key = `${keyOf(userId, jobId)}|${image.imageId}`;
    this.images.set(key, { ...image });
    return { ...image };
  }

  async getImage(userId: string, jobId: string, imageId: string): Promise<ImageRecord | null> {
    this.requireJob(userId, jobId);
    const image = this.images.get(`${keyOf(userId, jobId)}|${imageId}`);
    return image === undefined ? null : { ...image };
  }

  async listImages(userId: string, jobId: string): Promise<ImageRecord[]> {
    this.requireJob(userId, jobId);
    const prefix = `${keyOf(userId, jobId)}|`;
    return [...this.images.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([, image]) => ({ ...image }));
  }

  async updateImage(
    userId: string,
    jobId: string,
    imageId: string,
    patch: ImagePatch,
  ): Promise<ImageRecord> {
    this.requireJob(userId, jobId);
    const key = `${keyOf(userId, jobId)}|${imageId}`;
    const current = this.images.get(key);
    if (current === undefined) throw new Error('ImageNotFoundError');
    const next = { ...current, ...patch } as ImageRecord;
    this.images.set(key, next);
    return { ...next };
  }

  async deleteImages(userId: string, jobId: string): Promise<void> {
    this.requireJob(userId, jobId);
    const prefix = `${keyOf(userId, jobId)}|`;
    for (const key of [...this.images.keys()]) {
      if (key.startsWith(prefix)) this.images.delete(key);
    }
  }

  async deleteJobWithImages(userId: string, jobId: string): Promise<void> {
    await this.deleteImages(userId, jobId);
    await this.deleteJob(userId, jobId);
  }
}

/**
 * Doble del puerto de transiciones: comprobación y escritura sin `await`
 * intermedio, igual que una escritura condicional real de DynamoDB. Ignora
 * `delayNextUpdate` (eso solo sirve para exponer la carrera en el código viejo).
 */
export class FakeJobTransitionStore implements JobTransitionStore {
  constructor(private readonly jobs: FakeJobStore) {}

  async confirmPending(userId: string, jobId: string, updatedAt: string): Promise<Job> {
    const key = keyOf(userId, jobId);
    const current = this.jobs.jobs.get(key);
    if (current === undefined || current.status !== 'PENDING') {
      throw new JobAlreadyConfirmedError();
    }
    const next: Job = { ...current, status: 'PROCESSING', updatedAt };
    this.jobs.jobs.set(key, next);
    return { ...next };
  }

  async revertToPending(userId: string, jobId: string, updatedAt: string): Promise<Job> {
    if (this.jobs.failNextUpdate) {
      this.jobs.failNextUpdate = false;
      throw new Error('DynamoDB no disponible al revertir');
    }
    const key = keyOf(userId, jobId);
    const current = this.jobs.jobs.get(key);
    if (current === undefined || current.status !== 'PROCESSING') {
      throw new JobStateConflictError();
    }
    const next: Job = { ...current, status: 'PENDING', updatedAt };
    this.jobs.jobs.set(key, next);
    return { ...next };
  }
}

/** Doble del publicador SQS: registra mensajes y puede fallar a petición. */
export class RecordingPublisher implements JobQueuePublisher {
  readonly messages: JobConfirmationMessage[] = [];
  failNext = false;

  async publish(message: JobConfirmationMessage): Promise<void> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('SQS local no disponible');
    }
    this.messages.push(message);
  }
}

/**
 * Doble del `PresignService` (F02-AUD-01): graba cada petición de subida y
 * devuelve una URL HTTPS cuya ruta contiene la clave `raw` calculada con la
 * misma función de producción. No consulta el emulador (tests unitarios).
 */
export class RecordingUploadPresign implements PresignService {
  readonly uploads: UploadPresignRequest[] = [];
  readonly downloads: DownloadPresignRequest[] = [];

  private result(method: 'PUT' | 'GET', key: string, bucket: string): PresignResult {
    return {
      url: `https://127.0.0.1:9297/${bucket}/${key}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=900&X-Amz-Signature=firma_local_de_prueba`,
      key,
      method,
      bucket,
      expiresIn: 900,
      expiresAt: new Date().toISOString(),
    };
  }

  async presignUpload(request: UploadPresignRequest): Promise<PresignResult> {
    this.uploads.push({ ...request });
    return this.result('PUT', rawImageKey(request), 'mediashrink-raw-local');
  }

  async presignDownload(request: DownloadPresignRequest): Promise<PresignResult> {
    this.downloads.push({ ...request });
    const suffix = request.variant === 'thumbnail' ? '_thumb.webp' : `.${request.variant}`;
    return this.result(
      'GET',
      `${request.userId}/${request.jobId}/optimized/${request.imageId}${suffix}`,
      'mediashrink-optimized-local',
    );
  }
}

export interface ApiTestApp {
  app: Hono;
  config: AppConfig;
  users: InMemoryUserStore;
  jobs: FakeJobStore;
  publisher: RecordingPublisher;
  jobTransition: FakeJobTransitionStore;
  jobsLimiter: FixedWindowRateLimiter;
  presign: RecordingUploadPresign;
  setNow(value: number): void;
  register(email: string): Promise<{ token: string; userId: string }>;
}

export function createApiTestApp(
  overrides: Record<string, string> = {},
  jobsMax?: number,
  useDefaultJobsLimiter = false,
): ApiTestApp {
  const config = loadConfig(apiTestEnv(overrides));
  const users = new InMemoryUserStore();
  const jobs = new FakeJobStore();
  const publisher = new RecordingPublisher();
  const jobTransition = new FakeJobTransitionStore(jobs);
  const presign = new RecordingUploadPresign();
  let clock = Date.now();
  const now = () => clock;

  // El umbral de /jobs es independiente del de /auth para que los tests puedan
  // registrar varios usuarios sin agotar el cubo de autenticación.
  const jobsLimiter = new FixedWindowRateLimiter(
    jobsMax ?? config.rateLimit.authMax,
    config.rateLimit.apiWindowMs,
    now,
  );

  const app = createApiApp({
    config,
    users,
    jobs,
    publisher,
    jobLister: {
      async listByUser(userId: string) {
        return jobs.listByUser(userId);
      },
    },
    jobTransition,
    ...(useDefaultJobsLimiter ? {} : { jobsLimiter }),
    now,
    presignService: presign,
  });

  return {
    app,
    config,
    users,
    jobs,
    publisher,
    jobTransition,
    jobsLimiter,
    presign,
    setNow: (value: number) => {
      clock = value;
    },
    register: async (email: string) => {
      const response = await app.request('/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password: 'Segura1234' }),
      });
      const body = (await response.json()) as {
        accessToken: string;
        user: { userId: string };
      };
      return { token: body.accessToken, userId: body.user.userId };
    },
  };
}

export async function postJson(
  app: Hono,
  path: string,
  body: unknown,
  token?: string,
  headers: Record<string, string> = {},
): Promise<Response> {
  return app.request(path, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

export async function getJson(
  app: Hono,
  path: string,
  token?: string,
  headers: Record<string, string> = {},
): Promise<Response> {
  return app.request(path, {
    headers: {
      ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
      ...headers,
    },
  });
}

export const validBatch = {
  preset: 'BALANCED',
  files: [{ fileName: 'foto.jpg', contentType: 'image/jpeg', sizeBytes: 2048 }],
};
