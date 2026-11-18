import { describe, expect, it } from 'vitest';

import { FixedWindowRateLimiter } from '../../../backend/src/auth/rate-limit';

describe('rate limiting configurable (A-06)', () => {
  it('permite hasta max y bloquea la siguiente petición en la misma ventana', () => {
    const now = 0;
    const limiter = new FixedWindowRateLimiter(2, 1000, () => now);

    expect(limiter.check('ip-a')).toMatchObject({ allowed: true, remaining: 1 });
    expect(limiter.check('ip-a')).toMatchObject({ allowed: true, remaining: 0 });
    expect(limiter.check('ip-a')).toMatchObject({ allowed: false, remaining: 0 });
  });

  it('renueva el cupo al cambiar de ventana y mantiene claves independientes', () => {
    let now = 0;
    const limiter = new FixedWindowRateLimiter(1, 1000, () => now);

    expect(limiter.check('ip-a').allowed).toBe(true);
    expect(limiter.check('ip-a').allowed).toBe(false);
    expect(limiter.check('ip-b').allowed).toBe(true);

    now = 1000;
    expect(limiter.check('ip-a').allowed).toBe(true);
  });

  it('expone un retryAfterSeconds positivo y no mayor que la ventana', () => {
    const now = 250;
    const limiter = new FixedWindowRateLimiter(1, 1000, () => now);

    limiter.check('ip-a');
    const denied = limiter.check('ip-a');

    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterSeconds).toBeGreaterThan(0);
    expect(denied.retryAfterSeconds).toBeLessThanOrEqual(1);
  });

  it('respeta el valor de max proveniente de configuración', () => {
    const now = 0;
    const limiter = new FixedWindowRateLimiter(5, 60_000, () => now);

    for (let i = 0; i < 5; i += 1) expect(limiter.check('ip-a').allowed).toBe(true);
    expect(limiter.check('ip-a').allowed).toBe(false);
  });

  it('reset limpia el estado acumulado', () => {
    const now = 0;
    const limiter = new FixedWindowRateLimiter(1, 1000, () => now);

    limiter.check('ip-a');
    expect(limiter.check('ip-a').allowed).toBe(false);

    limiter.reset();
    expect(limiter.check('ip-a').allowed).toBe(true);
  });
});
