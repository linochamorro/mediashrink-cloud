/**
 * Carga y validación de la configuración de MediaShrink Cloud (F00-T01).
 *
 * Responsabilidad: validar variables de entorno, aplicar valores por defecto
 * seguros, convertir tipos y rechazar secretos con aspecto real (G-3).
 * No contiene esquemas Zod de dominio: esos se congelan en Fase 1.
 */

export type NodeEnv = 'development' | 'test' | 'production';

/** Tipos primitivos de la configuración tipada que consume el resto del backend. */
export interface AppConfig {
  app: { env: NodeEnv; port: number; corsOrigin: string };
  limits: { maxFileSizeMb: number; maxImagesPerBatch: number; maxPixels: number };
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessTtlSeconds: number;
    refreshTtlSeconds: number;
  };
  rateLimit: { authMax: number; authWindowMs: number };
  aws: {
    region: string;
    endpointUrl: string;
    // El emulador genera credenciales en cada arranque: se consumen desde
    // archivos, nunca desde variables de entorno con secretos fijos (G-3/A-03).
    sharedCredentialsFile: string;
    configFile: string;
    ec2MetadataDisabled: boolean;
    accountId: string;
    useSsl: boolean;
    caBundlePath: string;
  };
  resources: {
    s3BucketRaw: string;
    s3BucketOptimized: string;
    sqsQueueUrl: string;
    sqsDlqUrl: string;
    dynamodbTableJobs: string;
  };
  worker: { retentionDays: number; sqsMaxRetries: number; pollIntervalMs: number };
}

/** Inventario completo: debe coincidir exactamente con `.env.example`. */
export const ALL_ENV_KEYS: readonly string[] = [
  'NODE_ENV',
  'PORT',
  'CORS_ORIGIN',
  'MAX_FILE_SIZE_MB',
  'MAX_IMAGES_PER_BATCH',
  'MAX_PIXELS',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'JWT_ACCESS_TTL',
  'JWT_REFRESH_TTL',
  'RATE_LIMIT_AUTH_MAX',
  'RATE_LIMIT_AUTH_WINDOW_MS',
  'AWS_REGION',
  'AWS_ENDPOINT_URL',
  'AWS_SHARED_CREDENTIALS_FILE',
  'AWS_CONFIG_FILE',
  'AWS_EC2_METADATA_DISABLED',
  'AWS_ACCOUNT_ID',
  'USE_SSL',
  'CA_BUNDLE_PATH',
  'S3_BUCKET_RAW',
  'S3_BUCKET_OPTIMIZED',
  'SQS_QUEUE_URL',
  'SQS_DLQ_URL',
  'DYNAMODB_TABLE_JOBS',
  'RETENTION_DAYS',
  'SQS_MAX_RETRIES',
  'POLL_INTERVAL_MS',
];

/** Sin estas variables no es posible apuntar a un recurso seguro y conocido. */
export const REQUIRED_ENV_KEYS: readonly string[] = [
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'AWS_ENDPOINT_URL',
  'S3_BUCKET_RAW',
  'S3_BUCKET_OPTIMIZED',
  'SQS_QUEUE_URL',
  'SQS_DLQ_URL',
  'DYNAMODB_TABLE_JOBS',
];

const NODE_ENVS: readonly NodeEnv[] = ['development', 'test', 'production'];

/** Marcadores locales legítimos: nunca son secretos reales (G-3). */
const LOCAL_PLACEHOLDER_PREFIX_PATTERN = /^(?:REPLACE_WITH_|CHANGE_ME|YOUR_)/i;
const LOCAL_PLACEHOLDER_EXACT_PATTERN =
  /^(?:<.*>|test|dummy|local|example|dev|dev-only|replace-me|placeholder|fake|sample)$/i;

/** Patrones evidentes de credencial real. Nunca se incluye el valor en el error. */
const REAL_SECRET_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/^AKIA[0-9A-Z]{16}$/, 'AWS Access Key ID'],
  [/^ASIA[0-9A-Z]{16}$/, 'AWS Access Key ID temporal'],
  [/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/, 'JWT'],
  [/^(?:ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{20,}$/, 'token de GitHub'],
  [/^[A-Fa-f0-9]{32,}$/, 'cadena hexadecimal larga'],
  [/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z0-9+/=_-]{24,}$/, 'secreto aleatorio largo'],
];

