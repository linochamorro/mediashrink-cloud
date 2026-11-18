/**
 * Orquestador del seed sintético de MediaShrink Cloud (F01-T04, CA-04).
 *
 * Reutiliza: el hash de T03 (`hashPassword`), el cliente DynamoDB de T02,
 * los contratos congelados de T01 y el almacén de jobs de T02. No reimplementa
 * ninguno de ellos. La idempotencia se apoya en claves deterministas y en
 * escrituras condicionales / comprobación previa de existencia.
 */

import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

import { hashPassword } from '../../../backend/src/auth/password';
import {
  computeTtl,
  schemas,
  type ImageRecord,
  type Job,
} from '../../../backend/src/contracts/index';
import { createJobStore } from '../../../backend/src/db/index';

import { buildSeedPlan, type DemoImageSpec, type DemoJobSpec } from './demo-data';
import { generateSyntheticImage, type SyntheticImage } from './images';
import { countAllItems, ensureSeedTable, putUserIfAbsent, type ItemCounts } from './store';

export { buildSeedPlan } from './demo-data';
export {
  SEED_TABLE_NAME,
  countAllItems,
  dropSeedTable,
  ensureSeedTable,
  readSeedUser,
} from './store';
export type { DemoImageSpec, DemoJobSpec, DemoUserSpec } from './demo-data';

export type { ItemCounts, SeedUserRecord } from './store';

export interface SeedDeps {
  client: DynamoDBDocumentClient;
  tableName: string;
  now?: () => string;
}

export interface SeedItemDetail {
  id: string;
  status: 'created' | 'skipped' | 'would-create';
  detail: string;
}

export interface SeedCategory {
  created: number;
  skipped: number;
  items: SeedItemDetail[];
}

export interface SeedSummary {
  dryRun: boolean;
  tableName: string;
  tableCreated: boolean;
  users: SeedCategory;
  jobs: SeedCategory;
  images: SeedCategory;
  countsBefore: ItemCounts;
  countsAfter: ItemCounts;
}

const EMPTY_COUNTS: ItemCounts = { users: 0, jobs: 0, images: 0, total: 0 };

function buildJob(spec: DemoJobSpec, images: readonly SyntheticImage[], now: string): Job {
  const bytesBefore = images.reduce((total, image) => total + image.rawBytes, 0);
  const bytesAfter = images.reduce((total, image) => total + image.optimizedBytes, 0);
  return schemas.Job.parse({
    jobId: spec.jobId,
    userId: spec.userId,
    status: 'COMPLETED',
    preset: spec.preset,
    formats: ['webp', 'avif'],
    bytesBefore,
    bytesAfter,
    savingsPct: bytesBefore === 0 ? 0 : ((bytesBefore - bytesAfter) / bytesBefore) * 100,
    exifStripped: true,
    createdAt: now,
    updatedAt: now,
    ttl: computeTtl(now),
  });
}

function buildImageRecord(spec: DemoImageSpec, generated: SyntheticImage): ImageRecord {
  return schemas.ImageRecord.parse({
    imageId: spec.imageId,
    status: 'COMPLETED',
    bytesBefore: generated.rawBytes,
    bytesAfter: generated.optimizedBytes,
    exifStripped: true,
  });
}

export async function runSeed(deps: SeedDeps, options: { dryRun?: boolean } = {}): Promise<SeedSummary> {
  const { client, tableName } = deps;
  const now = deps.now ?? (() => new Date().toISOString());
  const dryRun = options.dryRun === true;
  const plan = buildSeedPlan();
  const store = createJobStore({ tableName, client });

  const summary: SeedSummary = {
    dryRun,
    tableName,
    tableCreated: false,
    users: { created: 0, skipped: 0, items: [] },
    jobs: { created: 0, skipped: 0, items: [] },
    images: { created: 0, skipped: 0, items: [] },
    countsBefore: EMPTY_COUNTS,
    countsAfter: EMPTY_COUNTS,
  };

  if (!dryRun) {
    summary.tableCreated = await ensureSeedTable(client, tableName);
    summary.countsBefore = await countAllItems(client, tableName);
  }

  const generated = new Map<string, SyntheticImage>();
  for (const job of plan.jobs) {
    for (const image of job.images) {
      generated.set(image.imageId, await generateSyntheticImage(image));
    }
  }

  for (const user of plan.users) {
    // Hash del servicio de T03: nunca se reimplementa y nunca se registra en claro.
    const passwordHash = await hashPassword(user.password);
    const detail = `${user.email} · contraseña hasheada con scrypt (T03)`;
    if (dryRun) {
      summary.users.items.push({ id: user.userId, status: 'would-create', detail });
      continue;
    }
    const created = await putUserIfAbsent(client, tableName, user, passwordHash, now());
    if (created) summary.users.created += 1;
    else summary.users.skipped += 1;
    summary.users.items.push({ id: user.userId, status: created ? 'created' : 'skipped', detail });
  }

  for (const job of plan.jobs) {
    const images = job.images.map((image) => generated.get(image.imageId)!);
    const jobDetail = `${job.preset} · ${images.length} imágenes 100x100 · bytes reales`;
    let jobCreated = false;
    if (dryRun) {
      summary.jobs.items.push({ id: job.jobId, status: 'would-create', detail: jobDetail });
    } else {
      jobCreated = (await store.getJob(job.userId, job.jobId)) === null;
      if (jobCreated) {
        await store.createJob(buildJob(job, images, now()));
        summary.jobs.created += 1;
      } else {
        summary.jobs.skipped += 1;
      }
      summary.jobs.items.push({ id: job.jobId, status: jobCreated ? 'created' : 'skipped', detail: jobDetail });
    }

    for (const image of job.images) {
      const synthetic = generated.get(image.imageId)!;
      const detail =
        `${image.label} · ${synthetic.width}x${synthetic.height} ` +
        `${synthetic.rawBytes} B → ${synthetic.optimizedBytes} B (webp+avif)`;
      if (dryRun) {
        summary.images.items.push({ id: image.imageId, status: 'would-create', detail });
        continue;
      }
      // Comprobación por ítem: un lote creado a medias se completa en la
      // siguiente ejecución sin duplicar las imágenes que ya estuvieran.
      const imageCreated = (await store.getImage(job.userId, job.jobId, image.imageId)) === null;
      if (imageCreated) {
        await store.putImage(job.userId, job.jobId, buildImageRecord(image, synthetic));
        summary.images.created += 1;
      } else {
        summary.images.skipped += 1;
      }
      summary.images.items.push({ id: image.imageId, status: imageCreated ? 'created' : 'skipped', detail });
    }
  }

  if (!dryRun) summary.countsAfter = await countAllItems(client, tableName);
  return summary;
}
