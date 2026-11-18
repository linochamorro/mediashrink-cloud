/**
 * Observabilidad del consumidor SQS (F02-T06 / CA-06).
 *
 * Expone de forma explícita los tres campos de resiliencia introducidos en
 * F02-T04 (`dlqFailures`, `dlqDeliveryFailed`, `skippedAsDuplicate`) para que
 * la integración E2E y los logs de operación puedan consumirlos sin acceder a
 * la estructura interna de `ConsumeResult`.
 */

import type { ConsumeResult } from './consumer';

export interface ConsumeObservabilitySnapshot {
  readonly userId: string;
  readonly jobId: string;
  readonly batchStatus: ConsumeResult['batchStatus'];
  readonly completed: number;
  readonly failed: number;
  readonly deadLettered: number;
  /** Envíos a DLQ que fallaron: se reportan, nunca abortan el lote (A-02). */
  readonly dlqFailures: number;
  /** Verdadero si alguna imagen agotó reintentos y su envío a DLQ falló. */
  readonly dlqDeliveryFailed: boolean;
  /** Entrega duplicada de un job terminal: no se reprocesó nada (A-01). */
  readonly skippedAsDuplicate: boolean;
  readonly messageDeleted: boolean;
}

/** Proyección estable y serializable de un resultado de consumo. */
export function summarizeConsumeResult(result: ConsumeResult): ConsumeObservabilitySnapshot {
  return {
    userId: result.userId,
    jobId: result.jobId,
    batchStatus: result.batchStatus,
    completed: result.completed,
    failed: result.failed,
    deadLettered: result.deadLettered,
    dlqFailures: result.dlqFailures,
    dlqDeliveryFailed: result.outcomes.some((outcome) => outcome.dlqDeliveryFailed === true),
    skippedAsDuplicate: result.skippedAsDuplicate,
    messageDeleted: result.messageDeleted,
  };
}
