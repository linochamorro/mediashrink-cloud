/**
 * F05-AUDIT-FULL — tests de regresión M-01/M-02/M-04/M-05/M-06 y UX-01..UX-03.
 *
 * Cubren los defectos detectados en uso real por un humano: carga de `.env`,
 * falsos positivos de secretos, relay local de S3, Claim Check, separación de
 * rate limits y saneado del nombre de lote.
 */

import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  assertNoRealSecret,
  findRealSecretPattern,
  loadConfig,
} from '../../backend/src/config/index';
import { sanitizeBatchName } from '../../backend/src/api/jobs';
import { loadDotEnv } from '../../backend/src/server';
import { resolveDevStorageUrl } from '../../frontend/src/api/jobs';
import { parseJobQueueMessage } from '../../backend/src/worker/messages';

const BASE_ENV: Record<string, string> = {
  JWT_ACCESS_SECRET: 'REPLACE_WITH_LOCAL_DEV_SECRET_32_CHARS',
  JWT_REFRESH_SECRET: 'REPLACE_WITH_LOCAL_DEV_SECRET_32_CHARS',
  AWS_ENDPOINT_URL: 'https://127.0.0.1:9297',
  S3_BUCKET_RAW: 'mediashrink-raw-local',
  S3_BUCKET_OPTIMIZED: 'mediashrink-optimized-local',
  SQS_QUEUE_URL: 'https://sqs.us-east-1.amazonaws.com/000000000000/mediashrink-jobs',
  SQS_DLQ_URL: 'https://sqs.us-east-1.amazonaws.com/000000000000/mediashrink-jobs-dlq',
  DYNAMODB_TABLE_JOBS: 'mediashrink-jobs',
};

describe('M-01 — carga de .env desde la raíz o subdirectorio', () => {
  it('carga el .env de la raíz cuando el cwd es backend/', () => {
    const root = mkdtempSync(join(tmpdir(), 'mediashrink-env-'));
    const backend = join(root, 'backend');
    try {
      writeFileSync(join(root, '.env'), 'FROM_ROOT=yes\n');
      const env: NodeJS.ProcessEnv = {};
      // cwd=backend no tiene .env: debe subir un nivel.
      loadDotEnv(backend, env);
      expect(env.FROM_ROOT).toBe('yes');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('no pisa variables ya definidas en el proceso', () => {
    const root = mkdtempSync(join(tmpdir(), 'mediashrink-env-'));
    try {
      writeFileSync(join(root, '.env'), 'KEEP=file\n');
      const env: NodeJS.ProcessEnv = { KEEP: 'process' };
      loadDotEnv(root, env);
      expect(env.KEEP).toBe('process');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('M-02 — secretos locales frente a credenciales reales', () => {
  it('acepta secretos locales hex/base64/aleatorios de 32+ caracteres', () => {
    const localSecrets = [
      'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6',
      '0123456789abcdef0123456789abcdef',
      'AbC123xYz789QwE456Rty012Uio345P',
      'QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo=',
    ];
    for (const secret of localSecrets) {
      expect(findRealSecretPattern(secret), secret).toBeNull();
      expect(() => assertNoRealSecret(secret)).not.toThrow();
    }
  });

  it('sigue rechazando AWS Access Key ID, JWT y token de GitHub', () => {
    expect(findRealSecretPattern('AKIAABCDEFGHIJKLMNOP')).not.toBeNull();
    expect(
      findRealSecretPattern('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcdefghijklmnop'),
    ).not.toBeNull();
    expect(findRealSecretPattern('ghp_abcdefghijklmnopqrstuvwxyz0123456789')).not.toBeNull();
  });
});

describe('M-04 — relay local de S3 solo para el emulador', () => {
  it('reescribe únicamente 127.0.0.1:9297 y localhost:9297', () => {
    expect(resolveDevStorageUrl('https://127.0.0.1:9297/bucket/key?X-Amz-Signature=1')).toBe(
      '/__s3_local/bucket/key?X-Amz-Signature=1',
    );
    expect(resolveDevStorageUrl('https://localhost:9297/bucket/key')).toBe(
      '/__s3_local/bucket/key',
    );
  });

  it('deja intactas URLs de producción y hosts no autorizados', () => {
    expect(resolveDevStorageUrl('https://s3.amazonaws.com/bucket/key')).toBe(
      'https://s3.amazonaws.com/bucket/key',
    );
    expect(resolveDevStorageUrl('https://127.0.0.1:9298/bucket/key')).toBe(
      'https://127.0.0.1:9298/bucket/key',
    );
  });
});

describe('M-05 — Claim Check y mensajes sin contentBase64', () => {
  it('acepta un sobre ligero sin contentBase64', () => {
    const message = parseJobQueueMessage(
      JSON.stringify({
        userId: 'u-1',
        jobId: 'j-1',
        images: [{ imageId: 'img-1', preset: 'HIGH' }],
      }),
    );
    expect(message.images[0]?.contentBase64).toBeUndefined();
    expect(message.images[0]?.preset).toBe('HIGH');
  });

  it('sigue aceptando un sobre normal con contentBase64', () => {
    const message = parseJobQueueMessage(
      JSON.stringify({
        userId: 'u-1',
        jobId: 'j-1',
        images: [{ imageId: 'img-1', contentBase64: Buffer.from('hola').toString('base64') }],
      }),
    );
    expect(message.images[0]?.contentBase64).toBe(Buffer.from('hola').toString('base64'));
  });
});

describe('M-06 — rate limit de auth separado del de trabajo', () => {
  it('/auth conserva 5/min y la API usa 120/min por defecto', () => {
    const config = loadConfig(BASE_ENV);
    expect(config.rateLimit.authMax).toBe(5);
    expect(config.rateLimit.apiMax).toBe(120);
  });

  it('RATE_LIMIT_API_MAX es configurable y no afecta al límite de auth', () => {
    const config = loadConfig({ ...BASE_ENV, RATE_LIMIT_API_MAX: '240' });
    expect(config.rateLimit.apiMax).toBe(240);
    expect(config.rateLimit.authMax).toBe(5);
  });
});

describe('UX-01..UX-03 — nombre de lote y coherencia de acciones', () => {
  it('sanea el nombre: recorta, acota a 80 y descarta vacíos/no string', () => {
    expect(sanitizeBatchName('  Fotos vacaciones noviembre  ')).toBe('Fotos vacaciones noviembre');
    expect(sanitizeBatchName('x'.repeat(120))).toHaveLength(80);
    expect(sanitizeBatchName('   ')).toBeUndefined();
    expect(sanitizeBatchName(42)).toBeUndefined();
    expect(sanitizeBatchName(undefined)).toBeUndefined();
  });

  it('neutraliza intentos de XSS/inyección conservando el texto como dato', () => {
    const name = sanitizeBatchName('<script>alert("x")</script>');
    expect(name).toBe('<script>alert("x")</script>');
    // El frontend lo renderiza como texto (React escapa), nunca como HTML.
    expect(name).not.toContain('javascript:');
  });
});
