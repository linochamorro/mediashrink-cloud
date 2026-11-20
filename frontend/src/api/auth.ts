import type { AuthenticatedUser, LoginInput, RegisterInput, TokenPair } from './types.generated';

export type AuthSession = TokenPair & { user: AuthenticatedUser };
type Fetcher = typeof fetch;

export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); this.name = 'ApiError'; }
}

export function serializeStoredRefreshToken(session: Pick<AuthSession, 'refreshToken'>): string {
  return JSON.stringify({ refreshToken: session.refreshToken });
}

async function request<T>(fetcher: Fetcher, url: string, body: unknown): Promise<T> {
  const response = await fetcher(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.ok) {
    let message = 'No se pudo completar la solicitud. Inténtalo de nuevo.';
    try {
      const payload = await response.json() as { error?: { code?: unknown } };
      const code = payload.error?.code;
      const publicMessages: Record<string, string> = {
        VALIDATION_ERROR: 'Revisa el correo y la contraseña e inténtalo de nuevo.',
        INVALID_CREDENTIALS: 'El correo o la contraseña no son correctos.',
        EMAIL_ALREADY_EXISTS: 'Ya existe una cuenta con ese correo.',
        REGISTRATION_FAILED: 'No se pudo completar el registro. Revisa tus datos o inicia sesión si ya tienes cuenta.',
        INVALID_TOKEN: 'Tu sesión no es válida. Inicia sesión otra vez.',
        TOKEN_EXPIRED: 'Tu sesión ha caducado. Inicia sesión otra vez.',
        UNAUTHORIZED: 'Tu sesión no es válida. Inicia sesión otra vez.',
        RATE_LIMITED: 'Has realizado demasiados intentos. Espera un momento e inténtalo de nuevo.',
      };
      if (typeof code === 'string' && publicMessages[code]) message = publicMessages[code];
    } catch { /* respuesta vacía o no JSON: usar texto seguro */ }
    throw new ApiError(message, response.status);
  }
  return response.json() as Promise<T>;
}

export function createAuthClient(baseUrl = '', fetcher: Fetcher = fetch) {
  const post = <T>(path: string, body: unknown) => request<T>(fetcher, `${baseUrl}${path}`, body);
  return {
    register: (input: RegisterInput) => post<AuthSession>('/auth/register', input),
    login: (input: LoginInput) => post<AuthSession>('/auth/login', input),
    refresh: (refreshToken: string) => post<AuthSession>('/auth/refresh', { refreshToken }),
  };
}
