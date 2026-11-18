/**
 * Servicio de autenticación: registro, login y refresh (FR-01/FR-02/FR-03).
 *
 * Consume los contratos Zod congelados (F01-T01) y el `AppConfig` validado;
 * no define políticas de producto nuevas. El correo se normaliza, la
 * contraseña se hashea antes de persistir y nunca aparece en las respuestas.
 */

import { randomUUID } from 'node:crypto';

import type { AppConfig } from '../config/index';
import {
  schemas,
  type AuthenticatedUser,
  type LoginInput,
  type RegisterInput,
  type RefreshInput,
  type TokenPair,
} from '../contracts/index';
import { invalidCredentials, invalidToken, registrationFailed, validationError } from './errors';
import { normalizeEmail } from './identity';
import { issueTokenPair, verifyToken } from './jwt';
import { hashPassword, verifyPassword } from './password';
import { EmailAlreadyExistsError, type UserRecord, type UserStore } from './user-store';

export interface AuthResult {
  user: AuthenticatedUser;
  tokens: TokenPair;
}

export interface AuthServiceDeps {
  config: AppConfig;
  users: UserStore;
  now?: () => number;
}

export class AuthService {
  private readonly now: () => number;
  private dummyHashPromise: Promise<string> | undefined;

  constructor(private readonly deps: AuthServiceDeps) {
    this.now = deps.now ?? (() => Date.now());
  }

  private toAuthenticatedUser(user: UserRecord): AuthenticatedUser {
    return { userId: user.userId, email: user.email, createdAt: user.createdAt };
  }

  /** Iguala el coste de verificación cuando el correo no existe (anti-enumeración). */
  private async verifyAgainstDummy(password: string): Promise<void> {
    this.dummyHashPromise ??= hashPassword('placeholder-no-es-un-usuario');
    await verifyPassword(password, await this.dummyHashPromise);
  }

  async register(input: RegisterInput): Promise<AuthResult> {
    const parsed = schemas.RegisterInput.safeParse(input);
    if (!parsed.success) throw validationError();

    const passwordHash = await hashPassword(parsed.data.password);
    const user: UserRecord = {
      userId: randomUUID(),
      email: normalizeEmail(parsed.data.email),
      passwordHash,
      createdAt: new Date(this.now()).toISOString(),
    };

    try {
      await this.deps.users.create(user);
    } catch (error) {
      if (error instanceof EmailAlreadyExistsError) throw registrationFailed();
      throw error;
    }

    const publicUser = this.toAuthenticatedUser(user);
    return { user: publicUser, tokens: await issueTokenPair(this.deps.config, publicUser) };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const parsed = schemas.LoginInput.safeParse(input);
    if (!parsed.success) throw validationError();

    const stored = await this.deps.users.findByEmail(normalizeEmail(parsed.data.email));
    if (stored === null) {
      await this.verifyAgainstDummy(parsed.data.password);
      throw invalidCredentials();
    }
    if (!(await verifyPassword(parsed.data.password, stored.passwordHash))) {
      throw invalidCredentials();
    }

    const publicUser = this.toAuthenticatedUser(stored);
    return { user: publicUser, tokens: await issueTokenPair(this.deps.config, publicUser) };
  }

  async refresh(input: RefreshInput): Promise<AuthResult> {
    const parsed = schemas.RefreshInput.safeParse(input);
    if (!parsed.success) throw validationError();

    const verified = await verifyToken(
      parsed.data.refreshToken,
      this.deps.config.jwt.refreshSecret,
      'refresh',
    );
    const stored = await this.deps.users.findById(verified.userId);
    if (stored === null) throw invalidToken();

    const publicUser = this.toAuthenticatedUser(stored);
    return { user: publicUser, tokens: await issueTokenPair(this.deps.config, publicUser) };
  }
}
