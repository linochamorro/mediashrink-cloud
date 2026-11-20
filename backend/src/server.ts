/**
 * Arranque local del stack real de MediaShrink Cloud (F05-T01 / CA-01).
 *
 * Levanta en un único proceso:
 *   1. el servidor Hono con `createRuntimeApp()` (auth, /jobs, presign, descarga, /health);
 *   2. el consumidor SQS con reintentos y DLQ contra `aws/aws-emulator`.
 *
 * No hay dobles de API: DynamoDB, S3 y SQS se construyen desde la configuración
 * validada (credenciales efímeras por archivo y CA del emulador, G-3/A-03).
 * Terraform debe haber aplicado la infraestructura antes de arrancar.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadConfig, parseEnvFile } from './config/index';
import { createDynamoDbDocumentClientFromConfig } from './db/client';
import { createJobStore } from './db/job-store';
import { createDynamoUserStore } from './db/user-store-adapter';
import { createRuntimeApp, listen } from './index';
import { createJobQueuePublisherFromConfig } from './worker/publisher';
import { createSqsClientFromConfig } from './worker/sqs-client';
import { drainQueue, type ConsumeDependencies } from './worker/consumer';

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Variables cuyo valor es una RUTA relativa al directorio del `.env`. */
const RELATIVE_PATH_KEYS = [
  'AWS_SHARED_CREDENTIALS_FILE',
  'AWS_CONFIG_FILE',
  'CA_BUNDLE_PATH',
] as const;

/**
 * Carga `.env` de la raíz del proyecto (o del cwd) antes de validar config (M-01).
 *
 * Las rutas relativas del `.env` (`./.local/...`) se resuelven contra el
 * directorio del propio `.env`, de modo que el arranque funciona igual con
 * `npm run dev:backend` desde la raíz (cwd=backend/) o desde el backend.
 */
export function loadDotEnv(cwd: string = process.cwd(), env: NodeJS.ProcessEnv = process.env): void {
  const candidates = [
    resolve(cwd, '.env'),
    resolve(cwd, '..', '.env'),
    resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '.env'),
  ];
  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    const parsed = parseEnvFile(readFileSync(candidate, 'utf8'));
    const baseDir = dirname(candidate);
    for (const [key, value] of Object.entries(parsed)) {
      if (env[key] !== undefined) continue;
      const isRelativePath = (RELATIVE_PATH_KEYS as readonly string[]).includes(key);
      env[key] = isRelativePath && !isAbsolute(value) ? resolve(baseDir, value) : value;
    }
    break;
  }
}

function log(event: string, detail: Record<string, string | number> = {}): void {
  // Sin secretos ni rutas absolutas en logs (G-3 / P4): solo eventos y cifras.
  process.stdout.write(`${event} ${JSON.stringify(detail)}\n`);
}

export async function startRuntime(): Promise<() => Promise<void>> {
  loadDotEnv();
  const config = loadConfig();
  const documentClient = createDynamoDbDocumentClientFromConfig(config);
  const sqs = createSqsClientFromConfig(config);

  const users = createDynamoUserStore({
    tableName: config.resources.dynamodbTableJobs,
    client: documentClient,
  });
  const jobs = createJobStore({
    tableName: config.resources.dynamodbTableJobs,
    client: documentClient,
  });
  const publisher = createJobQueuePublisherFromConfig(config);

  const application = createRuntimeApp(config, { users, jobs, publisher });
  const http = await listen(application, config.app.port);
  log('F05_SERVER_READY', { port: http.port, retentionDays: config.worker.retentionDays });

  let stopped = false;
  const workerDeps: ConsumeDependencies = { config, sqs, jobs };
  const workerLoop = (async () => {
    while (!stopped) {
      try {
        await drainQueue(workerDeps, { waitTimeSeconds: 1, maxRounds: 10 });
      } catch (error) {
        // Un fallo transitorio de red no detiene el consumidor; se reintenta en
        // el siguiente ciclo. Nunca se registra el mensaje de error del SDK
        // (podría contener rutas/credenciales).
        log('F05_WORKER_POLL_ERROR', { name: (error as Error).name });
      }
      if (!stopped) await delay(config.worker.pollIntervalMs);
    }
  })();

  return async () => {
    stopped = true;
    await http.close();
    await workerLoop;
    sqs.destroy();
    log('F05_RUNTIME_STOPPED', {});
  };
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (invokedDirectly) {
  const shutdown = async () => {
    if (stop !== undefined) await stop();
    process.exit(0);
  };
  let stop: (() => Promise<void>) | undefined;

  startRuntime()
    .then((handle) => {
      stop = handle;
      for (const signal of ['SIGINT', 'SIGTERM', 'SIGBREAK'] as const) {
        process.once(signal, () => void shutdown());
      }
    })
    .catch((error: unknown) => {
      log('F05_RUNTIME_FAILED', { name: (error as Error).name });
      process.exitCode = 1;
    });
}
