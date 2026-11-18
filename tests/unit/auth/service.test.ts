import { sign } from 'hono/jwt';
import { describe, expect, it } from 'vitest';

import { loadConfig } from '../../../backend/src/config/index';
import { AuthError } from '../../../backend/src/auth/errors';
import { verifyToken } from '../../../backend/src/auth/jwt';
import { verifyPassword } from '../../../backend/src/auth/password';
import { AuthService } from '../../../backend/src/auth/service';
import { InMemoryUserStore } from '../../../backend/src/auth/user-store';
import { authTestEnv } from './fixtures';

const config = loadConfig(authTestEnv());
const credentials = { email: 'demo@example.com', password: 'Segura1234' };

function makeService(): { service: AuthService; users: InMemoryUserStore } {
  const users = new InMemoryUserStore();
  return { service: new AuthService({ config, users }), users };
}

describe('AuthService — registro, login y refresh (FR-01/FR-02/FR-03)', () => {
  it('registra un usuario hasheado y devuelve un par de tokens sin exponer el hash', async () => {
    const { service, users } = makeService();
    const result = await service.register(credentials);

    expect(result.user).toMatchObject({ email: credentials.email });
    expect(result.user).toHaveProperty('userId');
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result.tokens.tokenType).toBe('Bearer');

    const stored = await users.findByEmail(credentials.email);
    expect(stored?.passwordHash).toBeDefined();
    expect(stored?.passwordHash).not.toContain(credentials.password);
    expect(await verifyPassword(credentials.password, stored!.passwordHash)).toBe(true);
  });

  it('rechaza un registro duplicado con 409 y mensaje genérico', async () => {
    const { service } = makeService();
    await service.register(credentials);

    await expect(service.register(credentials)).rejects.toMatchObject({
      code: 'REGISTRATION_FAILED',
      status: 409,
      message: 'No se pudo completar el registro',
    });
  });

  it.each([
    ['corta', 'a'.repeat(7)],
    ['larga', 'a'.repeat(129)],
  ])('rechaza una contraseña %s fuera de 8–128 caracteres', async (_label, password) => {
    const { service } = makeService();

    await expect(service.register({ email: credentials.email, password })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 400,
    });
  });

  it('rechaza un correo sin formato', async () => {
    const { service } = makeService();

    await expect(service.register({ email: 'correo-invalido', password: credentials.password })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 400,
    });
  });

  it('hace login con credenciales correctas', async () => {
    const { service } = makeService();
    await service.register(credentials);

    const result = await service.login(credentials);

    expect(result.user.email).toBe(credentials.email);
    expect(result.tokens.accessToken.split('.')).toHaveLength(3);
  });

  it('devuelve el mismo error para correo desconocido y contraseña incorrecta', async () => {
    const { service } = makeService();
    await service.register(credentials);

    const unknownEmail = await service.login({ email: 'otra@example.com', password: credentials.password }).catch((e: unknown) => e);
    const wrongPassword = await service.login({ email: credentials.email, password: 'Incorrecta123' }).catch((e: unknown) => e);

    expect(unknownEmail).toBeInstanceOf(AuthError);
    expect(wrongPassword).toBeInstanceOf(AuthError);
    expect(unknownEmail).toMatchObject({
      code: 'INVALID_CREDENTIALS',
      status: 401,
      message: 'Credenciales no válidas',
    });
    expect(wrongPassword).toEqual(unknownEmail);
  });

  it('rechaza refresh inválido y un access token usado como refresh', async () => {
    const { service } = makeService();
    const registered = await service.register(credentials);

    await expect(service.refresh({ refreshToken: 'token.falso' })).rejects.toMatchObject({
      code: 'INVALID_TOKEN',
      status: 401,
    });
    await expect(service.refresh({ refreshToken: registered.tokens.accessToken })).rejects.toMatchObject({
      code: 'INVALID_TOKEN',
      status: 401,
    });
  });

  it('rechaza un refresh expirado con TOKEN_EXPIRED', async () => {
    const { service } = makeService();
    const now = Math.floor(Date.now() / 1000);
    const expired = await sign(
      { sub: 'user_local_001', email: credentials.email, typ: 'refresh', iat: now - 100, exp: now - 10 },
      config.jwt.refreshSecret,
      'HS256',
    );

    await expect(service.refresh({ refreshToken: expired })).rejects.toMatchObject({
      code: 'TOKEN_EXPIRED',
      status: 401,
    });
  });

  it('renueva la sesión emitiendo un nuevo access token del mismo usuario', async () => {
    const { service } = makeService();
    const registered = await service.register(credentials);

    const renewed = await service.refresh({ refreshToken: registered.tokens.refreshToken });
    const verified = await verifyToken(renewed.tokens.accessToken, config.jwt.accessSecret, 'access');

    expect(verified.userId).toBe(registered.user.userId);
    expect(renewed.user.email).toBe(credentials.email);
    expect(renewed.tokens.tokenType).toBe('Bearer');
  });
});
