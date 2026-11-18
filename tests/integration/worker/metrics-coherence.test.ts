/**
 * Coherencia de métricas en DynamoDB real (F02-T06 / CA-06, PR-12, FR-12).
 *
 * Demuestra que el 0 % y el ahorro negativo se persisten SIN recorte y que los
 * esquemas congelados (`savings-coherence`) validan el resultado. Usa
 * `computeSavings` de F01-T05 como única fuente del porcentaje.
 */

import { afterEach, describe, expect, it } from 'vitest';

import { computeSavings } from '../../../backend/src/domain/index';
import { schemas, type Job } from '../../../backend/src/contracts/index';
import { createJobStore, type JobStore } from '../../../backend/src/db/index';
import { makeJob } from '../db/factories';
import { createTestTable, type TestTable } from '../db/table-fixture';

interface Context {
  readonly table: TestTable;
  readonly jobs: JobStore;
  readonly userId: string;
  readonly jobId: string;
}

const contexts: Context[] = [];

async function setup(bytesBefore: number, bytesAfter: number): Promise<Context> {
  const table = await createTestTable('metricscoh');
  const jobs = createJobStore({ tableName: table.tableName, client: table.documentClient });
  const userId = `user-metrics-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const jobId = `job-${userId}`;
  const savings = computeSavings({ bytesBefore, bytesAfter });
  await jobs.createJob(
    makeJob({ userId, jobId, bytesBefore, bytesAfter, savingsPct: savings.savingsPct }),
  );
  const context: Context = { table, jobs, userId, jobId };
  contexts.push(context);
  return context;
}

afterEach(async () => {
  while (contexts.length > 0) {
    const context = contexts.pop()!;
    await context.table.dispose();
  }
});

describe('métricas reales y coherentes en DynamoDB (PR-12)', () => {
  it('0 %: bytesBefore = bytesAfter se persiste como 0, sin redondeos ni recorte', async () => {
    const ctx = await setup(1000, 1000);
    const savings = computeSavings({ bytesBefore: 1000, bytesAfter: 1000 });
    expect(savings.savingsPct).toBe(0);
    await ctx.jobs.updateJob(ctx.userId, ctx.jobId, {
      bytesBefore: savings.bytesBefore,
      bytesAfter: savings.bytesAfter,
      savingsPct: savings.savingsPct,
      exifStripped: true,
    });
    const stored = (await ctx.jobs.getJob(ctx.userId, ctx.jobId)) as Job;
    expect(stored.savingsPct).toBe(0);
    expect(schemas.Job.safeParse(stored).success).toBe(true);
    expect(
      schemas.JobMetrics.safeParse({
        bytesBefore: stored.bytesBefore,
        bytesAfter: stored.bytesAfter,
        savingsPct: stored.savingsPct,
        exifStripped: stored.exifStripped,
      }).success,
    ).toBe(true);
  }, 30_000);

  it('negativo: bytesAfter > bytesBefore se persiste tal cual (-50 %), nunca se oculta', async () => {
    const ctx = await setup(100, 150);
    const savings = computeSavings({ bytesBefore: 100, bytesAfter: 150 });
    expect(savings.bytesSaved).toBe(-50);
    expect(savings.savingsPct).toBe(-50);
    await ctx.jobs.updateJob(ctx.userId, ctx.jobId, {
      bytesBefore: savings.bytesBefore,
      bytesAfter: savings.bytesAfter,
      savingsPct: savings.savingsPct,
      exifStripped: true,
    });
    const stored = (await ctx.jobs.getJob(ctx.userId, ctx.jobId)) as Job;
    expect(stored.bytesBefore).toBe(100);
    expect(stored.bytesAfter).toBe(150);
    expect(stored.savingsPct).toBe(-50);
    expect(stored.savingsPct).toBeLessThan(0);
    expect(schemas.Job.safeParse(stored).success).toBe(true);
  }, 30_000);
});
