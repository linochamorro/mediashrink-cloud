/**
 * Rutas Hono de autenticación: `/auth/register`, `/auth/login`, `/auth/refresh`
 * (FR-01/FR-02/FR-03). No implementa rutas `/jobs` (F02).
 */

import { Hono, type Context } from 'hono';

import type { AppConfig } from '../config/index';
import type { LoginInput, RegisterInput, RefreshInput } from '../contracts/index';
import { rateLimited, validationError } from './errors';
import { authErrorResponse } from './middleware';
import type { FixedWindowRateLimiter } from './rate-limit';
import type { AuthService } from './service';
import type { UserStore } from './user-store';

export interface AuthRoutesDeps {
  config: AppConfig;
  users: UserStore;
  service: AuthService;
  limiter: FixedWindowRateLimiter;
}

/** Clave del limitador: cabecera de proxy o marcador local (sin secretos). */
function clientKey(c: Context): string {
  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded !== undefined && forwarded.trim() !== '') {
    return forwarded.split(',')[0].trim();
  }
  return c.req.header('x-real-ip') ?? 'local';
}

function rateLimitResponse(deps: AuthRoutesDeps, c: Context): Response | null {
  const decision = deps.limiter.check(clientKey(c));
  if (decision.allowed) return null;
  return authErrorResponse(rateLimited(decision.retryAfterSeconds), {
    'Retry-After': String(decision.retryAfterSeconds),
  });
}

async function readJson(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    throw validationError();
  }
}

/** Aplica el mismo límite y la misma política de errores a las tres rutas. */
async function guarded(
  deps: AuthRoutesDeps,
  c: Context,
  action: () => Promise<Response>,
): Promise<Response> {
  const limited = rateLimitResponse(deps, c);
  if (limited !== null) return limited;
  try {
    return await action();
  } catch (error) {
    return authErrorResponse(error);
  }
}

export function createAuthRouter(deps: AuthRoutesDeps): Hono {
  const router = new Hono();

  router.post('/register', (c) =>
    guarded(deps, c, async () => {
      const result = await deps.service.register((await readJson(c)) as RegisterInput);
      return c.json({ user: result.user, ...result.tokens }, 201);
    }),
  );

  router.post('/login', (c) =>
    guarded(deps, c, async () => {
      const result = await deps.service.login((await readJson(c)) as LoginInput);
      return c.json({ user: result.user, ...result.tokens });
    }),
  );

  router.post('/refresh', (c) =>
    guarded(deps, c, async () => {
      const result = await deps.service.refresh((await readJson(c)) as RefreshInput);
      return c.json({ user: result.user, ...result.tokens });
    }),
  );

  return router;
}

export function mountAuthRoutes(app: Hono, deps: AuthRoutesDeps): Hono {
  app.route('/auth', createAuthRouter(deps));
  return app;
}
