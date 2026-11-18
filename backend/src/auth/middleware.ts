/**
 * Middleware de autenticación y aislamiento (D-06, D-07, FR-21, spec §6).
 *
 * Sin token → 401. Recurso de otro usuario → 404 con el mismo mensaje que un
 * recurso inexistente: la respuesta no revela si el recurso ajeno existe.
 */

import type { MiddlewareHandler } from 'hono';

import type { AppConfig } from '../config/index';
import { AuthError, invalidToken, resourceNotFound, unauthorized } from './errors';
import { verifyToken } from './jwt';
import type { UserStore } from './user-store';

declare module 'hono' {
  interface ContextVariableMap {
    userId: string;
    userEmail: string;
  }
}

export interface AuthMiddlewareDeps {
  config: AppConfig;
  users: UserStore;
}

/** Serializa errores de auth sin filtrar rutas internas, secretos ni stacks. */
export function authErrorResponse(error: unknown, extraHeaders?: Record<string, string>): Response {
  const authError = error instanceof AuthError ? error : null;
  return new Response(
    JSON.stringify({
      error: {
        code: authError?.code ?? 'INTERNAL_ERROR',
        message: authError?.message ?? 'Error interno',
      },
    }),
    {
      status: authError?.status ?? 500,
      headers: {
        'content-type': 'application/json; charset=UTF-8',
        ...extraHeaders,
      },
    },
  );
}

export function requireAuth(deps: AuthMiddlewareDeps): MiddlewareHandler {
  return async (c, next) => {
    try {
      const header = c.req.header('authorization');
      if (header === undefined) throw unauthorized();

      const parts = header.trim().split(/\s+/);
      if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') throw unauthorized();

      const verified = await verifyToken(parts[1], deps.config.jwt.accessSecret, 'access');
      if ((await deps.users.findById(verified.userId)) === null) throw invalidToken();

      c.set('userId', verified.userId);
      c.set('userEmail', verified.email);
      await next();
    } catch (error) {
      // Fail-closed: cualquier fallo inesperado se trata como no autenticado.
      return authErrorResponse(error instanceof AuthError ? error : unauthorized());
    }
  };
}

export function assertOwnership(currentUserId: string, resourceUserId: string): void {
  if (currentUserId !== resourceUserId) throw resourceNotFound();
}

export function requireOwnershipParam(paramName = 'userId'): MiddlewareHandler {
  return async (c, next) => {
    try {
      assertOwnership(c.get('userId'), c.req.param(paramName) ?? '');
      await next();
    } catch (error) {
      return authErrorResponse(error instanceof AuthError ? error : resourceNotFound());
    }
  };
}
