/**
 * Entrada CLI de `npm run seed` (F01-T04).
 *
 * Uso:
 *   npm run seed -- --dry-run   # solo imprime el plan, sin tocar DynamoDB
 *   npm run seed                # crea/respeta los datos demo en el emulador
 */

import { existsSync, readFileSync } from 'node:fs';

import { loadConfig, parseEnvFile, type AppConfig } from '../../../backend/src/config/index';
import { createDynamoDbDocumentClientFromConfig } from '../../../backend/src/db/client';
import { runSeed, type SeedSummary } from './index';
import { SEED_TABLE_NAME } from './store';

/** Valores locales del emulador: marcadores G-3, nunca credenciales reales. */
const LOCAL_DEFAULTS: Record<string, string> = {
  NODE_ENV: 'development',
  JWT_ACCESS_SECRET: 'REPLACE_WITH_LOCAL_SEED_ACCESS_SECRET',
  JWT_REFRESH_SECRET: 'REPLACE_WITH_LOCAL_SEED_REFRESH_SECRET',
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
  DYNAMODB_TABLE_JOBS: SEED_TABLE_NAME,
};

const EMULATOR_ENDPOINT = 'https://127.0.0.1:9297';

function resolveEnv(): Record<string, string> {
  const fileEnv = existsSync('./.env') ? parseEnvFile(readFileSync('./.env', 'utf8')) : {};
  // El seed es una herramienta local: nunca se ejecuta contra un entorno real.
  return { ...LOCAL_DEFAULTS, ...fileEnv, ...process.env, NODE_ENV: 'development' };
}

function assertEmulatorOnly(config: AppConfig): void {
  if (config.aws.endpointUrl !== EMULATOR_ENDPOINT) {
    throw new Error('El seed solo puede ejecutarse contra el emulador local (AWS_ENDPOINT_URL no autorizado)');
  }
}

function redactPaths(message: string): string {
  return message
    .replace(/[A-Za-z]:\\(?:[^\\\r\n]+\\)*[^\\\r\n]*/g, '<PROJECT_ROOT>')
    .replace(/\\\\[^\\\r\n]+/g, '<PROJECT_ROOT>');
}

function section(title: string, rows: readonly { id: string; status: string; detail: string }[]): string[] {
  const labels: Record<string, string> = {
    created: 'CREADO',
    skipped: 'OMITIDO',
    'would-create': 'SE CREARÍA',
  };
  return [
    '',
    `${title} (${rows.length})`,
    ...rows.map((row) => `  [${labels[row.status] ?? row.status}] ${row.id} — ${row.detail}`),
  ];
}

export function formatReport(summary: SeedSummary): string {
  const lines: string[] = [
    '=== MediaShrink Cloud — seed sintético (F01-T04) ===',
    `Modo: ${summary.dryRun ? 'DRY-RUN (sin escrituras)' : 'ESCRITURA'}`,
    `Tabla DynamoDB: ${summary.tableName}${summary.dryRun ? '' : ` (creada en esta ejecución: ${summary.tableCreated ? 'sí' : 'no'})`}`,
    `Usuarios: creados=${summary.users.created}, omitidos=${summary.users.skipped}`,
    `Lotes: creados=${summary.jobs.created}, omitidos=${summary.jobs.skipped}`,
    `Imágenes 100x100: creadas=${summary.images.created}, omitidas=${summary.images.skipped}`,
  ];

  if (summary.dryRun) {
    lines.push('Nota: --dry-run no ha abierto conexión con DynamoDB ni ha escrito nada.');
  } else {
    lines.push(
      `Conteo en emulador ANTES: usuarios=${summary.countsBefore.users}, jobs=${summary.countsBefore.jobs}, imágenes=${summary.countsBefore.images}, total=${summary.countsBefore.total}`,
      `Conteo en emulador DESPUÉS: usuarios=${summary.countsAfter.users}, jobs=${summary.countsAfter.jobs}, imágenes=${summary.countsAfter.images}, total=${summary.countsAfter.total}`,
    );
  }

  lines.push(...section('Usuarios demo (ficticios; contraseña hasheada con T03)', summary.users.items));
  lines.push(...section('Lotes demo', summary.jobs.items));
  lines.push(...section('Imágenes sintéticas 100x100 (generadas por código)', summary.images.items));
  lines.push('=== Fin del seed ===');
  return lines.join('\n');
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const config = loadConfig(resolveEnv());
  assertEmulatorOnly(config);
  const client = createDynamoDbDocumentClientFromConfig(config);
  const summary = await runSeed({ client, tableName: SEED_TABLE_NAME }, { dryRun });
  client.destroy();
  console.log(formatReport(summary));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`seed falló: ${redactPaths(message)}`);
  process.exitCode = 1;
});
