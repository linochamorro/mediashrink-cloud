/**
 * Consumidor SQS con reintentos y DLQ (F02-T04, CA-04).
 *
 * Procesa cada imagen del mensaje llamando SIEMPRE a `processImage` (que impone
 * la guarda A-05 y el strip real). Nunca invoca `renderWithSharp` directamente.
 * Tras agotar los reintentos de una imagen, envía el sobre a la DLQ, marca SOLO
 * esa imagen como FAILED en DynamoDB y continúa con el resto del lote.
 *
 * Idempotencia de mensaje (A-01): un job terminal no se reabre y una imagen ya
 * FAILED no vuelve a generar un sobre en la DLQ. Resiliencia (A-02): el envío a
 * la DLQ está aislado en try/catch; su fallo se registra y no aborta el lote.
 * Precondición (A-03): si el ítem imagen no existe, se crea con la API pública
 * del almacén (`putImage`) antes de actualizarlo.
 */

import { GetObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
  type SQSClient,
} from '@aws-sdk/client-sqs';

import type { AppConfig } from '../config/index';
import type { JobMetrics, JobStatus } from '../contracts/index';
import { ALLOWED_TRANSITIONS, computeSavings, nextStatus, resolveBatchStatus } from '../domain/index';
import type { JobStore } from '../db/index';
import { createS3ClientFromConfig } from '../storage/client';
import {
  createObjectAccessServiceFromConfig,
  type OptimizedObjectWriter,
} from '../storage/index';
import { parseJobQueueMessage, type DeadLetterMessage } from './messages';
import { processImage, type ProcessImageOptions, type ProcessImageResult } from './processImage';

/** Costura de inyección para fallos transitorios en pruebas; por defecto es `processImage`. */
export type ImageProcessor = (
  bytes: Uint8Array,
  options: ProcessImageOptions,
) => Promise<ProcessImageResult>;

export interface ConsumeDependencies {
  readonly config: AppConfig;
  readonly sqs: SQSClient;
  readonly jobs: JobStore;
  readonly processor?: ImageProcessor;
  readonly now?: () => string;
  /** Cliente usado para la DLQ; por defecto `sqs`. Inyectable para simular su caída (A-02). */
  readonly dlqClient?: Pick<SQSClient, 'send'>;
  /** Servicio de almacenamiento inyectable; por defecto se construye desde `config`. */
  readonly objects?: OptimizedObjectWriter;
}

export interface ImageOutcome {
  readonly imageId: string;
  readonly status: 'COMPLETED' | 'FAILED';
  readonly attempts: number;
  readonly deadLettered: boolean;
  readonly dlqDeliveryFailed?: boolean;
  readonly reasonCode?: string;
  readonly failureReason?: string;
  readonly metrics?: JobMetrics;
}

export interface ConsumeResult {
  readonly userId: string;
  readonly jobId: string;
  readonly outcomes: readonly ImageOutcome[];
  readonly completed: number;
  readonly failed: number;
  readonly deadLettered: number;
  /** Envíos a DLQ que fallaron: se reportan, pero no abortan el lote (A-02). */
  readonly dlqFailures: number;
  readonly batchStatus: 'COMPLETED' | 'PARTIAL' | 'FAILED';
  readonly messageDeleted: boolean;
  /** Entrega duplicada de un job ya terminal: no se reprocesó nada (A-01). */
  readonly skippedAsDuplicate: boolean;
}

export interface PollOptions {
  readonly maxNumberOfMessages?: number;
  readonly waitTimeSeconds?: number;
}

/** Mensaje estable para fallos lanzados por el procesador (G-3: sin rutas ni entorno). */
const TRANSIENT_FAILURE_REASON = 'No se pudo procesar la imagen con sharp';

/** Un estado es terminal cuando la máquina de estados congelada no tiene salidas. */
function terminalStatus(status: JobStatus): 'COMPLETED' | 'PARTIAL' | 'FAILED' | null {
  return ALLOWED_TRANSITIONS[status].length === 0
    ? (status as 'COMPLETED' | 'PARTIAL' | 'FAILED')
    : null;
}

function skippedResult(
  userId: string,
  jobId: string,
  status: 'COMPLETED' | 'PARTIAL' | 'FAILED',
): ConsumeResult {
  return {
    userId,
    jobId,
    outcomes: [],
    completed: 0,
    failed: 0,
    deadLettered: 0,
    dlqFailures: 0,
    batchStatus: status,
    messageDeleted: false,
    skippedAsDuplicate: true,
  };
}

/**
 * Asegura el ítem imagen sin tocar `backend/src/db/**`: usa solo la API pública.
 * Si ya existe, la devuelve; si no, la materializa en estado PROCESSING.
 */
