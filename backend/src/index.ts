import { Hono } from 'hono';

/**
 * Aplicación Hono mínima de Fase 0.
 * Único comportamiento expuesto: el healthcheck de humo. Las rutas de producto
 * (auth/jobs) se implementan en F02 y no pertenecen a este esqueleto.
 */
export function createApp(): Hono {
  const app = new Hono();
  app.get('/health', (c) => c.json({ status: 'ok' }));
  return app;
}

export const app = createApp();
