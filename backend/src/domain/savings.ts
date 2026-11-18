/**
 * Cálculo de ahorro real (F01-T05, PR-12 / FR-12).
 *
 * Bytes enteros del objeto original y optimizado → bytes ahorrados y
 * porcentaje. El 0 % y el ahorro negativo son resultados legítimos y se
 * reportan tal cual: nunca se recortan ni se ocultan (Métricas honestas).
 */

import { assertNonNegativeSafeInt } from './guards';

export interface SavingsInput {
  readonly bytesBefore: number;
  readonly bytesAfter: number;
}

export interface SavingsResult {
  readonly bytesBefore: number;
  readonly bytesAfter: number;
  readonly bytesSaved: number;
  readonly savingsPct: number;
}

/**
 * `(bytesBefore - bytesAfter) / bytesBefore * 100`, con 0 % cuando no hay
 * bytes de entrada. Mantiene la precisión para ser coherente con la
 * refinación `savings-coherence` del contrato congelado (tolerancia 0.01).
 */
export function computeSavings(input: SavingsInput): SavingsResult {
  assertNonNegativeSafeInt(input.bytesBefore, 'bytesBefore', 'INVALID_BYTES');
  assertNonNegativeSafeInt(input.bytesAfter, 'bytesAfter', 'INVALID_BYTES');

  const bytesSaved = input.bytesBefore - input.bytesAfter;
  const savingsPct = input.bytesBefore === 0 ? 0 : (bytesSaved / input.bytesBefore) * 100;

  return {
    bytesBefore: input.bytesBefore,
    bytesAfter: input.bytesAfter,
    bytesSaved,
    savingsPct,
  };
}
