/**
 * Worker de procesamiento de imágenes: función pura sobre buffers.
 *
 * No depende de `backend/src/storage/**` ni de `backend/src/api/**`.
 * La integración S3/SQS se cablea en T04/T06.
 */

import { randomUUID } from 'node:crypto';

import type { AppConfig } from '../config/index';
import type { JobMetrics, Preset } from '../contracts/index';
import { computeSavings } from '../domain/index';
import { preflightImage, type HeaderScanner, type WorkerRejectionCode } from './preflight';
import {
  renderWithSharp,
  type ImageRenderer,
  type RenderedOutputs,
} from './render';

export interface WorkerHooks {
  /** Inyectable en pruebas para demostrar que la guarda de tamaño va antes del escaneo. */
  readonly scanHeader?: HeaderScanner;
  /** Inyectable en pruebas para demostrar que ninguna guarda rechazada decodifica. */
  readonly render?: ImageRenderer;
}

export interface ProcessImageOptions {
  readonly config: AppConfig;
  readonly imageId?: string;
  readonly filename?: string;
  readonly mimeType?: string;
  readonly preset?: Preset;
  readonly hooks?: WorkerHooks;
}

export interface ProcessedImageSuccess {
  readonly ok: true;
  readonly imageId: string;
  readonly status: 'COMPLETED';
  readonly metrics: JobMetrics;
  readonly outputs: RenderedOutputs;
}

export interface ProcessedImageFailure {
  readonly ok: false;
  readonly imageId: string;
  readonly status: 'FAILED';
  readonly reasonCode: WorkerRejectionCode;
  readonly failureReason: string;
  readonly exifStripped: false;
}

export type ProcessImageResult = ProcessedImageSuccess | ProcessedImageFailure;

function rejected(
  imageId: string,
  reasonCode: WorkerRejectionCode,
  failureReason: string,
): ProcessedImageFailure {
  return { ok: false, imageId, status: 'FAILED', reasonCode, failureReason, exifStripped: false };
}

/**
 * Procesa un buffer en memoria y devuelve un resultado tipado; nunca lanza
 * hacia el llamador por una imagen inválida (T04 decide cómo abortar el lote).
 * No hay dependencias de S3, SQS ni de la API HTTP.
 */
export async function processImage(
  bytes: Uint8Array,
  options: ProcessImageOptions,
): Promise<ProcessImageResult> {
  const imageId = options.imageId ?? randomUUID();
  const preset = options.preset ?? 'BALANCED';

  // A-05: esta guarda compuesta ejecuta checkFileSize antes de escanear.
  const preflight = preflightImage(bytes, options.config, {
    filename: options.filename,
    mimeType: options.mimeType,
    scanHeader: options.hooks?.scanHeader,
  });
  if (!preflight.ok) {
    return rejected(imageId, preflight.reasonCode, preflight.failureReason);
  }

  let outputs: RenderedOutputs;
  try {
    outputs = await (options.hooks?.render ?? renderWithSharp)({
      bytes,
      format: preflight.format,
      preset,
    });
  } catch {
    // Mensaje estable: nunca se propaga una ruta local ni un valor de entorno (G-3).
    return rejected(imageId, 'RENDER_FAILED', 'No se pudo procesar la imagen con sharp');
  }

  const bytesBefore = bytes.byteLength;
  const bytesAfter =
    outputs.webp.byteLength + outputs.avif.byteLength + outputs.thumbnail.byteLength;
  const savings = computeSavings({ bytesBefore, bytesAfter });
  const metrics: JobMetrics = {
    bytesBefore: savings.bytesBefore,
    bytesAfter: savings.bytesAfter,
    savingsPct: savings.savingsPct,
    // Solo se certifica después de que el renderizador verificó la ausencia de metadatos.
    exifStripped: true,
  };

  return { ok: true, imageId, status: 'COMPLETED', metrics, outputs };
}
