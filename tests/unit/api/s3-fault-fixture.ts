/**
 * Doble de `S3Client` para inyectar fallos parciales (F02-T05, loop 2).
 * Simula `ListObjectsV2`, `GetObject` (con `ContentLength`) y `DeleteObjects`
 * con `Errors[]`, sin emulador ni secretos.
 */

import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';

import type { Hono } from 'hono';

import { createApiApp } from '../../../backend/src/api/app';
import { FixedWindowRateLimiter } from '../../../backend/src/auth/rate-limit';
import { InMemoryUserStore } from '../../../backend/src/auth/user-store';
import { loadConfig } from '../../../backend/src/config/index';
import { computeTtl, type ImageRecord, type Job } from '../../../backend/src/contracts/index';
import {
  createObjectAccessService,
  type ObjectAccessService,
  type PresignResult,
  type PresignService,
} from '../../../backend/src/storage/index';
import {
  apiTestEnv,
  FakeJobStore,
  FakeJobTransitionStore,
  postJson,
  RecordingPublisher,
} from './fixtures';

const CREATED_AT = '2026-11-17T20:00:00.000Z';

export interface S3FaultApp {
  app: Hono;
  jobs: FakeJobStore;
  s3: FaultyS3Client;
  objectAccess: ObjectAccessService;
  register(email: string): Promise<{ token: string; userId: string }>;
  seedJob(userId: string, jobId: string, imageIds: string[]): Promise<void>;
}

export function createS3FaultApp(options: {
  maxZipBytes?: number;
  maxZipEntries?: number;
  deletePlan?: DeletePlan;
} = {}): S3FaultApp {
  const config = loadConfig(apiTestEnv());
  const users = new InMemoryUserStore();
  const jobs = new FakeJobStore();
  const s3 = new FaultyS3Client();
  if (options.deletePlan !== undefined) s3.deletePlan = options.deletePlan;

  const deps: Parameters<typeof createObjectAccessService>[0] = {
    client: s3.client,
    presign: new StaticPresignService(),
    rawBucket: 'mediashrink-raw-local',
    optimizedBucket: 'mediashrink-optimized-local',
    ...(options.maxZipBytes === undefined && options.maxZipEntries === undefined
      ? {}
      : {
          zipLimits: {
            maxBytes: options.maxZipBytes ?? Number.MAX_SAFE_INTEGER,
            maxEntries: options.maxZipEntries ?? Number.MAX_SAFE_INTEGER,
          },
        }),
  };
  const objectAccess = createObjectAccessService(deps);

  const app = createApiApp({
    config,
    users,
    jobs,
    publisher: new RecordingPublisher(),
    jobLister: { listByUser: async (userId) => jobs.listByUser(userId) },
    jobTransition: new FakeJobTransitionStore(jobs),
    jobsLimiter: new FixedWindowRateLimiter(100, 60_000),
    downloadLimiter: new FixedWindowRateLimiter(100, 60_000),
    objectAccess,
  });

  return {
    app,
    jobs,
    s3,
    objectAccess,
    register: async (email: string) => {
      const response = await postJson(app, '/auth/register', { email, password: 'Segura1234' });
      const body = (await response.json()) as {
        accessToken: string;
        user: { userId: string };
      };
      return { token: body.accessToken, userId: body.user.userId };
    },
    seedJob: async (userId: string, jobId: string, imageIds: string[]) => {
      const job: Job = {
        jobId,
        userId,
        status: 'COMPLETED',
        preset: 'BALANCED',
        formats: ['webp', 'avif'],
        bytesBefore: 1024,
        bytesAfter: 512,
        savingsPct: 50,
        exifStripped: true,
        createdAt: CREATED_AT,
        updatedAt: CREATED_AT,
        ttl: computeTtl(CREATED_AT),
      };
      await jobs.createJob(job);
      for (const imageId of imageIds) {
        const image: ImageRecord = {
          imageId,
          status: 'COMPLETED',
          bytesBefore: 512,
          bytesAfter: 256,
          exifStripped: true,
        };
        await jobs.putImage(userId, jobId, image);
      }
    },
  };
}

