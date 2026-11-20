# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: qa-human-roadmap.spec.ts >> F05-QA-HUMAN Loop 2: roadmap real E0-01 … E7-03 sin dobles ni muletas
- Location: temporary\qa-human\qa-human-roadmap.spec.ts:112:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('1 imágenes listas', { exact: true })
Expected: visible
Timeout: 30000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByText('1 imágenes listas', { exact: true }) with timeout 30000ms
  - waiting for getByText('1 imágenes listas', { exact: true })

```

```yaml
- banner:
  - link "MediaShrink, inicio":
    - /url: /
    - text: M mediashrink ESTUDIO DE IMAGEN
  - navigation "Navegación principal":
    - link "Optimizar":
      - /url: "#optimizar"
    - link "Privacidad":
      - /url: "#privacidad"
  - text: Tus imágenes, bajo tu control
  - button "Cambiar a tema oscuro": ☾ Oscuro
- main:
  - paragraph: UN TALLER PARA TUS FOTOGRAFÍAS
  - heading "Menos peso. La misma imagen." [level=1]:
    - text: Menos peso.
    - emphasis: La misma imagen.
  - paragraph: Optimiza tus fotos en privado. Conserva cada detalle y recupera espacio, con métricas claras en cada paso.
  - text: ↗ WebP + AVIF ⌁ Metadatos privados ◷ Tú decides cuándo borrar
  - region "Prepara un lote":
    - paragraph: TU ESPACIO DE TRABAJO
    - heading "Prepara un lote" [level=2]
    - text: 01 · Añade fotografías Sesión iniciada como
    - strong: ana.demo@example.com
    - button "Cerrar sesión"
    - button "explora tus archivos"
    - heading "Arrastra tus imágenes aquí" [level=3]
    - paragraph: o explora tus archivos
    - text: JPEG, PNG, WebP o AVIF · Hasta 15 MB por imagen · Máximo 20 imágenes
    - alert:
      - listitem: "malo.txt: formato no permitido. Usa JPEG, PNG, WebP o AVIF."
    - paragraph: NIVEL DE COMPRESIÓN
    - radiogroup "Preset de compresión":
      - radio "Alta calidad Prioriza el detalle":
        - strong: Alta calidad
        - text: Prioriza el detalle
      - radio "Equilibrado Un punto medio versátil" [checked]:
        - strong: Equilibrado
        - text: Un punto medio versátil
      - radio "Máxima compresión Archivos más pequeños":
        - strong: Máxima compresión
        - text: Archivos más pequeños
    - complementary:
      - paragraph:
        - strong: Privacidad por diseño
        - text: Eliminamos los metadatos de ubicación y cámara al optimizar.
    - text: Nombre del lote (opcional)
    - textbox "Nombre del lote (opcional)":
      - /placeholder: Ej. Fotos vacaciones noviembre
    - button "Optimizar tus imágenes" [disabled]
    - paragraph: La selección se valida en este dispositivo antes de iniciar un lote.
    - text: TUS LOTES
    - button "Actualizar historial"
    - paragraph: Aún no hay lotes. Cuando optimices imágenes, aparecerán aquí.
  - text: MediaShrink Cloud / Cuidado para tus imágenes Diseñado para la privacidad
