/**
 * Adaptador de publicación enriquecida (F02-T06 / CA-06).
 *
 * `POST /jobs/:id/confirm` solo conoce `{ userId, jobId }` (puerto de T01). El
 * publicador real de `worker/**` ofrece `publishJob()`, que necesita el sobre
 * completo con las imágenes. Este adaptador, dentro de `api/**`:
 *
 *   1. lee de S3 `raw` los objetos realmente subidos bajo
 *      `<userId>/<jobId>/raw/` (nunca el tamaño declarado por el cliente),
 *   2. construye el sobre con `contentBase64` y el preset del lote, y
 *   3. delega en `publishJob()` del publicador inyectado.
 *
 * Así las métricas que después persiste el consumidor se calculan con los bytes
 * reales del objeto S3 (FR-12 / PR-12), sin tocar `backend/src/storage/**` ni
 * `backend/src/db/**`.
 */

import { GetObjectCommand, ListObjectsV2Command, type S3Client } from '@aws-sdk/client-s3';

import type { AppConfig } from '../config/index';
import type { JobStore } from '../db/types';
import { createS3ClientFromConfig } from '../storage/client';
import { assertKeyWithinPrefix, assertSafeKeySegment } from '../storage/keys';
import type { JobImagePayload, JobQueueMessage } from '../worker/messages';
import type { JobConfirmationMessage, JobQueuePublisher } from './publisher';

/** Capacidad mínima del publicador de `worker/**` que este adaptador aprovecha. */
export interface JobEnvelopePublisher {
  publishJob(message: JobQueueMessage): Promise<void>;
}

export interface S3EnrichedPublisherOptions {
  readonly delegate: JobEnvelopePublisher;
  readonly config: AppConfig;
  /** Solo se usa para leer el `preset` del lote; opcional por compatibilidad. */
  readonly jobs?: Pick<JobStore, 'getJob'>;
  /** Cliente S3 inyectable en pruebas; por defecto se construye desde `config`. */
  readonly s3?: Pick<S3Client, 'send'>;
}

/** Comprobación de capacidad: mantiene intactos los dobles que solo publican `publish()`. */
export function supportsJobEnvelope(
  publisher: JobQueuePublisher,
): publisher is JobQueuePublisher & JobEnvelopePublisher {
  return typeof (publisher as Partial<JobEnvelopePublisher>).publishJob === 'function';
}

/**
 * Envuelve un publicador real para que `publish()` de T01 termine llamando a
 * `publishJob()` con el sobre enriquecido desde S3.
 */
export function createS3EnrichedPublisher(options: S3EnrichedPublisherOptions): JobQueuePublisher {
  let s3: Pick<S3Client, 'send'> | undefined = options.s3;
  const getS3 = () => (s3 ??= createS3ClientFromConfig(options.config));
  const rawBucket = options.config.resources.s3BucketRaw;

  return {
    async publish(message: JobConfirmationMessage): Promise<void> {
      // Las claves se validan igual que en la capa S3: defensa en profundidad
      // antes de listar cualquier prefijo.
      assertSafeKeySegment(message.userId, 'userId');
      assertSafeKeySegment(message.jobId, 'jobId');
      const prefix = `${message.userId}/${message.jobId}/raw/`;

      const listed = await getS3().send(
        new ListObjectsV2Command({ Bucket: rawBucket, Prefix: prefix }),
      );
      const keys = (listed.Contents ?? [])
        .map((item) => item.Key)
        .filter((key): key is string => typeof key === 'string')
        .filter((key) => key.startsWith(prefix) && key.length > prefix.length)
        .sort();

      const job = options.jobs === undefined
        ? null
        : await options.jobs.getJob(message.userId, message.jobId);
      const images: JobImagePayload[] = [];

      for (const key of keys) {
        assertKeyWithinPrefix(key, message.userId);
        const imageId = key.slice(prefix.length);
        assertSafeKeySegment(imageId, 'imageId');
        const object = await getS3().send(new GetObjectCommand({ Bucket: rawBucket, Key: key }));
        if (object.Body === undefined) continue;
        // Bytes exactos del objeto: ni mimeType ni filename (el worker detecta
        // el formato por magic bytes y un filename sin extensión lo rechazaría).
        const bytes = Buffer.from(await object.Body.transformToByteArray());
        images.push({
          imageId,
          contentBase64: bytes.toString('base64'),
          ...(job === null ? {} : { preset: job.preset }),
        });
      }

      const envelope: JobQueueMessage = {
        userId: message.userId,
        jobId: message.jobId,
        images,
      };
      await options.delegate.publishJob(envelope);
    },
  };
}
