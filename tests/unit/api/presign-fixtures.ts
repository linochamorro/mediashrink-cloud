/** Fixture HTTP aislada de presign (F02-T02): sin emulador ni secretos. */

import { createApiApp } from '../../../backend/src/api/app';
import { FixedWindowRateLimiter } from '../../../backend/src/auth/rate-limit';
import { InMemoryUserStore } from '../../../backend/src/auth/user-store';
import { loadConfig } from '../../../backend/src/config/index';
import type {
  DownloadPresignRequest,
  PresignResult,
  PresignService,
  UploadPresignRequest,
} from '../../../backend/src/storage/index';
import {
  apiTestEnv,
  FakeJobStore,
  FakeJobTransitionStore,
  RecordingPublisher,
  postJson,
} from './fixtures';

export class RecordingPresignService implements PresignService {
  readonly uploads: UploadPresignRequest[] = [];
  readonly downloads: DownloadPresignRequest[] = [];

  private result(method: 'PUT' | 'GET', key: string, bucket: string): PresignResult {
    return {
      url: `https://127.0.0.1:9297/${bucket}/${key}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=900&X-Amz-Signature=firma_local_de_prueba`,
      key,
      method,
      bucket,
      expiresIn: 900,
      expiresAt: '2026-11-17T21:00:00.000Z',
    };
  }

  async presignUpload(request: UploadPresignRequest): Promise<PresignResult> {
    this.uploads.push(request);
    return this.result(
      'PUT',
      `${request.userId}/${request.jobId}/raw/${request.imageId}`,
      'mediashrink-raw-local',
    );
  }

  async presignDownload(request: DownloadPresignRequest): Promise<PresignResult> {
    this.downloads.push(request);
    const suffix = request.variant === 'thumbnail' ? '_thumb.webp' : `.${request.variant}`;
    return this.result(
      'GET',
      `${request.userId}/${request.jobId}/optimized/${request.imageId}${suffix}`,
      'mediashrink-optimized-local',
    );
  }
}

export interface PresignTestApp {
  app: ReturnType<typeof createApiApp>;
  presign: RecordingPresignService;
  register(email: string): Promise<{ token: string; userId: string }>;
}

export function createPresignTestApp(): PresignTestApp {
  const config = loadConfig(apiTestEnv());
  const users = new InMemoryUserStore();
  const jobs = new FakeJobStore();
  const presign = new RecordingPresignService();

  const app = createApiApp({
    config,
    users,
    jobs,
    publisher: new RecordingPublisher(),
    jobLister: { listByUser: async (userId) => jobs.listByUser(userId) },
    jobTransition: new FakeJobTransitionStore(jobs),
    jobsLimiter: new FixedWindowRateLimiter(100, 60_000),
    presignService: presign,
  });

  return {
    app,
    presign,
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
  };
}
