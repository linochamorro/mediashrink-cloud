import { describe, expect, it } from 'vitest';

import { loadConfig } from '../../../backend/src/config/index';
import {
  checkDimensions,
  checkFileSize,
  limitsFromConfig,
  type AntiBombLimits,
} from '../../../backend/src/domain/antiBomb';

/** Entorno mínimo con marcadores locales (G-3), suficiente para `loadConfig`. */
const minimalEnv = (overrides: Record<string, string> = {}): Record<string, string> => ({
  NODE_ENV: 'test',
  JWT_ACCESS_SECRET: 'REPLACE_WITH_LOCAL_DEV_SECRET',
  JWT_REFRESH_SECRET: 'REPLACE_WITH_LOCAL_DEV_SECRET',
  AWS_ENDPOINT_URL: 'https://127.0.0.1:9297',
  S3_BUCKET_RAW: 'mediashrink-raw-local',
  S3_BUCKET_OPTIMIZED: 'mediashrink-optimized-local',
  SQS_QUEUE_URL: 'https://sqs.us-east-1.amazonaws.com/000000000000/mediashrink-jobs',
  SQS_DLQ_URL: 'https://sqs.us-east-1.amazonaws.com/000000000000/mediashrink-jobs-dlq',
  DYNAMODB_TABLE_JOBS: 'mediashrink-jobs',
  ...overrides,
});

const LIMITS: AntiBombLimits = { maxFileSizeMb: 1, maxPixels: 1000 };
const ONE_MB = 1024 * 1024;

describe('anti-bomba — límites leídos de loadConfig()', () => {
  it('toma MAX_FILE_SIZE_MB y MAX_PIXELS de la configuración', () => {
    expect(limitsFromConfig(loadConfig(minimalEnv()))).toEqual({
      maxFileSizeMb: 15,
      maxPixels: 25_000_000,
    });
    expect(
      limitsFromConfig(
        loadConfig(minimalEnv({ MAX_FILE_SIZE_MB: '7', MAX_PIXELS: '4000000' })),
      ),
    ).toEqual({ maxFileSizeMb: 7, maxPixels: 4_000_000 });
  });

  it('acepta el tamaño exacto del límite y lo rechaza por encima (antes de procesar)', () => {
    expect(checkFileSize(0, LIMITS)).toEqual({ ok: true });
    expect(checkFileSize(ONE_MB, LIMITS)).toEqual({ ok: true });
    expect(checkFileSize(ONE_MB + 1, LIMITS)).toEqual({
      ok: false,
      reason: 'FILE_TOO_LARGE',
      detail: expect.stringContaining('MAX_FILE_SIZE_MB') as string,
    });
  });

  it('rechaza tamaños no enteros o negativos como INVALID_SIZE', () => {
    expect(checkFileSize(-1, LIMITS).ok).toBe(false);
    expect(checkFileSize(1.5, LIMITS)).toMatchObject({ ok: false, reason: 'INVALID_SIZE' });
    expect(checkFileSize(Number.NaN, LIMITS)).toMatchObject({ ok: false, reason: 'INVALID_SIZE' });
  });

  it('acepta exactamente MAX_PIXELS y rechaza un píxel más', () => {
    expect(checkDimensions({ width: 40, height: 25 }, LIMITS)).toEqual({ ok: true });
    expect(checkDimensions({ width: 40, height: 26 }, LIMITS)).toMatchObject({
      ok: false,
      reason: 'TOO_MANY_PIXELS',
    });
  });

  it('rechaza dimensiones no positivas o no enteras (INVALID_DIMENSIONS)', () => {
    expect(checkDimensions({ width: 0, height: 10 }, LIMITS)).toMatchObject({
      ok: false,
      reason: 'INVALID_DIMENSIONS',
    });
    expect(checkDimensions({ width: 10, height: -1 }, LIMITS)).toMatchObject({
      ok: false,
      reason: 'INVALID_DIMENSIONS',
    });
    expect(checkDimensions({ width: 1.5, height: 10 }, LIMITS)).toMatchObject({
      ok: false,
      reason: 'INVALID_DIMENSIONS',
    });
    expect(checkDimensions({ width: 10, height: 2.5 }, LIMITS)).toMatchObject({
      ok: false,
      reason: 'INVALID_DIMENSIONS',
    });
  });

  it('usa los límites del config (no constantes embebidas) en una bomba real', () => {
    const limits = limitsFromConfig(
      loadConfig(minimalEnv({ MAX_PIXELS: '100', MAX_FILE_SIZE_MB: '1' })),
    );
    expect(checkDimensions({ width: 5000, height: 5000 }, limits).ok).toBe(false);
    expect(checkFileSize(10 * ONE_MB, limits).ok).toBe(false);
    expect(checkDimensions({ width: 10, height: 10 }, limits)).toEqual({ ok: true });
  });
});
