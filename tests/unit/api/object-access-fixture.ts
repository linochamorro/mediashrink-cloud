/**
 * Fixture HTTP aislada de descarga/ZIP/borrado (F02-T05): app Hono real con
 * dobles en memoria de `JobStore` y del servicio de objetos. Sin Docker, sin
 * emulador, sin secretos y sin archivos temporales (G-3, G-7, CA-05).
 */

import { Hono } from 'hono';

import { createApiApp } from '../../../backend/src/api/app';
import { FixedWindowRateLimiter } from '../../../backend/src/auth/rate-limit';
import { InMemoryUserStore } from '../../../backend/src/auth/user-store';
import { loadConfig } from '../../../backend/src/config/index';
import { computeTtl, type ImageRecord, type Job } from '../../../backend/src/contracts/index';
import {
  assertKeyWithinPrefix,
  optimizedImageKey,
  rawImageKey,
  type ArchiveEntry,
  type DownloadVariant,
  type JobObjectRequest,
  type ObjectAccessService,
  type PresignResult,
  type PresignVariantRequest,
} from '../../../backend/src/storage/index';
import {
  apiTestEnv,
  FakeJobStore,
  FakeJobTransitionStore,
  RecordingPublisher,
  postJson,
} from './fixtures';

const BUCKET_RAW = 'mediashrink-raw-local';
const BUCKET_OPTIMIZED = 'mediashrink-optimized-local';

interface ObjectRecord {
  bucket: string;
  bytes: Buffer;
}

/** Doble del servicio de objetos: guarda todo en memoria por clave S3 real. */
export class FakeObjectAccess implements ObjectAccessService {
  readonly objects = new Map<string, ObjectRecord>();
  readonly presignCalls: PresignVariantRequest[] = [];
  readonly readCalls: Array<{ request: JobObjectRequest; imageIds: readonly string[] }> = [];
  readonly deleteCalls: JobObjectRequest[] = [];
  failNextDelete = false;

  async presignVariant(request: PresignVariantRequest): Promise<PresignResult> {
    this.presignCalls.push({ ...request });
    const key =
      request.variant === 'original'
        ? rawImageKey(request)
        : optimizedImageKey(request, request.variant);
    assertKeyWithinPrefix(key, request.userId);
    const bucket = request.variant === 'original' ? BUCKET_RAW : BUCKET_OPTIMIZED;
    return {
      url: `https://127.0.0.1:9297/${bucket}/${key}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=900&X-Amz-Signature=firma_local_de_prueba`,
      key,
      method: 'GET',
      bucket,
      expiresIn: 900,
      expiresAt: '2026-11-17T21:00:00.000Z',
    };
  }

  async readOptimizedObjects(
    request: JobObjectRequest,
    imageIds: readonly string[],
  ): Promise<ArchiveEntry[]> {
    this.readCalls.push({ request: { ...request }, imageIds: [...imageIds] });
    const entries: ArchiveEntry[] = [];
    for (const imageId of imageIds) {
      for (const variant of ['webp', 'avif', 'thumbnail'] as const) {
        const key = optimizedImageKey({ ...request, imageId }, variant);
        assertKeyWithinPrefix(key, request.userId);
        const object = this.objects.get(key);
        if (object === undefined || object.bucket !== BUCKET_OPTIMIZED) continue;
        const name =
          variant === 'thumbnail' ? `${imageId}_thumb.webp` : `${imageId}.${variant}`;
        entries.push({ name, bytes: object.bytes });
      }
    }
    return entries;
  }

  async deleteJobObjects(request: JobObjectRequest): Promise<number> {
    this.deleteCalls.push({ ...request });
    if (this.failNextDelete) {
      this.failNextDelete = false;
      throw new Error('S3 local no disponible');
    }
    const prefix = `${request.userId}/${request.jobId}/`;
    let deleted = 0;
    for (const key of [...this.objects.keys()]) {
      if (!key.startsWith(prefix)) continue;
      assertKeyWithinPrefix(key, request.userId);
      this.objects.delete(key);
      deleted += 1;
    }
    return deleted;
  }

  seedRaw(request: JobObjectRequest, imageId: string, bytes: Buffer): void {
    const key = rawImageKey({ ...request, imageId });
    this.objects.set(key, { bucket: BUCKET_RAW, bytes });
  }

  seedOptimized(
    request: JobObjectRequest,
    imageId: string,
    variant: Exclude<DownloadVariant, 'original'>,
    bytes: Buffer,
  ): void {
    const key = optimizedImageKey({ ...request, imageId }, variant);
    this.objects.set(key, { bucket: BUCKET_OPTIMIZED, bytes });
  }
}

export interface DownloadTestApp {
  app: Hono;
  jobs: FakeJobStore;
  objects: FakeObjectAccess;
  register(email: string): Promise<{ token: string; userId: string }>;
  seedJob(userId: string, jobId: string, imageIds: string[]): void;
}

export async function getBinary(
  app: Hono,
  path: string,
  token?: string,
): Promise<Response> {
  return app.request(path, {
    headers: {
      ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
    },
  });
}

export function createDownloadTestApp(): DownloadTestApp {
  const config = loadConfig(apiTestEnv());
  const users = new InMemoryUserStore();
  const jobs = new FakeJobStore();
  const objects = new FakeObjectAccess();
  const limiter = new FixedWindowRateLimiter(100, 60_000);

  const app = createApiApp({
    config,
    users,
    jobs,
    publisher: new RecordingPublisher(),
    jobLister: { listByUser: async (userId) => jobs.listByUser(userId) },
    jobTransition: new FakeJobTransitionStore(jobs),
    jobsLimiter: new FixedWindowRateLimiter(100, 60_000),
    downloadLimiter: limiter,
    objectAccess: objects,
  });

  const createdAt = '2026-11-17T20:00:00.000Z';
  return {
    app,
    jobs,
    objects,
    register: async (email: string) => {
      const response = await postJson(app, '/auth/register', {
        email,
        password: 'Segura1234',
      });
      const body = (await response.json()) as {
        accessToken: string;
        user: { userId: string };
      };
      return { token: body.accessToken, userId: body.user.userId };
    },
    seedJob: (userId: string, jobId: string, imageIds: string[]) => {
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
        createdAt,
        updatedAt: createdAt,
        ttl: computeTtl(createdAt),
      };
      jobs.createJob(job);
      for (const imageId of imageIds) {
        const image: ImageRecord = {
          imageId,
          status: 'COMPLETED',
          bytesBefore: 512,
          bytesAfter: 256,
          exifStripped: true,
        };
        jobs.putImage(userId, jobId, image);
      }
    },
  };
}

export const jsonOf = async (response: Response): Promise<Record<string, unknown>> =>
  (await response.json()) as Record<string, unknown>;
