/**
 * F05-T02 — `bytesBefore` anclado al tamaño REAL del objeto `raw` (HeadObject).
 *
 * RED: el publicador enriquecido actual lee `GetObject` y construye el base64,
 * pero NO emite `HeadObject` en la ruta de producto (solo lo hacía la fixture).
 * La primera prueba exige que el adaptador verifique el `ContentLength` real de
 * S3; hoy falla porque no se registra ninguna llamada `HeadObject`.
 *
 * La segunda prueba cierra el círculo: un `sizeBytes` declarado distinto del
 * real no debe filtrarse a la métrica persistida.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, type S3Client } from '@aws-sdk/client-s3';

import { createS3EnrichedPublisher } from '../../../backend/src/api/enriched-publisher';
import type { JobQueueMessage } from '../../../backend/src/worker/messages';
import { handleJobMessage } from '../../../backend/src/worker/index';
import { createJpegWithMetadata } from '../../unit/worker/fixtures';
import { createE2eEnv, type E2eEnv } from './e2e-fixture';

const itPersist = (name: string, fn: () => Promise<void>): void => {
  it(name, fn, 45_000);
};

let env: E2eEnv;

beforeEach(async () => {
  env = await createE2eEnv('headobject');
});

afterEach(async () => {
  if (env !== undefined) await env.dispose();
});

describe('F05-T02 — HeadObject en raw para bytesBefore', () => {
  itPersist('el publicador enriquecido consulta HeadObject y el sobre lleva los bytes reales, no el declarado', async () => {
    const { token, userId } = await env.register('f05.headobject@example.com');
    const declaredBytes = 1; //sizeBytes deliberadamente erróneo
    const bytes = await createJpegWithMetadata(96, 96);
    const { jobId, realBytes } = await env.createUploadedJob({
      token,
      preset: 'HIGH',
      images: [{ imageId: 'img-head', declaredBytes, bytes }],
    });

    const headCalls: Array<{ Bucket?: string; Key?: string }> = [];
    const realS3 = env.buckets.client;
    const spy: Pick<S3Client, 'send'> = {
      send: async (command: unknown) => {
        if (command instanceof HeadObjectCommand) {
          headCalls.push({ Bucket: command.input.Bucket, Key: command.input.Key });
        }
        return (realS3.send as unknown as (input: unknown) => Promise<unknown>)(command);
      },
    } as unknown as Pick<S3Client, 'send'>;

    const captured: JobQueueMessage[] = [];
    const publisher = createS3EnrichedPublisher({
      delegate: {
        publishJob: async (message) => {
          captured.push(message);
        },
      },
      config: env.config,
      jobs: env.jobs,
      s3: spy,
    });

    await publisher.publish({ userId, jobId });

    // RED: hoy headCalls está vacío porque la ruta de producto no llama a HeadObject.
    expect(headCalls).toHaveLength(1);
    const key = headCalls[0]?.Key ?? '';
    expect(key).toContain(`${userId}/${jobId}/raw/`);
    expect(headCalls[0]?.Bucket).toBe(env.buckets.rawBucket);

    const head = await realS3.send(new HeadObjectCommand({ Bucket: env.buckets.rawBucket, Key: key }));
    expect(head.ContentLength).toBe(realBytes['img-head']);
    expect(head.ContentLength).not.toBe(declaredBytes);

    const envelope = captured[0];
    expect(envelope).toBeDefined();
    const decoded = Buffer.from(envelope!.images[0]!.contentBase64!, 'base64');
    expect(decoded.byteLength).toBe(head.ContentLength);
    expect(decoded.byteLength).not.toBe(declaredBytes);
  });

  itPersist('un sobre declarado distinto al objeto persistido conserva bytesBefore real en DynamoDB', async () => {
    const { token, userId } = await env.register('f05.headobject.metrics@example.com');
    const declaredBytes = 7; // distinto del real a propósito
    const bytes = await createJpegWithMetadata(88, 88);
    const { jobId, realBytes } = await env.createUploadedJob({
      token,
      preset: 'BALANCED',
      images: [{ imageId: 'img-metric', declaredBytes, bytes }],
    });
    expect((await env.confirm(token, jobId)).status).toBe(200);

    const captured: JobQueueMessage[] = [];
    const publisher = createS3EnrichedPublisher({
      delegate: {
        publishJob: async (message) => {
          captured.push(message);
        },
      },
      config: env.config,
      jobs: env.jobs,
    });
    await publisher.publish({ userId, jobId });

    const result = await handleJobMessage(JSON.stringify(captured[0]), {
      config: env.config,
      sqs: env.queues.sqs,
      jobs: env.jobs,
    });
    expect(result.completed).toBe(1);

    const detail = await env.detail(token, jobId);
    expect(detail.job?.status).toBe('COMPLETED');
    expect(detail.job?.bytesBefore).toBe(realBytes['img-metric']);
    expect(detail.job?.bytesBefore).not.toBe(declaredBytes);
    expect((detail.images as Array<{ bytesBefore?: number }>)[0]?.bytesBefore).toBe(realBytes['img-metric']);
  });

  it('falla cerrado si HeadObject y GetObject divergen en el tamaño', async () => {
    const userId = 'u-divergence';
    const jobId = 'j-divergence';
    const key = `${userId}/${jobId}/raw/img-x`;
    const fake: Pick<S3Client, 'send'> = {
      send: async (command: unknown) => {
        if (command instanceof ListObjectsV2Command) return { Contents: [{ Key: key }] } as never;
        if (command instanceof HeadObjectCommand) return { ContentLength: 999 } as never;
        if (command instanceof GetObjectCommand) {
          return { Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) } } as never;
        }
        throw new Error('comando inesperado');
      },
    } as unknown as Pick<S3Client, 'send'>;
    const publisher = createS3EnrichedPublisher({
      delegate: { publishJob: async () => undefined },
      config: env.config,
      s3: fake,
    });
    await expect(publisher.publish({ userId, jobId })).rejects.toThrow(/ContentLength|tamaño|diverg/i);
  });
});
