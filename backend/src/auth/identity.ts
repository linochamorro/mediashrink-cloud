/** Normalización canónica del correo: una sola regla para servicio y almacén. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
