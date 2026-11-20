# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: qa-human-roadmap.spec.ts >> F05-QA-HUMAN Loop 3: roadmap real E0-01 … E7-03 sin dobles ni muletas
- Location: temporary\qa-human\qa-human-roadmap.spec.ts:112:1

# Error details

```
Error: 0 4xx/5xx inesperadas

expect(received).toEqual(expected) // deep equality

- Expected  -  1
+ Received  + 16

- Array []
+ Array [
+   Object {
+     "method": "GET",
+     "path": "/__s3_local/mediashrink-optimized-local/demo-user-ana/b241c33f-6aff-4538-9491-d527f2a1bc7a/optimized/e7d46ea3-b402-47e5-b6a6-0b0d7c0a1aa5.webp",
+     "stage": "E5",
+     "status": 404,
+     "ts": 1795184250364,
+   },
+   Object {
+     "method": "GET",
+     "path": "/__s3_local/mediashrink-optimized-local/demo-user-ana/107aabf9-bd22-4627-899f-eb1a506530c7/optimized/4bf3055f-5f67-414e-a292-4e4467b70e84.webp",
+     "stage": "E5",
+     "status": 404,
+     "ts": 1795184256447,
+   },
+ ]
```

# Page snapshot

```yaml
- generic [ref=f6e3]:
  - banner [ref=f6e4]:
    - link "MediaShrink, inicio" [ref=f6e5] [cursor=pointer]:
      - /url: /
      - generic [ref=f6e6]: M
      - generic [ref=f6e7]:
        - text: mediashrink
        - generic [ref=f6e8]: ESTUDIO DE IMAGEN
    - navigation "Navegación principal" [ref=f6e9]:
      - link "Optimizar" [ref=f6e10] [cursor=pointer]:
        - /url: "#optimizar"
      - link "Privacidad" [ref=f6e11] [cursor=pointer]:
        - /url: "#privacidad"
    - generic [ref=f6e12]:
      - generic [ref=f6e13]: ● Tus imágenes, bajo tu control
      - button "Cambiar a tema oscuro" [ref=f6e14] [cursor=pointer]: ☾ Oscuro
  - main [ref=f6e15]:
    - generic [ref=f6e16]:
      - paragraph [ref=f6e17]: UN TALLER PARA TUS FOTOGRAFÍAS
      - heading [level=1] [ref=f6e18]:
        - text: Menos peso.
        - emphasis [ref=f6e19]: La misma imagen.
      - paragraph [ref=f6e20]: Optimiza tus fotos en privado. Conserva cada detalle y recupera espacio, con métricas claras en cada paso.
      - generic [ref=f6e21]:
        - generic [ref=f6e22]: ↗ WebP + AVIF
        - generic [ref=f6e23]: ⌁ Metadatos privados
        - generic [ref=f6e24]: ◷ Tú decides cuándo borrar
    - region "Prepara un lote" [ref=f6e25]:
      - generic [ref=f6e26]:
        - generic [ref=f6e27]:
          - paragraph [ref=f6e28]: TU ESPACIO DE TRABAJO
          - heading "Prepara un lote" [level=2] [ref=f6e29]
        - generic [ref=f6e30]: 01 · Añade fotografías
      - generic [ref=f6e31]:
        - generic [ref=f6e32]:
          - generic [ref=f6e33]:
            - text: Correo electrónico
            - textbox "Correo electrónico" [ref=f6e34]: ana.demo@example.com
          - generic [ref=f6e35]:
            - text: Contraseña
            - textbox "Contraseña" [ref=f6e36]: ClaveIncorrecta123!
          - button "Iniciar sesión" [active] [ref=f6e37] [cursor=pointer]: Iniciar sesión ↗
          - button "Crear cuenta" [ref=f6e38] [cursor=pointer]
        - alert [ref=f6e39]: Has realizado demasiados intentos. Espera un momento e inténtalo de nuevo.
      - generic [ref=f6e40]:
        - button "explora tus archivos" [ref=f6e41]
        - generic [aria-hidden] [ref=f6e42]: ↑
        - heading "Arrastra tus imágenes aquí" [level=3] [ref=f6e43]
        - paragraph [ref=f6e44]: o explora tus archivos
        - generic [ref=f6e45]: JPEG, PNG, WebP o AVIF · Hasta 15 MB por imagen · Máximo 20 imágenes
      - generic [ref=f6e46]:
        - generic [ref=f6e47]:
          - paragraph [ref=f6e48]: NIVEL DE COMPRESIÓN
          - radiogroup "Preset de compresión" [ref=f6e49]:
            - radio "Alta calidad Prioriza el detalle" [ref=f6e50] [cursor=pointer]:
              - strong [ref=f6e52]: Alta calidad
              - generic [ref=f6e53]: Prioriza el detalle
            - radio "Equilibrado Un punto medio versátil" [checked] [ref=f6e54] [cursor=pointer]:
              - strong [ref=f6e56]: Equilibrado
              - generic [ref=f6e57]: Un punto medio versátil
            - radio "Máxima compresión Archivos más pequeños" [ref=f6e58] [cursor=pointer]:
              - strong [ref=f6e60]: Máxima compresión
              - generic [ref=f6e61]: Archivos más pequeños
        - complementary [ref=f6e62]:
          - generic [aria-hidden] [ref=f6e63]: ✳
          - paragraph [ref=f6e64]:
            - strong [ref=f6e65]: Privacidad por diseño
            - text: Eliminamos los metadatos de ubicación y cámara al optimizar.
      - generic [ref=f6e66]:
        - text: Nombre del lote (opcional)
        - textbox "Nombre del lote (opcional)" [ref=f6e67]:
          - /placeholder: Ej. Fotos vacaciones noviembre
      - button "Optimizar tus imágenes" [disabled] [ref=f6e68]:
        - text: Optimizar tus imágenes
        - generic [aria-hidden] [ref=f6e69]: →
      - paragraph [ref=f6e70]: La selección se valida en este dispositivo antes de iniciar un lote.
      - generic [ref=f6e71]:
        - generic [ref=f6e72]: TUS LOTES
        - button "Actualizar historial" [disabled] [ref=f6e73]
      - paragraph [ref=f6e74]: Aún no hay lotes. Cuando optimices imágenes, aparecerán aquí.
    - generic [ref=f6e75]:
      - generic [ref=f6e76]: MediaShrink Cloud / Cuidado para tus imágenes
      - generic [ref=f6e77]: Diseñado para la privacidad ✳
```

