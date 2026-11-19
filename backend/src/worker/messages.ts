/**
 * Contratos de transporte SQS del consumidor (F02-T04).
 *
 * No redefinen los contratos congelados de F01: son el sobre (envelope) con el
 * que el publicador real (T06) enriquece el mensaje mínimo `{ userId, jobId }`
 * de T01 para que el worker pueda invocar `processImage` sobre cada imagen.
 */

import { PRESET_VALUES, type Preset } from '../contracts/index';
import { assertOpaqueId } from '../db/keys';

/** Imagen a procesar. Los bytes viajan en base64 en mensajes pequeños; en lotes grandes se omiten para no exceder los 256 KiB de SQS. */
export interface JobImagePayload {
  readonly imageId: string;
  readonly contentBase64?: string;
  readonly mimeType?: string;
  readonly filename?: string;
  readonly preset?: Preset;
}

/** Mensaje de trabajo en la cola principal. */
export interface JobQueueMessage {
  readonly userId: string;
  readonly jobId: string;
  readonly images: readonly JobImagePayload[];
}

/** Sobre enviado a la DLQ cuando una imagen agota los reintentos. */
export interface DeadLetterMessage {
  readonly userId: string;
  readonly jobId: string;
  readonly imageId: string;
  readonly attempts: number;
  readonly reasonCode: string;
  readonly failureReason: string;
}

export class MessageParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MessageParseError';
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new MessageParseError('El cuerpo del mensaje debe ser un objeto JSON');
  }
  return value as Record<string, unknown>;
}

function opaque(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new MessageParseError(`${key} debe ser una cadena no vacía`);
  }
  try {
    assertOpaqueId(value, key);
  } catch {
    throw new MessageParseError(`${key} debe ser un identificador opaco sin '#'`);
  }
  return value;
}

function optionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new MessageParseError(`${key} debe ser una cadena`);
  return value;
}

function base64(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new MessageParseError('contentBase64 debe ser una cadena no vacía');
  }
  const decoded = Buffer.from(value, 'base64');
  if (decoded.toString('base64') !== value) {
    throw new MessageParseError('contentBase64 no es base64 válido');
  }
  return value;
}

/**
 * Parsea y valida un mensaje de trabajo. Retrocompatible con el mensaje mínimo
 * de T01: si no trae `images`, se interpreta como lote sin imágenes (el
 * productor real de T06 enriquece el sobre con el contenido a procesar).
 */
export function parseJobQueueMessage(body: string | undefined): JobQueueMessage {
  if (body === undefined || body.trim() === '') {
    throw new MessageParseError('El mensaje SQS llegó sin cuerpo');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new MessageParseError('El cuerpo del mensaje no es JSON válido');
  }
  const record = asRecord(parsed);
  const userId = opaque(record, 'userId');
  const jobId = opaque(record, 'jobId');

  const rawImages = record.images ?? [];
  if (!Array.isArray(rawImages)) {
    throw new MessageParseError('images debe ser un arreglo');
  }
  const images: JobImagePayload[] = rawImages.map((raw) => {
    const image = asRecord(raw);
    const imageId = opaque(image, 'imageId');
    const mimeType = optionalString(image, 'mimeType');
    const filename = optionalString(image, 'filename');
    const rawPreset = optionalString(image, 'preset');
    if (rawPreset !== undefined && !PRESET_VALUES.includes(rawPreset as Preset)) {
      throw new MessageParseError('preset no es uno de los permitidos');
    }
    const rawContent = image.contentBase64;
    const content =
      rawContent !== undefined && rawContent !== null && rawContent !== ''
        ? base64(rawContent)
        : undefined;
    return {
      imageId,
      ...(content === undefined ? {} : { contentBase64: content }),
      ...(mimeType === undefined ? {} : { mimeType }),
      ...(filename === undefined ? {} : { filename }),
      ...(rawPreset === undefined ? {} : { preset: rawPreset as Preset }),
    };
  });

  return { userId, jobId, images };
}

/** Parsea el sobre de una entrada de la DLQ (defensa en profundidad). */
export function parseDeadLetterMessage(body: string | undefined): DeadLetterMessage {
  if (body === undefined || body.trim() === '') {
    throw new MessageParseError('El mensaje de la DLQ llegó sin cuerpo');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new MessageParseError('El cuerpo del mensaje de la DLQ no es JSON válido');
  }
  const record = asRecord(parsed);
  const attempts = record.attempts;
  if (typeof attempts !== 'number' || !Number.isInteger(attempts) || attempts < 1) {
    throw new MessageParseError('attempts debe ser un entero positivo');
  }
  const reasonCode = opaque(record, 'reasonCode');
  const failureReason = opaque(record, 'failureReason');
  return {
    userId: opaque(record, 'userId'),
    jobId: opaque(record, 'jobId'),
    imageId: opaque(record, 'imageId'),
    attempts,
    reasonCode,
    failureReason,
  };
}
