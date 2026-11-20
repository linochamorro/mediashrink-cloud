import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { request as httpsRequest } from 'node:https';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';
import sharp from 'sharp';

import { readZip } from '../unit/api/zip-reader';

/**
 * F05-QA / Capa 5 — roadmap QA integral en navegador real (runbook §1 y §2).
 *
 * Pila EXTERNA y real, sin `webServer` ni dobles de API: emulador
 * aws/aws-emulator + `terraform apply` + backend Hono/worker (3001) + SPA Vite
 * (5173, proxy same-origin `/auth` y `/jobs`). El único adaptador es el relay
 * de transporte S3: el emulador no implementa OPTIONS, así que se reenvía la
 * petición REAL (misma URL firmada, mismo cuerpo) y se devuelve la respuesta
 * REAL con solo las cabeceras CORS que faltan.
 *
 * Un único test y un único contexto encadenan los escenarios 01→12 en orden
 * para emitir los 12 PNG obligatorios del runbook §2 en
 * `reports/implementation/F05/evidence/qa-roadmap/`.
 *
 * Datos 100% ficticios: cuentas `@example.com` y fotografías sintéticas
 * generadas por código. Ningún nombre de archivo ni captura contiene una ruta
 * local ni un secreto (G-3).
 */

const shotsDir = resolve(
  fileURLToPath(new URL('../../reports/implementation/F05/evidence/qa-roadmap', import.meta.url)),
);
const origin = 'http://localhost:5173';

/** Catálogo exacto del runbook §2 (orden 01→12). */
const PNGS = [
  '01-auth-login-claro.png',
  '02-auth-error-credenciales.png',
  '03-auth-registro.png',
  '04-dashboard-tema-oscuro.png',
  '05-upload-validacion-error.png',
  '06-upload-lote-preset-progreso.png',
  '07-resultados-comparativa-metricas.png',
  '08-descarga-individual-y-zip.png',
  '09-lote-parcial-o-error.png',
  '10-borrado-manual-lote.png',
  '11-aislamiento-usuario-b.png',
  '12-logout-limpio.png',
] as const;

type Upload = { name: string; mimeType: string; buffer: Buffer };

function jpegSegment(marker: number, payload: Buffer): Buffer {
  const segment = Buffer.alloc(4 + payload.length);
  segment[0] = 0xff;
  segment[1] = marker;
  segment.writeUInt16BE(payload.length + 2, 2);
  payload.copy(segment, 4);
  return segment;
}

/** Fotografía sintética con metadatos ficticios (sin datos personales reales). */
async function createDemoPhoto(seed: number): Promise<Upload> {
  const hue = (seed * 47) % 360;
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="750">',
    '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">',
    `<stop offset="0" stop-color="hsl(${hue},64%,60%)"/>`,
    `<stop offset="0.55" stop-color="hsl(${(hue + 42) % 360},56%,43%)"/>`,
    `<stop offset="1" stop-color="hsl(${(hue + 96) % 360},48%,24%)"/>`,
    '</linearGradient></defs>',
    '<rect width="1000" height="750" fill="url(#g)"/>',
    `<circle cx="${260 + seed * 90}" cy="290" r="165" fill="rgba(255,255,255,0.17)"/>`,
    `<circle cx="${720 - seed * 60}" cy="470" r="95" fill="rgba(0,0,0,0.10)"/>`,
    `<text x="58" y="694" font-family="Arial,Helvetica,sans-serif" font-size="42" fill="rgba(255,255,255,0.88)">MUESTRA SINTETICA 0${seed}</text>`,
    '</svg>',
  ].join('');
  const base = await sharp(Buffer.from(svg)).jpeg({ quality: 86 }).toBuffer();
  const xmp = Buffer.from(
    `http://ns.adobe.com/xap/1.0/\x00<x:xmpmeta><private>DEMO-XMP-0${seed}</private></x:xmpmeta>`,
    'latin1',
  );
  const iptc = Buffer.from(
    `Photoshop 3.0\x008BIM\x04\x04\x00\x00\x00\x0bDEMO-IPTC-0${seed}`,
    'latin1',
  );
  return {
    name: `paisaje-sintetico-0${seed}.jpg`,
    mimeType: 'image/jpeg',
    buffer: Buffer.concat([
      base.subarray(0, 2),
      jpegSegment(0xe1, xmp),
      jpegSegment(0xed, iptc),
      base.subarray(2),
    ]),
  };
}

