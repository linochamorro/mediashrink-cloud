import { describe, expect, it } from 'vitest';

import { DomainError, assertNonNegativeSafeInt, isNonNegativeSafeInt, isPositiveSafeInt } from '../../../backend/src/domain/guards';

describe('guards — enteros seguros (RED por comportamiento)', () => {
  it('isNonNegativeSafeInt acepta 0 y enteros positivos', () => {
    expect(isNonNegativeSafeInt(0)).toBe(true);
    expect(isNonNegativeSafeInt(1048576)).toBe(true);
  });

  it('isNonNegativeSafeInt rechaza negativos, fracciones y NaN', () => {
    expect(isNonNegativeSafeInt(-1)).toBe(false);
    expect(isNonNegativeSafeInt(1.5)).toBe(false);
    expect(isNonNegativeSafeInt(Number.NaN)).toBe(false);
    expect(isNonNegativeSafeInt(Number.MAX_SAFE_INTEGER + 1)).toBe(false);
  });

  it('isPositiveSafeInt exige al menos 1', () => {
    expect(isPositiveSafeInt(1)).toBe(true);
    expect(isPositiveSafeInt(0)).toBe(false);
    expect(isPositiveSafeInt(-2)).toBe(false);
    expect(isPositiveSafeInt(2.5)).toBe(false);
  });

  it('assertNonNegativeSafeInt no lanza con un valor válido', () => {
    expect(() => assertNonNegativeSafeInt(0, 'bytes', 'INVALID_BYTES')).not.toThrow();
  });

  it('assertNonNegativeSafeInt lanza DomainError con código y campo', () => {
    try {
      assertNonNegativeSafeInt(-5, 'bytesBefore', 'INVALID_BYTES');
      throw new Error('debió lanzar');
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      const domainError = error as DomainError;
      expect(domainError.code).toBe('INVALID_BYTES');
      expect(domainError.message).toContain('bytesBefore');
      expect(domainError.name).toBe('DomainError');
    }
  });
});
