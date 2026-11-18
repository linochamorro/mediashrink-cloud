/**
 * F04-T05 — guardia de retención (F04T01-A-01 / F04T03-A-03, MEDIUM).
 *
 * Falla el job si divergen las declaraciones de retención de los cuatro
 * sistemas: Terraform (default HCL + salidas aplicadas), `.env.example`,
 * el catálogo congelado y el lifecycle/TTL reales verificados en vivo.
 * No modifica ninguna de esas fuentes: solo las compara.
 */

import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

import {
  EXPECTED_RETENTION_DAYS,
  EXPECTED_TTL_SECONDS,
  readTerraformOutputs,
  tfValue,
} from './emulator';

function matchOne(source: string, pattern: RegExp, label: string): string {
  const match = source.match(pattern);
  if (match?.[1] === undefined) {
    throw new Error(`No se pudo leer ${label} con ${pattern.source}`);
  }
  return match[1];
}

function numeric(text: string): number {
  return Number(text.replaceAll('_', ''));
}

it('retention_days=30 coincide en Terraform, .env.example y el catálogo congelado', () => {
  const envExample = readFileSync('.env.example', 'utf8');
  const catalog = readFileSync('backend/src/contracts/catalog.ts', 'utf8');
  const s3Tf = readFileSync('infra/terraform/s3.tf', 'utf8');
  const outputs = readTerraformOutputs();

  const envDays = numeric(matchOne(envExample, /^RETENTION_DAYS=(\d+)$/m, 'RETENTION_DAYS'));
  const catalogDays = numeric(
    matchOne(catalog, /export const RETENTION_DAYS\s*=\s*([\d_]+);/, 'RETENTION_DAYS del catálogo'),
  );
  const catalogTtl = numeric(
    matchOne(catalog, /export const TTL_SECONDS\s*=\s*([\d_]+);/, 'TTL_SECONDS del catálogo'),
  );
  const tfDefaultDays = Number(
    matchOne(
      s3Tf,
      /variable "retention_days"\s*\{[\s\S]*?default\s*=\s*(\d+)/,
      'default de var.retention_days',
    ),
  );
  const appliedDays = Number(tfValue(outputs, 's3_lifecycle_expiration_days'));
  const appliedTtl = Number(tfValue(outputs, 'dynamodb_ttl_seconds'));

  console.log(
    'RETENTION_GUARD: ' +
      JSON.stringify({
        EXPECTED_DAYS: EXPECTED_RETENTION_DAYS,
        EXPECTED_TTL_SECONDS: EXPECTED_TTL_SECONDS,
        ENV_RETENTION_DAYS: envDays,
        CATALOG_RETENTION_DAYS: catalogDays,
        CATALOG_TTL_SECONDS: catalogTtl,
        TF_DEFAULT_RETENTION_DAYS: tfDefaultDays,
        TF_APPLIED_RETENTION_DAYS: appliedDays,
        TF_APPLIED_TTL_SECONDS: appliedTtl,
      }),
  );

  for (const [label, value] of [
    ['RETENTION_DAYS en .env.example', envDays],
    ['RETENTION_DAYS en el catálogo', catalogDays],
    ['default de var.retention_days en s3.tf', tfDefaultDays],
    ['s3_lifecycle_expiration_days aplicado', appliedDays],
  ] as const) {
    expect(value, label).toBe(EXPECTED_RETENTION_DAYS);
  }
  expect(catalogTtl, 'TTL_SECONDS del catálogo congelado').toBe(EXPECTED_TTL_SECONDS);
  expect(appliedTtl, 'dynamodb_ttl_seconds aplicado').toBe(EXPECTED_TTL_SECONDS);
  expect(appliedTtl, 'TTL = retention_days * 86400').toBe(appliedDays * 86_400);
});