# Test source

```ts
  702 |     } catch (error) {
  703 |       throw new Error(`DLQ real no verificada: ${dlq} · ${error instanceof Error ? error.message.slice(0, 200) : ''}`);
  704 |     }
  705 |     return `JPEG truncada (${truncated.length} bytes con SOI válido) → Completado parcialmente, imagen sana optimizada y ZIP habilitado; ${dlq}`;
  706 |   });
  707 |   await shot('E5-01-parcial-dlq.png');
  708 | 
  709 |   await runCase('E5-02', async () => {
  710 |     const textBytes = Buffer.from('este archivo es texto plano y no contiene magic bytes de imagen; renombrado a .jpg.');
  711 |     await nameInput().fill(XSS_NAME);
  712 |     await page.locator('#file-picker').setInputFiles([{ name: 'texto-renombrado.jpg', mimeType: 'image/jpeg', buffer: textBytes }]);
  713 |     await expect(page.getByText('1 imágenes listas', { exact: true })).toBeVisible();
  714 |     await page.getByRole('button', { name: /Optimizar 1 imágenes/ }).click();
  715 |     const confirmation = page.getByText(/Lote \S+ confirmado/);
  716 |     await expect(confirmation).toBeVisible({ timeout: 60_000 });
  717 |     const results = page.getByRole('region', { name: 'Resultados del lote' });
  718 |     await expect(results.locator('.status-chip')).toHaveText('Fallido', { timeout: 180_000 });
  719 |     const row = page.getByRole('list', { name: 'Historial de lotes' }).locator('li').filter({ hasText: XSS_NAME });
  720 |     await expect(row).toHaveCount(1);
  721 |     await expect(row.getByRole('button', { name: 'Descargar ZIP', exact: true })).toBeDisabled();
  722 |     await expect(row.getByRole('button', { name: XSS_NAME, exact: true })).toHaveCount(1);
  723 |     expect(await row.locator('script').count()).toBe(0);
  724 |     expect(dialogs).toEqual([]);
  725 |     return 'Texto renombrado a .jpg rechazado por magic bytes → lote Fallido con ZIP deshabilitado; nombre XSS renderizado como texto literal, 0 script/0 dialog';
  726 |   });
  727 |   await shot('E5-02-fallido.png');
  728 | 
  729 |   // ---------------------------------------------------------------- E6
  730 |   stage = 'E6';
  731 |   await runCase('E6-01', async () => {
  732 |     dialogMode = 'dismiss';
  733 |     const row = page.getByRole('list', { name: 'Historial de lotes' }).locator('li').filter({ hasText: MIXED_NAME });
  734 |     await expect(row).toHaveCount(1);
  735 |     await row.getByRole('button', { name: 'Borrar', exact: true }).click();
  736 |     await expect(row).toHaveCount(1);
  737 |     expect(dialogs.some((d) => d.includes('¿Borrar el lote'))).toBe(true);
  738 |     return 'Diálogo de confirmación cancelado: el lote "Lote Mixto Corrupto" se conserva';
  739 |   });
  740 | 
  741 |   await runCase('E6-02', async () => {
  742 |     dialogMode = 'accept';
  743 |     const row = page.getByRole('list', { name: 'Historial de lotes' }).locator('li').filter({ hasText: MIXED_NAME });
  744 |     await row.getByRole('button', { name: 'Borrar', exact: true }).click();
  745 |     await expect(row).toHaveCount(0);
  746 |     await paceAuth(1);
  747 |     await page.reload();
  748 |     noteAuth();
  749 |     await expect(page.getByText('Sesión iniciada como', { exact: false })).toBeVisible();
  750 |     await page.getByRole('button', { name: 'Actualizar historial' }).click();
  751 |     await expect(page.getByRole('list', { name: 'Historial de lotes' }).locator('li').filter({ hasText: MIXED_NAME })).toHaveCount(0);
  752 |     return 'Borrado confirmado (DELETE 200) y lote ausente incluso tras F5 + "Actualizar historial"';
  753 |   });
  754 | 
  755 |   await runCase('E6-03', async () => {
  756 |     await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  757 |     await paceAuth(1); noteAuth();
  758 |     await page.getByLabel('Correo electrónico').fill(BRUNO_EMAIL);
  759 |     await page.getByLabel('Contraseña').fill(BRUNO_PASSWORD);
  760 |     await loginButtons().click();
  761 |     await expect(page.getByText(BRUNO_EMAIL, { exact: false })).toBeVisible();
  762 |     await page.getByRole('button', { name: 'Actualizar historial' }).click();
  763 |     const history = page.getByRole('list', { name: 'Historial de lotes' });
  764 |     await expect(history).toBeVisible();
  765 |     expect(await history.locator('li').filter({ hasText: BATCH_NAME }).count()).toBe(0);
  766 |     expect(await page.getByText(BATCH_NAME, { exact: false }).count()).toBe(0);
  767 |     expect(await page.getByText(jobId, { exact: false }).count()).toBe(0);
  768 |     return 'Logout Ana + login Bruno 200 con aislamiento total: 0 lotes, 0 nombre y 0 jobId de Ana visibles';
  769 |   });
  770 |   await shot('E6-03-aislamiento.png');
  771 | 
  772 |   await runCase('E6-04', async () => {
  773 |     await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  774 |     await freshAuthWindow();
  775 |     for (let attempt = 1; attempt <= 6; attempt += 1) {
  776 |       noteAuth();
  777 |       await page.getByLabel('Correo electrónico').fill(ANA_EMAIL);
  778 |       await page.getByLabel('Contraseña').fill('ClaveIncorrecta123!');
  779 |       await loginButtons().click();
  780 |       const alert = page.getByRole('alert').first();
  781 |       if (attempt < 6) {
  782 |         await expect(alert).toHaveText('El correo o la contraseña no son correctos.');
  783 |       } else {
  784 |         await expect(alert).toHaveText('Has realizado demasiados intentos. Espera un momento e inténtalo de nuevo.');
  785 |       }
  786 |     }
  787 |     const limited = responses.filter((r) => r.path === '/auth/login' && r.status === 429);
  788 |     expect(limited.length, '6.º intento → 429').toBe(1);
  789 |     return '6 intentos fallidos en la misma ventana: los 5 primeros 401 y el 6.º 429 con mensaje RATE_LIMITED claro en español';
  790 |   });
  791 |   await shot('E6-04-rate-limit.png');
  792 | 
  793 |   // ---------------------------------------------------------------- E7
  794 |   stage = 'E7';
  795 |   await runCase('E7-01', async () => {
  796 |     expect(pageErrors, '0 pageerror').toEqual([]);
  797 |     const expectedStatus = (r: Resp) =>
  798 |       (r.status === 401 && r.path === '/auth/login')
  799 |       || (r.status === 409 && r.path === '/auth/register')
  800 |       || (r.status === 429 && r.path === '/auth/login');
  801 |     const unexpectedHttp = responses.filter((r) => r.status >= 400 && !expectedStatus(r));
> 802 |     expect(unexpectedHttp, '0 4xx/5xx inesperadas').toEqual([]);
      |                                                     ^ Error: 0 4xx/5xx inesperadas
  803 |     const isExpectedConsole = (entry: ConsoleErr) => /Failed to load resource.*status of (401|409|429)/.test(entry.text);
  804 |     const unexpectedConsole = consoleErrors.filter((entry) => !isExpectedConsole(entry));
  805 |     expect(unexpectedConsole, '0 errores de consola inesperados').toEqual([]);
  806 |     return `0 pageerror; ${responses.filter((r) => r.status >= 400).length} HTTP de error todas esperadas (401/409/429); ${consoleErrors.length} errores de consola todos asociados a esos statuses esperados`;
  807 |   });
  808 | 
  809 |   await runCase('E7-02', async () => {
  810 |     const pngs = readdirSync(EVIDENCE_DIR).filter((name) => /^E\d-.*\.png$/.test(name));
  811 |     expect(pngs.length, 'captura por etapa E0…E7').toBeGreaterThanOrEqual(8);
  812 |     return `${pngs.length} capturas PNG E0…E7 en reports/implementation/F05/evidence/qa-human-roadmap/loop3/`;
  813 |   });
  814 | 
  815 |   await runCase('E7-03', async () => {
  816 |     const evidence = readFileSync(EVIDENCE_JSON, 'utf8');
  817 |     expect(evidence).not.toMatch(/[A-Za-z]:\\|[A-Za-z]:\/[A-Za-z0-9_]/);
  818 |     expect(evidence).not.toMatch(/\/@fs\/(?!<PROJECT_ROOT>)/);
  819 |     expect(evidence).not.toMatch(/Bearer\s+[A-Za-z0-9._-]{12,}|AKIA[0-9A-Z]{16}/);
  820 |     expect(evidence).not.toMatch(/https?:\/\/[^\s"']+\?[^\s"']+/);
  821 |     return 'Evidencia saneada desde escritura: 0 rutas de host, 0 rutas Vite sin normalizar, 0 tokens y 0 query strings (P4/G-3); cierre Docker verificado fuera del navegador';
  822 |   });
  823 | 
  824 |   writeEvidence();
  825 |   expect(results.length, '31 casos ejecutados').toBe(31);
  826 |   expect(results.every((r) => r.result === 'PASS'), 'roadmap completo sin fallos').toBe(true);
  827 | });
  828 | 
```