async function ensureImageRecord(
  jobs: JobStore,
  userId: string,
  jobId: string,
  imageId: string,
): Promise<{ readonly alreadyFailed: boolean }> {
  const existing = await jobs.getImage(userId, jobId, imageId);
  if (existing === null) {
    await jobs.putImage(userId, jobId, {
      imageId,
      status: 'PROCESSING',
      exifStripped: false,
    });
    return { alreadyFailed: false };
  }
  return { alreadyFailed: existing.status === 'FAILED' };
}

/**
 * Procesa un mensaje ya recibido. No borra el mensaje: eso lo hace
 * `pollAndProcessOnce` solo después de completar TODAS las imágenes del lote.
 */
export async function handleJobMessage(
  body: string | undefined,
  deps: ConsumeDependencies,
): Promise<ConsumeResult> {
  // Validar antes de tocar el almacén: un mensaje corrupto no cambia estados.
  const message = parseJobQueueMessage(body);
  const processor: ImageProcessor = deps.processor ?? processImage;
  const now = deps.now ?? (() => new Date().toISOString());
  const maxAttempts = deps.config.worker.sqsMaxRetries;
  const { userId, jobId } = message;
  let objects = deps.objects;
  const getObjects = () => (objects ??= createObjectAccessServiceFromConfig(deps.config));
  let s3Client: S3Client | undefined;
  const getS3 = () => (s3Client ??= createS3ClientFromConfig(deps.config));

  // A-01: la máquina de estados congelada decide. Un job terminal nunca se reabre.
  const currentJob = await deps.jobs.getJob(userId, jobId);
  if (currentJob !== null) {
    const terminal = terminalStatus(currentJob.status);
    if (terminal !== null) return skippedResult(userId, jobId, terminal);
  }
  // Reentrada en PROCESSING: no se escribe de nuevo; PENDING (o job ausente,
  // que updateJob rechazará con JobNotFoundError) sí pasa por la máquina de estados.
  if (currentJob === null || currentJob.status !== 'PROCESSING') {
    await deps.jobs.updateJob(userId, jobId, {
      status: nextStatus(currentJob?.status ?? 'PENDING', 'PROCESSING'),
      updatedAt: now(),
    });
  }

  const outcomes: ImageOutcome[] = [];
  let dlqFailures = 0;
  for (const image of message.images) {
    const { alreadyFailed } = await ensureImageRecord(deps.jobs, userId, jobId, image.imageId);
    const options: ProcessImageOptions = {
      config: deps.config,
      imageId: image.imageId,
      ...(image.mimeType === undefined ? {} : { mimeType: image.mimeType }),
      ...(image.filename === undefined ? {} : { filename: image.filename }),
      ...(image.preset === undefined ? {} : { preset: image.preset }),
    };
    let bytes: Buffer;
    if (image.contentBase64 !== undefined && image.contentBase64 !== '') {
      bytes = Buffer.from(image.contentBase64, 'base64');
    } else {
      const rawBucket = deps.config.resources.s3BucketRaw;
      const rawKey = `${userId}/${jobId}/raw/${image.imageId}`;
      const s3 = getS3();
      const object = await s3.send(new GetObjectCommand({ Bucket: rawBucket, Key: rawKey }));
      if (object.Body === undefined) {
        throw new Error(`Objeto S3 raw no disponible: ${rawKey}`);
      }
      bytes = Buffer.from(await object.Body.transformToByteArray());
    }

    let attempt = 0;
    let success: Extract<ProcessImageResult, { ok: true }> | undefined;
    let reasonCode = 'RENDER_FAILED';
    let failureReason = TRANSIENT_FAILURE_REASON;

    while (attempt < maxAttempts) {
      attempt += 1;
      try {
        const result = await processor(bytes, options);
        if (result.ok) {
          success = result;
          break;
        }
        reasonCode = result.reasonCode;
        failureReason = result.failureReason;
      } catch {
        reasonCode = 'RENDER_FAILED';
        failureReason = TRANSIENT_FAILURE_REASON;
      }
    }

    if (success !== undefined) {
      // A-01: persistir las TRES variantes antes de cerrar la imagen. La
      // métrica se re-deriva de los bytes confirmados por HeadObject en S3,
      // no de los buffers en memoria (PR-12, bytes reales del artefacto final).
      const persisted = await getObjects().writeOptimizedVariants(
        { userId, jobId, imageId: image.imageId },
        success.outputs,
      );
      const anchoredSavings = computeSavings({
        bytesBefore: success.metrics.bytesBefore,
        bytesAfter: persisted.totalBytes,
      });
      const metrics: JobMetrics = {
        bytesBefore: success.metrics.bytesBefore,
        bytesAfter: anchoredSavings.bytesAfter,
        savingsPct: anchoredSavings.savingsPct,
        exifStripped: success.metrics.exifStripped,
      };
      await deps.jobs.updateImage(userId, jobId, image.imageId, {
        status: 'COMPLETED',
        bytesBefore: metrics.bytesBefore,
        bytesAfter: metrics.bytesAfter,
        exifStripped: metrics.exifStripped,
      });
      outcomes.push({
        imageId: image.imageId,
        status: 'COMPLETED',
        attempts: attempt,
        deadLettered: false,
        metrics,
      });
      continue;
    }

    // Reintentos agotados: FAILED solo para esta imagen; el lote sigue.
    await deps.jobs.updateImage(userId, jobId, image.imageId, {
      status: 'FAILED',
      exifStripped: false,
      failureReason,
    });

    // A-01: si ya estaba FAILED, no se emite un segundo sobre para el mismo imageId.
    let deadLettered = false;
    let dlqDeliveryFailed = false;
    if (!alreadyFailed) {
      const deadLetter: DeadLetterMessage = {
        userId,
        jobId,
        imageId: image.imageId,
        attempts: attempt,
        reasonCode,
        failureReason,
      };
      // A-02: efecto de infraestructura aislado. Su fallo se reporta y no aborta.
      try {
        await (deps.dlqClient ?? deps.sqs).send(
          new SendMessageCommand({
            QueueUrl: deps.config.resources.sqsDlqUrl,
            MessageBody: JSON.stringify(deadLetter),
          }),
        );
        deadLettered = true;
      } catch {
        dlqDeliveryFailed = true;
        dlqFailures += 1;
      }
    }
    outcomes.push({
      imageId: image.imageId,
      status: 'FAILED',
      attempts: attempt,
      deadLettered,
      dlqDeliveryFailed,
      reasonCode,
      failureReason,
    });
  }

  const completed = outcomes.filter((outcome) => outcome.status === 'COMPLETED').length;
  const failed = outcomes.length - completed;
  const batchStatus = resolveBatchStatus({ completed, failed });
  const successes = outcomes.flatMap((outcome) =>
    outcome.metrics === undefined ? [] : [outcome.metrics],
  );
  const bytesBefore = successes.reduce((sum, metrics) => sum + metrics.bytesBefore, 0);
  const bytesAfter = successes.reduce((sum, metrics) => sum + metrics.bytesAfter, 0);
  const savings = computeSavings({ bytesBefore, bytesAfter });

  // Cierre también gobernado por la máquina de estados con summary coherente.
  await deps.jobs.updateJob(userId, jobId, {
    status: nextStatus('PROCESSING', batchStatus, { completed, failed }),
    bytesBefore: savings.bytesBefore,
    bytesAfter: savings.bytesAfter,
    savingsPct: savings.savingsPct,
    exifStripped: successes.length > 0 && successes.every((metrics) => metrics.exifStripped),
    updatedAt: now(),
  });

  return {
    userId,
    jobId,
    outcomes,
    completed,
    failed,
    deadLettered: outcomes.filter((outcome) => outcome.deadLettered).length,
    dlqFailures,
    batchStatus,
    messageDeleted: false,
    skippedAsDuplicate: false,
  };
}

