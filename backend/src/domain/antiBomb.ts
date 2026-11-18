/**
 * Regla anti-bomba (F01-T05): rechazo de tamaño y dimensiones antes de procesar.
 *
 * Los límites NO se hardcoded: se projectionan desde `loadConfig()` (MAX_FILE_SIZE_MB,
 * MAX_PIXELS). Las funciones son puras: reciben los límites y no leen el entorno.
 */

import type { AppConfig } from '../config/index';
import { isNonNegativeSafeInt, isPositiveSafeInt } from './guards';

/** Subconjunto de `AppConfig['limits']` que gobierna la anti-bomba. */
export interface AntiBombLimits {
  readonly maxFileSizeMb: number;
  readonly maxPixels: number;
}

export interface ImageDimensions {
  readonly width: number;
  readonly height: number;
}

export type AntiBombReason =
  | 'INVALID_SIZE'
  | 'FILE_TOO_LARGE'
  | 'INVALID_DIMENSIONS'
  | 'TOO_MANY_PIXELS';

export type AntiBombCheck =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: AntiBombReason; readonly detail: string };

const BYTES_PER_MB = 1024 * 1024;

/** Proyecta los límites de la configuración cargada sin duplicar valores. */
export function limitsFromConfig(config: AppConfig): AntiBombLimits {
  return {
    maxFileSizeMb: config.limits.maxFileSizeMb,
    maxPixels: config.limits.maxPixels,
  };
}

function reject(reason: AntiBombReason, detail: string): AntiBombCheck {
  return { ok: false, reason, detail };
}

/** Rechaza tamaños no enteros, negativos o superiores a `MAX_FILE_SIZE_MB`. */
export function checkFileSize(sizeBytes: number, limits: AntiBombLimits): AntiBombCheck {
  if (!isNonNegativeSafeInt(sizeBytes)) {
    return reject('INVALID_SIZE', 'sizeBytes debe ser un entero seguro no negativo');
  }
  const maxBytes = limits.maxFileSizeMb * BYTES_PER_MB;
  if (sizeBytes > maxBytes) {
    return reject('FILE_TOO_LARGE', `sizeBytes supera MAX_FILE_SIZE_MB (${limits.maxFileSizeMb} MB)`);
  }
  return { ok: true };
}

/** Rechaza dimensiones no positivas o cuyo producto supere `MAX_PIXELS`. */
export function checkDimensions(
  dimensions: ImageDimensions,
  limits: AntiBombLimits,
): AntiBombCheck {
  if (!isPositiveSafeInt(dimensions.width) || !isPositiveSafeInt(dimensions.height)) {
    return reject('INVALID_DIMENSIONS', 'width y height deben ser enteros seguros positivos');
  }
  if (dimensions.width * dimensions.height > limits.maxPixels) {
    return reject('TOO_MANY_PIXELS', `píxeles superan MAX_PIXELS (${limits.maxPixels})`);
  }
  return { ok: true };
}
