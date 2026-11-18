/**
 * Fixture HTTP para auth: app Hono aislada, store en memoria y reloj controlado
 * para el limitador. Sin Docker, sin emulador y sin secretos reales (G-3).
 */

import { Hono } from 'hono';

import { loadConfig, type AppConfig } from '../../../backend/src/config/index';
import { FixedWindowRateLimiter } from '../../../backend/src/auth/rate-limit';
import { assertOwnership, authErrorResponse, requireAuth } from '../../../backend/src/auth/middleware';
import { mountAuthRoutes } from '../../../backend/src/auth/routes';
import { AuthService } from '../../../backend/src/auth/service';
import { InMemoryUserStore } from '../../../backend/src/auth/user-store';

export function authTestEnv(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    NODE_ENV: 'test',
    JWT_ACCESS_SECRET: 'REPLACE_WITH_LOCAL_TEST_ACCESS_SECRET',
    JWT_REFRESH_SECRET: 'REPLACE_WITH_LOCAL_TEST_REFRESH_SECRET',
    JWT_ACCESS_TTL: '900',
    JWT_REFRESH_TTL: '604800',
    RATE_LIMIT_AUTH_MAX: '100',
    RATE_LIMIT_AUTH_WINDOW_MS: '60000',
    AWS_ENDPOINT_URL: 'https://127.0.0.1:9297',
    S3_BUCKET_RAW: 'mediashrink-raw-local',
    S3_BUCKET_OPTIMIZED: 'mediashrink-optimized-local',
    SQS_QUEUE_URL: 'https://sqs.us-east-1.amazonaws.com/000000000000/mediashrink-jobs',
    SQS_DLQ_URL: 'https://sqs.us-east-1.amazonaws.com/000000000000/mediashrink-jobs-dlq',
    DYNAMODB_TABLE_JOBS: 'mediashrink-jobs',
    ...overrides,
  };
}

export interface AuthTestApp {
  app: Hono;
  config: AppConfig;
  users: InMemoryUserStore;
  service: AuthService;
  limiter: FixedWindowRateLimiter;
  setLimiterNow(value: number): void;
}

export function createAuthTestApp(overrides: Record<string, string> = {}): AuthTestApp {
  const config = loadConfig(authTestEnv(overrides));
  const users = new InMemoryUserStore();
  let limiterNow = Date.now();
  const limiter = new FixedWindowRateLimiter(
    config.rateLimit.authMax,
    config.rateLimit.authWindowMs,
    () => limiterNow,
  );
  const service = new AuthService({ config, users });

  const app = new Hono();
  mountAuthRoutes(app, { config, users, service, limiter });

  // Recurso de prueba efímero: demuestra 401/404 sin implementar rutas /jobs (F02).
  app.get('/private/resources/:userId', requireAuth({ config, users }), (c) => {
    try {
      assertOwnership(c.get('userId'), c.req.param('userId') ?? '');
      return c.json({ userId: c.get('userId'), email: c.get('userEmail') });
    } catch (error) {
      return authErrorResponse(error);
    }
  });

  return {
    app,
    config,
    users,
    service,
    limiter,
    setLimiterNow: (value: number) => {
      limiterNow = value;
    },
  };
}

export function postJson(app: Hono, path: string, body: unknown, token?: string): Promise<Response> | Response {
  return app.request(path, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify(body),
  });
}

export function getWithToken(app: Hono, path: string, token?: string): Promise<Response> | Response {
  return app.request(path, {
    headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
  });
}
