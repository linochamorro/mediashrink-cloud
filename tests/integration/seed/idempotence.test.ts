/**
 * F01-T04 — idempotencia del seed sintético (CA-04).
 *
 * Requiere el emulador arrancado y CA/credenciales exportados según el
 * runbook §1.3. Tabla efímera propia de este archivo: permite que Vitest
 * ejecute los archivos de `tests/integration/seed/` en paralelo sin colisión.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { verifyPassword } from '../../../backend/src/auth/password';
import { loadConfig } from '../../../backend/src/config/index';
import { createDynamoDbDocumentClientFromConfig } from '../../../backend/src/db/client';
import { createJobStore } from '../../../backend/src/db/index';
import {
  buildSeedPlan,
  countAllItems,
  dropSeedTable,
  ensureSeedTable,
  readSeedUser,
  runSeed,
  SEED_TABLE_NAME,
  type SeedDeps,
} from '../../../tools/scripts/seed/index';
import { seedTestEnv } from './helpers';

const TABLE = `${SEED_TABLE_NAME}-idem`;
const config = loadConfig(seedTestEnv());
const client = createDynamoDbDocumentClientFromConfig(config);
const deps: SeedDeps = { client, tableName: TABLE };
const plan = buildSeedPlan();

describe('F01-T04 — seed sintético idempotente (CA-04)', () => {
  beforeAll(async () => {
    await dropSeedTable(client, TABLE).catch(() => undefined);
    await ensureSeedTable(client, TABLE);
  });

  afterAll(async () => {
    await dropSeedTable(client, TABLE);
  });

  it('el plan es determinista, ficticio y usa imágenes de 100x100', () => {
    expect(plan.users).toHaveLength(3);
    expect(plan.jobs).toHaveLength(3);
    expect(plan.jobs.flatMap((job) => job.images)).toHaveLength(6);

    for (const user of plan.users) {
      expect(user.email).toMatch(/@example\.com$/);
      expect(user.password.length).toBeGreaterThanOrEqual(8);
      expect(user.password.length).toBeLessThanOrEqual(128);
    }
    for (const image of plan.jobs.flatMap((job) => job.images)) {
      expect(image.width).toBe(100);
      expect(image.height).toBe(100);
    }
    expect(buildSeedPlan()).toEqual(plan);
  });

  it('--dry-run no escribe nada en el emulador', async () => {
    const before = await countAllItems(client, TABLE);
    const summary = await runSeed(deps, { dryRun: true });
    const after = await countAllItems(client, TABLE);

    expect(summary.dryRun).toBe(true);
    expect(summary.users.created + summary.jobs.created + summary.images.created).toBe(0);
    expect(after).toEqual(before);
  });

  it('crea usuarios con hash scrypt de T03 e imágenes sintéticas reales', async () => {
    const before = await countAllItems(client, TABLE);
    const first = await runSeed(deps);

    expect(first.users.created).toBe(3);
    expect(first.jobs.created).toBe(3);
    expect(first.images.created).toBe(6);

    const after = await countAllItems(client, TABLE);
    expect(after.users).toBe(before.users + 3);
    expect(after.jobs).toBe(before.jobs + 3);
    expect(after.images).toBe(before.images + 6);

    for (const user of plan.users) {
      const stored = await readSeedUser(client, TABLE, user.userId);
      expect(stored).not.toBeNull();
      expect(stored!.passwordHash).toMatch(/^scrypt\$/);
      await expect(verifyPassword(user.password, stored!.passwordHash)).resolves.toBe(true);
    }
    expect(JSON.stringify(after)).not.toContain('C:\\');
  });

  it('una segunda ejecución no duplica usuarios ni ítems', async () => {
    const before = await countAllItems(client, TABLE);
    const second = await runSeed(deps);
    const after = await countAllItems(client, TABLE);

    expect(second.users.created).toBe(0);
    expect(second.jobs.created).toBe(0);
    expect(second.images.created).toBe(0);
    expect(second.users.skipped + second.jobs.skipped + second.images.skipped).toBe(12);
    expect(after).toEqual(before);
  });

  it('recupera un lote sembrado a medias sin duplicar usuarios ni jobs', async () => {
    const store = createJobStore({ tableName: TABLE, client });
    const target = plan.jobs[0];
    await store.deleteImages(target.userId, target.jobId);

    const before = await countAllItems(client, TABLE);
    expect(before.images).toBe(4);

    const repair = await runSeed(deps);
    const after = await countAllItems(client, TABLE);

    expect(repair.users.created).toBe(0);
    expect(repair.jobs.created).toBe(0);
    expect(repair.images.created).toBe(2);
    expect(after.images).toBe(6);
    expect(after.users).toBe(before.users);
    expect(after.jobs).toBe(before.jobs);
  });
});
