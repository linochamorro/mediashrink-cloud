# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: qa-human-roadmap.spec.ts >> F05-QA-HUMAN: roadmap real E0-01 … E7-03 sin dobles ni muletas
- Location: temporary\qa-human\qa-human-roadmap.spec.ts:109:1

# Error details

```
Error: expect(locator).toHaveText(expected) failed

Locator:  getByRole('alert').first()
Expected: "Ya existe una cuenta con ese correo."
Received: "No se pudo completar la solicitud. Inténtalo de nuevo."
Timeout:  30000ms

Call log:
  - Expect "toHaveText" getByRole('alert').first() with timeout 30000ms
  - waiting for getByRole('alert').first()
    61 × locator resolved to <p role="alert" class="error-message">No se pudo completar la solicitud. Inténtalo de n…</p>
       - unexpected value "No se pudo completar la solicitud. Inténtalo de nuevo."

```

```yaml
- alert: No se pudo completar la solicitud. Inténtalo de nuevo.
```

# Test source

```ts
  206 |     expect(response.status(), `${label} HTTP`).toBe(200);
  207 |     const bytes = await response.body();
  208 |     await popup.close();
  209 |     return { bytes, path: target.pathname };
  210 |   };
  211 | 
  212 |   // ---------------------------------------------------------------- E0
  213 |   await runCase('E0-01', async () => {
  214 |     stage = 'E0';
  215 |     const health = await page.request.get('http://127.0.0.1:3001/health');
  216 |     expect(health.status()).toBe(200);
  217 |     expect(await health.json()).toEqual({ status: 'ok' });
  218 |     const navigation = await page.goto(BASE_URL + '/');
  219 |     expect(navigation?.status()).toBe(200);
  220 |     await expect(page.getByRole('heading', { name: /Menos peso/ })).toBeVisible();
  221 |     return 'backend /health 200; SPA HTTP 200; emulador healthy (2GiB/2CPU), terraform plan 0 cambios, seed idempotente, .env sin overrides de rate limit';
  222 |   });
  223 |   await shot('E0-01-inicio.png');
  224 | 
  225 |   await runCase('E0-02', async () => {
  226 |     await expect(page.getByRole('heading', { name: 'Prepara un lote' })).toBeVisible();
  227 |     await expect(page.getByRole('button', { name: /Optimizar/ })).toBeDisabled();
  228 |     expect(await page.locator('html').getAttribute('data-theme')).toBe('light');
  229 |     expect(pageErrors).toEqual([]);
  230 |     expect(consoleErrors).toEqual([]);
  231 |     expect(responses.filter((r) => r.status >= 400)).toEqual([]);
  232 |     return 'UI en español, Optimizar deshabilitado sin sesión/archivos, tema claro, 0 pageerror y 0 HTTP de error';
  233 |   });
  234 | 
  235 |   await runCase('E0-03', async () => {
  236 |     const toggle = page.locator('button.theme-toggle');
  237 |     await expect(toggle).toHaveAttribute('aria-label', 'Cambiar a tema oscuro');
  238 |     await toggle.click();
  239 |     await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  240 |     await page.reload();
  241 |     await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  242 |     await toggle.click();
  243 |     await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  244 |     await page.reload();
  245 |     await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  246 |     return 'Claro→Oscuro→Claro con persistencia verificada tras dos recargas (localStorage mediashrink-theme)';
  247 |   });
  248 |   await shot('E0-03-tema.png');
  249 | 
  250 |   // ---------------------------------------------------------------- E1
  251 |   stage = 'E1';
  252 |   let e1_02Message = '';
  253 |   const loginResponseCount = (status?: number) => responses.filter((r) =>
  254 |     r.method === 'POST' && r.path === '/auth/login' && (status === undefined || r.status === status)).length;
  255 |   const registerResponseCount = () => responses.filter((r) => r.method === 'POST' && r.path === '/auth/register').length;
  256 | 
  257 |   await runCase('E1-01', async () => {
  258 |     const before = loginResponseCount();
  259 |     const email = page.getByLabel('Correo electrónico');
  260 |     await email.fill('correo-mal-formado');
  261 |     await loginButtons().click();
  262 |     expect(await email.evaluate((el: HTMLInputElement) => el.validity.valid)).toBe(false);
  263 |     expect(loginResponseCount()).toBe(before);
  264 |     await email.fill('');
  265 |     await page.getByLabel('Contraseña').fill('');
  266 |     await loginButtons().click();
  267 |     expect(loginResponseCount()).toBe(before);
  268 |     return 'Correo mal formado y campos vacíos detenidos por validación HTML5; 0 POST /auth/login';
  269 |   });
  270 | 
  271 |   await runCase('E1-02', async () => {
  272 |     await paceAuth(1); noteAuth();
  273 |     await page.getByLabel('Correo electrónico').fill(ANA_EMAIL);
  274 |     await page.getByLabel('Contraseña').fill('ClaveIncorrecta123!');
  275 |     await loginButtons().click();
  276 |     const alert = page.getByRole('alert').first();
  277 |     await expect(alert).toHaveText('El correo o la contraseña no son correctos.');
  278 |     e1_02Message = (await alert.textContent()) ?? '';
  279 |     expect(e1_02Message).not.toMatch(/stack|\/home\/|[A-Z]:\\|Error:|at\s+\w+\s+\(/i);
  280 |     expect(loginResponseCount(401)).toBeGreaterThan(0);
  281 |     return 'Clave incorrecta de Ana → 401 con mensaje genérico en español, sin stack/rutas/indicio de existencia';
  282 |   });
  283 | 
  284 |   await runCase('E1-03', async () => {
  285 |     await paceAuth(1); noteAuth();
  286 |     await page.getByLabel('Correo electrónico').fill('no.existe.qa@example.com');
  287 |     await page.getByLabel('Contraseña').fill('ClaveIncorrecta123!');
  288 |     await loginButtons().click();
  289 |     const alert = page.getByRole('alert').first();
  290 |     await expect(alert).toHaveText('El correo o la contraseña no son correctos.');
  291 |     expect((await alert.textContent()) ?? '').toBe(e1_02Message);
  292 |     return 'Correo inexistente → 401 con mensaje BYTE-IDÉNTICO a E1-02 (anti-enumeración)';
  293 |   });
  294 | 
  295 |   await runCase('E1-04', async () => {
  296 |     await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
  297 |     const before = registerResponseCount();
  298 |     await page.getByLabel('Correo electrónico').fill('nuevo.qa@example.com');
  299 |     await page.getByLabel('Contraseña').fill('corta');
  300 |     await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
  301 |     expect(registerResponseCount()).toBe(before);
  302 |     await paceAuth(1); noteAuth();
  303 |     await page.getByLabel('Correo electrónico').fill(ANA_EMAIL);
  304 |     await page.getByLabel('Contraseña').fill('ClaveSegura2026!');
  305 |     await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
> 306 |     await expect(page.getByRole('alert').first()).toHaveText('Ya existe una cuenta con ese correo.');
      |                                                   ^ Error: expect(locator).toHaveText(expected) failed
  307 |     expect(responses.some((r) => r.path === '/auth/register' && r.status === 409)).toBe(true);
  308 |     return 'Clave <8 detenida en cliente (0 POST) y correo duplicado ana.demo@example.com rechazado con 409 en español';
  309 |   });
  310 | 
  311 |   await runCase('E1-05', async () => {
  312 |     await paceAuth(1); noteAuth();
  313 |     await page.getByLabel('Correo electrónico').fill('usuario.humano.qa@example.com');
  314 |     await page.getByLabel('Contraseña').fill('ClaveHumana2026!');
  315 |     await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
  316 |     await expect(page.getByText('Sesión iniciada como', { exact: false })).toBeVisible();
  317 |     await expect(page.getByText('usuario.humano.qa@example.com', { exact: false })).toBeVisible();
  318 |     await expect(page.getByText('Aún no hay lotes. Cuando optimices imágenes, aparecerán aquí.')).toBeVisible();
  319 |     return 'Registro 201 de usuario.humano.qa@example.com con estado vacío (0 lotes, empty-state visible)';
  320 |   });
  321 |   await shot('E1-05-registro.png');
  322 | 
  323 |   await runCase('E1-06', async () => {
  324 |     await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  325 |     await expect(page.getByLabel('Correo electrónico')).toBeVisible();
  326 |     await expect(page.getByText('Aún no hay lotes.', { exact: false })).toHaveCount(0);
  327 |     await page.reload();
  328 |     await expect(page.getByLabel('Correo electrónico')).toBeVisible();
  329 |     expect(await page.evaluate(() => sessionStorage.getItem('mediashrink-session'))).toBeNull();
  330 |     return 'Logout limpió sesión, lotes y vistas; persistente tras F5 (sessionStorage sin mediashrink-session)';
  331 |   });
  332 | 
  333 |   await runCase('E1-07', async () => {
  334 |     await paceAuth(2);
  335 |     await page.getByLabel('Correo electrónico').fill(ANA_EMAIL);
  336 |     await page.getByLabel('Contraseña').fill(ANA_PASSWORD);
  337 |     await loginButtons().click();
  338 |     await expect(page.getByText('Sesión iniciada como', { exact: false })).toBeVisible();
  339 |     noteAuth();
  340 |     await page.reload();
  341 |     await expect(page.getByText('Sesión iniciada como', { exact: false })).toBeVisible();
  342 |     noteAuth();
  343 |     const storage = await page.evaluate(() => {
  344 |       const dump = (store: Storage): Record<string, string> => {
  345 |         const out: Record<string, string> = {};
  346 |         for (let i = 0; i < store.length; i += 1) {
  347 |           const key = store.key(i);
  348 |           if (key !== null) out[key] = store.getItem(key) ?? '';
  349 |         }
  350 |         return out;
  351 |       };
  352 |       return { session: dump(sessionStorage), local: dump(localStorage) };
  353 |     });
  354 |     expect(storage.session['mediashrink-session']).toBeTruthy();
  355 |     expect(Object.keys(JSON.parse(storage.session['mediashrink-session']))).toEqual(['refreshToken']);
  356 |     expect(Object.values(storage.session).some((v) => v.includes('accessToken'))).toBe(false);
  357 |     expect(Object.keys(storage.local).some((k) => k.includes('accessToken'))).toBe(false);
  358 |     expect(Object.values(storage.local).some((v) => v.includes('accessToken'))).toBe(false);
  359 |     return 'Login seed Ana 200 y sesión viva tras F5; sessionStorage solo contiene refreshToken en mediashrink-session; 0 accessToken en storage';
  360 |   });
  361 |   await shot('E1-07-sesion.png');
  362 | 
  363 |   // ---------------------------------------------------------------- E2
  364 |   stage = 'E2';
  365 |   const nameInput = () => page.getByLabel('Nombre del lote (opcional)', { exact: true });
  366 |   const optimizar = () => page.getByRole('button', { name: /Optimizar/ });
  367 |   const tinyJpeg = await sharp({ create: { width: 2, height: 2, channels: 3, background: { r: 10, g: 20, b: 30 } } }).jpeg().toBuffer();
  368 | 
  369 |   await runCase('E2-01', async () => {
  370 |     const invalids = [
  371 |       { name: 'notas.txt', mimeType: 'text/plain', buffer: Buffer.from('texto') },
  372 |       { name: 'documento.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') },
  373 |       { name: 'vector.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') },
  374 |       { name: 'animado.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a') },
  375 |     ];
  376 |     await page.locator('#file-picker').setInputFiles(invalids);
  377 |     const items = page.locator('.validation-errors li');
  378 |     await expect(items).toHaveCount(4);
  379 |     expect((await items.allTextContents()).every((t) => t.includes('formato no permitido'))).toBe(true);
  380 |     await expect(optimizar()).toBeDisabled();
  381 |     await expect(page.getByText('imágenes listas', { exact: false })).toHaveCount(0);
  382 |     return '4/4 rechazados en cliente (.txt/.pdf/.svg/.gif) con aviso "formato no permitido"; Optimizar sigue deshabilitado';
  383 |   });
  384 |   await shot('E2-01-formatos.png');
  385 | 
  386 |   await runCase('E2-02', async () => {
  387 |     const huge = Buffer.alloc(16 * 1024 * 1024 + 64, 7);
  388 |     await page.locator('#file-picker').setInputFiles([{ name: 'enorme.jpg', mimeType: 'image/jpeg', buffer: huge }]);
  389 |     await expect(page.locator('.validation-errors li').first()).toContainText('supera el límite de 15 MB');
  390 |     await expect(optimizar()).toBeDisabled();
  391 |     return 'Archivo de 16 MB rechazado antes de subir con aviso de límite de 15 MB; Optimizar deshabilitado';
  392 |   });
  393 | 
  394 |   await runCase('E2-03', async () => {
  395 |     const many = Array.from({ length: 21 }, (_, i) => ({ name: `mini-${i + 1}.jpg`, mimeType: 'image/jpeg', buffer: tinyJpeg }));
  396 |     await page.locator('#file-picker').setInputFiles(many);
  397 |     await expect(page.locator('.validation-errors li').first()).toContainText('El máximo es 20 imágenes por lote.');
  398 |     await expect(optimizar()).toBeDisabled();
  399 |     return '21 archivos rechazados por el tope MAX_IMAGES_PER_BATCH=20 antes de subir';
  400 |   });
  401 | 
  402 |   await runCase('E2-04', async () => {
  403 |     await page.locator('#file-picker').setInputFiles([
  404 |       { name: 'valida.jpg', mimeType: 'image/jpeg', buffer: tinyJpeg },
  405 |       { name: 'malo.txt', mimeType: 'text/plain', buffer: Buffer.from('x') },
  406 |     ]);
```