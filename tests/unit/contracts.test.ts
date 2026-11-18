import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import type { z } from 'zod';

import { loadConfig } from '../../backend/src/config/index';
import {
  CATALOG,
  CATALOG_HASH,
  CONTRACTS_VERSION,
  JOB_STATUSES,
  OUTPUT_FORMATS,
  PRESETS,
  RETENTION_DAYS,
  TTL_SECONDS,
  computeTtl,
  generateTypes,
  schemas,
} from '../../backend/src/contracts/index';
import type {
  AwsTransport,
  AuthenticatedUser,
  ImageRecord,
  Job,
  JobMetrics,
  JobStatus,
  LimitsConfig,
  LoginInput,
  OutputFormat,
  Preset,
  RefreshInput,
  RegisterInput,
  RetentionPolicy,
  TokenPair,
} from '../../frontend/src/api/types.generated';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const GENERATED_FILE = join(PROJECT_ROOT, 'frontend/src/api/types.generated.ts');
const FROZEN_NAMES = Object.keys(CATALOG);

/** Igualdad estructural exacta en tiempo de compilación. */
type Exact<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
  ? true
  : false;

/** Entorno mínimo con marcadores locales (G-3): suficiente para `loadConfig`. */
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
});

const expectReject = (schema: z.ZodTypeAny, value: unknown): void => {
  const result = schema.safeParse(value);
  expect(result.success, `el esquema debió rechazar ${JSON.stringify(value)}`).toBe(false);
};

const expectRoundTrip = (schema: z.ZodTypeAny, value: unknown): void => {
  const result = schema.safeParse(value);
  expect(result.success, `el esquema debió aceptar ${JSON.stringify(value)}`).toBe(true);
  if (result.success) expect(result.data).toEqual(value);
};

const CREATED_AT = '2026-11-17T10:00:00.000Z';

const validJob = () => ({
  jobId: 'job_demo_001',
  userId: 'user_demo_001',
  status: 'PROCESSING',
  preset: 'BALANCED',
  formats: ['webp', 'avif'],
  bytesBefore: 1000,
  bytesAfter: 600,
  savingsPct: 40,
  exifStripped: true,
  createdAt: CREATED_AT,
  updatedAt: '2026-11-17T10:00:05.000Z',
  ttl: computeTtl(CREATED_AT),
});

const validMetrics = () => ({
  bytesBefore: 100,
  bytesAfter: 60,
  savingsPct: 40,
  exifStripped: true,
});

const validTransport = () => ({
  region: 'us-east-1',
  accountId: '000000000000',
  endpointUrl: 'https://127.0.0.1:9297',
  queueUrl: 'https://sqs.us-east-1.amazonaws.com/000000000000/mediashrink-jobs',
  dlqUrl: 'https://sqs.us-east-1.amazonaws.com/000000000000/mediashrink-jobs-dlq',
});

describe('F01-T01 — inventario y convenios congelados', () => {
  it('versiona los contratos y fija exactamente tres presets', () => {
    expect(CONTRACTS_VERSION).toBe('1.0.0');
    expect(PRESETS).toEqual(['HIGH', 'BALANCED', 'MAX_COMPRESSION']);
  });

  it('fija los cinco estados y los dos formatos de salida', () => {
    expect(JOB_STATUSES).toEqual(['PENDING', 'PROCESSING', 'COMPLETED', 'PARTIAL', 'FAILED']);
    expect(OUTPUT_FORMATS).toEqual(['webp', 'avif']);
  });

  it('congela la retención a 30 días y deriva el TTL del timestamp', () => {
    expect(RETENTION_DAYS).toBe(30);
    expect(TTL_SECONDS).toBe(2_592_000);
    expect(computeTtl(CREATED_AT)).toBe(Math.floor(Date.parse(CREATED_AT) / 1000) + TTL_SECONDS);
  });
});

describe('F01-T01 — Auth (register/login/refresh y usuario autenticado)', () => {
  it('acepta y devuelve sin transformar un registro válido', () => {
    expectRoundTrip(schemas.RegisterInput, { email: 'demo@example.com', password: 'Segura1234' });
  });

  it('rechaza un correo sin formato y una contraseña corta', () => {
    expectReject(schemas.RegisterInput, { email: 'correo-invalido', password: 'Segura1234' });
    expectReject(schemas.RegisterInput, { email: 'demo@example.com', password: 'corta' });
  });

  it('acepta login válido y rechaza credenciales vacías', () => {
    expectRoundTrip(schemas.LoginInput, { email: 'demo@example.com', password: 'Segura1234' });
    expectReject(schemas.LoginInput, { email: '', password: 'Segura1234' });
  });

  it('acepta refresh válido y rechaza un token vacío', () => {
    expectRoundTrip(schemas.RefreshInput, { refreshToken: 'refresh.token.local' });
    expectReject(schemas.RefreshInput, { refreshToken: '' });
  });

  it('acepta un par de tokens y rechaza un tipo de token distinto de Bearer', () => {
    expectRoundTrip(schemas.TokenPair, {
      accessToken: 'access.token.local',
      refreshToken: 'refresh.token.local',
      tokenType: 'Bearer',
      expiresIn: 900,
    });
    expectReject(schemas.TokenPair, {
      accessToken: 'access.token.local',
      refreshToken: 'refresh.token.local',
      tokenType: 'Basic',
      expiresIn: 900,
    });
  });

  it('acepta un usuario autenticado con userId y rechaza uno sin él', () => {
    expectRoundTrip(schemas.AuthenticatedUser, {
      userId: 'user_demo_001',
      email: 'demo@example.com',
      createdAt: CREATED_AT,
    });
    expectReject(schemas.AuthenticatedUser, { email: 'demo@example.com', createdAt: CREATED_AT });
  });
});

