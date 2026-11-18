/**
 * Errores de la capa de autenticación (F01-T03).
 *
 * Los mensajes son deliberadamente genéricos: no revelan si un correo está
 * registrado, ni rutas internas, ni secretos (NFR-03, PR-08, G-3).
 */

export type AuthErrorCode =
  | 'VALIDATION_ERROR'
  | 'REGISTRATION_FAILED'
  | 'INVALID_CREDENTIALS'
  | 'INVALID_TOKEN'
  | 'TOKEN_EXPIRED'
  | 'UNAUTHORIZED'
  | 'RESOURCE_NOT_FOUND'
  | 'RATE_LIMITED';

export class AuthError extends Error {
  constructor(
    readonly code: AuthErrorCode,
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export const validationError = (): AuthError =>
  new AuthError('VALIDATION_ERROR', 400, 'Datos de entrada no válidos');

export const registrationFailed = (): AuthError =>
  new AuthError('REGISTRATION_FAILED', 409, 'No se pudo completar el registro');

export const invalidCredentials = (): AuthError =>
  new AuthError('INVALID_CREDENTIALS', 401, 'Credenciales no válidas');

export const invalidToken = (): AuthError =>
  new AuthError('INVALID_TOKEN', 401, 'Token no válido');

export const tokenExpired = (): AuthError =>
  new AuthError('TOKEN_EXPIRED', 401, 'Sesión caducada');

export const unauthorized = (): AuthError =>
  new AuthError('UNAUTHORIZED', 401, 'Se requiere autenticación');

export const resourceNotFound = (): AuthError =>
  new AuthError('RESOURCE_NOT_FOUND', 404, 'Recurso no encontrado');

export const rateLimited = (retryAfterSeconds: number): AuthError =>
  new AuthError('RATE_LIMITED', 429, `Demasiadas solicitudes; reintente en ${retryAfterSeconds} s`);
