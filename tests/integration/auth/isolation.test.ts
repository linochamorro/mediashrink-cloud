import { describe, expect, it } from 'vitest';

import { createAuthTestApp, getWithToken, postJson } from './fixtures';

const userA = { email: 'alice@example.com', password: 'Segura1234' };
const userB = { email: 'bob@example.com', password: 'OtraClave5678' };

async function register(app: ReturnType<typeof createAuthTestApp>['app'], credentials: typeof userA) {
  const response = await postJson(app, '/auth/register', credentials);
  return (await response.json()) as {
    user: { userId: string; email: string };
    accessToken: string;
    refreshToken: string;
  };
}

describe('aislamiento 401/404 entre usuarios (FR-21, D-07, spec §6)', () => {
  it('el token de A no accede al recurso de B y el de B no accede al de A', async () => {
    const { app } = createAuthTestApp();
    const a = await register(app, userA);
    const b = await register(app, userB);

    const aOnB = await getWithToken(app, `/private/resources/${b.user.userId}`, a.accessToken);
    const bOnA = await getWithToken(app, `/private/resources/${a.user.userId}`, b.accessToken);
    const aOnSelf = await getWithToken(app, `/private/resources/${a.user.userId}`, a.accessToken);
    const bOnSelf = await getWithToken(app, `/private/resources/${b.user.userId}`, b.accessToken);

    expect(aOnB.status).toBe(404);
    expect(bOnA.status).toBe(404);
    expect(aOnSelf.status).toBe(200);
    expect(bOnSelf.status).toBe(200);
  });

  it('404 es idéntico para un recurso ajeno y para uno inexistente (sin filtrar existencia)', async () => {
    const { app } = createAuthTestApp();
    const a = await register(app, userA);
    const b = await register(app, userB);

    const foreign = await getWithToken(app, `/private/resources/${b.user.userId}`, a.accessToken);
    const missing = await getWithToken(app, '/private/resources/user_inexistente', a.accessToken);

    expect(foreign.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(await foreign.text()).toBe(await missing.text());
  });

  it('sin token, propio y ajeno responden 401 antes que 404', async () => {
    const { app } = createAuthTestApp();
    const a = await register(app, userA);
    const b = await register(app, userB);

    const onSelf = await getWithToken(app, `/private/resources/${a.user.userId}`);
    const onForeign = await getWithToken(app, `/private/resources/${b.user.userId}`);

    expect(onSelf.status).toBe(401);
    expect(onForeign.status).toBe(401);
    expect(await onSelf.text()).toBe(await onForeign.text());
  });

  it('un refresh token no sirve para autorizar rutas privadas', async () => {
    const { app } = createAuthTestApp();
    const a = await register(app, userA);

    const response = await getWithToken(app, `/private/resources/${a.user.userId}`, a.refreshToken);

    expect(response.status).toBe(401);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe('INVALID_TOKEN');
  });
});