```

# Test source

```ts
  327 |     await paceAuth(1); noteAuth();
  328 |     await page.getByLabel('Correo electrónico').fill('usuario.humano.qa@example.com');
  329 |     await page.getByLabel('Contraseña').fill('ClaveHumana2026!');
  330 |     await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
  331 |     await expect(page.getByText('Sesión iniciada como', { exact: false })).toBeVisible();
  332 |     await expect(page.getByText('usuario.humano.qa@example.com', { exact: false })).toBeVisible();
  333 |     await expect(page.getByText('Aún no hay lotes. Cuando optimices imágenes, aparecerán aquí.')).toBeVisible();
  334 |     return 'Registro 201 de usuario.humano.qa@example.com con estado vacío (0 lotes, empty-state visible)';
  335 |   });
  336 |   await shot('E1-05-registro.png');
  337 | 
  338 |   await runCase('E1-06', async () => {
  339 |     await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  340 |     await expect(page.getByLabel('Correo electrónico')).toBeVisible();
  341 |     // Corrección de aserción del harness (no del producto): el placeholder
  342 |     // genérico "Aún no hay lotes" se muestra siempre que jobs.length===0,
  343 |     // también sin sesión; lo que debe desaparecer es el ESTADO PRIVADO.
  344 |     await expect(page.getByText('Sesión iniciada como', { exact: false })).toHaveCount(0);
  345 |     await expect(page.getByRole('list', { name: 'Historial de lotes' })).toHaveCount(0);
  346 |     await expect(page.getByRole('region', { name: 'Resultados del lote' })).toHaveCount(0);
  347 |     await page.reload();
  348 |     await expect(page.getByLabel('Correo electrónico')).toBeVisible();
  349 |     expect(await page.evaluate(() => sessionStorage.getItem('mediashrink-session'))).toBeNull();
  350 |     return 'Logout limpió sesión, lotes y vistas; persistente tras F5 (sessionStorage sin mediashrink-session)';
  351 |   });
  352 | 
  353 |   await runCase('E1-07', async () => {
  354 |     await paceAuth(2);
  355 |     await page.getByLabel('Correo electrónico').fill(ANA_EMAIL);
  356 |     await page.getByLabel('Contraseña').fill(ANA_PASSWORD);
  357 |     await loginButtons().click();
  358 |     await expect(page.getByText('Sesión iniciada como', { exact: false })).toBeVisible();
  359 |     noteAuth();
  360 |     await page.reload();
  361 |     await expect(page.getByText('Sesión iniciada como', { exact: false })).toBeVisible();
  362 |     noteAuth();
  363 |     const storage = await page.evaluate(() => {
  364 |       const dump = (store: Storage): Record<string, string> => {
  365 |         const out: Record<string, string> = {};
  366 |         for (let i = 0; i < store.length; i += 1) {
  367 |           const key = store.key(i);
  368 |           if (key !== null) out[key] = store.getItem(key) ?? '';
  369 |         }
  370 |         return out;
  371 |       };
  372 |       return { session: dump(sessionStorage), local: dump(localStorage) };
  373 |     });
  374 |     expect(storage.session['mediashrink-session']).toBeTruthy();
  375 |     expect(Object.keys(JSON.parse(storage.session['mediashrink-session']))).toEqual(['refreshToken']);
  376 |     expect(Object.values(storage.session).some((v) => v.includes('accessToken'))).toBe(false);
  377 |     expect(Object.keys(storage.local).some((k) => k.includes('accessToken'))).toBe(false);
  378 |     expect(Object.values(storage.local).some((v) => v.includes('accessToken'))).toBe(false);
  379 |     return 'Login seed Ana 200 y sesión viva tras F5; sessionStorage solo contiene refreshToken en mediashrink-session; 0 accessToken en storage';
  380 |   });
  381 |   await shot('E1-07-sesion.png');
  382 | 
  383 |   // ---------------------------------------------------------------- E2
  384 |   stage = 'E2';
  385 |   const nameInput = () => page.getByLabel('Nombre del lote (opcional)', { exact: true });
  386 |   const optimizar = () => page.getByRole('button', { name: /Optimizar/ });
  387 |   const tinyJpeg = await sharp({ create: { width: 2, height: 2, channels: 3, background: { r: 10, g: 20, b: 30 } } }).jpeg().toBuffer();
  388 | 
  389 |   await runCase('E2-01', async () => {
  390 |     const invalids = [
  391 |       { name: 'notas.txt', mimeType: 'text/plain', buffer: Buffer.from('texto') },
  392 |       { name: 'documento.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') },
  393 |       { name: 'vector.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') },
  394 |       { name: 'animado.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a') },
  395 |     ];
  396 |     await page.locator('#file-picker').setInputFiles(invalids);
  397 |     const items = page.locator('.validation-errors li');
  398 |     await expect(items).toHaveCount(4);
  399 |     expect((await items.allTextContents()).every((t) => t.includes('formato no permitido'))).toBe(true);
  400 |     await expect(optimizar()).toBeDisabled();
  401 |     await expect(page.getByText('imágenes listas', { exact: false })).toHaveCount(0);
  402 |     return '4/4 rechazados en cliente (.txt/.pdf/.svg/.gif) con aviso "formato no permitido"; Optimizar sigue deshabilitado';
  403 |   });
  404 |   await shot('E2-01-formatos.png');
  405 | 
  406 |   await runCase('E2-02', async () => {
  407 |     const huge = Buffer.alloc(16 * 1024 * 1024 + 64, 7);
  408 |     await page.locator('#file-picker').setInputFiles([{ name: 'enorme.jpg', mimeType: 'image/jpeg', buffer: huge }]);
  409 |     await expect(page.locator('.validation-errors li').first()).toContainText('supera el límite de 15 MB');
  410 |     await expect(optimizar()).toBeDisabled();
  411 |     return 'Archivo de 16 MB rechazado antes de subir con aviso de límite de 15 MB; Optimizar deshabilitado';
  412 |   });
  413 | 
  414 |   await runCase('E2-03', async () => {
  415 |     const many = Array.from({ length: 21 }, (_, i) => ({ name: `mini-${i + 1}.jpg`, mimeType: 'image/jpeg', buffer: tinyJpeg }));
  416 |     await page.locator('#file-picker').setInputFiles(many);
  417 |     await expect(page.locator('.validation-errors li').first()).toContainText('El máximo es 20 imágenes por lote.');
  418 |     await expect(optimizar()).toBeDisabled();
  419 |     return '21 archivos rechazados por el tope MAX_IMAGES_PER_BATCH=20 antes de subir';
  420 |   });
  421 | 
  422 |   await runCase('E2-04', async () => {
  423 |     await page.locator('#file-picker').setInputFiles([
  424 |       { name: 'valida.jpg', mimeType: 'image/jpeg', buffer: tinyJpeg },
  425 |       { name: 'malo.txt', mimeType: 'text/plain', buffer: Buffer.from('x') },
  426 |     ]);
> 427 |     await expect(page.getByText('1 imágenes listas', { exact: true })).toBeVisible();
      |                                                                        ^ Error: expect(locator).toBeVisible() failed
  428 |     expect((await page.locator('.validation-errors li').allTextContents()).some((t) => t.includes('malo.txt') && t.includes('formato no permitido'))).toBe(true);
  429 |     await expect(optimizar()).toBeEnabled();
  430 |     return 'Mezcla válido+inválido: solo 1 imagen válida lista con motivo del descarte; Optimizar habilitado';
  431 |   });
  432 | 
  433 |   await runCase('E2-05', async () => {
  434 |     const field = nameInput();
  435 |     await expect(field).toHaveAttribute('maxlength', '80');
  436 |     await field.fill('    ');
  437 |     expect(await field.inputValue()).toBe('    ');
  438 |     await field.fill('X'.repeat(120));
  439 |     expect((await field.inputValue()).length).toBe(80);
  440 |     await field.fill(XSS_NAME);
  441 |     expect(await field.inputValue()).toBe(XSS_NAME);
  442 |     expect(dialogs).toEqual([]);
  443 |     return 'Espacios aceptados sin error, >80 chars acotado a 80 y XSS conservado como texto literal; 0 dialog';
  444 |   });
  445 | 
  446 |   await runCase('E2-06', async () => {
  447 |     for (const label of ['Alta calidad', 'Equilibrado', 'Máxima compresión']) {
  448 |       const radio = page.getByRole('radio', { name: new RegExp(label) });
  449 |       await radio.click();
  450 |       await expect(radio).toHaveAttribute('aria-checked', 'true');
  451 |     }
  452 |     await page.getByRole('radio', { name: /Equilibrado/ }).click();
  453 |     await expect(page.getByRole('radio', { name: /Equilibrado/ })).toHaveAttribute('aria-checked', 'true');
  454 |     return 'Los 3 presets son seleccionables; se deja activo Equilibrado para E3';
  455 |   });
  456 |   await shot('E2-06-presets.png');
  457 | 
  458 |   // ---------------------------------------------------------------- E3
  459 |   stage = 'E3';
  460 |   let jobId = '';
  461 |   let metricValues: string[] = [];
  462 |   const largeBuffers: Buffer[] = [];
  463 | 
  464 |   await runCase('E3-01', async () => {
  465 |     for (let i = 0; i < 3; i += 1) {
  466 |       const buffer = await createLargeJpeg(i, i === 0);
  467 |       expect(buffer.byteLength, `imagen ${i + 1} > 350 KiB`).toBeGreaterThan(350_000);
  468 |       largeBuffers.push(buffer);
  469 |     }
  470 |     expect((await sharp(largeBuffers[0]).metadata()).exif, 'EXIF/GPS real inyectado en la imagen 1').toBeDefined();
  471 |     await nameInput().fill(BATCH_NAME);
  472 |     await page.locator('#file-picker').setInputFiles(largeBuffers.map((buffer, i) => ({
  473 |       name: `producto-${i + 1}.jpg`, mimeType: 'image/jpeg', buffer,
  474 |     })));
  475 |     await expect(page.getByText('3 imágenes listas', { exact: true })).toBeVisible();
  476 |     await expect(page.getByRole('radio', { name: /Equilibrado/ })).toHaveAttribute('aria-checked', 'true');
  477 |     return `3 JPEG reales de ${largeBuffers.map((b) => b.byteLength).join('/')} bytes (>350 KiB), imagen 1 con EXIF/GPS inyectado, nombre "${BATCH_NAME}" y preset Equilibrado`;
  478 |   });
  479 | 
  480 |   await runCase('E3-02', async () => {
  481 |     await captureInitialState(page, BATCH_NAME);
  482 |     await page.getByRole('button', { name: /Optimizar 3 imágenes/ }).click();
  483 |     const confirmation = page.getByText(/Lote \S+ confirmado/);
  484 |     await expect(confirmation).toBeVisible({ timeout: 60_000 });
  485 |     const text = (await confirmation.textContent()) ?? '';
  486 |     jobId = text.match(/Lote (\S+) confirmado/)?.[1] ?? '';
  487 |     expect(jobId).not.toBe('');
  488 |     const posts = responses.filter((r) => r.method === 'POST' && r.path === '/jobs');
  489 |     expect(posts.length).toBeGreaterThan(0);
  490 |     expect(posts[posts.length - 1]?.status).toBe(200);
  491 |     const confirms = responses.filter((r) => r.method === 'POST' && /\/confirm$/.test(r.path));
  492 |     expect(confirms.length).toBeGreaterThan(0);
  493 |     expect(confirms[confirms.length - 1]?.status).toBe(200);
  494 |     expect(confirms.some((r) => r.status === 503)).toBe(false);
  495 |     await expect.poll(
  496 |       () => page.locator('html').getAttribute('data-f05-initial-zip-state'),
  497 |       { timeout: 30_000 },
  498 |     ).not.toBeNull();
  499 |     expect(await page.locator('html').getAttribute('data-f05-busy-observed')).toBe('true');
  500 |     const initial = JSON.parse((await page.locator('html').getAttribute('data-f05-initial-zip-state')) ?? '{}') as { disabled: boolean; status: string };
  501 |     expect(initial.disabled, 'ZIP deshabilitado en el primer render').toBe(true);
  502 |     expect(initial.status).toMatch(/En espera|Procesando/);
  503 | 
  504 |     const results = page.getByRole('region', { name: 'Resultados del lote' });
  505 |     await expect(results.locator('.status-chip')).toHaveText('Completado', { timeout: 180_000 });
  506 |     const polls = responses.filter((r) => r.method === 'GET' && r.path === `/jobs/${jobId}`);
  507 |     expect(polls.length, 'polling real GET /jobs/:id').toBeGreaterThan(0);
  508 |     expect(polls.every((r) => r.status === 200)).toBe(true);
  509 |     expect(responses.filter((r) => r.status === 429)).toEqual([]);
  510 |     return `POST /jobs 200, confirm 200 (sin 503), botón bloqueado durante subida, ZIP deshabilitado en "${initial.status}", ${polls.length} polls 200 hasta Completado, 0×429`;
  511 |   });
  512 | 
  513 |   await runCase('E3-03', async () => {
  514 |     const history = page.getByRole('list', { name: 'Historial de lotes' });
  515 |     await expect(history).toBeVisible();
  516 |     const row = history.locator('li').filter({ hasText: BATCH_NAME });
  517 |     await expect(row).toHaveCount(1);
  518 |     await expect(history.locator('li').first().getByRole('button', { name: BATCH_NAME, exact: true })).toHaveCount(1);
  519 |     await expect(row.locator('time')).toHaveText(/\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}/);
  520 |     const results = page.getByRole('region', { name: 'Resultados del lote' });
  521 |     await expect(results.getByRole('heading', { name: BATCH_NAME, exact: true })).toBeVisible();
  522 |     metricValues = await results.locator('.metrics-grid strong').allTextContents();
  523 |     expect(toBytes(metricValues[0])).toBeGreaterThan(1_048_576);
  524 |     expect(toBytes(metricValues[1])).toBeLessThan(toBytes(metricValues[0]));
  525 |     expect(Number.parseFloat(metricValues[2])).toBeGreaterThan(0);
  526 |     expect(metricValues[3]).toContain('EXIF eliminado');
  527 |     const cards = results.locator('.image-result');
```