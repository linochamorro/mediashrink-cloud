import { describe, expect, it } from 'vitest';

import { DomainError } from '../../../backend/src/domain/guards';
import { computeSavings } from '../../../backend/src/domain/savings';

describe('savings — ahorro real con bytes enteros (PR-12)', () => {
  it('calcula el ahorro positivo Exacto con bytes enteros', () => {
    expect(computeSavings({ bytesBefore: 1000, bytesAfter: 700 })).toEqual({
      bytesBefore: 1000,
      bytesAfter: 700,
      bytesSaved: 300,
      savingsPct: 30,
    });
  });

  it('reporta 0 % sin ocultarlo cuando no hay ahorro', () => {
    const result = computeSavings({ bytesBefore: 1000, bytesAfter: 1000 });
    expect(result.bytesSaved).toBe(0);
    expect(result.savingsPct).toBe(0);
    expect(Object.prototype.hasOwnProperty.call(result, 'savingsPct')).toBe(true);
  });

  it('reporta el ahorro negativo sin recortarlo a cero', () => {
    const result = computeSavings({ bytesBefore: 1000, bytesAfter: 1200 });
    expect(result.bytesSaved).toBe(-200);
    expect(result.savingsPct).toBe(-20);
  });

  it('evita la división por cero cuando bytesBefore es 0', () => {
    expect(computeSavings({ bytesBefore: 0, bytesAfter: 0 }).savingsPct).toBe(0);
    expect(computeSavings({ bytesBefore: 0, bytesAfter: 500 })).toEqual({
      bytesBefore: 0,
      bytesAfter: 500,
      bytesSaved: -500,
      savingsPct: 0,
    });
  });

  it('conserva la precisión real del porcentaje (sin redondeo opaco)', () => {
    expect(computeSavings({ bytesBefore: 3, bytesAfter: 2 }).savingsPct).toBeCloseTo(33.3333, 3);
  });

  it('es coherente con la refinación savings-coherence del contrato congelado', () => {
    for (const [before, after] of [
      [1000, 333],
      [7, 1],
      [250, 250],
      [90, 99],
      [0, 500],
    ] as const) {
      const result = computeSavings({ bytesBefore: before, bytesAfter: after });
      const esperado = before === 0 ? 0 : ((before - after) / before) * 100;
      expect(Math.abs(result.savingsPct - esperado)).toBeLessThanOrEqual(0.01);
    }
  });

  it('rechaza bytes negativos, fraccionarios y no seguros con DomainError', () => {
    const casos = [
      { bytesBefore: -1, bytesAfter: 10 },
      { bytesBefore: 10, bytesAfter: -1 },
      { bytesBefore: 1.5, bytesAfter: 1 },
      { bytesBefore: 1, bytesAfter: Number.NaN },
      { bytesBefore: Number.MAX_SAFE_INTEGER + 1, bytesAfter: 1 },
    ];
    for (const caso of casos) {
      expect(() => computeSavings(caso)).toThrowError(DomainError);
    }
    try {
      computeSavings({ bytesBefore: -1, bytesAfter: 1 });
    } catch (error) {
      expect((error as DomainError).code).toBe('INVALID_BYTES');
    }
  });
});
