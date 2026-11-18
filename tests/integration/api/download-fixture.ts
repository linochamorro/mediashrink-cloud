/**
 * Fixture de integración real de descarga/ZIP/borrado (F02-T05) contra
 * `aws/aws-emulator`: tabla DynamoDB y buckets S3 aislados por archivo.
 */

import { PutObjectCommand } from '@aws-sdk/client-s3';

import { createApiApp } from '../../../backend/src/api/app';
import { createDynamoJobListStore } from '../../../backend/src/api/job-list-store';
import { createDynamoJobTransitionStore } from '../../../backend/src/api/job-transition';
import { loadConfig } from '../../../backend/src/config/index';
import { computeTtl, type ImageRecord, type Job } from '../../../backend/src/contracts/index';
import { createDynamoUserStore } from '../../../backend/src/db/user-store-adapter';
import { createJobStore } from '../../../backend/src/db/job-store';
import type { JobStore } from '../../../backend/src/db/types';
import {
  createObjectAccessServiceFromConfig,
  optimizedImageKey,
  rawImageKey,
  type DownloadVariant,
  type OptimizedVariant,
} from '../../../backend/src/storage/index';
import { apiTestEnv, postJson, RecordingPublisher } from '../../unit/api/fixtures';
import { createTestTable, type TestTable } from '../db/table-fixture';
import { createTestBuckets, type TestBuckets, getViaPresignedUrl } from './presign-fixture';

const CREATED_AT = '2026-11-17T20:00:00.000Z';

export interface DownloadIntegrationEnv {
  table: TestTable;
  buckets: TestBuckets;
  jobs: JobStore;
  app: ReturnType<typeof createApiApp>;
  register(email: string): Promise<{ token: string; userId: string }>;
  seedJob(userId: string, jobId: string, imageIds: string[]): Promise<void>;
  putRaw(userId: string, jobId: string, imageId: string, bytes: Buffer): Promise<void>;
  putOptimized(
    userId: string,
    jobId: string,
    imageId: string,
    variant: Exclude<DownloadVariant, 'original'>,
    bytes: Buffer,
  ): Promise<void>;
  objectKey(userId: string, jobId: string, imageId: string, variant: DownloadVariant): string;
  download(url: string): Promise<{ status: number; body: Buffer }>;
  dispose(): Promise<void>;
}

export async function createDownloadIntegrationEnv(tag: string): Promise<DownloadIntegrationEnv> {
  const table = await createTestTable(tag);
  let buckets: TestBuckets | undefined;
  try {
    buckets = await createTestBuckets(tag);
    const createdBuckets = buckets;
    const config = loadConfig(
      apiTestEnv({
        DYNAMODB_TABLE_JOBS: table.tableName,
        S3_BUCKET_RAW: buckets.rawBucket,
        S3_BUCKET_OPTIMIZED: buckets.optimizedBucket,
      }),
    );
    const users = createDynamoUserStore({ tableName: table.tableName, client: table.documentClient });
    const jobs = createJobStore({ tableName: table.tableName, client: table.documentClient });
    const objectAccess = createObjectAccessServiceFromConfig(config);

    const app = createApiApp({
      config,
      users,
      jobs,
      publisher: new RecordingPublisher(),
      jobLister: createDynamoJobListStore({ tableName: table.tableName, client: table.documentClient }),
      jobTransition: createDynamoJobTransitionStore({
        tableName: table.tableName,
        client: table.documentClient,
      }),
      objectAccess,
    });

    return {
      table,
      buckets: createdBuckets,
      jobs,
      app,
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
      putRaw: async (userId: string, jobId: string, imageId: string, bytes: Buffer) => {
        await createdBuckets.client.send(
          new PutObjectCommand({
            Bucket: createdBuckets.rawBucket,
            Key: rawImageKey({ userId, jobId, imageId }),
            Body: bytes,
          }),
        );
      },
      putOptimized: async (
        userId: string,
        jobId: string,
        imageId: string,
        variant: Exclude<DownloadVariant, 'original'>,
        bytes: Buffer,
      ) => {
        await createdBuckets.client.send(
          new PutObjectCommand({
            Bucket: createdBuckets.optimizedBucket,
            Key: optimizedImageKey({ userId, jobId, imageId }, variant as OptimizedVariant),
            Body: bytes,
          }),
        );
      },
      objectKey: (userId: string, jobId: string, imageId: string, variant: DownloadVariant) =>
        variant === 'original'
          ? rawImageKey({ userId, jobId, imageId })
          : optimizedImageKey({ userId, jobId, imageId }, variant as OptimizedVariant),
      download: getViaPresignedUrl,
      dispose: async () => {
        await createdBuckets.dispose();
        await table.dispose();
      },
    };
  } catch (error) {
    if (buckets !== undefined) await buckets.dispose();
    await table.dispose();
    throw error;
  }
}
