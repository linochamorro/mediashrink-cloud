/**
 * Fixture de integración S3 real en `aws/aws-emulator` (F02-T02).
 * Buckets aislados por archivo de prueba; credenciales efímeras por `fromIni`
 * y CA explícito. Sin rutas Windows absolutas ni secretos fijos (G-3).
 */

import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Agent, get as httpsGet, request as httpsRequest } from 'node:https';

import {
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3';
import { fromIni } from '@aws-sdk/credential-providers';
import { NodeHttpHandler } from '@smithy/node-http-handler';

import { createApiApp } from '../../../backend/src/api/app';
import { createDynamoJobListStore } from '../../../backend/src/api/job-list-store';
import { createDynamoJobTransitionStore } from '../../../backend/src/api/job-transition';
import { loadConfig, type AppConfig } from '../../../backend/src/config/index';
import { createDynamoUserStore } from '../../../backend/src/db/user-store-adapter';
import { createJobStore } from '../../../backend/src/db/job-store';
import { createPresignServiceFromConfig, type PresignService } from '../../../backend/src/storage/index';
import { apiTestEnv, postJson, RecordingPublisher } from '../../unit/api/fixtures';
import { createTestTable } from '../db/table-fixture';

const CA_BUNDLE_PATH = './.local/aws-emulator/ca.pem';
const CREDENTIALS_PATH = './.local/aws-emulator/emulator_credentials';
const CONFIG_PATH = './.local/aws-emulator/config';
const ENDPOINT_URL = 'https://127.0.0.1:9297';
const REGION = 'us-east-1';

const caAgent = (): Agent => new Agent({ ca: readFileSync(CA_BUNDLE_PATH), keepAlive: true });

export function createTestS3Client(): S3Client {
  return new S3Client({
    region: REGION,
    endpoint: ENDPOINT_URL,
    forcePathStyle: true,
    credentials: fromIni({ filepath: CREDENTIALS_PATH, configFilepath: CONFIG_PATH }),
    requestHandler: new NodeHttpHandler({ httpsAgent: caAgent() }),
  });
}

export interface TestBuckets {
  rawBucket: string;
  optimizedBucket: string;
  client: S3Client;
  dispose(): Promise<void>;
}

async function emptyBucket(client: S3Client, bucket: string): Promise<void> {
  let continuationToken: string | undefined;
  do {
    const listed = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: continuationToken }),
    );
    const objects = (listed.Contents ?? [])
      .filter((item) => item.Key !== undefined)
      .map((item) => ({ Key: item.Key as string }));
    if (objects.length > 0) {
      await client.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: objects } }));
    }
    continuationToken = listed.IsTruncated === true ? listed.NextContinuationToken : undefined;
  } while (continuationToken !== undefined);
}

export async function createTestBuckets(tag: string): Promise<TestBuckets> {
  const client = createTestS3Client();
  const suffix = randomUUID().slice(0, 8);
  const rawBucket = `mediashrink-raw-test-${tag}-${suffix}`;
  const optimizedBucket = `mediashrink-optimized-test-${tag}-${suffix}`;

  await client.send(new CreateBucketCommand({ Bucket: rawBucket }));
  await client.send(new CreateBucketCommand({ Bucket: optimizedBucket }));

  return {
    rawBucket,
    optimizedBucket,
    client,
    dispose: async () => {
      await emptyBucket(client, rawBucket);
      await emptyBucket(client, optimizedBucket);
      await client.send(new DeleteBucketCommand({ Bucket: rawBucket }));
      await client.send(new DeleteBucketCommand({ Bucket: optimizedBucket }));
      client.destroy();
    },
  };
}

/** Sube bytes a una URL presignada con el CA del emulador; el binario NO pasa por la API. */
export function putViaPresignedUrl(url: string, body: Buffer): Promise<{ status: number }> {
  return new Promise((resolve, reject) => {
    const request = httpsRequest(
      new URL(url),
      { method: 'PUT', agent: caAgent(), headers: { 'content-type': 'application/octet-stream' } },
      (response) => {
        response.resume();
        response.on('end', () => resolve({ status: response.statusCode ?? 0 }));
      },
    );
    request.on('error', reject);
    request.write(body);
    request.end();
  });
}

/** Descarga una URL presignada con el CA del emulador. */
export function getViaPresignedUrl(url: string): Promise<{ status: number; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const request = httpsGet(new URL(url), { agent: caAgent() }, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () =>
        resolve({ status: response.statusCode ?? 0, body: Buffer.concat(chunks) }),
      );
    });
    request.on('error', reject);
  });
}

export interface PresignIntegrationEnv extends TestBuckets {
  config: AppConfig;
  presign: PresignService;
  app: ReturnType<typeof createApiApp>;
  register(email: string): Promise<{ token: string; userId: string }>;
  dispose(): Promise<void>;
}

export async function createPresignIntegrationEnv(tag: string): Promise<PresignIntegrationEnv> {
  const table = await createTestTable(tag);
  let buckets: TestBuckets | undefined;
  try {
    buckets = await createTestBuckets(tag);
    const config = loadConfig(
      apiTestEnv({
        DYNAMODB_TABLE_JOBS: table.tableName,
        S3_BUCKET_RAW: buckets.rawBucket,
        S3_BUCKET_OPTIMIZED: buckets.optimizedBucket,
      }),
    );
    const users = createDynamoUserStore({
      tableName: table.tableName,
      client: table.documentClient,
    });
    const jobs = createJobStore({ tableName: table.tableName, client: table.documentClient });
    const presign = createPresignServiceFromConfig(config);
    const createdBuckets = buckets;
    const app = createApiApp({
      config,
      users,
      jobs,
      publisher: new RecordingPublisher(),
      jobLister: createDynamoJobListStore({
        tableName: table.tableName,
        client: table.documentClient,
      }),
      jobTransition: createDynamoJobTransitionStore({
        tableName: table.tableName,
        client: table.documentClient,
      }),
      presignService: presign,
    });

    return {
      ...buckets,
      config,
      presign,
      app,
      register: async (email: string) => {
        const response = await postJson(app, '/auth/register', {
          email,
          password: 'Segura1234',
        });
        if (response.status !== 201) {
          throw new Error(`No se pudo registrar el usuario de prueba (${response.status})`);
        }
        const body = (await response.json()) as { accessToken: string; user: { userId: string } };
        return { token: body.accessToken, userId: body.user.userId };
      },
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
