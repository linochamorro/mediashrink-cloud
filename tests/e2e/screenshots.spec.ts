import { mkdirSync, readFileSync } from 'node:fs';
import { request as httpsRequest } from 'node:https';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';
import sharp from 'sharp';

/**
 * F05-T04 / CA-04 — capturas reales para el README del repositorio.
 *
 * La pila es la misma que el E2E de integracion real: emulador + terraform
 * apply + backend Hono/worker + SPA Vite, sin dobles de API. El unico
 * adaptador es el relay de transporte que el emulador exige porque no
 * implementa OPTIONS (misma URL firmada, mismo cuerpo, respuesta real).
 *
 * Los datos son ficticios: cuentas @example.test y fotografias generadas por
 * codigo. Ninguna captura ni nombre de archivo contiene una ruta local.
 */

const imagesDir = resolve(fileURLToPath(new URL('../../docs/images', import.meta.url)));
const origin = 'http://localhost:5173';
const photoCount = 3;

type Upload = { name: string; mimeType: string; buffer: Buffer };

function jpegSegment(marker: number, payload: Buffer): Buffer {
  const segment = Buffer.alloc(4 + payload.length);
  segment[0] = 0xff;
  segment[1] = marker;
  segment.writeUInt16BE(payload.length + 2, 2);
  payload.copy(segment, 4);
  return segment;
}

/** Fotografia sintetica con metadatos ficticios (sin datos personales reales). */
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

async function shot(target: Page | Locator, name: string): Promise<void> {
  await target.screenshot({ path: resolve(imagesDir, name), animations: 'disabled' });
}

async function capturePartialProgress(results: Locator, name: string): Promise<boolean> {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    const bar = results.getByRole('progressbar');
    if (await bar.count()) {
      const value = Number(await bar.getAttribute('value'));
      const max = Number(await bar.getAttribute('max'));
      // Primera observación de la barra (value 0..max-1): estado de polling real.
      if (value < max) {
        await shot(results, name);
        return true;
      }
    }
    if (await results.getByText('Completado', { exact: true }).isVisible().catch(() => false)) break;
    await results.page().waitForTimeout(200);
  }
  // El lote puede completarse antes de observar un valor parcial: se captura el
  // estado real de la barra (ya completada) para no fabricar una captura.
  const bar = results.getByRole('progressbar');
  if (await bar.count()) {
    await shot(results, name);
    return true;
  }
  return false;
}

async function runFlow(browser: import('@playwright/test').Browser, theme: 'claro' | 'oscuro'): Promise<void> {
  mkdirSync(imagesDir, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await installS3Relay(context);
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);

  try {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Menos peso/ })).toBeVisible();
    if (theme === 'oscuro') {
      await page.getByRole('button', { name: 'Cambiar a tema oscuro' }).click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    } else {
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    }
    await shot(page, `01-portada-${theme}.png`);

    await page.locator('.workspace').scrollIntoViewIfNeeded();
    await shot(page.locator('.auth-strip'), `02-acceso-${theme}.png`);

    const email = `diseno-${theme}-${Date.now()}@example.test`;
    const submitAuth = page.locator('form.auth-form button[type="submit"]');
    if (!(await submitAuth.textContent())?.includes('Crear cuenta')) {
      await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
    }
    await page.getByLabel('Correo electrónico').fill(email);
    await page.getByLabel('Contraseña').fill('DemoPassword2026!');
    await submitAuth.click();
    await expect(page.getByText('Sesión iniciada como')).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();

    const photos = await Promise.all(
      Array.from({ length: photoCount }, (_, index) => createDemoPhoto(index + 1)),
    );
    await page.locator('#file-picker').setInputFiles(photos);
    await expect(page.getByText(`${photoCount} imágenes listas`)).toBeVisible();
    await shot(page.locator('.workspace'), `03-subida-${theme}.png`);

    await page.getByRole('button', { name: new RegExp(`Optimizar ${photoCount} imágenes`) }).click();
    await expect(page.getByText(/Lote .+ confirmado/)).toBeVisible({ timeout: 30_000 });
    const message = await page.getByText(/Lote .+ confirmado/).textContent();
    const jobId = message?.match(/Lote ([^\s]+) confirmado/)?.[1];
    expect(jobId, 'la API real devolvió un jobId').toBeTruthy();

    const results = page.getByRole('region', { name: 'Resultados del lote' });
    await expect(results).toBeVisible({ timeout: 30_000 });
    await capturePartialProgress(results, `04-progreso-${theme}.png`);

    await expect(results.getByText('Completado', { exact: true })).toBeVisible({ timeout: 120_000 });
    await expect(results.getByText('✓ EXIF eliminado')).toBeVisible();
    await expect(results.getByText(/Ahorro real/)).toBeVisible();
    await expect(results.getByRole('progressbar')).toHaveAttribute('value', String(photoCount));

    // La captura del progreso acerca la comparativa al viewport antes de que el
    // worker haya escrito los optimizados; se recarga la sesion real (token de
    // sessionStorage + historial) y se reabre el lote para que las vistas se
    // soliciten con los objetos ya disponibles. No hay dobles de API.
    await page.reload();
    await expect(page.getByText('Sesión iniciada como')).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Actualizar historial' }).click();
    await expect(page.getByRole('button', { name: jobId ?? '' })).toBeVisible();
    await page.getByRole('button', { name: jobId ?? '' }).click();

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
    await shot(results.locator('.comparison-grid'), `05-comparativa-${theme}.png`);
    await shot(results.locator('.metrics-grid'), `06-metricas-${theme}.png`);
    await shot(results.locator('.image-result').first(), `07-descarga-individual-${theme}.png`);

    const history = page.getByRole('list', { name: 'Historial de lotes' });
    await expect(history.getByRole('button', { name: 'Descargar ZIP' })).toBeVisible();
    await shot(history, `08-zip-${theme}.png`);

    page.once('dialog', (dialog) => void dialog.accept());
    await history.getByRole('button', { name: 'Borrar' }).click();
    await expect(page.getByText('Aún no hay lotes.')).toBeVisible({ timeout: 30_000 });
    await shot(page.locator('.workspace'), `09-borrado-${theme}.png`);
  } finally {
    await context.close();
  }
}

test('capturas reales del flujo completo en tema Claro', async ({ browser }) => {
  await runFlow(browser, 'claro');
});

test('capturas reales del flujo completo en tema Oscuro', async ({ browser }) => {
  await runFlow(browser, 'oscuro');
});
