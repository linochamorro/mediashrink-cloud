/**
 * Guardas numéricas compartidas por las reglas puras (F01-T05).
 *
 * Solo Node built-ins: `Number.isSafeInteger` evita desbordamientos y valores
 * no representables antes de cualquier cálculo de bytes o píxeles.
 */

/** Error de dominio con código estable: el worker puede traducirlo a motivo de rechazo. */
export class DomainError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
  }
}

/** `true` para enteros representables mayores o iguales que cero. */
export function isNonNegativeSafeInt(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

/** `true` para enteros representables estrictamente positivos. */
export function isPositiveSafeInt(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 1;
}

/** Lanza `DomainError` si el valor no es un entero seguro no negativo. */
export function assertNonNegativeSafeInt(value: number, field: string, code: string): void {
  if (!isNonNegativeSafeInt(value)) {
    throw new DomainError(code, `${field} debe ser un entero seguro no negativo`);
  }
}
