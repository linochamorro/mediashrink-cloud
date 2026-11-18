/**
 * Emisión y verificación de JWT HS256 con `hono/jwt` (IN-05, FR-02/FR-03).
 *
 * Los secretos y TTLs llegan desde `loadConfig()`. La verificación fija el
 * algoritmo HS256 y comprueba de forma explícita firma, `exp`, `iat`, `typ`
 * y `sub`; cualquier fallo se traduce a un `AuthError` sin detalles internos.
 */

import { randomUUID } from 'node:crypto';

import { sign, verify } from 'hono/jwt';

import type { AppConfig } from '../config/index';
import type { AuthenticatedUser, TokenPair } from '../contracts/index';
import { invalidToken, tokenExpired } from './errors';

export type TokenKind = 'access' | 'refresh';

export interface VerifiedToken {
  userId: string;
  email: string;
  kind: TokenKind;
}

type Claims = Record<string, unknown>;

export async function issueTokenPair(
  config: AppConfig,
  user: AuthenticatedUser,
): Promise<TokenPair> {
  const issuedAt = Math.floor(Date.now() / 1000);
  const common = { sub: user.userId, email: user.email, iat: issuedAt };

  const accessToken = await sign(
    {
      ...common,
      typ: 'access',
      jti: randomUUID(),
      exp: issuedAt + config.jwt.accessTtlSeconds,
    },
    config.jwt.accessSecret,
    'HS256',
  );
  const refreshToken = await sign(
    {
      ...common,
      typ: 'refresh',
      jti: randomUUID(),
      exp: issuedAt + config.jwt.refreshTtlSeconds,
    },
    config.jwt.refreshSecret,
    'HS256',
  );

  return {
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: config.jwt.accessTtlSeconds,
  };
}

export async function verifyToken(
  token: string,
  secret: string,
  expectedKind: TokenKind,
): Promise<VerifiedToken> {
  let claims: Claims;
  try {
    // `exp` e `iat` se validan aquí de forma explícita para distinguir
    // "caducado" de "manipulado" sin depender de los errores de la librería.
    claims = await verify(token, secret, { alg: 'HS256', exp: false, iat: false });
  } catch {
    throw invalidToken();
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = claims.exp;
  const issuedAt = claims.iat;
  if (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt)) throw invalidToken();
  if (expiresAt <= now) throw tokenExpired();
  if (typeof issuedAt !== 'number' || !Number.isFinite(issuedAt) || issuedAt > now) {
    throw invalidToken();
  }
  if (claims.typ !== expectedKind) throw invalidToken();

  const userId = claims.sub;
  const email = claims.email;
  if (typeof userId !== 'string' || userId.length === 0) throw invalidToken();
  if (typeof email !== 'string' || email.length === 0) throw invalidToken();

  return { userId, email, kind: expectedKind };
}
