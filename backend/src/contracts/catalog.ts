/**
 * Catálogo canónico de contratos congelados de MediaShrink Cloud (F01-T01).
 *
 * FUENTE ÚNICA: de este catálogo se materializan (1) los esquemas Zod de
 * validación en `zod-schemas.ts` y (2) los tipos TypeScript del frontend en
 * `frontend/src/api/types.generated.ts` mediante `generate.ts`. Ningún tipo
 * de producto se redefine a mano en el frontend.
 *
 * Cambiar este archivo cambia el hash SHA-256 del catálogo y, por tanto,
 * invalida el archivo generado: el test de congelación lo detecta.
 */

import { createHash } from 'node:crypto';

export const CONTRACTS_VERSION = '1.1.0';
export const RETENTION_DAYS = 30;
/** Literal explícito (30 × 24 × 60 × 60) para conservar el tipo literal en el contrato. */
export const TTL_SECONDS = 2_592_000;

export const PRESET_VALUES = ['HIGH', 'BALANCED', 'MAX_COMPRESSION'] as const;
export const JOB_STATUS_VALUES = [
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'PARTIAL',
  'FAILED',
] as const;
export const OUTPUT_FORMAT_VALUES = ['webp', 'avif'] as const;

export const PRESETS = PRESET_VALUES;
export const JOB_STATUSES = JOB_STATUS_VALUES;
export const OUTPUT_FORMATS = OUTPUT_FORMAT_VALUES;

/** Timestamp ISO 8601 → segundos Unix del TTL (retención de 30 días, IN-09). */
export function computeTtl(createdAtIso: string): number {
  const milliseconds = Date.parse(createdAtIso);
  if (!Number.isFinite(milliseconds)) {
    throw new Error('createdAt debe ser un timestamp ISO 8601 válido');
  }
  return Math.floor(milliseconds / 1000) + TTL_SECONDS;
}

/* -------------------------------------------------------------------------- */
/* DSL mínimo del catálogo                                                     */
/* -------------------------------------------------------------------------- */

export type StringFormat = 'email' | 'datetime' | 'nonempty' | 'digits12' | 'https-url';
export type RefinementName =
  | 'savings-coherence'
  | 'ttl-coherence'
  | 'canonical-queue-urls';

export type FieldType =
  | { readonly type: 'string'; readonly format?: StringFormat; readonly min?: number; readonly max?: number }
  | { readonly type: 'number'; readonly min?: number; readonly max?: number }
  | { readonly type: 'integer'; readonly min?: number; readonly max?: number }
  | { readonly type: 'boolean' }
  | { readonly type: 'enum'; readonly values: readonly [string, ...string[]] }
  | { readonly type: 'literal'; readonly value: string | number | boolean }
  | {
      readonly type: 'array';
      readonly items: FieldType;
      readonly min?: number;
      readonly max?: number;
      readonly unique?: true;
      readonly includes?: readonly string[];
    }
  | { readonly type: 'object'; readonly fields: FieldMap };

export interface FieldSpec {
  readonly type: FieldType;
  readonly optional?: true;
  readonly nullable?: true;
  readonly description?: string;
}

export type FieldMap = Readonly<Record<string, FieldSpec>>;

export interface ContractSpec {
  /** Versión del contrato dentro de `CONTRACTS_VERSION`. */
  readonly version: number;
  readonly description: string;
  /** Objeto con claves; alternativamente, `root` define un contrato no-objeto. */
  readonly fields?: FieldMap;
  readonly root?: FieldType;
  readonly refinement?: readonly RefinementName[];
}

export type Catalog = Readonly<Record<string, ContractSpec>>;

/* -------------------------------------------------------------------------- */
/* Proyección de tipos (misma fuente que consume el generador)                 */
/* -------------------------------------------------------------------------- */

/** Elimina `readonly` del catálogo `as const` para igualar los tipos generados. */
type Simplify<T> = { -readonly [K in keyof T]: T[K] };