/**
 * JPEG corrupto determinista para el escenario 09: SOI + relleno sin marcador
 * SOF. Pasa la validación de cliente (tipo y tamaño) y el worker lo rechaza en
 * `validateImageHeader` con `DIMENSIONS_UNAVAILABLE` en cada intento, hasta la
 * DLQ, sin abortar el lote (1 válida + 1 corrupta = `PARTIAL`).
 */
function createCorruptJpeg(): Buffer {
  return Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(117, 0x00)]);
}

async function installS3Relay(context: BrowserContext): Promise<void> {
  await context.route('https://127.0.0.1:9297/**', async (route) => {
    const cors = {
      'access-control-allow-origin': origin,
      'access-control-expose-headers': '*',
    };
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          ...cors,
          'access-control-allow-methods': 'GET, PUT',
          'access-control-allow-headers': '*',
        },
      });
      return;
    }

    const signed = new URL(route.request().url());
    const body = route.request().postDataBuffer() ?? undefined;
    const response = await new Promise<{
      status: number;
      headers: Record<string, string>;
      body: Buffer;
    }>((done, reject) => {
      const upstream = httpsRequest(
        {
          hostname: signed.hostname,
          port: signed.port || 443,
          path: `${signed.pathname}${signed.search}`,
          method: route.request().method(),
          headers: { host: signed.host, ...(body ? { 'content-length': String(body.length) } : {}) },
          ca: readFileSync('.local/aws-emulator/ca.pem'),
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () =>
            done({
              status: res.statusCode ?? 502,
              headers: res.headers as Record<string, string>,
              body: Buffer.concat(chunks),
            }),
          );
        },
      );
      upstream.once('error', reject);
      if (body) upstream.write(body);
      upstream.end();
    });

    const hopByHop = new Set(['content-length', 'transfer-encoding', 'connection']);
    const safeHeaders = Object.fromEntries(
      Object.entries(response.headers).filter(([key]) => !hopByHop.has(key.toLowerCase())),
    );
    await route.fulfill({
      status: response.status,
      headers: {
        ...safeHeaders,
        'content-type': response.headers['content-type'] ?? 'application/octet-stream',
        ...cors,
      },
      body: response.body,
    });
  });
}

async function shotPage(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: resolve(shotsDir, name), fullPage: true, animations: 'disabled' });
}

async function shotElement(target: Locator, name: string): Promise<void> {
  await target.screenshot({ path: resolve(shotsDir, name), animations: 'disabled' });
}

/** Extrae el jobId real devuelto por `POST /jobs/confirm` desde el mensaje de la UI. */
async function readJobId(page: Page): Promise<string> {
  const message = await page.getByText(/Lote .+ confirmado/).textContent();
  const jobId = message?.match(/Lote ([^\s]+) confirmado/)?.[1];
  if (!jobId) throw new Error('la API real no devolvio un jobId en el mensaje de confirmacion');
  return jobId;
}

type ProgressState = { partial: boolean; value: string };

/**
 * Observa la barra de progreso REAL en cuanto existe: el primer detalle del
 * lote llega con estado PENDING/PROCESSING y `value < max` (el consumidor
 * SQS drena cada 2 s), así que se captura el estado de polling real. Devuelve
 * `partial=false` solo si el lote aparece ya completado en la primera lectura.
 */
