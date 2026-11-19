import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

import { defineConfig } from '@playwright/test';

/**
 * F05-QA / Capa 5 — captura de los 12 PNG obligatorios del runbook §2.
 *
 * La pila es EXTERNA y real (sin `webServer` de Playwright): emulador
 * aws/aws-emulator + `terraform apply` + backend Hono/worker en el puerto 3001
 * + SPA Vite en el 5173 con proxy same-origin /auth y /jobs (mismo mecanismo
 * de `tests/e2e/vite-webserver.mjs`). Sin dobles de API: la única adaptación
 * es el relay de transporte S3 que el emulador exige porque no implementa
 * OPTIONS (misma URL firmada, mismo cuerpo, respuesta real).
 */
const repoRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const port = Number(process.env.F05_QA_PORT ?? 5173);

export default defineConfig({
  testDir: '.',
  testMatch: 'qa-roadmap.spec.ts',
  reporter: [['list']],
  timeout: 900_000,
  expect: { timeout: 30_000 },
  workers: 1,
  outputDir: '../../reports/implementation/F05/evidence/qa-roadmap/playwright-results',
  use: {
    baseURL: `http://localhost:${port}`,
    browserName: 'chromium',
    channel: 'msedge',
    // El emulador sirve HTTPS con CA propia; el navegador debe aceptarla.
    ignoreHTTPSErrors: true,
    acceptDownloads: true,
    viewport: { width: 1440, height: 900 },
  },
});
