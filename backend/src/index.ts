/**
 * Punto de entrada HTTP de MediaShrink Cloud (F05-T01 / CA-01).
 *
 * Fase 0 dejó aquí un esqueleto con `/health`. La integración global expone
 * ahora la API real (`createApiApp()`: auth + `/jobs` + presign + descarga) y
 * el arranque del consumidor SQS contra `aws/aws-emulator`, sin mocks.
 *
 * Se conservan `createApp()` y `app` por compatibilidad con el test de humo de
 * F00-T02, que verifica `/health` en proceso y sin infraestructura.
 */

import { createServer, type Server } from 'node:http';
import { Hono } from 'hono';

import type { JobQueuePublisher } from './api/publisher';
import { createApiApp } from './api/app';
import type { UserStore } from './auth/user-store';
import type { AppConfig } from './config/index';
import type { JobStore } from './db/types';

/** Esqueleto original de F00: solo el healthcheck de humo, sin dependencias. */
export function createApp(): Hono {
  const app = new Hono();
  app.get('/health', (c) => c.json({ status: 'ok' }));
  return app;
}

export const app = createApp();

/** La fábrica real de la API de producto queda expuesta desde este módulo. */
export { createApiApp };

export interface RuntimeAppDeps {
  readonly users: UserStore;
  readonly jobs: JobStore;
  readonly publisher: JobQueuePublisher;
}

/**
 * Aplica Hono completa: `/health` más todas las rutas de `createApiApp()`.
 * Las dependencias son reales (DynamoDB/S3/SQS del emulador) cuando las
 * construye `server.ts`; los tests siguen pudiendo inyectar dobles.
 */
export function createRuntimeApp(config: AppConfig, deps: RuntimeAppDeps): Hono {
  const api = createApiApp({ config, ...deps });
  api.get('/health', (c) => c.json({ status: 'ok' }));
  return api;
}

export interface HttpServerHandle {
  readonly server: Server;
  readonly port: number;
  close(): Promise<void>;
}

/**
 * Adaptador mínimo de `app.fetch` a `node:http`. Evita añadir una dependencia
 * (`@hono/node-server`) no declarada en el manifiesto y mantiene el arranque
 * 100 % local con el runtime de Node ya instalado.
 */
export function listen(app: Hono, port: number, host = '127.0.0.1'): Promise<HttpServerHandle> {
  const server = createServer(async (req, res) => {
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? `${host}:${port}`}`);
      const requestHeaders: Record<string, string> = {};
      for (const [key, value] of Object.entries(req.headers)) {
        if (value === undefined) continue;
        requestHeaders[key] = Array.isArray(value) ? value.join(', ') : value;
      }
      const request = new Request(url.href, {
        method: req.method ?? 'GET',
        headers: requestHeaders,
        ...(body === undefined ? {} : { body }),
      });

      const response = await app.fetch(request);
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });
      res.writeHead(response.status, headers);

      if (response.body !== null) {
        const reader = response.body.getReader();
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
          }
        } finally {
          reader.releaseLock();
        }
      }
      res.end();
    } catch {
      // G-3: mensaje estable, sin rutas ni detalles del error en la respuesta.
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { code: 'INTERNAL', message: 'Error interno' } }));
    }
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      const address = server.address();
      const boundPort = typeof address === 'object' && address !== null ? address.port : port;
      resolve({
        server,
        port: boundPort,
        close: () =>
          new Promise<void>((resolveClose, rejectClose) => {
            server.close((error) => (error ? rejectClose(error) : resolveClose()));
            server.closeIdleConnections?.();
          }),
      });
    });
  });
}