async function observeProgress(results: Locator): Promise<ProgressState> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const bar = results.getByRole('progressbar');
    if (await bar.count()) {
      const value = Number(await bar.getAttribute('value'));
      const max = Number(await bar.getAttribute('max'));
      return { partial: value < max, value: `${value}/${max}` };
    }
    await results.page().waitForTimeout(100);
  }
  return { partial: false, value: 'sin-barra' };
}

test('F05-QA roadmap: 12 capturas obligatorias sobre la pila real (sin mocks)', async ({
  browser,
}) => {
  mkdirSync(shotsDir, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await installS3Relay(context);
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  // Errores de red del navegador con la query string retirada: nunca se
  // registran URL firmadas completas en la evidencia (G-3).
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    console.log(`F05_QA browser console.error: ${message.text().replace(/\?.*$/, '')}`);
  });

  // JobIds reales devueltos por el backend, encadenados entre escenarios.
  let jobA = '';
  let jobB = '';
  let jobC = '';

  try {
    await test.step('01 — pantalla de acceso en tema Claro por defecto', async () => {
      await page.goto('/');
      await expect(page.getByRole('heading', { name: /Menos peso/ })).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
      // F05-UX-HEADER-AUTH: acceso compacto en el <header>; el formulario vive en el panel.
      await expect(page.getByRole('button', { name: 'Abrir panel de acceso' })).toBeVisible();
      await page.getByRole('button', { name: 'Abrir panel de acceso' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByLabel('Correo electrónico')).toBeVisible();
      await shotPage(page, PNGS[0]);
      console.log('F05_QA 01: tema claro por defecto y formulario de acceso visibles');
    });

    await test.step('02 — error acotado ante credenciales invalidas', async () => {
      await page.getByLabel('Correo electrónico').fill('bruno.demo@example.com');
      await page.getByLabel('Contraseña').fill('PasswordIncorrecta2026!');
      await page.locator('form.auth-form button[type="submit"]').click();
      // Coincidencia EXACTA: ningún detalle interno (stack, tabla, ruta o SQL)
      // puede acompañar al mensaje público.
      await expect(page.locator('.auth-panel .error-message')).toHaveText(
        'El correo o la contraseña no son correctos.',
      );
      await shotElement(page.locator('.auth-panel'), PNGS[1]);
      console.log('F05_QA 02: 401 INVALID_CREDENTIALS mostrado como mensaje publico acotado');
    });

    await test.step('03 — registro publico de usuario ficticio', async () => {
      await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
      await page.getByLabel('Correo electrónico').fill('ana.demo@example.com');
      await page.getByLabel('Contraseña').fill('DemoAna2026!');
      await shotElement(page.locator('.auth-panel'), PNGS[2]);
      await page.locator('form.auth-form button[type="submit"]').click();
      // Idempotencia de corrida: si la cuenta ficticia ya la registró una
      // corrida anterior (409), se entra con la MISMA cuenta. La captura 03 se
      // emitió antes de enviar, con el formulario publico de registro visible.
      const outcome = await page
        .waitForSelector('.session-email, .auth-panel .error-message', { timeout: 15_000 })
        .catch(() => null);
      expect(outcome, 'el backend responde con sesion o con un error publico').not.toBeNull();
      if ((await page.locator('.session-email').count()) > 0) {
        console.log('F05_QA 03: registro ana.demo@example.com aceptado por el backend real');
      } else {
        console.log('F05_QA 03: cuenta ya registrada en una corrida previa; acceso con la misma');
        await page.getByRole('button', { name: 'Ya tengo cuenta' }).click();
        await page.getByLabel('Correo electrónico').fill('ana.demo@example.com');
        await page.getByLabel('Contraseña').fill('DemoAna2026!');
        await page.locator('form.auth-form button[type="submit"]').click();
        await expect(page.getByRole('banner').getByText('ana.demo@example.com')).toBeVisible({ timeout: 15_000 });
      }
      await expect(page.getByRole('banner').getByText('ana.demo@example.com')).toBeVisible();
    });

    await test.step('04 — tema Oscuro persistente tras recargar', async () => {
      await page.getByRole('button', { name: 'Cambiar a tema oscuro' }).click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      expect(await page.evaluate(() => localStorage.getItem('mediashrink-theme'))).toBe('dark');
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      await expect(page.getByRole('banner').getByText('ana.demo@example.com')).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText('ana.demo@example.com')).toBeVisible();
      await shotPage(page, PNGS[3]);
      console.log('F05_QA 04: tema oscuro y sesion restaurada tras recargar (localStorage)');
    });

    await test.step('05 — rechazo en cliente de archivo no permitido', async () => {
      await page.locator('#file-picker').setInputFiles([
        {
          name: 'vector-demo.svg',
          mimeType: 'image/svg+xml',
          buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'),
        },
      ]);
      const errors = page.locator('.validation-errors');
      await expect(errors).toBeVisible();
      await expect(errors).toContainText('formato no permitido');
      await expect(errors).toContainText('vector-demo.svg');
      await shotElement(page.locator('.workspace'), PNGS[4]);
      console.log('F05_QA 05: SVG rechazado en cliente antes de subir nada');
    });

    await test.step('06 — drag & drop, 3 presets y barra de progreso en polling', async () => {
      const photos = await Promise.all([1, 2, 3].map((seed) => createDemoPhoto(seed)));
      const transfer = await page.evaluateHandle(
        (items) => {
          const browser = globalThis as unknown as {
            DataTransfer: new () => { items: { add(item: unknown): void } };
            File: new (parts: unknown[], name: string, options: { type: string }) => unknown;
            atob(data: string): string;
          };
          const data = new browser.DataTransfer();
          for (const item of items) {
            const raw = browser.atob(item.b64);
            const bytes = new Uint8Array(raw.length);
            for (let index = 0; index < raw.length; index += 1) {
              bytes[index] = raw.charCodeAt(index);
            }
            data.items.add(new browser.File([bytes], item.name, { type: item.type }));
          }
          return data;
        },
        photos.map((photo) => ({
          b64: photo.buffer.toString('base64'),
          name: photo.name,
          type: photo.mimeType,
        })),
      );
      await page.locator('.dropzone').dispatchEvent('drop', { dataTransfer: transfer });
      await transfer.dispose();
      await expect(page.getByText('3 imágenes listas')).toBeVisible();

      const presetHigh = page.getByRole('radio', { name: /Alta calidad/ });
      const presetBalanced = page.getByRole('radio', { name: /Equilibrado/ });
      const presetMax = page.getByRole('radio', { name: /Máxima compresión/ });
      for (const preset of [presetHigh, presetMax, presetBalanced]) {
        await preset.click();
        await expect(preset).toHaveAttribute('aria-checked', 'true');
      }
      console.log('F05_QA 06: 3 presets (HIGH/BALANCED/MAX_COMPRESSION) seleccionables');

      await page.getByRole('button', { name: /Optimizar 3 imágenes/ }).click();
      await expect(page.getByText(/Lote .+ confirmado/)).toBeVisible({ timeout: 30_000 });
      const jobAFromMessage = await readJobId(page);
      console.log(`F05_QA 06: lote A ${jobAFromMessage} confirmado por el backend real`);

      const results = page.getByRole('region', { name: 'Resultados del lote' });
      await expect(results).toBeVisible({ timeout: 30_000 });
      const progress = await observeProgress(results);
      console.log(`F05_QA 06: progreso observado ${progress.value} (parcial=${progress.partial})`);
      await shotPage(page, PNGS[5]);
      jobA = jobAFromMessage;
    });

    await test.step('07 — lote COMPLETED: comparativa, metricas reales y EXIF eliminado', async () => {
      const results = page.getByRole('region', { name: 'Resultados del lote' });
      await expect(results.getByText('Completado', { exact: true })).toBeVisible({
        timeout: 120_000,
      });
      await expect(results.getByText('✓ EXIF eliminado')).toBeVisible();
      await expect(results.getByText(/Ahorro real/)).toBeVisible();
      await expect(results.getByRole('progressbar')).toHaveAttribute('value', '3');

      // La captura del progreso acerca la comparativa al viewport antes de que
      // el worker escriba los optimizados; se recarga la sesión real (token en
      // sessionStorage) y se reabre el lote para pedir las vistas con los
      // objetos ya disponibles. Sin dobles de API.
      await page.reload();
      await expect(page.getByRole('banner').getByText('ana.demo@example.com')).toBeVisible({ timeout: 30_000 });
      await page.getByRole('button', { name: 'Actualizar historial' }).click();
      await page.getByRole('button', { name: jobA }).click();
      await expect(results).toBeVisible({ timeout: 30_000 });
      await expect(results.getByText('Completado', { exact: true })).toBeVisible({
        timeout: 120_000,
      });

      const comparison = results.getByLabel(/Comparativa visual de/).first();
      await comparison.scrollIntoViewIfNeeded();
      const original = comparison.locator('img[alt^="Imagen original"]');
      const optimized = comparison.locator('img[alt^="Imagen optimizada"]');
      await expect(original).toHaveCount(1);
      await expect(optimized).toHaveCount(1);
      for (const image of [original, optimized]) {
        await expect
          .poll(
            () =>
              image.evaluate((node) => {
                const raster = node as unknown as { complete: boolean; naturalWidth: number };
                return raster.complete && raster.naturalWidth > 0;
              }),
            { timeout: 30_000 },
          )
          .toBe(true);
      }
      await shotElement(results, PNGS[6]);
      console.log('F05_QA 07: COMPLETED con comparativa real, metricas y badge EXIF eliminado');
    });

    await test.step('08 — descarga individual (WebP) y ZIP del lote', async () => {
      const results = page.getByRole('region', { name: 'Resultados del lote' });

      await expect(results.getByRole('button', { name: 'Descargar WEBP' }).first()).toBeVisible();
      const popupPromise = page.waitForEvent('popup');
      await results.getByRole('button', { name: 'Descargar WEBP' }).first().click();
      const popup = await popupPromise;
      await popup.waitForURL(/^https:\/\//, { timeout: 30_000 });
      await popup.waitForLoadState('domcontentloaded');
      const webpResponse = await page.request.get(popup.url());
      expect(webpResponse.ok(), 'la URL presignada real responde 2xx').toBe(true);
      const webpBytes = await webpResponse.body();
      expect(webpBytes.subarray(0, 4).toString('ascii')).toBe('RIFF');
      expect(webpBytes.subarray(8, 12).toString('ascii')).toBe('WEBP');
      console.log(`F05_QA 08: descarga individual real ${webpBytes.length} bytes, magic RIFF/WEBP`);
      await popup.close();

      const history = page.getByRole('list', { name: 'Historial de lotes' });
      // El historial acumula lotes de corridas anteriores: se accede al ZIP
      // DEL lote de esta corrida (fila filtrada por su jobId).
      const jobRow = history.locator('li').filter({ hasText: jobA });
      await expect(jobRow.getByRole('button', { name: 'Descargar ZIP' })).toBeVisible();
      const downloadPromise = page.waitForEvent('download');
      await jobRow.getByRole('button', { name: 'Descargar ZIP' }).click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toBe(`${jobA}.zip`);
      const zipBytes = await download.createReadStream().then(async (stream) => {
        const chunks: Buffer[] = [];
        for await (const chunk of stream) chunks.push(Buffer.from(chunk));
        return Buffer.concat(chunks);
      });
      expect(zipBytes.subarray(0, 2).toString('ascii')).toBe('PK');
      const entries = readZip(zipBytes);
      // 3 fotografías × 3 variantes reales (WebP + AVIF + miniatura WebP).
      expect(entries, '3 variantes por imagen del lote').toHaveLength(3 * 3);
      const names = entries.map((entry) => entry.name).sort();
      const imageIds = new Set(
        names.map((name) => name.replace(/_thumb\.(webp|avif)$|\.(webp|avif)$/, '')),
      );
      expect(imageIds.size, 'tres imageId distintos en el ZIP').toBe(3);
      for (const imageId of imageIds) {
        expect(names).toContain(`${imageId}.webp`);
        expect(names).toContain(`${imageId}.avif`);
        expect(names).toContain(`${imageId}_thumb.webp`);
      }
      for (const entry of entries) {
        const head = entry.bytes.subarray(0, 12);
        const isWebp =
          head.subarray(0, 4).toString('ascii') === 'RIFF' &&
          head.subarray(8, 12).toString('ascii') === 'WEBP';
        const isAvif = head.subarray(4, 8).toString('ascii') === 'ftyp';
        expect(isWebp || isAvif, `${entry.name} debe ser WebP o AVIF real`).toBe(true);
      }
      console.log(
        `F05_QA 08: ZIP real ${zipBytes.length} bytes, ${entries.length} entradas (${names.join(', ')})`,
      );
      await shotPage(page, PNGS[7]);
    });

    await test.step('09 — archivo corrupto: PARTIAL con imagen fallida en DLQ', async () => {
      const good = await createDemoPhoto(4);
      await page.locator('#file-picker').setInputFiles([
        { name: good.name, mimeType: good.mimeType, buffer: good.buffer },
        { name: 'foto-corrupta-09.jpg', mimeType: 'image/jpeg', buffer: createCorruptJpeg() },
      ]);
      await expect(page.getByText('2 imágenes listas')).toBeVisible();
      await page.getByRole('button', { name: /Optimizar 2 imágenes/ }).click();
      await expect(page.getByText(/Lote .+ confirmado/)).toBeVisible({ timeout: 30_000 });
      jobB = await readJobId(page);
      console.log(`F05_QA 09: lote B ${jobB} confirmado (1 valida + 1 corrupta)`);

      const results = page.getByRole('region', { name: 'Resultados del lote' });
      await expect(results.getByText('Completado parcialmente')).toBeVisible({ timeout: 120_000 });
      await expect(results.getByRole('progressbar')).toHaveAttribute('value', '2');
      await expect(results.getByText('EXIF pendiente')).toBeVisible();
      await shotElement(results, PNGS[8]);
      console.log('F05_QA 09: estado PARTIAL en UI; la corrupta no aborta el lote valido');
    });

    await test.step('10 — borrado manual con confirmacion y lista actualizada', async () => {
      const history = page.getByRole('list', { name: 'Historial de lotes' });
      await expect(history.getByRole('button', { name: jobA })).toBeVisible();
      await expect(history.getByRole('button', { name: jobB })).toBeVisible();

      page.once('dialog', (dialog) => {
        console.log(`F05_QA 10: confirmacion nativa "${dialog.message()}"`);
        void dialog.accept();
      });
      await history
        .locator('li')
        .filter({ hasText: jobB })
        .getByRole('button', { name: 'Borrar' })
        .click();
      await expect(page.getByRole('button', { name: jobB })).toHaveCount(0, { timeout: 30_000 });
      await expect(page.getByRole('region', { name: 'Resultados del lote' })).toHaveCount(0);

      // Reconsulta al servidor: el lote borrado ya no vuelve del API real.
      await page.getByRole('button', { name: 'Actualizar historial' }).click();
      await expect(history.getByRole('button', { name: jobA })).toBeVisible();
      await expect(history.getByRole('button', { name: jobB })).toHaveCount(0);
      await shotElement(page.locator('.workspace'), PNGS[9]);
      console.log(`F05_QA 10: DELETE /jobs/${jobB} confirmado; el historial real ya no lo incluye`);
    });

    await test.step('11 — aislamiento: bruno.demo no ve los lotes de ana.demo', async () => {
      await page.getByRole('button', { name: 'Cerrar sesión' }).click();
      await expect(page.getByRole('button', { name: 'Abrir panel de acceso' })).toBeVisible();
      await page.getByRole('button', { name: 'Abrir panel de acceso' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByRole('region', { name: 'Resultados del lote' })).toHaveCount(0);
      await expect(page.locator('.jobs-list')).toHaveCount(0);
      expect(await page.evaluate(() => sessionStorage.getItem('mediashrink-session'))).toBeNull();

      await page.getByLabel('Correo electrónico').fill('bruno.demo@example.com');
      await page.getByLabel('Contraseña').fill('DemoBruno2026!');
      await page.locator('form.auth-form button[type="submit"]').click();
      await expect(page.getByRole('banner').getByText('bruno.demo@example.com')).toBeVisible();
      await expect(page.getByText('bruno.demo@example.com')).toBeVisible();

      // El historial REAL de bruno no contiene los lotes de ana (el de bruno
      // puede traer lotes propios de una corrida anterior: eso no rompe el
      // aislamiento, que se mide por la ausencia de los lotes de ana).
      await page.getByRole('button', { name: 'Actualizar historial' }).click();
      await expect(page.getByRole('button', { name: jobA })).toHaveCount(0);
      await expect(page.getByRole('button', { name: jobB })).toHaveCount(0);

      // Lote propio de bruno: su sesión sí ve SU lote y sigue sin ver los de ana.
      const photo = await createDemoPhoto(5);
      await page
        .locator('#file-picker')
        .setInputFiles([{ name: photo.name, mimeType: photo.mimeType, buffer: photo.buffer }]);
      await expect(page.getByText('1 imágenes listas')).toBeVisible();
      await page.getByRole('button', { name: /Optimizar 1 imágenes/ }).click();
      await expect(page.getByText(/Lote .+ confirmado/)).toBeVisible({ timeout: 30_000 });
      jobC = await readJobId(page);
      const results = page.getByRole('region', { name: 'Resultados del lote' });
      await expect(results.getByText('Completado', { exact: true })).toBeVisible({
        timeout: 120_000,
      });
      await expect(page.getByRole('button', { name: jobA })).toHaveCount(0);
      await expect(page.getByRole('button', { name: jobB })).toHaveCount(0);
      await expect(page.getByRole('button', { name: jobC })).toHaveCount(1);
      await expect(page.getByText('ana.demo@example.com')).toHaveCount(0);
      await shotPage(page, PNGS[10]);
      console.log(
        `F05_QA 11: bruno ve solo su lote ${jobC}; ${jobA} y ${jobB} (ana) siguen ausentes`,
      );
    });

    await test.step('12 — logout limpio, sin datos ni previews residuales', async () => {
      await page.getByRole('button', { name: 'Cerrar sesión' }).click();
      await expect(page.getByRole('region', { name: 'Resultados del lote' })).toHaveCount(0);
      await expect(page.locator('.jobs-list')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Abrir panel de acceso' })).toBeVisible();
      await expect(page.getByText('bruno.demo@example.com')).toHaveCount(0);
      await expect(page.locator('img[alt^="Imagen "]')).toHaveCount(0);
      expect(await page.evaluate(() => sessionStorage.getItem('mediashrink-session'))).toBeNull();
      await shotPage(page, PNGS[11]);
      console.log('F05_QA 12: sesion y datos privados retirados del DOM y del almacenamiento');
    });

    await test.step('verificacion final de los 12 PNG del catalogo', async () => {
      for (const name of PNGS) {
        const path = resolve(shotsDir, name);
        expect(existsSync(path), `${name} debe existir`).toBe(true);
        expect(statSync(path).size, `${name} debe pesar mas de 0 bytes`).toBeGreaterThan(0);
      }
      console.log('F05_QA RESULTADO: 12/12 PNG del runbook §2 emitidos en la carpeta de evidencia');
    });
  } finally {
    await context.close();
  }
});
