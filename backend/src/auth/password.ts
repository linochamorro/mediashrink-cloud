/**
 * Hash de contraseñas con `scrypt` nativo (A-02, IN-05).
 *
 * Formato autocontenido: `scrypt$N$r$p$saltHex$digestHex`. El coste queda
 * fijado por el código (no por el dato): un digest manipulado para reducir
 * parámetros se rechaza. Nunca se almacena ni se registra la contraseña.
 */

import { randomBytes, scrypt as scryptCallback, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

const SALT_BYTES = 16;
const KEY_LENGTH = 64;
const COST = 16_384;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;
const MAX_MEMORY = 64 * 1024 * 1024;

const OPTIONS: ScryptOptions = {
  N: COST,
  r: BLOCK_SIZE,
  p: PARALLELIZATION,
  maxmem: MAX_MEMORY,
};

const ENCODED_PATTERN = /^scrypt\$(\d+)\$(\d+)\$(\d+)\$([0-9a-f]+)\$([0-9a-f]+)$/;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const digest = await scrypt(password, salt, KEY_LENGTH, OPTIONS);
  return `scrypt$${COST}$${BLOCK_SIZE}$${PARALLELIZATION}$${salt.toString('hex')}$${digest.toString('hex')}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const parts = ENCODED_PATTERN.exec(encoded);
  if (parts === null) return false;

  const cost = Number(parts[1]);
  const blockSize = Number(parts[2]);
  const parallelization = Number(parts[3]);
  if (cost !== COST || blockSize !== BLOCK_SIZE || parallelization !== PARALLELIZATION) return false;

  const salt = Buffer.from(parts[4], 'hex');
  const expected = Buffer.from(parts[5], 'hex');
  if (salt.length !== SALT_BYTES || expected.length !== KEY_LENGTH) return false;

  const actual = await scrypt(password, salt, KEY_LENGTH, OPTIONS);
  return timingSafeEqual(actual, expected);
}
