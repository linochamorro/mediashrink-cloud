import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { defineConfig } from '@playwright/test';

/**
 * F05-T01 / CA-01 — E2E real sin dobles de API.
 *
 * Requiere, en este orden: aws-emulator arrancado con límites G-7,
 * `terraform apply` contra el emulador y el backend real escuchando en
 * `F05_E2E_API_PORT` (por defecto 3001). La SPA se sirve en 5173 — el origen
 * exacto declarado en el CORS de Terraform — y Vite proxifica /auth y /jobs.
 */
const repoRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const port = Number(process.env.F05_E2E_PORT ?? 5173);
const apiPort = Number(process.env.F05_E2E_API_PORT ?? 3001);
const shutdownToken = randomBytes(32).toString('hex');

process.env.F03_E2E_PORT = String(port);
process.env.F03_E2E_SHUTDOWN_TOKEN = shutdownToken;
process.env.F05_E2E_API_PORT = String(apiPort);

export default defineConfig({
  testDir: '.',
  testMatch: 'real-stack.spec.ts',
  timeout: 180_000,
  expect: { timeout: 20_000 },
  workers: 1,
  outputDir: '../../reports/implementation/F05/evidence/playwright-real-results',
  globalTeardown: './global-teardown.mjs',
  use: {
    baseURL: `http://localhost:${port}`,
    browserName: 'chromium',
    channel: 'msedge',
    // El emulador sirve HTTPS con CA propia; el navegador debe aceptarla.
    ignoreHTTPSErrors: true,
    acceptDownloads: true,
  },
  webServer: {
    command: 'node ./tests/e2e/vite-webserver.mjs',
    cwd: repoRoot,
    env: {
      ...process.env,
      F03_E2E_PORT: String(port),
      F03_E2E_SHUTDOWN_TOKEN: shutdownToken,
      F05_E2E_API_PORT: String(apiPort),
    },
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 45_000,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 8_000 },
  },
});