export type InferFieldType<T extends FieldType> = T extends { type: 'string' }
  ? string
  : T extends { type: 'number' | 'integer' }
    ? number
    : T extends { type: 'boolean' }
      ? boolean
      : T extends { type: 'enum'; values: readonly (infer V)[] }
        ? V
        : T extends { type: 'literal'; value: infer V }
          ? V
          : T extends { type: 'array'; items: infer I }
            ? I extends FieldType
              ? InferFieldType<I>[]
              : never
            : T extends { type: 'object'; fields: infer F }
              ? F extends FieldMap
                ? InferFields<F>
                : never
              : never;

type InferFieldSpec<S extends FieldSpec> =
  | InferFieldType<S['type']>
  | (S extends { nullable: true } ? null : never);

export type InferFields<F extends FieldMap> = Simplify<
  { [K in keyof F as F[K] extends { optional: true } ? never : K]: InferFieldSpec<F[K]> } & {
    [K in keyof F as F[K] extends { optional: true } ? K : never]?: InferFieldSpec<F[K]>;
  }
>;

export type InferContract<S extends ContractSpec> = S extends { root: infer R }
  ? R extends FieldType
    ? InferFieldType<R>
    : never
  : S extends { fields: infer F }
    ? F extends FieldMap
      ? InferFields<F>
      : never
    : never;

/* -------------------------------------------------------------------------- */
/* Contratos congelados                                                        */
/* -------------------------------------------------------------------------- */

/* `as const` conserva los literales: la proyección de tipos depende de ello. */
const NON_EMPTY = { type: 'string', format: 'nonempty' } as const;
const ISO_DATETIME = { type: 'string', format: 'datetime' } as const;
const EMAIL = { type: 'string', format: 'email' } as const;
const BOOLEAN = { type: 'boolean' } as const;
const POSITIVE_INT = { type: 'integer', min: 1 } as const;
const NON_NEGATIVE_INT = { type: 'integer', min: 0 } as const;
const METRIC_FIELDS = {
  bytesBefore: { type: NON_NEGATIVE_INT },
  bytesAfter: { type: NON_NEGATIVE_INT },
  savingsPct: { type: { type: 'number' } },
  exifStripped: { type: BOOLEAN },
} as const;