type EnvSource = Readonly<Record<string, string | undefined>>;

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

/** Parsea un archivo `.env` minimalista (comentarios, líneas vacías y comillas). */
export function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;

    const separator = line.indexOf('=');
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim().replace(/^export\s+/, '');
    let value = line.slice(separator + 1).trim();
    const quoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"));
    if (quoted) value = value.slice(1, -1);

    if (key !== '') result[key] = value;
  }

  return result;
}

/** Devuelve la etiqueta del patrón de secreto real detectado, o `null`. */
export function findRealSecretPattern(value: string): string | null {
  if (isLocalPlaceholder(value)) return null;

  const trimmed = value.trim();
  for (const [pattern, label] of REAL_SECRET_PATTERNS) {
    if (pattern.test(trimmed)) return label;
  }
  return null;
}

export function isLocalPlaceholder(value: string): boolean {
  const trimmed = value.trim();
  return (
    LOCAL_PLACEHOLDER_PREFIX_PATTERN.test(trimmed) || LOCAL_PLACEHOLDER_EXACT_PATTERN.test(trimmed)
  );
}

/** Lanza `ConfigError` si el valor parece una credencial real; nunca imprime el valor. */
export function assertNoRealSecret(value: string, name = 'environment value'): void {
  const pattern = findRealSecretPattern(value);
  if (pattern !== null) {
    throw new ConfigError(
      `${name} looks like a real ${pattern} (G-3). Use a local development placeholder instead.`,
    );
  }
}

/** Puerto SQS que ya no expone el emulador (hallazgo A-03). */
const RETIRED_EMULATOR_PORT_PATTERN = /:9324(?:\D|$)/;

export function assertNoRetiredEmulatorPort(value: string, name: string): void {
  if (RETIRED_EMULATOR_PORT_PATTERN.test(value)) {
    throw new ConfigError(
      `${name} uses the retired emulator port :9324; aws-emulator only exposes https://127.0.0.1:9297`,
    );
  }
}

/** Las QueueUrl del emulador y de AWS son siempre HTTPS; nunca se imprime el valor. */
export function assertHttpsUrl(value: string, name: string): void {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new ConfigError(`Invalid URL for ${name}: expected an absolute https URL`);
  }
  if (parsed.protocol !== 'https:') {
    throw new ConfigError(`${name} must use https (aws-emulator serves HTTPS only)`);
  }
}

function readRequired(env: EnvSource, key: string): string {
  const raw = env[key];
  if (raw === undefined || raw.trim() === '') {
    throw new ConfigError(`Missing required environment variable: ${key}`);
  }
  return raw.trim();
}

function readString(env: EnvSource, key: string, fallback: string): string {
  const raw = env[key];
  return raw === undefined || raw.trim() === '' ? fallback : raw.trim();
}

function readPositiveInt(env: EnvSource, key: string, fallback: number, max = Number.MAX_SAFE_INTEGER): number {
  const raw = env[key];
  if (raw === undefined || raw.trim() === '') return fallback;

  const trimmed = raw.trim();
  const parsed = /^\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN;
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
    throw new ConfigError(
      `Invalid value for ${key}: expected an integer between 1 and ${max}, got "${raw}"`,
    );
  }
  return parsed;
}

function readBool(env: EnvSource, key: string, fallback: boolean): boolean {
  const raw = env[key];
  if (raw === undefined || raw.trim() === '') return fallback;

  const value = raw.trim().toLowerCase();
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new ConfigError(`Invalid value for ${key}: expected "true" or "false", got "${raw}"`);
}

function readNodeEnv(env: EnvSource): NodeEnv {
  const raw = env.NODE_ENV;
  if (raw === undefined || raw.trim() === '') return 'development';

  const value = raw.trim() as NodeEnv;
  if (!NODE_ENVS.includes(value)) {
    throw new ConfigError(
      `Invalid value for NODE_ENV: expected ${NODE_ENVS.join(', ')}, got "${raw}"`,
    );
  }
  return value;
}

/**
 * Valida el entorno y devuelve la configuración tipada.
 *
 * @throws ConfigError con el nombre de la variable responsable del fallo.
 */