describe('F01-T01 — presets, estados y formatos (casos negativos)', () => {
  it('rechaza un preset que no esté en el conjunto congelado', () => {
    expectReject(schemas.Preset, 'ULTRA');
    expectRoundTrip(schemas.Preset, 'MAX_COMPRESSION');
  });

  it('rechaza un estado de job inválido', () => {
    expectReject(schemas.JobStatus, 'QUEUED');
    expectRoundTrip(schemas.JobStatus, 'PARTIAL');
  });

  it('rechaza un formato de salida no permitido', () => {
    expectReject(schemas.OutputFormat, 'gif');
    expectRoundTrip(schemas.OutputFormat, 'webp');
  });
});

describe('F01-T01 — jobs', () => {
  it('acepta un job completo y lo devuelve sin transformar', () => {
    expectRoundTrip(schemas.Job, validJob());
  });

  it('rechaza un job sin userId', () => {
    const { userId: _userId, ...sinUserId } = validJob();
    expect(_userId).toBe('user_demo_001');
    expectReject(schemas.Job, sinUserId);
  });

  it('rechaza un job con preset, estado o formato inválidos', () => {
    expectReject(schemas.Job, { ...validJob(), preset: 'ULTRA' });
    expectReject(schemas.Job, { ...validJob(), status: 'QUEUED' });
    expectReject(schemas.Job, { ...validJob(), formats: ['webp', 'gif'] });
  });

  it('rechaza un TTL que no corresponde a createdAt + 30 días', () => {
    expectReject(schemas.Job, { ...validJob(), ttl: 60 });
  });

  it('rechaza claves desconocidas (validación estricta)', () => {
    expectReject(schemas.Job, { ...validJob(), campoExtra: 'no permitido' });
  });
});

describe('F01-T01 — imágenes', () => {
  it('acepta una imagen procesada y una fallida con motivo', () => {
    expectRoundTrip(schemas.ImageRecord, {
      imageId: 'img_001',
      status: 'COMPLETED',
      bytesBefore: 500,
      bytesAfter: 300,
      exifStripped: true,
    });
    expectRoundTrip(schemas.ImageRecord, {
      imageId: 'img_002',
      status: 'FAILED',
      failureReason: 'magic bytes no coherentes con el MIME',
      exifStripped: false,
    });
  });

  it('rechaza un imageId vacío y un estado individual inválido', () => {
    expectReject(schemas.ImageRecord, {
      imageId: '',
      status: 'COMPLETED',
      exifStripped: true,
    });
    expectReject(schemas.ImageRecord, {
      imageId: 'img_003',
      status: 'QUEUED',
      exifStripped: true,
    });
  });
});

describe('F01-T01 — métricas honestas', () => {
  it('acepta un ahorro del 0 % y uno negativo', () => {
    expectRoundTrip(schemas.JobMetrics, {
      bytesBefore: 100,
      bytesAfter: 100,
      savingsPct: 0,
      exifStripped: true,
    });
    expectRoundTrip(schemas.JobMetrics, {
      bytesBefore: 100,
      bytesAfter: 150,
      savingsPct: -50,
      exifStripped: true,
    });
  });

  it('rechaza un porcentaje incoherente con los bytes', () => {
    expectReject(schemas.JobMetrics, { ...validMetrics(), savingsPct: 99 });
    expectReject(schemas.Job, { ...validJob(), savingsPct: 12.5 });
  });

  it('rechaza un porcentaje no nulo cuando bytesBefore es 0', () => {
    expectReject(schemas.JobMetrics, {
      bytesBefore: 0,
      bytesAfter: 0,
      savingsPct: 10,
      exifStripped: true,
    });
    expectRoundTrip(schemas.JobMetrics, {
      bytesBefore: 0,
      bytesAfter: 0,
      savingsPct: 0,
      exifStripped: true,
    });
  });
});