export interface FaultObject {
  bytes: Buffer;
  /** Permite declarar un `ContentLength` distinto al real para probar el tope. */
  declaredLength?: number;
}

export interface DeletePlan {
  /** Claves que `DeleteObjects` debe reportar como fallidas en cada llamada. */
  failKeys?: ReadonlySet<string>;
  /** Número de primeras llamadas que fallan; `Infinity` para fallo permanente. */
  failCalls?: number;
}

export class FaultyS3Client {
  readonly objects = new Map<string, FaultObject>();
  readonly materializations: string[] = [];
  readonly deleteCommands: Array<{ bucket: string; keys: string[] }> = [];
  deletePlan: DeletePlan = {};
  private deleteCalls = 0;

  seed(key: string, bytes: Buffer, declaredLength?: number): void {
    this.objects.set(key, { bytes, ...(declaredLength === undefined ? {} : { declaredLength }) });
  }

  get client(): S3Client {
    return this as unknown as S3Client;
  }

  async send(command: unknown): Promise<Record<string, unknown>> {
    if (command instanceof ListObjectsV2Command) {
      const prefix = command.input.Prefix ?? '';
      const contents = [...this.objects.keys()]
        .filter((key) => key.startsWith(prefix))
        .map((Key) => ({ Key }));
      return { Contents: contents, IsTruncated: false };
    }

    if (command instanceof GetObjectCommand) {
      const key = command.input.Key ?? '';
      const object = this.objects.get(key);
      if (object === undefined) {
        const error = Object.assign(new Error('NoSuchKey'), { name: 'NoSuchKey' });
        throw error;
      }
      const bytes = object.bytes;
      const declaredLength = object.declaredLength ?? bytes.length;
      return {
        ContentLength: declaredLength,
        Body: {
          transformToByteArray: async () => {
            this.materializations.push(key);
            return new Uint8Array(bytes);
          },
        },
      };
    }

    if (command instanceof DeleteObjectsCommand) {
      const bucket = command.input.Bucket ?? '';
      const keys = (command.input.Delete?.Objects ?? [])
        .map((entry) => entry.Key)
        .filter((key): key is string => typeof key === 'string');
      this.deleteCommands.push({ bucket, keys });
      this.deleteCalls += 1;
      const shouldFail = this.deleteCalls <= (this.deletePlan.failCalls ?? 0);
      const failedKeys = shouldFail
        ? keys.filter((key) => this.deletePlan.failKeys?.has(key) ?? false)
        : [];
      const deleted = keys.filter((key) => !failedKeys.includes(key)).map((Key) => ({ Key }));
      // Solo se eliminan realmente las claves confirmadas por S3.
      for (const entry of deleted) this.objects.delete(entry.Key);
      return {
        Deleted: deleted,
        Errors: failedKeys.map((Key) => ({ Key, Code: 'InternalError', Message: 'fallo inyectado' })),
      };
    }

    if (command instanceof PutObjectCommand) return {};
    throw new Error(`Comando no soportado por el doble: ${command?.constructor?.name ?? 'desconocido'}`);
  }
}

export class StaticPresignService implements PresignService {
  async presignUpload(): Promise<PresignResult> {
    throw new Error('No usado en estas pruebas');
  }

  async presignDownload(request: {
    userId: string;
    jobId: string;
    imageId: string;
    variant: string;
  }): Promise<PresignResult> {
    const key = `${request.userId}/${request.jobId}/optimized/${request.imageId}.${request.variant}`;
    return {
      url: `https://127.0.0.1:9297/mediashrink-optimized-local/${key}`,
      key,
      method: 'GET',
      bucket: 'mediashrink-optimized-local',
      expiresIn: 900,
      expiresAt: '2026-11-17T21:00:00.000Z',
    };
  }
}
