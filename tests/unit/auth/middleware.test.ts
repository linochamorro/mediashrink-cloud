import { describe, expect, it } from 'vitest';

import { assertOwnership } from '../../../backend/src/auth/middleware';

describe('aislamiento por userId (FR-21, PR-07, spec §6)', () => {
  it('permite el acceso al recurso propio', () => {
    expect(() => assertOwnership('user_a', 'user_a')).not.toThrow();
  });

  it('rechaza el recurso ajeno con 404 sin filtrar su existencia', () => {
    let captured: unknown;
    try {
      assertOwnership('user_a', 'user_b');
    } catch (error) {
      captured = error;
    }

    expect(captured).toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
      status: 404,
      message: 'Recurso no encontrado',
    });
  });

  it('el mensaje de error no incluye los identificadores', () => {
    let message = '';
    try {
      assertOwnership('user_secreto_a', 'user_secreto_b');
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).not.toContain('user_secreto_a');
    expect(message).not.toContain('user_secreto_b');
  });
});
