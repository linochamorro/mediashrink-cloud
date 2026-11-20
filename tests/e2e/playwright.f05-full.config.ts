import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { defineConfig } from '@playwright/test';

const repoRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));

/**
 * F05-AUDIT-FULL — E2E real de extremo a extremo.
 *
 * Arranca los dos servidores del producto desde la raíz del repositorio. La
 * SPA usa el relay local de S3 incluido en `frontend/vite.config.ts`; no hay
 * mocks, interceptaciones ni ajustes del rate limit de producción.
 */
export default defineConfig({
  testDir: '.',
  testMatch: 'f05-audit-full.spec.ts',
  outputDir: '../../reports/implementation/F05/evidence/playwright-f05-full-results',
  timeout: 240_000,
  expect: { timeout: 30_000 },
  workers: 1,
  use: {
    baseURL: 'http://localhost:5173',
    browserName: 'chromium',
    channel: 'msedge',
    ignoreHTTPSErrors: true,
    acceptDownloads: true,
  },
  webServer: [
    {
      command: 'npm run dev:backend',
      cwd: repoRoot,
      url: 'http://127.0.0.1:3001/health',
      reuseExistingServer: false,
      timeout: 90_000,
    },
    {
      command: 'npm run dev:frontend',
      cwd: repoRoot,
      env: {
        // Adaptación exclusiva del harness E2E en Windows: `localhost` se
        // resolvía como `::1` y Vite enlazaba solo IPv6, por lo que la sonda
        // IPv4 del contrato no alcanzaba el servidor. No modifica la API, el
        // rate limit, el almacenamiento ni el comportamiento de la SPA.
        // Tampoco es una muleta de verificación: no intercepta ni falsifica
        // respuestas; solo fija el orden de resolución DNS del proceso.
        NODE_OPTIONS: '--dns-result-order=ipv4first',
      },
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: false,
      timeout: 90_000,
    },
  ],
});
