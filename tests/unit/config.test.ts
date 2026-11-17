import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  ALL_ENV_KEYS,
  assertNoRealSecret,
  findRealSecretPattern,
  loadConfig,
  parseEnvFile,
} from '../../backend/src/config/index';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ENV_EXAMPLE_PATH = join(PROJECT_ROOT, '.env.example');

/** Entorno válido completo: usa únicamente marcadores locales (G-3). */
const BASE_ENV: Record<string, string> = {
  NODE_ENV: 'development',
  PORT: '3001',
  CORS_ORIGIN: 'http://localhost:5173',
  MAX_FILE_SIZE_MB: '15',
  MAX_IMAGES_PER_BATCH: '20',
  MAX_PIXELS: '25000000',
  JWT_ACCESS_SECRET: 'REPLACE_WITH_LOCAL_DEV_SECRET_32_CHARS',
  JWT_REFRESH_SECRET: 'REPLACE_WITH_LOCAL_DEV_SECRET_32_CHARS',
  JWT_ACCESS_TTL: '900',
  JWT_REFRESH_TTL: '604800',
  RATE_LIMIT_AUTH_MAX: '5',
  RATE_LIMIT_AUTH_WINDOW_MS: '60000',
  AWS_REGION: 'us-east-1',
  AWS_ENDPOINT_URL: 'https://127.0.0.1:9297',
  AWS_SHARED_CREDENTIALS_FILE: './.local/aws-emulator/emulator_credentials',
  AWS_CONFIG_FILE: './.local/aws-emulator/config',
  AWS_EC2_METADATA_DISABLED: 'true',
  AWS_ACCOUNT_ID: '000000000000',
  USE_SSL: 'true',
  CA_BUNDLE_PATH: './.local/aws-emulator/ca.pem',
  S3_BUCKET_RAW: 'mediashrink-raw-local',
  S3_BUCKET_OPTIMIZED: 'mediashrink-optimized-local',
  SQS_QUEUE_URL: 'https://sqs.us-east-1.amazonaws.com/000000000000/mediashrink-jobs',
  SQS_DLQ_URL: 'https://sqs.us-east-1.amazonaws.com/000000000000/mediashrink-jobs-dlq',
  DYNAMODB_TABLE_JOBS: 'mediashrink-jobs',
  RETENTION_DAYS: '30',
  SQS_MAX_RETRIES: '3',
  POLL_INTERVAL_MS: '2000',
};

const withOverride = (key: string, value: string): Record<string, string> => ({
  ...BASE_ENV,
  [key]: value,
});

const without = (key: string): Record<string, string> => {
  const copy = { ...BASE_ENV };
  delete copy[key];
  return copy;
};

describe('loadConfig — caso positivo', () => {
  it('carga un entorno válido y convierte números y booleanos a su tipo', () => {
    const config = loadConfig(BASE_ENV);

    expect(config.app.env).toBe('development');
    expect(config.app.port).toBe(3001);
    expect(config.limits.maxFileSizeMb).toBe(15);
    expect(config.limits.maxImagesPerBatch).toBe(20);
    expect(config.limits.maxPixels).toBe(25_000_000);
    expect(config.jwt.accessTtlSeconds).toBe(900);
    expect(config.jwt.refreshTtlSeconds).toBe(604_800);
    expect(config.rateLimit.authMax).toBe(5);
    expect(config.rateLimit.authWindowMs).toBe(60_000);
    expect(config.aws.useSsl).toBe(true);
    expect(config.resources.dynamodbTableJobs).toBe('mediashrink-jobs');
    expect(config.worker.retentionDays).toBe(30);
    expect(config.worker.sqsMaxRetries).toBe(3);
    expect(config.worker.pollIntervalMs).toBe(2000);
  });

  it('aplica valores por defecto seguros a las variables opcionales', () => {
    const minimal = {
      JWT_ACCESS_SECRET: BASE_ENV.JWT_ACCESS_SECRET,
      JWT_REFRESH_SECRET: BASE_ENV.JWT_REFRESH_SECRET,
      AWS_ENDPOINT_URL: BASE_ENV.AWS_ENDPOINT_URL,
      S3_BUCKET_RAW: BASE_ENV.S3_BUCKET_RAW,
      S3_BUCKET_OPTIMIZED: BASE_ENV.S3_BUCKET_OPTIMIZED,
      SQS_QUEUE_URL: BASE_ENV.SQS_QUEUE_URL,
      SQS_DLQ_URL: BASE_ENV.SQS_DLQ_URL,
      DYNAMODB_TABLE_JOBS: BASE_ENV.DYNAMODB_TABLE_JOBS,
    };

    const config = loadConfig(minimal);

    expect(config.app.env).toBe('development');
    expect(config.app.port).toBe(3001);
    expect(config.limits.maxFileSizeMb).toBe(15);
    expect(config.limits.maxImagesPerBatch).toBe(20);
    expect(config.worker.retentionDays).toBe(30);
    expect(config.worker.sqsMaxRetries).toBe(3);
    expect(config.worker.pollIntervalMs).toBe(2000);
    expect(config.aws.region).toBe('us-east-1');
    expect(config.aws.sharedCredentialsFile).toBe('./.local/aws-emulator/emulator_credentials');
    expect(config.aws.configFile).toBe('./.local/aws-emulator/config');
    expect(config.aws.ec2MetadataDisabled).toBe(true);
  });

  it('expone los archivos generados del emulador en lugar de credenciales fijas', () => {
    const config = loadConfig(BASE_ENV);

    expect(config.aws.sharedCredentialsFile).toBe('./.local/aws-emulator/emulator_credentials');
    expect(config.aws.configFile).toBe('./.local/aws-emulator/config');
    expect(config.aws.ec2MetadataDisabled).toBe(true);
    expect(config.aws).not.toHaveProperty('accessKeyId');
    expect(config.aws).not.toHaveProperty('secretAccessKey');
  });

  it('acepta USE_SSL=false y NODE_ENV=test', () => {
    const config = loadConfig(withOverride('USE_SSL', 'false'));
    expect(config.aws.useSsl).toBe(false);

    const testConfig = loadConfig(withOverride('NODE_ENV', 'test'));
    expect(testConfig.app.env).toBe('test');
  });
});