export function loadConfig(env: EnvSource = process.env): AppConfig {
  const nodeEnv = readNodeEnv(env);

  const jwtAccessSecret = readRequired(env, 'JWT_ACCESS_SECRET');
  const jwtRefreshSecret = readRequired(env, 'JWT_REFRESH_SECRET');
  const endpointUrl = readRequired(env, 'AWS_ENDPOINT_URL');
  const s3BucketRaw = readRequired(env, 'S3_BUCKET_RAW');
  const s3BucketOptimized = readRequired(env, 'S3_BUCKET_OPTIMIZED');
  const sqsQueueUrl = readRequired(env, 'SQS_QUEUE_URL');
  const sqsDlqUrl = readRequired(env, 'SQS_DLQ_URL');
  const dynamodbTableJobs = readRequired(env, 'DYNAMODB_TABLE_JOBS');

  for (const key of ALL_ENV_KEYS) {
    const value = env[key];
    if (value !== undefined && value.trim() !== '') {
      assertNoRealSecret(value, key);
      assertNoRetiredEmulatorPort(value, key);
    }
  }

  assertHttpsUrl(sqsQueueUrl, 'SQS_QUEUE_URL');
  assertHttpsUrl(sqsDlqUrl, 'SQS_DLQ_URL');

  if (nodeEnv === 'production') {
    for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const) {
      const value = env[key] ?? '';
      if (isLocalPlaceholder(value)) {
        throw new ConfigError(
          `Insecure placeholder in ${key} is not allowed when NODE_ENV=production`,
        );
      }
    }
  }

  const accessTtlSeconds = readPositiveInt(env, 'JWT_ACCESS_TTL', 900);
  const refreshTtlSeconds = readPositiveInt(env, 'JWT_REFRESH_TTL', 604_800);
  if (accessTtlSeconds >= refreshTtlSeconds) {
    throw new ConfigError(
      `JWT_ACCESS_TTL (${accessTtlSeconds}) must be less than JWT_REFRESH_TTL (${refreshTtlSeconds})`,
    );
  }

  return {
    app: {
      env: nodeEnv,
      port: readPositiveInt(env, 'PORT', 3001, 65_535),
      corsOrigin: readString(env, 'CORS_ORIGIN', 'http://localhost:5173'),
    },
    limits: {
      maxFileSizeMb: readPositiveInt(env, 'MAX_FILE_SIZE_MB', 15),
      maxImagesPerBatch: readPositiveInt(env, 'MAX_IMAGES_PER_BATCH', 20),
      maxPixels: readPositiveInt(env, 'MAX_PIXELS', 25_000_000),
    },
    jwt: {
      accessSecret: jwtAccessSecret,
      refreshSecret: jwtRefreshSecret,
      accessTtlSeconds,
      refreshTtlSeconds,
    },
    rateLimit: {
      authMax: readPositiveInt(env, 'RATE_LIMIT_AUTH_MAX', 5),
      authWindowMs: readPositiveInt(env, 'RATE_LIMIT_AUTH_WINDOW_MS', 60_000),
    },
    aws: {
      region: readString(env, 'AWS_REGION', 'us-east-1'),
      endpointUrl,
      sharedCredentialsFile: readString(
        env,
        'AWS_SHARED_CREDENTIALS_FILE',
        './.local/aws-emulator/emulator_credentials',
      ),
      configFile: readString(env, 'AWS_CONFIG_FILE', './.local/aws-emulator/config'),
      ec2MetadataDisabled: readBool(env, 'AWS_EC2_METADATA_DISABLED', true),
      accountId: readString(env, 'AWS_ACCOUNT_ID', '000000000000'),
      useSsl: readBool(env, 'USE_SSL', true),
      caBundlePath: readString(env, 'CA_BUNDLE_PATH', './.local/aws-emulator/ca.pem'),
    },
    resources: {
      s3BucketRaw,
      s3BucketOptimized,
      sqsQueueUrl,
      sqsDlqUrl,
      dynamodbTableJobs,
    },
    worker: {
      retentionDays: readPositiveInt(env, 'RETENTION_DAYS', 30),
      sqsMaxRetries: readPositiveInt(env, 'SQS_MAX_RETRIES', 3),
      pollIntervalMs: readPositiveInt(env, 'POLL_INTERVAL_MS', 2000),
    },
  };
}
