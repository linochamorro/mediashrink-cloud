/**
 * Rate limiting por ventana fija, parametrizado desde la configuración (A-06).
 * El reloj es inyectable para que las pruebas usen umbrales bajos sin dormir.
 */

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

interface Bucket {
  windowStart: number;
  count: number;
}

export class FixedWindowRateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    readonly max: number,
    readonly windowMs: number,
    readonly now: () => number = Date.now,
  ) {
    if (!Number.isInteger(max) || max < 1) throw new Error('rate limit max debe ser >= 1');
    if (!Number.isInteger(windowMs) || windowMs < 1) throw new Error('rate limit window debe ser >= 1 ms');
  }

  check(key: string): RateLimitDecision {
    const now = this.now();
    const windowStart = Math.floor(now / this.windowMs) * this.windowMs;
    const current = this.buckets.get(key);
    const bucket: Bucket =
      current !== undefined && current.windowStart === windowStart
        ? current
        : { windowStart, count: 0 };

    if (bucket.count >= this.max) {
      this.buckets.set(key, bucket);
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((windowStart + this.windowMs - now) / 1000)),
      };
    }

    bucket.count += 1;
    this.buckets.set(key, bucket);
    return { allowed: true, remaining: this.max - bucket.count, retryAfterSeconds: 0 };
  }

  reset(): void {
    this.buckets.clear();
  }
}
