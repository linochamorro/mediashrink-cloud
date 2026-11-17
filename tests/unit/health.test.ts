import { describe, expect, it } from 'vitest';

import { app, createApp } from '../../backend/src/index';

describe('backend — healthcheck de humo (F00-T02)', () => {
  it('responde 200 con status ok en GET /health', async () => {
    const response = await app.request('/health');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('expone una fábrica de app aislada y funcional para pruebas', async () => {
    const isolated = await createApp().request('/health');

    expect(isolated.status).toBe(200);
  });
});
