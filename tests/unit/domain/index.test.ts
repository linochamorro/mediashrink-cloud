import { describe, expect, it } from 'vitest';

import { loadConfig } from '../../../backend/src/config/index';
import {
  checkDimensions,
  checkFileSize,
  checkTransition,
  computeSavings,
  extractDimensions,
  isPositiveSafeInt,
  limitsFromConfig,
  nextStatus,
  resolveBatchStatus,
  validateImageHeader,
} from '../../../backend/src/domain/index';
import { pngFixture } from './fixtures';

const minimalEnv = (): Record<string, string> => ({
  NODE_ENV: 'test',
  JWT_ACCESS_SECRET: 'REPLACE_WITH_LOCAL_DEV_SECRET',
  JWT_REFRESH_SECRET: 'REPLACE_WITH_LOCAL_DEV_SECRET',
  AWS_ENDPOINT_URL: 'https://127.0.0.1:9297',
  S3_BUCKET_RAW: 'mediashrink-raw-local',
  S3_BUCKET_OPTIMIZED: 'mediashrink-optimized-local',
  SQS_QUEUE_URL: 'https://sqs.us-east-1.amazonaws.com/000000000000/mediashrink-jobs',
  SQS_DLQ_URL: 'https://sqs.us-east-1.amazonaws.com/000000000000/mediashrink-jobs-dlq',
  DYNAMODB_TABLE_JOBS: 'mediashrink-jobs',
  MAX_PIXELS: '100',
  MAX_FILE_SIZE_MB: '1',
});

/**
 * Integración de las cinco familias de reglas puras sin I/O: la configuración
 * alimenta la anti-bomba, la cabecera aporta dimensiones, el ahorro se mide con
 * bytes enteros y el estado agregado termina en PARTIAL si una imagen falló.
 */
describe('dominio — composición de reglas puras (CA-05)', () => {
  it('compone cabecera + anti-bomba + ahorro + estados de extremo a extremo', () => {
    const limits = limitsFromConfig(loadConfig(minimalEnv()));
    const bytes = pngFixture(8, 8);

    const cabecera = validateImageHeader({ bytes, filename: 'foto.png', mimeType: 'image/png' });
    expect(cabecera.ok).toBe(true);
    if (!cabecera.ok) throw new Error('cabecera inesperadamente rechazada');

    expect(isPositiveSafeInt(cabecera.dimensions.width)).toBe(true);
    expect(extractDimensions(bytes, 'png')).toEqual(cabecera.dimensions);
    expect(checkDimensions(cabecera.dimensions, limits)).toEqual({ ok: true });
    expect(checkFileSize(bytes.byteLength, limits)).toEqual({ ok: true });

    const metricas = computeSavings({ bytesBefore: 1000, bytesAfter: 1150 });
    expect(metricas).toEqual({
      bytesBefore: 1000,
      bytesAfter: 1150,
      bytesSaved: -150,
      savingsPct: -15,
    });

    const resumen = { completed: 1, failed: 1 };
    const objetivo = resolveBatchStatus(resumen);
    expect(objetivo).toBe('PARTIAL');
    expect(checkTransition('PROCESSING', objetivo, resumen)).toEqual({ ok: true });
    expect(nextStatus('PROCESSING', objetivo, resumen)).toBe('PARTIAL');
  });
});
