import { sign } from 'hono/jwt';
import { describe, expect, it } from 'vitest';

import { loadConfig } from '../../../backend/src/config/index';
import { issueTokenPair, verifyToken } from '../../../backend/src/auth/jwt';
import { AuthError } from '../../../backend/src/auth/errors';
import { authTestEnv, LOCAL_USER } from './fixtures';

const config = loadConfig(authTestEnv());

describe('JWT HS256 propio (IN-05, FR-02/FR-03)', () => {
  it('emite un par Bearer con expiresIn igual al TTL de access de la configuración', async () => {
    const pair = await issueTokenPair(config, LOCAL_USER);

    expect(pair.tokenType).toBe('Bearer');
    expect(pair.expiresIn).toBe(config.jwt.accessTtlSeconds);
    expect(pair.accessToken.split('.')).toHaveLength(3);
    expect(pair.refreshToken.split('.')).toHaveLength(3);
    expect(pair.accessToken).not.toBe(pair.refreshToken);
  });

  it('verifica el access token, expone userId y distingue access de refresh', async () => {
    const pair = await issueTokenPair(config, LOCAL_USER);
    const access = await verifyToken(pair.accessToken, config.jwt.accessSecret, 'access');
    const refresh = await verifyToken(pair.refreshToken, config.jwt.refreshSecret, 'refresh');

    expect(access).toMatchObject({ userId: LOCAL_USER.userId, email: LOCAL_USER.email, kind: 'access' });
    expect(refresh).toMatchObject({ userId: LOCAL_USER.userId, kind: 'refresh' });
  });

  it('rechaza un access token cuando se espera refresh y viceversa', async () => {
    const pair = await issueTokenPair(config, LOCAL_USER);

    await expect(verifyToken(pair.accessToken, config.jwt.refreshSecret, 'refresh')).rejects.toBeInstanceOf(AuthError);
    await expect(verifyToken(pair.refreshToken, config.jwt.accessSecret, 'access')).rejects.toBeInstanceOf(AuthError);
  });

  it('rechaza un token firmado con otro secreto', async () => {
    const pair = await issueTokenPair(config, LOCAL_USER);

    await expect(
      verifyToken(pair.accessToken, 'REPLACE_WITH_A_DIFFERENT_TEST_SECRET', 'access'),
    ).rejects.toBeInstanceOf(AuthError);
  });

  it('rechaza un token manipulado (firma alterada)', async () => {
    const pair = await issueTokenPair(config, LOCAL_USER);
    const parts = pair.accessToken.split('.');
    parts[2] = (parts[2].at(0) === 'a' ? 'b' : 'a') + parts[2].slice(1);

    await expect(verifyToken(parts.join('.'), config.jwt.accessSecret, 'access')).rejects.toBeInstanceOf(AuthError);
  });

  it('rechaza un token expirado firmado con el secreto correcto', async () => {
    const now = Math.floor(Date.now() / 1000);
    const expired = await sign(
      {
        sub: LOCAL_USER.userId,
        email: LOCAL_USER.email,
        typ: 'access',
        iat: now - 100,
        exp: now - 10,
      },
      config.jwt.accessSecret,
      'HS256',
    );

    await expect(verifyToken(expired, config.jwt.accessSecret, 'access')).rejects.toMatchObject({
      code: 'TOKEN_EXPIRED',
      status: 401,
    });
  });

  it('rechaza tokens sin sub o sin typ y cadenas que no son JWT', async () => {
    const now = Math.floor(Date.now() / 1000);
    const withoutSub = await sign(
      { email: LOCAL_USER.email, typ: 'access', iat: now, exp: now + 60 },
      config.jwt.accessSecret,
      'HS256',
    );
    const withoutTyp = await sign(
      { sub: LOCAL_USER.userId, email: LOCAL_USER.email, iat: now, exp: now + 60 },
      config.jwt.accessSecret,
      'HS256',
    );

    await expect(verifyToken(withoutSub, config.jwt.accessSecret, 'access')).rejects.toBeInstanceOf(AuthError);
    await expect(verifyToken(withoutTyp, config.jwt.accessSecret, 'access')).rejects.toBeInstanceOf(AuthError);
    await expect(verifyToken('no.es.un.jwt', config.jwt.accessSecret, 'access')).rejects.toBeInstanceOf(AuthError);
  });
});
