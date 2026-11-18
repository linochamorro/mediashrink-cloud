import { describe, expect, it } from 'vitest';

import type { JobStatus } from '../../../backend/src/contracts/index';
import { DomainError } from '../../../backend/src/domain/guards';
import {
  checkTransition,
  nextStatus,
  resolveBatchStatus,
  type ImageOutcomeSummary,
} from '../../../backend/src/domain/stateMachine';

const TERMINALES: readonly JobStatus[] = ['COMPLETED', 'PARTIAL', 'FAILED'];

describe('máquina de estados — transiciones válidas', () => {
  it('permite PENDING → PROCESSING → COMPLETED sin imágenes fallidas', () => {
    expect(checkTransition('PENDING', 'PROCESSING')).toEqual({ ok: true });
    expect(checkTransition('PROCESSING', 'COMPLETED', { completed: 3, failed: 0 })).toEqual({
      ok: true,
    });
    expect(nextStatus('PENDING', 'PROCESSING')).toBe('PROCESSING');
  });

  it('permite fallos parciales: PROCESSING → PARTIAL con imagen FAILED', () => {
    const resumen: ImageOutcomeSummary = { completed: 2, failed: 1 };
    expect(checkTransition('PROCESSING', 'PARTIAL', resumen)).toEqual({ ok: true });
    expect(nextStatus('PROCESSING', 'PARTIAL', resumen)).toBe('PARTIAL');
  });

  it('permite fallo total: PROCESSING → FAILED y PENDING → FAILED', () => {
    expect(checkTransition('PROCESSING', 'FAILED', { completed: 0, failed: 3 })).toEqual({
      ok: true,
    });
    expect(checkTransition('PENDING', 'FAILED')).toEqual({ ok: true });
  });
});

describe('máquina de estados — transiciones inválidas rechazadas', () => {
  it('rechaza saltos que omiten PROCESSING', () => {
    expect(checkTransition('PENDING', 'COMPLETED')).toMatchObject({
      ok: false,
      reason: 'INVALID_TRANSITION',
    });
    expect(checkTransition('PENDING', 'PARTIAL')).toMatchObject({
      ok: false,
      reason: 'INVALID_TRANSITION',
    });
  });

  it('rechaza retrocesos y auto-transiciones', () => {
    expect(checkTransition('PROCESSING', 'PENDING')).toMatchObject({
      ok: false,
      reason: 'INVALID_TRANSITION',
    });
    expect(checkTransition('PENDING', 'PENDING')).toMatchObject({
      ok: false,
      reason: 'INVALID_TRANSITION',
    });
    expect(checkTransition('PROCESSING', 'PROCESSING')).toMatchObject({
      ok: false,
      reason: 'INVALID_TRANSITION',
    });
  });

  it('rechaza cualquier salida desde estados terminales', () => {
    for (const estado of TERMINALES) {
      for (const destino of ['PENDING', 'PROCESSING', ...TERMINALES] as const) {
        expect(checkTransition(estado, destino)).toMatchObject({
          ok: false,
          reason: 'INVALID_TRANSITION',
        });
      }
    }
  });

  it('nextStatus lanza DomainError en una transición inválida', () => {
    try {
      nextStatus('COMPLETED', 'PROCESSING');
      throw new Error('debió lanzar');
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).code).toBe('INVALID_TRANSITION');
    }
  });
});

describe('máquina de estados — coherencia con imágenes FAILED', () => {
  it('no permite COMPLETED si alguna imagen falló', () => {
    expect(
      checkTransition('PROCESSING', 'COMPLETED', { completed: 2, failed: 1 }),
    ).toMatchObject({ ok: false, reason: 'COMPLETED_REJECTS_FAILED_IMAGES' });
  });

  it('exige al menos un COMPLETED y un FAILED para PARTIAL', () => {
    expect(checkTransition('PROCESSING', 'PARTIAL', { completed: 0, failed: 1 })).toMatchObject({
      ok: false,
      reason: 'PARTIAL_REQUIRES_BOTH_OUTCOMES',
    });
    expect(checkTransition('PROCESSING', 'PARTIAL', { completed: 1, failed: 0 })).toMatchObject({
      ok: false,
      reason: 'PARTIAL_REQUIRES_BOTH_OUTCOMES',
    });
  });

  it('no permite FAILED si alguna imagen se completó', () => {
    expect(
      checkTransition('PROCESSING', 'FAILED', { completed: 1, failed: 2 }),
    ).toMatchObject({ ok: false, reason: 'FAILED_REJECTS_COMPLETED_IMAGES' });
  });

  it('omite la coherencia de imágenes cuando no se aporta resumen', () => {
    expect(checkTransition('PROCESSING', 'COMPLETED')).toEqual({ ok: true });
    expect(checkTransition('PROCESSING', 'PARTIAL')).toEqual({ ok: true });
    expect(checkTransition('PROCESSING', 'FAILED')).toEqual({ ok: true });
  });

  it('resolveBatchStatus deriva COMPLETED, PARTIAL o FAILED del resumen', () => {
    expect(resolveBatchStatus({ completed: 3, failed: 0 })).toBe('COMPLETED');
    expect(resolveBatchStatus({ completed: 2, failed: 1 })).toBe('PARTIAL');
    expect(resolveBatchStatus({ completed: 0, failed: 2 })).toBe('FAILED');
    expect(resolveBatchStatus({ completed: 0, failed: 0 })).toBe('FAILED');
  });

  it('flujo completo: PROCESSING + resumen mixto → PARTIAL', () => {
    const resumen = { completed: 4, failed: 1 };
    let estado: JobStatus = 'PENDING';
    estado = nextStatus(estado, 'PROCESSING');
    estado = nextStatus(estado, resolveBatchStatus(resumen), resumen);
    expect(estado).toBe('PARTIAL');
  });
});
