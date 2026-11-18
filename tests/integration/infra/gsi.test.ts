/**
 * F04-T05 — sonda explícita `GSI_COUNT: 0` (recomendación F04T03-A-01).
 *
 * La tabla de jobs solo se accede desde `userId` (PR-07/IN-06): todo acceso
 * empieza por la partición y el listado de hijos usa `begins_with(jobId, ...)`.
 * Un GSI permitiría eludir esa clave de aislamiento, por lo que su ausencia es
 * una invariante verificada contra el emulador en vivo.
 */

import { afterAll, expect, it } from 'vitest';

import {
  JOBS_TABLE,
  createDynamoDB,
  DescribeTableCommand,
} from './emulator';

const ddb = createDynamoDB();

afterAll(() => {
  ddb.destroy();
});

it('DescribeTable: la tabla de jobs no declara índices secundarios globales', async () => {
  const described = await ddb.send(new DescribeTableCommand({ TableName: JOBS_TABLE }));
  const count = (described.Table?.GlobalSecondaryIndexes ?? []).length;
  // Salida explícita para la evidencia F04-T05-gsi-probe.txt.
  console.log(`GSI_COUNT: ${count}`);
  expect(count).toBe(0);
});
