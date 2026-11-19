/**
 * F05-H01 (RED) — el seed CLI debe escribir en `DYNAMODB_TABLE_JOBS`
 * (default `mediashrink-jobs`) y no en la tabla efímera legada.
 *
 * - Test conductual sin emulador: `npm run seed -- --dry-run` no abre
 *   conexión con DynamoDB y su informe nombra la tabla destino.
 * - Test estructural: `tools/scripts/seed/store.ts` ya no exporta la
 *   constante de la tabla efímera como destino de escritura.
 */

import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

const PROJECT_ROOT = join(__dirname, '..', '..');

let dryRunOutput = '';

beforeAll(() => {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  dryRunOutput = execFileSync(npm, ['run', 'seed', '--', '--dry-run'], {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
    timeout: 120_000,
    shell: process.platform === 'win32',
  });
}, 120_000);

describe('F05-H01 — el seed escribe en DYNAMODB_TABLE_JOBS (RED)', () => {
  it('el informe --dry-run nombra mediashrink-jobs como tabla destino', () => {
    expect(dryRunOutput).toContain('Tabla DynamoDB: mediashrink-jobs');
  });

  it('el informe --dry-run no menciona la tabla efímera legada', () => {
    expect(dryRunOutput).not.toContain('mediashrink-seed-demo');
  });

  it('store.ts ya no exporta SEED_TABLE_NAME como destino de escritura', async () => {
    const store = (await import('../../tools/scripts/seed/store')) as Record<string, unknown>;
    expect(store['SEED_TABLE_NAME']).toBeUndefined();
  });
});
