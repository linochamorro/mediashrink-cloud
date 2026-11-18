import { defineConfig } from '@playwright/test';
import { randomBytes, randomInt } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const repoRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
// A per-run port plus strictPort prevents Playwright from reusing an unrelated
// listener. If a rare collision occurs, startup fails instead of targeting it.
const port = Number(process.env.F03_E2E_PORT ?? randomInt(42_000, 59_000));
const shutdownToken = randomBytes(32).toString('hex');
process.env.F03_E2E_PORT = String(port);
process.env.F03_E2E_SHUTDOWN_TOKEN = shutdownToken;

export default defineConfig({
  testDir: '.',
  testMatch: 'frontend-flow.spec.ts',
  timeout: 60_000,
  outputDir: '../../reports/implementation/F03/evidence/playwright-results',
  globalTeardown: './global-teardown.mjs',
  // Restore the Chromium engine through the locally installed Microsoft Edge,
  // which is the browser environment previously exercised by Tester.
  use: { baseURL: `http://127.0.0.1:${port}`, browserName: 'chromium', channel: 'msedge' },
  webServer: {
    command: 'node ./tests/e2e/vite-webserver.mjs',
    cwd: repoRoot,
    env: { ...process.env, F03_E2E_PORT: String(port), F03_E2E_SHUTDOWN_TOKEN: shutdownToken },
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 30_000,
    // Do not let the runner wait indefinitely for the Vite child after the
    // browser suite has already completed (Windows can retain child handles).
    gracefulShutdown: { signal: 'SIGTERM', timeout: 8_000 },
  },
});
