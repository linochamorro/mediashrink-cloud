/**
 * Guarda compuesta del worker: tamaño → cabecera → dimensiones (A-05).
 *
 * Compone las reglas puras de `backend/src/domain/**` sin reimplementarlas.
 * La primera guarda es la de bytes, antes de cualquier escaneo del buffer.
 */

import type { AppConfig } from '../config/index';
import type {
  AntiBombReason,
  HeaderRejectionReason,
  HeaderValidation,
  HeaderValidationInput,
  ImageDimensions,
  RasterFormat,
} from '../domain/index';
import {
  checkDimensions,
  checkFileSize,
  limitsFromConfig,
  validateImageHeader,
} from '../domain/index';

export type WorkerRejectionCode = AntiBombReason | HeaderRejectionReason | 'RENDER_FAILED';

/** Inyección opcional para demostrar el orden de las guardas en las pruebas. */
export interface HeaderScanner {
  (input: HeaderValidationInput): HeaderValidation;
}

export interface PreflightSuccess {
  readonly ok: true;
  readonly format: RasterFormat;
  readonly dimensions: ImageDimensions;
}

export interface PreflightFailure {
  readonly ok: false;
  readonly reasonCode: WorkerRejectionCode;
  readonly failureReason: string;
}

export type PreflightResult = PreflightSuccess | PreflightFailure;

export interface PreflightContext {
  readonly filename?: string;
  readonly mimeType?: string;
  readonly scanHeader?: HeaderScanner;
}

function fail(reasonCode: WorkerRejectionCode, failureReason: string): PreflightFailure {
  return { ok: false, reasonCode, failureReason };
}

/**
 * Orden estricto (A-05): el tamaño en bytes se comprueba ANTES de cualquier
 * escaneo de la cabecera; las dimensiones se comprueban ANTES de decodificar.
 * Todas las decisiones vienen de reglas puras de F01-T05: aquí solo se componen.
 */
export function preflightImage(
  bytes: Uint8Array,
  config: AppConfig,
  context: PreflightContext = {},
): PreflightResult {
  const limits = limitsFromConfig(config);

  const size = checkFileSize(bytes.byteLength, limits);
  if (!size.ok) return fail(size.reason, size.detail);

  const scan = (context.scanHeader ?? validateImageHeader)({
    bytes,
    filename: context.filename,
    mimeType: context.mimeType,
  });
  if (!scan.ok) {
    return fail(scan.reason, `Cabecera de imagen rechazada: ${scan.reason}`);
  }

  const dimensions = checkDimensions(scan.dimensions, limits);
  if (!dimensions.ok) return fail(dimensions.reason, dimensions.detail);

  return { ok: true, format: scan.format, dimensions: scan.dimensions };
}