describe('loadConfig — casos negativos', () => {
  it('falla con mensaje claro cuando falta una variable obligatoria', () => {
    expect(() => loadConfig(without('DYNAMODB_TABLE_JOBS'))).toThrow(/DYNAMODB_TABLE_JOBS/);
    expect(() => loadConfig(without('JWT_ACCESS_SECRET'))).toThrow(/JWT_ACCESS_SECRET/);
    expect(() => loadConfig(without('AWS_ENDPOINT_URL'))).toThrow(/AWS_ENDPOINT_URL/);
  });

  it('rechaza variables vacías como ausentes', () => {
    expect(() => loadConfig(withOverride('S3_BUCKET_RAW', '   '))).toThrow(/S3_BUCKET_RAW/);
  });

  it.each([
    ['MAX_FILE_SIZE_MB', 'abc'],
    ['MAX_IMAGES_PER_BATCH', '-1'],
    ['MAX_PIXELS', '1.5'],
    ['PORT', '70000'],
    ['JWT_ACCESS_TTL', '0'],
    ['JWT_REFRESH_TTL', 'no-es-numero'],
    ['RATE_LIMIT_AUTH_MAX', '1e3'],
    ['RATE_LIMIT_AUTH_WINDOW_MS', 'abc'],
    ['RETENTION_DAYS', '-30'],
    ['SQS_MAX_RETRIES', '0'],
    ['POLL_INTERVAL_MS', 'abc'],
    ['USE_SSL', 'maybe'],
    ['NODE_ENV', 'staging'],
  ])('rechaza el valor inválido de %s = "%s" con el nombre de la variable', (key, value) => {
    expect(() => loadConfig(withOverride(key, value))).toThrow(new RegExp(key));
  });

  it('rechaza el puerto retirado :9324 en las variables del emulador (A-03)', () => {
    expect(() =>
      loadConfig(withOverride('AWS_ENDPOINT_URL', 'http://127.0.0.1:9324')),
    ).toThrow(/AWS_ENDPOINT_URL/);
    expect(() =>
      loadConfig(withOverride('SQS_QUEUE_URL', 'http://127.0.0.1:9324/queue/mediashrink-jobs')),
    ).toThrow(/9324/);
    expect(() =>
      loadConfig(withOverride('SQS_DLQ_URL', 'http://127.0.0.1:9324/queue/mediashrink-jobs-dlq')),
    ).toThrow(/9324/);
  });

  it('rechaza URLs SQS sin HTTPS', () => {
    expect(() =>
      loadConfig(
        withOverride('SQS_QUEUE_URL', 'http://sqs.us-east-1.amazonaws.com/000000000000/mediashrink-jobs'),
      ),
    ).toThrow(/SQS_QUEUE_URL/);
    expect(() =>
      loadConfig(
        withOverride('SQS_DLQ_URL', 'http://sqs.us-east-1.amazonaws.com/000000000000/mediashrink-jobs-dlq'),
      ),
    ).toThrow(/SQS_DLQ_URL/);
  });

  it('rechaza TTLs incoherentes (access >= refresh)', () => {
    const env = { ...BASE_ENV, JWT_ACCESS_TTL: '604800', JWT_REFRESH_TTL: '900' };
    expect(() => loadConfig(env)).toThrow(/JWT_ACCESS_TTL/);
  });

  it('rechaza placeholders de JWT cuando NODE_ENV=production', () => {
    const env = { ...BASE_ENV, NODE_ENV: 'production' };
    expect(() => loadConfig(env)).toThrow(/JWT_ACCESS_SECRET/);
  });
});

