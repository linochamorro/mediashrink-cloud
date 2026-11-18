/**
 * Materialización en Zod del catálogo canónico (F01-T01, fase GREEN).
 *
 * Los esquemas son estrictos: rechazan claves desconocidas y validan tanto
 * formatos (email, ISO 8601, HTTPS, 12 dígitos) como coherencias cruzadas
 * (ahorro real, TTL de 30 días y QueueUrls canónicas).
 */

import { z } from 'zod';

import {
  CATALOG,
  computeTtl,
  type ContractSpec,
  type FieldMap,
  type FieldSpec,
  type FieldType,
  type InferContract,
} from './catalog';

function buildFieldType(type: FieldType): z.ZodTypeAny {
  switch (type.type) {
    case 'string': {
      if (type.format === 'https-url') {
        return z
          .string()
          .url()
          .refine(
            (value: string) => {
              try {
                return new URL(value).protocol === 'https:';
              } catch {
                return false;
              }
            },
            { message: 'la URL debe usar https' },
          );
      }
      let schema = z.string();
      if (type.format === 'email') schema = schema.email();
      if (type.format === 'datetime') schema = schema.datetime();
      if (type.format === 'nonempty') schema = schema.min(1);
      if (type.format === 'digits12') schema = schema.regex(/^\d{12}$/);
      if (type.min !== undefined) schema = schema.min(type.min);
      if (type.max !== undefined) schema = schema.max(type.max);
      return schema;
    }
    case 'number': {
      let schema = z.number().finite();
      if (type.min !== undefined) schema = schema.min(type.min);
      if (type.max !== undefined) schema = schema.max(type.max);
      return schema;
    }
    case 'integer': {
      let schema = z.number().finite().int();
      if (type.min !== undefined) schema = schema.min(type.min);
      if (type.max !== undefined) schema = schema.max(type.max);
      return schema;
    }
    case 'boolean':
      return z.boolean();
    case 'enum':
      return z.enum(type.values);
    case 'literal':
      return z.literal(type.value);
    case 'array': {
      let arraySchema = z.array(buildFieldType(type.items));
      if (type.min !== undefined) arraySchema = arraySchema.min(type.min);
      if (type.max !== undefined) arraySchema = arraySchema.max(type.max);
      let schema: z.ZodTypeAny = arraySchema;
      if (type.unique === true) {
        schema = schema.refine((items: unknown[]) => new Set(items).size === items.length, {
          message: 'no se permiten formatos duplicados',
        });
      }
      if (type.includes !== undefined) {
        const required = type.includes;
        schema = schema.refine(
          (items: unknown[]) => required.every((value) => items.includes(value)),
          { message: 'formats debe incluir webp y avif (IN-01)' },
        );
      }
      return schema;
    }
    case 'object':
      return buildObject(type.fields);
  }
}

function buildField(spec: FieldSpec): z.ZodTypeAny {
  let schema = buildFieldType(spec.type);
  if (spec.nullable === true) schema = schema.nullable();
  if (spec.optional === true) schema = schema.optional();
  return schema;
}

function buildObject(fields: FieldMap): z.ZodTypeAny {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const [name, spec] of Object.entries(fields)) shape[name] = buildField(spec);
  return z.object(shape).strict();
}

type ObjectLike = Record<string, unknown>;

function addIssue(
  ctx: z.RefinementCtx,
  path: string,
  message: string,
): void {
  ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
}

function refineSavings(value: unknown, ctx: z.RefinementCtx): void {
  const object = value as ObjectLike;
  const before = object.bytesBefore;
  const after = object.bytesAfter;
  const percent = object.savingsPct;
  if (typeof before !== 'number' || typeof after !== 'number' || typeof percent !== 'number') {
    return; // los errores de tipo los reporta la validación de campo
  }
  const expected = before === 0 ? 0 : ((before - after) / before) * 100;
  if (Math.abs(percent - expected) > 0.01) {
    addIssue(ctx, 'savingsPct', 'savingsPct no coincide con bytesBefore y bytesAfter');
  }
}

