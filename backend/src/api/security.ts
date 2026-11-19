/**
 * Hardening defensivo de la API HTTP (F05-H01, Bloque 2).
 *
 * - `securityHeaders`: cabeceras globales `X-Content-Type-Options: nosniff`,
 *   `X-Frame-Options: DENY` y `Referrer-Policy: no-referrer`. Se aplican
 *   DESPUÉS de `next()` mutando `c.res`, porque los handlers de error
 *   devuelven `new Response(...)` directos y las cabeceras preparadas antes
 *   de `next()` no se fusionarían en ellos.
 * - `jsonBodyLimit`: rechaza bodies de petición mayores de 1 MiB con
 *   `413 { error: { code: 'PAYLOAD_TOO_LARGE' } }` antes de que lleguen a
 *   `c.req.json()`. 1 MiB cubre con holgura el mayor body legítimo
 *   (`POST /jobs` con 20 archivos: unos pocos KB).
 */

import type { MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';

/** Tope de body JSON: 1 MiB. Sin variable de entorno: es un techo de red, no un límite de producto. */
export const MAX_JSON_BODY_BYTES = 1_048_576;

const HEADERS: Readonly<Record<string, string>> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
};

export const securityHeaders: MiddlewareHandler = async (c, next) => {
  await next();
  for (const [name, value] of Object.entries(HEADERS)) {
    c.res.headers.set(name, value);
  }
};

export const jsonBodyLimit: MiddlewareHandler = bodyLimit({
  maxSize: MAX_JSON_BODY_BYTES,
  onError: (c) =>
    c.json(
      {
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: 'Cuerpo de la petición demasiado grande',
        },
      },
      413,
    ),
});
