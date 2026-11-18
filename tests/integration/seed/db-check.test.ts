/**
 * F01-T04 — verificación independiente del contenido sembrado en el emulador.
 * Cuenta los ítems USER/JOB/IMAGE directamente en DynamoDB y lo registra en
 * consola para la evidencia `F01-T04-db-check.txt`.
 * Tabla propia para poder ejecutarse en paralelo con el resto de la suite.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { loadConfig } from '../../../backend/src/config/index';
import { createDynamoDbDocumentClientFromConfig } from '../../../backend/src/db/client';
import {
  buildSeedPlan,
  countAllItems,
  dropSeedTable,
  ensureSeedTable,
  readSeedUser,
  runSeed,
  SEED_TABLE_NAME,
} from '../../../tools/scripts/seed/index';
import { seedTestEnv } from './helpers';

const TABLE = `${SEED_TABLE_NAME}-dbcheck`;
const config = loadConfig(seedTestEnv());
const client = createDynamoDbDocumentClientFromConfig(config);
const plan = buildSeedPlan();

describe('F01-T04 — comprobación del estado en DynamoDB', () => {
  beforeAll(async () => {
    await dropSeedTable(client, TABLE).catch(() => undefined);
    await ensureSeedTable(client, TABLE);
    await runSeed({ client, tableName: TABLE });
  });

  afterAll(async () => {
    await dropSeedTable(client, TABLE);
  });

  it('el emulador contiene exactamente 3 usuarios, 3 jobs y 6 imágenes', async () => {
    const counts = await countAllItems(client, TABLE);
    console.log(
      `DB-CHECK tabla=${TABLE} usuarios=${counts.users} jobs=${counts.jobs} ` +
        `imagenes=${counts.images} total=${counts.total}`,
    );
    expect(counts).toEqual({ users: 3, jobs: 3, images: 6, total: 12 });

    for (const user of plan.users) {
      const stored = await readSeedUser(client, TABLE, user.userId);
      expect(stored?.email).toBe(user.email);
      expect(stored?.passwordHash.startsWith('scrypt$')).toBe(true);
    }
  });
});
