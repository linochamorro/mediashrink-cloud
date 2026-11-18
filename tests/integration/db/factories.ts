/** Fixtures deterministas construidos con los contratos congelados de F01-T01. */

import { randomUUID } from 'node:crypto';

import {
  computeTtl,
  schemas,
  type ImageRecord,
  type Job,
} from '../../../backend/src/contracts/index';

export const FIXED_CREATED_AT = '2026-11-17T10:00:00.000Z';
export const FIXED_UPDATED_AT = '2026-11-17T10:00:05.000Z';

export function makeJob(overrides: Partial<Job> = {}): Job {
  const createdAt = overrides.createdAt ?? FIXED_CREATED_AT;
  const bytesBefore = overrides.bytesBefore ?? 1000;
  const bytesAfter = overrides.bytesAfter ?? 600;
  return schemas.Job.parse({
    jobId: overrides.jobId ?? `job-${randomUUID()}`,
    userId: overrides.userId ?? `user-${randomUUID()}`,
    status: overrides.status ?? 'PENDING',
    preset: overrides.preset ?? 'BALANCED',
    formats: overrides.formats ?? ['webp', 'avif'],
    bytesBefore,
    bytesAfter,
    savingsPct: overrides.savingsPct ?? ((bytesBefore - bytesAfter) / bytesBefore) * 100,
    exifStripped: overrides.exifStripped ?? true,
    createdAt,
    updatedAt: overrides.updatedAt ?? FIXED_UPDATED_AT,
    ttl: overrides.ttl ?? computeTtl(createdAt),
  });
}

export function makeImage(overrides: Partial<ImageRecord> = {}): ImageRecord {
  return schemas.ImageRecord.parse({
    imageId: overrides.imageId ?? `img-${randomUUID()}`,
    status: overrides.status ?? 'COMPLETED',
    bytesBefore: overrides.bytesBefore ?? 500,
    bytesAfter: overrides.bytesAfter ?? 300,
    exifStripped: overrides.exifStripped ?? true,
    ...(overrides.failureReason === undefined ? {} : { failureReason: overrides.failureReason }),
  });
}