function refineTtl(value: unknown, ctx: z.RefinementCtx): void {
  const object = value as ObjectLike;
  const createdAt = object.createdAt;
  const ttl = object.ttl;
  if (typeof createdAt !== 'string' || typeof ttl !== 'number') return;
  let expected: number;
  try {
    expected = computeTtl(createdAt);
  } catch {
    return; // createdAt ya fue validado como ISO 8601
  }
  if (ttl !== expected) addIssue(ctx, 'ttl', 'ttl debe ser createdAt + 30 días en segundos Unix');
}

function refineCanonicalQueueUrls(value: unknown, ctx: z.RefinementCtx): void {
  const object = value as ObjectLike;
  const { region, accountId, endpointUrl, queueUrl, dlqUrl } = object;
  if (
    typeof region !== 'string' ||
    typeof accountId !== 'string' ||
    typeof endpointUrl !== 'string' ||
    typeof queueUrl !== 'string' ||
    typeof dlqUrl !== 'string'
  ) {
    return;
  }

  const all = { endpointUrl, queueUrl, dlqUrl };
  for (const [name, raw] of Object.entries(all)) {
    if (raw.includes(':9324')) addIssue(ctx, name, 'el puerto retirado :9324 no está permitido');
    try {
      if (new URL(raw).protocol !== 'https:') addIssue(ctx, name, 'la URL debe usar https');
    } catch {
      // z.string().url() ya reportó el formato inválido
    }
  }

  let endpointHost = '';
  try {
    endpointHost = new URL(endpointUrl).host;
  } catch {
    endpointHost = '';
  }

  const canonicalPrefix = `https://sqs.${region}.amazonaws.com/${accountId}/`;
  for (const name of ['queueUrl', 'dlqUrl'] as const) {
    const raw = all[name];
    if (raw.includes(':9297') || (endpointHost !== '' && raw.includes(endpointHost))) {
      addIssue(ctx, name, 'AWS_ENDPOINT_URL es transporte, no host de la QueueUrl');
    }
    if (!raw.startsWith(canonicalPrefix) || raw.length === canonicalPrefix.length) {
      addIssue(ctx, name, 'QueueUrl canónica esperada: https://sqs.<región>.amazonaws.com/<cuenta>/<cola>');
    }
  }
}

function applyRefinements(schema: z.ZodTypeAny, spec: ContractSpec): z.ZodTypeAny {
  let output = schema;
  for (const refinement of spec.refinement ?? []) {
    if (refinement === 'savings-coherence') {
      output = output.superRefine(refineSavings);
    } else if (refinement === 'ttl-coherence') {
      output = output.superRefine(refineTtl);
    } else if (refinement === 'canonical-queue-urls') {
      output = output.superRefine(refineCanonicalQueueUrls);
    }
  }
  return output;
}

/** Construye el esquema Zod tipado de un contrato del catálogo. */
export function buildSchema<S extends ContractSpec>(spec: S): z.ZodType<InferContract<S>> {
  const base =
    spec.root !== undefined
      ? buildFieldType(spec.root)
      : buildObject(spec.fields ?? {});
  return applyRefinements(base, spec) as unknown as z.ZodType<InferContract<S>>;
}

/** Esquemas congelados, nombre → validador. */
export const schemas = {
  RegisterInput: buildSchema(CATALOG.RegisterInput),
  LoginInput: buildSchema(CATALOG.LoginInput),
  RefreshInput: buildSchema(CATALOG.RefreshInput),
  TokenPair: buildSchema(CATALOG.TokenPair),
  AuthenticatedUser: buildSchema(CATALOG.AuthenticatedUser),
  Preset: buildSchema(CATALOG.Preset),
  JobStatus: buildSchema(CATALOG.JobStatus),
  OutputFormat: buildSchema(CATALOG.OutputFormat),
  ImageRecord: buildSchema(CATALOG.ImageRecord),
  JobMetrics: buildSchema(CATALOG.JobMetrics),
  Job: buildSchema(CATALOG.Job),
  LimitsConfig: buildSchema(CATALOG.LimitsConfig),
  AwsTransport: buildSchema(CATALOG.AwsTransport),
  RetentionPolicy: buildSchema(CATALOG.RetentionPolicy),
} as const;

export type Schemas = typeof schemas;
