import { createServer } from 'vite';
import { timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const port = Number(process.env.F03_E2E_PORT ?? 4201);
const apiPort = Number(process.env.F05_E2E_API_PORT ?? 0);
const shutdownToken = process.env.F03_E2E_SHUTDOWN_TOKEN;
if (!shutdownToken || !/^[a-f0-9]{64}$/.test(shutdownToken)) {
  throw new Error('F03 webServer requires a valid per-run shutdown token');
}
const server = await createServer({
  configFile: resolve(repoRoot, 'frontend/vite.config.ts'),
  root: resolve(repoRoot, 'frontend'),
  server: {
    host: '127.0.0.1',
    port,
    strictPort: true,
    // F05-T01: en el E2E real el navegador habla solo con el mismo origen;
    // Vite redirige /auth y /jobs al backend real. No hay dobles de API.
    ...(apiPort > 0
      ? {
          proxy: {
            '/auth': { target: `http://127.0.0.1:${apiPort}`, changeOrigin: true },
            '/jobs': { target: `http://127.0.0.1:${apiPort}`, changeOrigin: true },
          },
        }
      : {}),
  },
});

let closing;
let shutdownFallback;
const shutdownHandler = (request, response, next) => {
  if (request.url !== '/__f03_internal/shutdown') return next();

  const supplied = request.headers['x-f03-shutdown-token'];
  const authorized = request.method === 'POST'
    && typeof supplied === 'string'
    && Buffer.byteLength(supplied) === Buffer.byteLength(shutdownToken)
    && timingSafeEqual(Buffer.from(supplied), Buffer.from(shutdownToken));

  if (!authorized) {
    if (response.headersSent || response.writableEnded) return;
    response.statusCode = request.method === 'POST' ? 404 : 405;
    response.end();
    return;
  }

  if (closing) {
    if (response.headersSent || response.writableEnded) return;
    response.statusCode = 409;
    response.end();
    return;
  }

  if (response.headersSent || response.writableEnded) return;
  response.statusCode = 204;
  response.setHeader('x-f03-server-shutdown', 'accepted');
  response.once('finish', () => { void close(); });
  response.end();
};

const close = () => {
  if (closing) return closing;
  // Keep teardown bounded: Playwright must be able to finish even if Vite or a
  // Windows socket handle fails to settle after the runner sends SIGTERM.
  shutdownFallback = setTimeout(() => process.exit(1), 7_000);
  shutdownFallback.unref();
  server.httpServer?.closeIdleConnections?.();
  server.httpServer?.closeAllConnections?.();
  closing = server.close().then(() => {
    clearTimeout(shutdownFallback);
    process.exit(0);
  }, () => {
    clearTimeout(shutdownFallback);
    process.exit(1);
  });
  return closing;
};

for (const signal of ['SIGINT', 'SIGTERM', 'SIGBREAK']) process.once(signal, close);
// Handle shutdown before Vite's fallback middleware. Ending the response in an
// httpServer request listener would still let Connect write to that response.
server.middlewares.stack.unshift({ route: '', handle: shutdownHandler });
await server.listen();
console.log(`F03 mock frontend listening on 127.0.0.1:${port}`);
