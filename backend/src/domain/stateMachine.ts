/**
 * Máquina de estados del lote (F01-T05, IN-08 / FR-14).
 *
 * Grafo: PENDING → PROCESSING → {COMPLETED | PARTIAL | FAILED}. Terminales
 * sin salida. Un fallo parcial (imagen FAILED junto a imágenes completadas)
 * se refleja como PARTIAL; el fallo total como FAILED. Los estados se reutilizan
 * del catálogo congelado (no se redefinen).
 */

import type { JobStatus } from '../contracts/index';
import { DomainError } from './guards';

export interface ImageOutcomeSummary {
  readonly completed: number;
  readonly failed: number;
}

export type TransitionRejectionReason =
  | 'INVALID_TRANSITION'
  | 'COMPLETED_REJECTS_FAILED_IMAGES'
  | 'PARTIAL_REQUIRES_BOTH_OUTCOMES'
  | 'FAILED_REJECTS_COMPLETED_IMAGES';

export type TransitionCheck =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: TransitionRejectionReason };

/** Única fuente del grafo permitido. */
export const ALLOWED_TRANSITIONS: Readonly<Record<JobStatus, readonly JobStatus[]>> = {
  PENDING: ['PROCESSING', 'FAILED'],
  PROCESSING: ['COMPLETED', 'PARTIAL', 'FAILED'],
  COMPLETED: [],
  PARTIAL: [],
  FAILED: [],
};

function reject(reason: TransitionRejectionReason): TransitionCheck {
  return { ok: false, reason };
}

/**
 * Valida el grafo y, si se aporta un resumen de imágenes, la coherencia del
 * resultado terminal con los estados individuales.
 */
export function checkTransition(
  from: JobStatus,
  to: JobStatus,
  summary?: ImageOutcomeSummary,
): TransitionCheck {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) return reject('INVALID_TRANSITION');
  if (summary === undefined) return { ok: true };

  if (to === 'COMPLETED' && summary.failed > 0) {
    return reject('COMPLETED_REJECTS_FAILED_IMAGES');
  }
  if (to === 'PARTIAL' && !(summary.completed > 0 && summary.failed > 0)) {
    return reject('PARTIAL_REQUIRES_BOTH_OUTCOMES');
  }
  if (to === 'FAILED' && summary.completed > 0) {
    return reject('FAILED_REJECTS_COMPLETED_IMAGES');
  }
  return { ok: true };
}

/** Aplica la transición o lanza `DomainError`; nunca devuelve un estado inválido. */
export function nextStatus(
  current: JobStatus,
  to: JobStatus,
  summary?: ImageOutcomeSummary,
): JobStatus {
  const check = checkTransition(current, to, summary);
  if (!check.ok) {
    throw new DomainError(check.reason, `Transición ${current} → ${to} no permitida: ${check.reason}`);
  }
  return to;
}

/** Estado agregado derivado del resultado de las imágenes. Falla cerrado. */
export function resolveBatchStatus(summary: ImageOutcomeSummary): 'COMPLETED' | 'PARTIAL' | 'FAILED' {
  if (summary.completed === 0 && summary.failed === 0) return 'FAILED';
  if (summary.failed === 0) return 'COMPLETED';
  if (summary.completed > 0) return 'PARTIAL';
  return 'FAILED';
}