describe('detección de secretos reales (G-3)', () => {
  it('identifica patrones evidentes de secreto real', () => {
    expect(findRealSecretPattern('AKIAABCDEFGHIJKLMNOP')).not.toBeNull();
    expect(findRealSecretPattern('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcdefghijklmnop')).not.toBeNull();
    expect(findRealSecretPattern('ghp_abcdefghijklmnopqrstuvwxyz0123456789')).not.toBeNull();
    expect(findRealSecretPattern('a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6')).not.toBeNull();
  });

  it('no marca como reales los marcadores locales del emulador', () => {
    for (const value of [
      'REPLACE_WITH_LOCAL_DEV_SECRET_32_CHARS',
      'test',
      'dummy',
      '000000000000',
      'https://sqs.us-east-1.amazonaws.com/000000000000/mediashrink-jobs',
      './.local/aws-emulator/emulator_credentials',
    ]) {
      expect(() => assertNoRealSecret(value)).not.toThrow();
    }
  });

  it('rechaza un AWS Access Key ID con aspecto real en cualquier variable', () => {
    expect(() => loadConfig(withOverride('AWS_ACCOUNT_ID', 'AKIAABCDEFGHIJKLMNOP'))).toThrow(
      /AWS_ACCOUNT_ID/,
    );
  });

  it('rechaza un JWT real como secreto de access', () => {
    expect(() =>
      loadConfig(
        withOverride(
          'JWT_ACCESS_SECRET',
          'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcdefghijklmnop',
        ),
      ),
    ).toThrow(/JWT_ACCESS_SECRET/);
  });
});

describe('parseEnvFile y .env.example', () => {
  const readExample = (): Record<string, string> =>
    parseEnvFile(readFileSync(ENV_EXAMPLE_PATH, 'utf8'));

  it('ignora comentarios, líneas vacías y recorta comillas envolventes', () => {
    const result = parseEnvFile([
      '# comentario',
      '',
      '  A=1  ',
      'B="dos"',
      "C='tres'",
      'sin-igual',
    ].join('\n'));

    expect(result).toEqual({ A: '1', B: 'dos', C: 'tres' });
  });

  it('contiene todas las variables declaradas como requeridas por el loader', () => {
    const parsed = readExample();
    expect(ALL_ENV_KEYS.length).toBeGreaterThan(0);
    for (const key of ALL_ENV_KEYS) {
      expect(parsed).toHaveProperty(key);
    }
  });

  it('los nombres del archivo coinciden exactamente con el inventario del loader', () => {
    const parsed = readExample();
    expect(Object.keys(parsed).sort()).toEqual([...ALL_ENV_KEYS].sort());
  });

  it('no contiene secretos reales en ninguno de sus valores', () => {
    const parsed = readExample();
    for (const [key, value] of Object.entries(parsed)) {
      expect(() => assertNoRealSecret(value), `secreto real detectado en ${key}`).not.toThrow();
    }
  });

  it('usa marcadores locales para JWT y archivos generados para el emulador (A-03)', () => {
    const parsed = readExample();
    expect(parsed.JWT_ACCESS_SECRET).toMatch(/^REPLACE_WITH_/);
    expect(parsed.JWT_REFRESH_SECRET).toMatch(/^REPLACE_WITH_/);
    expect(parsed.AWS_SHARED_CREDENTIALS_FILE).toBe('./.local/aws-emulator/emulator_credentials');
    expect(parsed.AWS_CONFIG_FILE).toBe('./.local/aws-emulator/config');
    expect(parsed.AWS_EC2_METADATA_DISABLED).toBe('true');
    expect(parsed).not.toHaveProperty('AWS_ACCESS_KEY_ID');
    expect(parsed).not.toHaveProperty('AWS_SECRET_ACCESS_KEY');
    expect(parsed.RETENTION_DAYS).toBe('30');
    expect(parsed.SQS_MAX_RETRIES).toBe('3');
    expect(parsed.POLL_INTERVAL_MS).toBe('2000');
  });

  it('no contiene el puerto retirado :9324 en ningún valor (A-03)', () => {
    const parsed = readExample();
    for (const [key, value] of Object.entries(parsed)) {
      expect(value, `${key} no debe usar :9324`).not.toContain(':9324');
    }
  });

  it('apunta SQS/DLQ a las QueueUrls reales y el transporte a 9297 (A-03)', () => {
    const parsed = readExample();
    expect(parsed.AWS_ENDPOINT_URL).toBe('https://127.0.0.1:9297');
    expect(parsed.SQS_QUEUE_URL).toBe(
      'https://sqs.us-east-1.amazonaws.com/000000000000/mediashrink-jobs',
    );
    expect(parsed.SQS_DLQ_URL).toBe(
      'https://sqs.us-east-1.amazonaws.com/000000000000/mediashrink-jobs-dlq',
    );
  });

  it('el propio .env.example pasa la validación completa del loader', () => {
    const parsed = readExample();
    expect(() => loadConfig(parsed)).not.toThrow();
  });
});