export const CATALOG = {
  RegisterInput: {
    version: 1,
    description: 'Alta de usuario: correo y contraseña en claro solo en la petición.',
    fields: {
      email: { type: EMAIL },
      password: { type: { type: 'string', min: 8, max: 128 } },
    },
  },
  LoginInput: {
    version: 1,
    description: 'Credenciales de acceso; la contraseña nunca se almacena en claro.',
    fields: {
      email: { type: EMAIL },
      password: { type: NON_EMPTY },
    },
  },
  RefreshInput: {
    version: 1,
    description: 'Renovación de sesión sin reenviar credenciales.',
    fields: { refreshToken: { type: NON_EMPTY } },
  },
  TokenPair: {
    version: 1,
    description: 'Par JWT (access + refresh) emitido por auth.',
    fields: {
      accessToken: { type: NON_EMPTY },
      refreshToken: { type: NON_EMPTY },
      tokenType: { type: { type: 'literal', value: 'Bearer' } },
      expiresIn: { type: POSITIVE_INT },
    },
  },
  AuthenticatedUser: {
    version: 1,
    description: 'Usuario autenticado; userId es la clave de aislamiento (PR-07).',
    fields: {
      userId: { type: NON_EMPTY },
      email: { type: EMAIL },
      createdAt: { type: ISO_DATETIME },
    },
  },
  Preset: {
    version: 1,
    description: 'Uno de los tres presets de calidad (IN-02).',
    root: { type: 'enum', values: PRESET_VALUES },
  },
  JobStatus: {
    version: 1,
    description: 'Estados agregados del lote (FR-14, §6 del spec).',
    root: { type: 'enum', values: JOB_STATUS_VALUES },
  },
  OutputFormat: {
    version: 1,
    description: 'Formatos de salida permitidos; miniaturas WebP (IN-01, A-04).',
    root: { type: 'enum', values: OUTPUT_FORMAT_VALUES },
  },
  ImageRecord: {
    version: 1,
    description: 'Ítem hijo por imagen: estado individual, bytes y motivo de fallo.',
    fields: {
      imageId: { type: NON_EMPTY },
      status: { type: { type: 'enum', values: JOB_STATUS_VALUES } },
      bytesBefore: { type: NON_NEGATIVE_INT, optional: true },
      bytesAfter: { type: NON_NEGATIVE_INT, optional: true },
      failureReason: { type: NON_EMPTY, optional: true },
      exifStripped: { type: BOOLEAN },
    },
  },
  JobMetrics: {
    version: 1,
    description: 'Métricas reales: ahorro calculado con bytes, sin ocultar 0 % ni negativo.',
    refinement: ['savings-coherence'],
    fields: METRIC_FIELDS,
  },
  Job: {
    version: 1,
    description: 'Lote completo: identidad, estado, preset, formatos, métricas y TTL.',
    refinement: ['savings-coherence', 'ttl-coherence'],
    fields: {
      jobId: { type: NON_EMPTY },
      userId: { type: NON_EMPTY },
      name: { type: { type: 'string', max: 80 } as const, optional: true },
      status: { type: { type: 'enum', values: JOB_STATUS_VALUES } },
      preset: { type: { type: 'enum', values: PRESET_VALUES } },
      formats: {
        type: {
          type: 'array',
          items: { type: 'enum', values: OUTPUT_FORMAT_VALUES },
          min: 1,
          unique: true,
          includes: OUTPUT_FORMAT_VALUES,
        },
      },
      ...METRIC_FIELDS,
      createdAt: { type: ISO_DATETIME },
      updatedAt: { type: ISO_DATETIME },
      ttl: { type: POSITIVE_INT },
    },
  },
  LimitsConfig: {
    version: 1,
    description: 'Límites de validación estricta y anti-bomba leídos desde la configuración.',
    fields: {
      maxFileSizeMb: { type: POSITIVE_INT },
      maxImagesPerBatch: { type: POSITIVE_INT },
      maxPixels: { type: POSITIVE_INT },
    },
  },
  AwsTransport: {
    version: 1,
    description:
      'Colas canónicas (host AWS lógico) con AWS_ENDPOINT_URL como transporte; sin :9324 ni :9297 en la QueueUrl.',
    refinement: ['canonical-queue-urls'],
    fields: {
      region: { type: NON_EMPTY },
      accountId: { type: { type: 'string', format: 'digits12' } },
      endpointUrl: { type: { type: 'string', format: 'https-url' } },
      queueUrl: { type: { type: 'string', format: 'https-url' } },
      dlqUrl: { type: { type: 'string', format: 'https-url' } },
    },
  },
  RetentionPolicy: {
    version: 1,
    description: 'Ciclo de vida S3 y TTL DynamoDB fijados en 30 días (IN-09).',
    fields: {
      retentionDays: { type: { type: 'literal', value: RETENTION_DAYS } },
      ttlSeconds: { type: { type: 'literal', value: TTL_SECONDS } },
    },
  },
} as const satisfies Catalog;

export type ContractName = keyof typeof CATALOG;
export type ContractTypes = {
  [K in ContractName]: InferContract<(typeof CATALOG)[K]>;
};

/** Serialización canónica estable (el orden de claves del literal es fijo). */
export function canonicalCatalogJson(): string {
  return JSON.stringify({ version: CONTRACTS_VERSION, contracts: CATALOG });
}

/** Huella del catálogo: cualquier cambio rompe la sincronía del archivo generado. */
export function catalogHash(): string {
  return createHash('sha256').update(canonicalCatalogJson(), 'utf8').digest('hex');
}

export const CATALOG_HASH = catalogHash();
