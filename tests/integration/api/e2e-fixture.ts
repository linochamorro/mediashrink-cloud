/**
 * Fixture de integración E2E del backend (F02-T06 / CA-06).
 *
 * Levanta, contra `aws/aws-emulator`, una tabla DynamoDB, dos buckets S3 y una
 * cola SQS + DLQ aislados. La app HTTP se construye con `createApiApp()` y se
 * inyecta el publicador REAL de `worker/**` (`SqsJobQueuePublisher`): la
 * adaptación para publicar el sobre enriquecido (`publishJob`) reside en
 * `api/**` y es precisamente lo que esta fixture ejerce.
 *
 * Los binarios suben a `raw` mediante la URL presignada (el binario nunca pasa
 * por la API), de modo que las métricas se calculan con los bytes reales del
 * objeto S3 y no con el tamaño declarado por el cliente.
 */

import { createApiApp } from '../../../backend/src/api/app';
import { createDynamoJobListStore } from '../../../backend/src/api/job-list-store';
import { createDynamoJobTransitionStore } from '../../../backend/src/api/job-transition';
import { loadConfig, type AppConfig } from '../../../backend/src/config/index';
import type { Job, JobStatus, Preset } from '../../../backend/src/contracts/index';
import { createDynamoUserStore } from '../../../backend/src/db/user-store-adapter';
import { createJobStore, type JobStore } from '../../../backend/src/db/index';
import { SqsJobQueuePublisher } from '../../../backend/src/worker/index';
import { apiTestEnv, getJson, postJson } from '../../unit/api/fixtures';
import { createTestTable, type TestTable } from '../db/table-fixture';
import { createTestQueues, type TestQueues } from '../worker/sqs-fixture';
import {
  createTestBuckets,
  putViaPresignedUrl,
  type TestBuckets,
} from './presign-fixture';

export interface E2eEnv {
  readonly config: AppConfig;
  readonly table: TestTable;
  readonly buckets: TestBuckets;
  readonly queues: TestQueues;
  readonly jobs: JobStore;
  readonly publisher: SqsJobQueuePublisher;
  readonly app: ReturnType<typeof createApiApp>;
  register(email: string): Promise<{ token: string; userId: string }>;
  /** Crea el lote, sube los bytes reales a `raw` y devuelve el jobId y el tamaño S3. */
  createUploadedJob(input: {
    token: string;
    preset: Preset;
    images: readonly { imageId: string; declaredBytes: number; bytes: Uint8Array }[];
  }): Promise<{ jobId: string; realBytes: Readonly<Record<string, number>> }>;
  confirm(token: string, jobId: string): Promise<Response>;
  detail(token: string, jobId: string): Promise<{ status: number; job: Job | null; images: unknown[] }>;
  dispose(): Promise<void>;
}

export async function createE2eEnv(tag: string): Promise<E2eEnv> {
  const table = await createTestTable(tag);
  let buckets: TestBuckets | undefined;
  let queues: TestQueues | undefined;
  try {
    buckets = await createTestBuckets(tag);
    queues = await createTestQueues(tag);
    const config = loadConfig(
      apiTestEnv({
        DYNAMODB_TABLE_JOBS: table.tableName,
        S3_BUCKET_RAW: buckets.rawBucket,
        S3_BUCKET_OPTIMIZED: buckets.optimizedBucket,
        SQS_QUEUE_URL: queues.queueUrl,
        SQS_DLQ_URL: queues.dlqUrl,
      }),
    );
    const users = createDynamoUserStore({ tableName: table.tableName, client: table.documentClient });
    const jobs = createJobStore({ tableName: table.tableName, client: table.documentClient });
    const publisher = new SqsJobQueuePublisher({
      sqs: queues.sqs,
      queueUrl: queues.queueUrl,
      dlqUrl: queues.dlqUrl,
    });
    const app = createApiApp({
      config,
      users,
      jobs,
      // Inyección del publicador de worker/**; api/** lo adapta a publishJob.
      publisher,
      jobLister: createDynamoJobListStore({ tableName: table.tableName, client: table.documentClient }),
      jobTransition: createDynamoJobTransitionStore({
        tableName: table.tableName,
        client: table.documentClient,
      }),
    });
    const ownedBuckets = buckets;
    const ownedQueues = queues;

    return {
      config,
      table,
      buckets: ownedBuckets,
      queues: ownedQueues,
      jobs,
      publisher,
      app,
      register: async (email: string) => {
        const response = await postJson(app, '/auth/register', { email, password: 'Segura1234' });
        if (response.status !== 201) {
          throw new Error(`No se pudo registrar el usuario de prueba (${response.status})`);
        }
        const body = (await response.json()) as { accessToken: string; user: { userId: string } };
        return { token: body.accessToken, userId: body.user.userId };
      },
      createUploadedJob: async ({ token, preset, images }) => {
        const created = await postJson(
          app,
          '/jobs',
          {
            preset,
            files: images.map((image) => ({
              // fileName es solo un dato validado: la clave S3 la construye el
              // servidor con un imageId aleatorio. El id lógico se conserva como
              // etiqueta local para las aserciones del flujo E2E del worker.
              fileName: `${image.imageId}.jpg`,
              contentType: 'image/jpeg',
              sizeBytes: image.declaredBytes,
            })),
          },
          token,
        );
        if (created.status !== 201) {
          throw new Error(`No se pudo crear el lote de prueba (${created.status})`);
        }
        const createdBody = (await created.json()) as { job: Job };
        const jobId = createdBody.job.jobId;
        const realBytes: Record<string, number> = {};

        for (const image of images) {
          const signed = await postJson(
            app,
            '/presign/upload',
            { jobId, imageId: image.imageId },
            token,
          );
          if (signed.status !== 200) {
            throw new Error(`No se pudo presignar la subida (${signed.status})`);
          }
          const result = (await signed.json()) as { url: string; key: string };
          const upload = await putViaPresignedUrl(result.url, Buffer.from(image.bytes));
          if (upload.status !== 200) {
            throw new Error(`No se pudo subir el objeto a raw (${upload.status})`);
          }
          const { HeadObjectCommand } = await import('@aws-sdk/client-s3');
          const head = await ownedBuckets.client.send(
            new HeadObjectCommand({ Bucket: ownedBuckets.rawBucket, Key: result.key }),
          );
          realBytes[image.imageId] = head.ContentLength ?? image.bytes.byteLength;
        }
        return { jobId, realBytes };
      },
      confirm: (token: string, jobId: string) =>
        postJson(app, `/jobs/${jobId}/confirm`, {}, token),
      detail: async (token: string, jobId: string) => {
        const response = await getJson(app, `/jobs/${jobId}`, token);
        if (response.status !== 200) return { status: response.status, job: null, images: [] };
        const body = (await response.json()) as { job: Job; images: unknown[] };
        return { status: response.status, job: body.job, images: body.images };
      },
      dispose: async () => {
        await ownedQueues.dispose();
        await ownedBuckets.dispose();
        await table.dispose();
      },
    };
  } catch (error) {
    if (queues !== undefined) await queues.dispose();
    if (buckets !== undefined) await buckets.dispose();
    await table.dispose();
    throw error;
  }
}

/** Reexportación tipada para los consumidores del flujo. */
export { getJson, postJson };
export type { JobStatus };