describe('F01-T01 — límites desde configuración y transporte AWS', () => {
  it('valida los límites tal como los expone el loader de configuración', () => {
    const limits = loadConfig(minimalEnv()).limits;
    expectRoundTrip(schemas.LimitsConfig, limits);
    expectReject(schemas.LimitsConfig, { ...limits, maxPixels: 0 });
  });

  it('acepta QueueUrls canónicas con AWS_ENDPOINT_URL como transporte', () => {
    expectRoundTrip(schemas.AwsTransport, validTransport());
  });

  it('rechaza el puerto retirado :9324 y una QueueUrl fabricada con :9297', () => {
    expectReject(schemas.AwsTransport, {
      ...validTransport(),
      queueUrl: 'http://127.0.0.1:9324/queue/mediashrink-jobs',
    });
    expectReject(schemas.AwsTransport, {
      ...validTransport(),
      dlqUrl: 'https://127.0.0.1:9297/000000000000/mediashrink-jobs-dlq',
    });
  });

  it('rechaza transporte sin HTTPS y una cuenta distinta de la de la QueueUrl', () => {
    expectReject(schemas.AwsTransport, { ...validTransport(), endpointUrl: 'http://127.0.0.1:9297' });
    expectReject(schemas.AwsTransport, { ...validTransport(), accountId: '111111111111' });
  });

  it('congela la política de retención en 30 días', () => {
    expectRoundTrip(schemas.RetentionPolicy, { retentionDays: 30, ttlSeconds: 2_592_000 });
    expectReject(schemas.RetentionPolicy, { retentionDays: 29, ttlSeconds: 2_592_000 });
  });
});

describe('F01-T01 — congelación y sincronía del archivo generado', () => {
  const generated = (): string => readFileSync(GENERATED_FILE, 'utf8');

  const listFrontendSources = (directory: string): string[] => {
    const found: string[] = [];
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const fullPath = join(directory, entry.name);
      if (entry.isDirectory()) found.push(...listFrontendSources(fullPath));
      else if (/\.tsx?$/.test(entry.name)) found.push(fullPath);
    }
    return found;
  };

  it('el archivo generado coincide byte a byte con el catálogo fuente', () => {
    expect(generated()).toBe(generateTypes());
  });

  it('la cabecera fija versión, hash y marcador de raíz sin rutas absolutas', () => {
    expect(CATALOG_HASH).toMatch(/^[a-f0-9]{64}$/);
    expect(generated()).toContain(`Contratos v${CONTRACTS_VERSION}`);
    expect(generated()).toContain(CATALOG_HASH);
    expect(generated()).toContain('<PROJECT_ROOT>');
    expect(generated()).not.toMatch(/[A-Z]:\\/);
  });

  it('declara exactamente los contratos congelados, sin tipos sobrantes', () => {
    const declared = [...generated().matchAll(/export type (\w+) =/g)].map((match) => match[1]);
    expect(declared).toEqual(FROZEN_NAMES);
    expect(FROZEN_NAMES).toHaveLength(14);
  });

  it('el frontend no redefine tipos de producto ni importa del backend', () => {
    const sources = listFrontendSources(join(PROJECT_ROOT, 'frontend/src')).filter(
      (path) => resolve(path) !== resolve(GENERATED_FILE),
    );
    expect(sources.length).toBeGreaterThan(0);
    for (const source of sources) {
      const text = readFileSync(source, 'utf8');
      for (const name of FROZEN_NAMES) {
        expect(text, `${source} no debe redefinir ${name}`).not.toMatch(
          new RegExp(`\\b(?:type|interface)\\s+${name}\\b`),
        );
      }
      expect(text).not.toMatch(/from\s+['"][^'"]*backend\//);
      expect(text).not.toMatch(/from\s+['"][^'"]*contracts/);
    }
  });

  it('los tipos inferidos por Zod coinciden con los tipos generados', () => {
    // Igualdad exacta en tiempo de compilación: si difieren, `npm run typecheck` falla.
    const expectExact = <T extends true>(proof: T): void => {
      expect(proof).toBe(true);
    };
    expectExact<Exact<z.infer<typeof schemas.RegisterInput>, RegisterInput>>(true);
    expectExact<Exact<z.infer<typeof schemas.LoginInput>, LoginInput>>(true);
    expectExact<Exact<z.infer<typeof schemas.RefreshInput>, RefreshInput>>(true);
    expectExact<Exact<z.infer<typeof schemas.TokenPair>, TokenPair>>(true);
    expectExact<Exact<z.infer<typeof schemas.AuthenticatedUser>, AuthenticatedUser>>(true);
    expectExact<Exact<z.infer<typeof schemas.Preset>, Preset>>(true);
    expectExact<Exact<z.infer<typeof schemas.JobStatus>, JobStatus>>(true);
    expectExact<Exact<z.infer<typeof schemas.OutputFormat>, OutputFormat>>(true);
    expectExact<Exact<z.infer<typeof schemas.ImageRecord>, ImageRecord>>(true);
    expectExact<Exact<z.infer<typeof schemas.JobMetrics>, JobMetrics>>(true);
    expectExact<Exact<z.infer<typeof schemas.Job>, Job>>(true);
    expectExact<Exact<z.infer<typeof schemas.LimitsConfig>, LimitsConfig>>(true);
    expectExact<Exact<z.infer<typeof schemas.AwsTransport>, AwsTransport>>(true);
    expectExact<Exact<z.infer<typeof schemas.RetentionPolicy>, RetentionPolicy>>(true);
  });
});