/** Recibe como máximo un lote, lo procesa y solo entonces borra el mensaje. */
export async function pollAndProcessOnce(
  deps: ConsumeDependencies,
  options?: PollOptions,
): Promise<ConsumeResult | null> {
  const queueUrl = deps.config.resources.sqsQueueUrl;
  const received = await deps.sqs.send(
    new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: options?.maxNumberOfMessages ?? 1,
      WaitTimeSeconds: options?.waitTimeSeconds ?? 0,
    }),
  );
  const message = received.Messages?.[0];
  if (message === undefined || message.Body === undefined) return null;

  const result = await handleJobMessage(message.Body, deps);
  if (message.ReceiptHandle !== undefined) {
    await deps.sqs.send(
      new DeleteMessageCommand({ QueueUrl: queueUrl, ReceiptHandle: message.ReceiptHandle }),
    );
  }
  return { ...result, messageDeleted: true };
}

/**
 * Drena hasta `maxRounds` mensajes. El límite garantiza que un mensaje no
 * borrado (fallo inesperado) no produzca un bucle infinito de recepción.
 */
export async function drainQueue(
  deps: ConsumeDependencies,
  options?: PollOptions & { readonly maxRounds?: number },
): Promise<ConsumeResult[]> {
  const maxRounds = options?.maxRounds ?? 10;
  const results: ConsumeResult[] = [];
  for (let round = 0; round < maxRounds; round += 1) {
    const result = await pollAndProcessOnce(deps, options);
    if (result === null) break;
    results.push(result);
  }
  return results;
}
