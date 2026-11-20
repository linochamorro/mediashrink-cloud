import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin, type ViteDevServer } from 'vite';
import { request as httpsRequest } from 'node:https';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * M-04 — Relay local de S3 para el emulador (solo desarrollo).
 *
 * El emulador `aws/aws-emulator` sirve HTTPS con CA propia y NO implementa el
 * preflight CORS que el navegador exige para una PUT entre orígenes. Este
 * plugin expone un prefijo local (`/__s3_local/`) en el MISMO origen que la
 * SPA y reenvía la petición (URL firmada y cuerpo reales) al emulador.
 *
 * Endurecimiento (auditoría F05-AUDIT-FULL):
 *   - solo existe en el servidor de desarrollo de Vite (`configureServer`), por
 *     lo que no aparece en el bundle de producción;
 *   - el destino es FIJO (`127.0.0.1:9297`): la ruta del navegador nunca
 *     puede redirigir a otro host (sin SSRF);
 *   - solo se aceptan `GET`, `PUT` y `HEAD` sobre rutas sin `..` ni `%2e`;
 *   - se reenvían únicamente las cabeceras necesarias para la firma SigV4 y
 *     el cuerpo; se descartan `authorization`, `cookie` y cabeceras hop-by-hop;
 *   - la conexión al emulador valida el certificado con el CA local
 *     (`rejectUnauthorized: true`); sin CA el relay falla cerrado (503).
 */
const RELAY_PREFIX = '/__s3_local/';
const EMULATOR_HOST = '127.0.0.1';
const EMULATOR_PORT = 9297;
const ALLOWED_METHODS = new Set(['GET', 'PUT', 'HEAD']);

/** Cabeceras que nunca se reenvían al emulador (credenciales/hop-by-hop). */
const BLOCKED_REQUEST_HEADERS = new Set([
  'authorization',
  'cookie',
  'connection',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
  'proxy-authorization',
  'x-forwarded-for',
  'x-forwarded-host',
  'x-forwarded-proto',
]);

/**
 * Solo se propagan estas cabeceras del cliente al emulador. `content-length`
 * y las `x-amz-*` forman parte de la firma SigV4; el resto se descarta para no
 * reenviar metadatos del navegador ni cabeceras firmadas que no correspondan.
 */
const FORWARDED_REQUEST_HEADERS = new Set([
  'content-length',
  'x-amz-acl',
  'x-amz-content-sha256',
  'x-amz-date',
  'x-amz-meta',
  'x-amz-security-token',
]);

function isSafeRelayPath(path: string): boolean {
  if (path.length === 0) return false;
  if (path.includes('..')) return false;
  if (path.toLowerCase().includes('%2e')) return false;
  if (path.includes('\\')) return false;
  if (path.includes('\0')) return false;
  return true;
}

function s3EmulatorRelayPlugin(): Plugin {
  return {
    name: 's3-emulator-relay',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      const caPath = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '.local', 'aws-emulator', 'ca.pem');

      server.middlewares.use((req, res, next) => {
        if (!req.url || !req.url.startsWith(RELAY_PREFIX)) return next();

        const method = (req.method ?? 'GET').toUpperCase();
        if (!ALLOWED_METHODS.has(method)) {
          res.writeHead(405, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: 'Método no permitido en el relay local' }));
          return;
        }

        const s3Path = req.url.slice(RELAY_PREFIX.length - 1);
        if (!isSafeRelayPath(s3Path)) {
          res.writeHead(400, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: 'Ruta no permitida en el relay local' }));
          return;
        }

        if (!existsSync(caPath)) {
          res.writeHead(503, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: 'Relay local sin CA del emulador: no se reenvía la petición' }));
          return;
        }
        const ca = readFileSync(caPath);

        const headers: Record<string, string> = { host: `${EMULATOR_HOST}:${EMULATOR_PORT}` };
        for (const [key, value] of Object.entries(req.headers)) {
          if (value === undefined) continue;
          const lower = key.toLowerCase();
          if (BLOCKED_REQUEST_HEADERS.has(lower)) continue;
          if (!FORWARDED_REQUEST_HEADERS.has(lower)) continue;
          headers[lower] = Array.isArray(value) ? value.join(', ') : value;
        }

        const upstream = httpsRequest(
          {
            hostname: EMULATOR_HOST,
            port: EMULATOR_PORT,
            path: s3Path,
            method,
            headers,
            ca,
            rejectUnauthorized: true,
          },
          (upstreamRes) => {
            const hopByHop = new Set(['connection', 'keep-alive', 'transfer-encoding']);
            const responseHeaders: Record<string, string | string[]> = {};
            for (const [key, value] of Object.entries(upstreamRes.headers)) {
              if (hopByHop.has(key.toLowerCase()) || value === undefined) continue;
              responseHeaders[key] = value;
            }
            responseHeaders['access-control-allow-origin'] = '*';
            responseHeaders['access-control-expose-headers'] = '*';

            res.writeHead(upstreamRes.statusCode ?? 500, responseHeaders);
            upstreamRes.pipe(res);
          },
        );

        upstream.on('error', (error: Error) => {
          // Nunca se imprime la URL firmada ni credenciales (G-3): solo el tipo.
          console.error('[S3-Relay Error]:', error.name);
          if (!res.headersSent) {
            res.writeHead(502, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ error: 'No se pudo contactar con el emulador local' }));
          }
        });

        req.pipe(upstream);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), s3EmulatorRelayPlugin()],
  server: {
    port: 5173,
    proxy: {
      '/auth': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
      '/jobs': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
});
