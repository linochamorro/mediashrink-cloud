/**
 * Rate limiting no suplantable en la capa API (cierra T03-A-01).
 *
 * `mountAuthRoutes` de F01 construye su clave con `x-forwarded-for`/`x-real-ip`.
 * Sin modificar ese módulo congelado, la API inyecta un limitador que ignora
 * esa clave y usa un principal fijado por el servidor con `AsyncLocalStorage`.
 */

import { AsyncLocalStorage } from 'node:async_hooks';

import { FixedWindowRateLimiter, type RateLimitDecision } from '../auth/rate-limit';

const principalStore = new AsyncLocalStorage<string>();

export const ANONYMOUS_PRINCIPAL = 'auth:anonimo';

/** Fija el principal de la petición; el contexto se propaga a los handlers. */
export function withPrincipal<T>(principal: string, run: () => T): T {
  return principalStore.run(principal, run);
}

/**
 * Sustituye al limitador de `AuthRoutesDeps`: el argumento que le pasa F01
 * (derivado de cabeceras controlables) se descarta. La clave real es el
 * principal de servidor, o un valor anónimo si no hay middleware aplicado
 * (fail-closed: nunca se usa la cabecera).
 */
export class NonSpoofableAuthLimiter extends FixedWindowRateLimiter {
  constructor(max: number, windowMs: number, now: () => number = Date.now) {
    super(max, windowMs, now);
  }

  override check(_keyFromHeaders: string): RateLimitDecision {
    return super.check(principalStore.getStore() ?? ANONYMOUS_PRINCIPAL);
  }
}
