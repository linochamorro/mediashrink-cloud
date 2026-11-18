import { describe, expect, it } from 'vitest';

import { hashPassword, verifyPassword } from '../../../backend/src/auth/password';

const PASSWORD = 'Segura1234';

describe('hash de contraseñas — scrypt (A-02, IN-05)', () => {
  it('produce un hash con el formato scrypt$y$r$p$salt$digest y nunca el claro', async () => {
    const encoded = await hashPassword(PASSWORD);

    expect(encoded).toMatch(/^scrypt\$16384\$8\$1\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
    expect(encoded).not.toContain(PASSWORD);
  });

  it('verifica la contraseña correcta y rechaza una incorrecta', async () => {
    const encoded = await hashPassword(PASSWORD);

    expect(await verifyPassword(PASSWORD, encoded)).toBe(true);
    expect(await verifyPassword('Segura12345', encoded)).toBe(false);
  });

  it('usa una sal aleatoria: dos hashes del mismo password difieren', async () => {
    const first = await hashPassword(PASSWORD);
    const second = await hashPassword(PASSWORD);

    expect(first).not.toBe(second);
  });

  it('rechaza un digest manipulado sin lanzar', async () => {
    const encoded = await hashPassword(PASSWORD);
    const last = encoded.at(-1) === 'a' ? 'b' : 'a';
    const tampered = encoded.slice(0, -1) + last;

    await expect(verifyPassword(PASSWORD, tampered)).resolves.toBe(false);
  });

  it('rechaza un formato que no es scrypt sin lanzar', async () => {
    await expect(verifyPassword(PASSWORD, 'claro:Segura1234')).resolves.toBe(false);
    await expect(verifyPassword(PASSWORD, '')).resolves.toBe(false);
  });

  it('rechaza parámetros scrypt manipulados (coste reducido) sin lanzar', async () => {
    const encoded = await hashPassword(PASSWORD);
    const parts = encoded.split('$');
    parts[1] = '1';
    parts[2] = '1';
    parts[3] = '1';

    await expect(verifyPassword(PASSWORD, parts.join('$'))).resolves.toBe(false);
  });
});
