import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { defineConfig } from '@playwright/test';

/**
 * F05-T04 / CA-04 — capturas reales para el README, sin dobles de API.
 *
 * Requiere, en este orden: aws-emulator arrancado con limites G-7,
 * `terraform apply` contra el emulador y el backend real escuchando en
 * `F05_E2E_API_PORT` (por defecto 3001). La SPA se sirve en 5173 y Vite
 * redirige /auth y /jobs al backend real. Mismo arranque que el E2E de
 * integracion real (tests/e2e/playwright.real.config.ts).
 */
const repoRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const port = Number(process.env.F05_E2E_PORT ?? 5173);
const apiPort = Number(process.env.F05_E2E_API_PORT ?? 3001);
const e2eRateLimitMax = process.env.F05_E2E_RATE_LIMIT_MAX ?? '1000';
const externalBackend = process.env.F05_E2E_EXTERNAL_BACKEND === '1';
const shutdownToken = randomBytes(32).toString('hex');

process.env.F03_E2E_PORT = String(port);
process.env.F03_E2E_SHUTDOWN_TOKEN = shutdownToken;
process.env.F05_E2E_API_PORT = String(apiPort);
process.env.F05_E2E_RATE_LIMIT_MAX = e2eRateLimitMax;

const backendEnv: Record<string, string> = {
  ...Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
  ),
  NODE_ENV: 'development',
  PORT: String(apiPort),
  CORS_ORIGIN: `http://localhost:${port}`,
  JWT_ACCESS_SECRET: 'REPLACE_WITH_LOCAL_DEV_SECRET_32_CHARS',
  JWT_REFRESH_SECRET: 'REPLACE_WITH_LOCAL_DEV_SECRET_32_CHARS',
  RATE_LIMIT_AUTH_MAX: e2eRateLimitMax,
  AWS_ENDPOINT_URL: 'https://127.0.0.1:9297',
  AWS_REGION: 'us-east-1',
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
};

export default defineConfig({
  testDir: '.',
  testMatch: 'screenshots.spec.ts',
  timeout: 240_000,
  expect: { timeout: 20_000 },
  workers: 1,
  outputDir: '../../reports/implementation/F05/evidence/playwright-screenshots-results',
  globalTeardown: './global-teardown.mjs',
  use: {
    baseURL: `http://localhost:${port}`,
    browserName: 'chromium',
    channel: 'msedge',
    ignoreHTTPSErrors: true,
    acceptDownloads: true,
    viewport: { width: 1440, height: 900 },
  },
  webServer: [
    ...(externalBackend
      ? []
      : [
          {
            command: 'npx tsx backend/src/server.ts',
            cwd: repoRoot,
            env: backendEnv,
            url: `http://127.0.0.1:${apiPort}/health`,
            reuseExistingServer: false,
            timeout: 60_000,
            gracefulShutdown: { signal: 'SIGTERM' as const, timeout: 8_000 },
          },
        ]),
    {
      command: 'node ./tests/e2e/vite-webserver.mjs',
      cwd: repoRoot,
      env: {
        ...process.env,
        F03_E2E_PORT: String(port),
        F03_E2E_SHUTDOWN_TOKEN: shutdownToken,
        F05_E2E_API_PORT: String(apiPort),
        F05_E2E_RATE_LIMIT_MAX: e2eRateLimitMax,
      },
      url: `http://127.0.0.1:${port}`,
      reuseExistingServer: false,
      timeout: 45_000,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 8_000 },
    },
  ],
});
