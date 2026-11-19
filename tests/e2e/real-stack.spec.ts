import { readFileSync } from 'node:fs';
import { request as httpsRequest } from 'node:https';

import { expect, test } from '@playwright/test';
import sharp from 'sharp';

import { readZip } from '../unit/api/zip-reader';
import { createJpegWithMetadata } from '../unit/worker/fixtures';

/**
 * F05-T01 / CA-01 — flujo E2E real, sin dobles de API.
 *
 * Requisitos previos (fuera del test): emulador + terraform apply + backend real.
 * La SPA se sirve en 5173 y Vite proxifica /auth y /jobs al backend; las
 * subidas/descargas van directamente a S3 con las URL presignadas reales.
 */

const PRIVATE_MARKERS = [
  'PRIVATE-EXIF-MARKER',
  'GPS-TEST-LAT-40.4168-LON-3.7038',
  'XMP-TEST-MARKER',
  'IPTC-TEST-MARKER',
];

function assertNoPrivateMetadata(bytes: Buffer, label: string): void {
  const asLatin1 = bytes.toString('latin1');
  for (const marker of PRIVATE_MARKERS) {
    expect(asLatin1, `${label} no debe contener ${marker}`).not.toContain(marker);
  }
}

test('flujo real: registro → subida S3 → WebP/AVIF/miniatura sin EXIF → comparativa → ZIP → borrado', async ({
  page,
  context,
}) => {
  // Control positivo: la muestrasubida SÍ contiene EXIF/GPS/XMP/IPTC.
  const source = Buffer.from(await createJpegWithMetadata(120, 90));
  const sourceMeta = await sharp(source).metadata();
  expect(sourceMeta.exif, 'la fixture debe tener EXIF').toBeDefined();
  const sourceLatin1 = source.toString('latin1');
  for (const marker of PRIVATE_MARKERS) {
    expect(sourceLatin1, `la fixture debe contener ${marker}`).toContain(marker);
  }

  const email = `f05-e2e-${Date.now()}@example.test`;

  // El emulador no implementa OPTIONS y el navegador exige preflight para S3.
  // Este relay transporta la petición REAL (misma URL firmada, mismo cuerpo) via
  // https desde el proceso del test y devuelve la respuesta REAL del emulador,
  // añadiendo solo las cabeceras CORS que el emulador no emite. No hay dobles:
  // los bytes viajan al bucket y se verifican desde la UI y desde el ZIP.
  await context.route('https://127.0.0.1:9297/**', async (route) => {
    const origin = 'http://localhost:5173';
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
    }>((resolve, reject) => {
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
            resolve({
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
    if (process.env.F05_E2E_RELAY_DEBUG === '1' && route.request().method() === 'GET') {
      // Diagnóstico temporal (activable solo en tests): nunca imprime la URL
      // firmada ni credenciales, solo metadatos de la respuesta real.
      const contentType = response.headers['content-type'] ?? '(sin content-type)';
      console.log(
        'F05_RELAY_GET',
        JSON.stringify({
          status: response.status,
          contentType,
          upstreamContentLength: response.headers['content-length'] ?? null,
          bodyLength: response.body.length,
          magic: response.body.subarray(0, 12).toString('latin1'),
          headerNames: Object.keys(response.headers).sort(),
        }),
      );
    }
    // Se reenvían las cabeceras REALes del emulador salvo las de transporte,
    // que Playwright debe recalcular contra el buffer exacto. Sin esto, un
    // content-length/transfer-encoding heredado puede hacer que Edge descarte
    // los bytes de la vista optimizada. El tipo de contenido real se conserva.
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

  await page.goto('/');
  const submitAuth = page.locator('form.auth-form button[type="submit"]');
  if (!(await submitAuth.textContent())?.includes('Crear cuenta')) {
    await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
  }
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña').fill('password123');
  await submitAuth.click();
  await expect(page.getByText('Sesión iniciada como')).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();

  await page.locator('#file-picker').setInputFiles([
    { name: 'privada-con-gps.jpg', mimeType: 'image/jpeg', buffer: source },
  ]);
  await expect(page.getByText('1 imágenes listas')).toBeVisible();

  await page.getByRole('button', { name: /Optimizar 1 imágenes/ }).click();
  await expect(page.getByText(/Lote .+ confirmado/)).toBeVisible({ timeout: 30_000 });
  const message = await page.getByText(/Lote .+ confirmado/).textContent();
  const jobId = message?.match(/Lote ([^\s]+) confirmado/)?.[1];
  expect(jobId, 'la API real devolvió un jobId').toBeTruthy();

  // El consumidor SQS real procesa el mensaje publicado por /confirm.
  const results = page.getByRole('region', { name: 'Resultados del lote' });
  await expect(results.getByText('Completado', { exact: true })).toBeVisible({
    timeout: 120_000,
  });
  await expect(results.getByText('✓ EXIF eliminado')).toBeVisible();
  await expect(results.getByText(/Ahorro real/)).toBeVisible();
  await expect(results.getByRole('progressbar')).toHaveAttribute('value', '1');

  // Comparativa: las DOS URL firmadas reales cargan píxeles en el navegador.
  const comparison = results.getByLabel(/Comparativa visual de/);
  await comparison.scrollIntoViewIfNeeded();
  const original = comparison.locator('img[alt^="Imagen original"]');
  const optimized = comparison.locator('img[alt^="Imagen optimizada"]');
  await expect(original).toHaveCount(1);
  await expect(optimized).toHaveCount(1);
  await expect(comparison.getByText('La vista optimizada no está disponible.')).toHaveCount(0);
  for (const [label, image] of [['original', original], ['optimizada', optimized]] as const) {
    await expect(image).toBeVisible();
    await expect
      .poll(() =>
        image.evaluate((node) => {
          const raster = node as unknown as { complete: boolean; naturalWidth: number };
          return raster.complete && raster.naturalWidth > 0;
        }), `la vista ${label} debe decodificar píxeles reales`,
      )
      .toBe(true);
    const src = await image.getAttribute('src');
    expect(src, `la vista ${label} debe usar una URL firmada HTTPS`).toMatch(/^https:\/\//);
    // El navegador recibió la respuesta real del emulador a través del relay:
    // se vuelve a descargar esa misma URL y se comprueban los bytes/magic.
    const preview = await page.request.get(src ?? '');
    expect(preview.ok(), `HTTP de la vista ${label}`).toBe(true);
    const previewBytes = await preview.body();
    if (label === 'original') {
      expect(previewBytes.subarray(0, 3).toString('hex'), 'JPEG original').toBe('ffd8ff');
    } else {
      expect(previewBytes.subarray(0, 4).toString('ascii'), 'WebP optimizado').toBe('RIFF');
      expect(previewBytes.subarray(8, 12).toString('ascii'), 'WebP optimizado').toBe('WEBP');
      assertNoPrivateMetadata(previewBytes, 'vista optimizada');
    }
  }

  // Descarga individual WEBP: URL presignada real, bytes WebP reales y sin EXIF.
  await expect(results.getByRole('button', { name: 'Descargar WEBP' })).toBeVisible();
  const webpPopupPromise = page.waitForEvent('popup');
  await results.getByRole('button', { name: 'Descargar WEBP' }).click();
  const webpPopup = await webpPopupPromise;
  await webpPopup.waitForURL(/^https:\/\//, { timeout: 30_000 });
  await webpPopup.waitForLoadState('domcontentloaded');
  const webpResponse = await page.request.get(webpPopup.url());
  expect(webpResponse.ok()).toBe(true);
  const webpBytes = await webpResponse.body();
  expect(webpBytes.subarray(0, 4).toString('ascii')).toBe('RIFF');
  expect(webpBytes.subarray(8, 12).toString('ascii')).toBe('WEBP');
  assertNoPrivateMetadata(webpBytes, 'WEBP');
  await webpPopup.close();

  // ZIP real del lote: contiene WebP + AVIF + miniatura, todos sin metadatos.
  const history = page.getByRole('list', { name: 'Historial de lotes' });
  await expect(history.getByRole('button', { name: 'Descargar ZIP' })).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await history.getByRole('button', { name: 'Descargar ZIP' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(`${jobId}.zip`);
  const zipBytes = await download.createReadStream().then(async (stream) => {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
  });
  const entries = readZip(zipBytes);
  expect(entries, 'el ZIP debe contener exactamente tres variantes reales').toHaveLength(3);
  expect(entries.map((entry) => entry.name).sort()).toEqual([
    expect.stringContaining('.avif'),
    expect.stringContaining('.webp'),
    expect.stringContaining('_thumb.webp'),
  ]);
  for (const entry of entries) {
    assertNoPrivateMetadata(entry.bytes, entry.name);
  }
  const avif = entries.find((entry) => entry.name.endsWith('.avif'));
  expect(avif?.bytes.subarray(4, 8).toString('ascii')).toBe('ftyp');
  const thumbnail = entries.find((entry) => entry.name.includes('_thumb.webp'));
  expect(thumbnail?.bytes.subarray(8, 12).toString('ascii')).toBe('WEBP');
  const thumbnailMeta = await sharp(thumbnail?.bytes ?? Buffer.alloc(0)).metadata();
  expect(thumbnailMeta.width).toBeGreaterThan(0);
  expect(thumbnailMeta.width).toBeLessThanOrEqual(256);
  expect(thumbnailMeta.height).toBeLessThanOrEqual(256);

  // Borrado real: confirmar y comprobar que desaparece del historial y del API.
  const deleteButton = history.getByRole('button', { name: 'Borrar' });
  await expect(deleteButton).toBeVisible();
  page.once('dialog', (dialog) => void dialog.accept());
  await deleteButton.click();
  await expect(page.getByRole('button', { name: jobId ?? '' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Actualizar historial' }).click();
  await expect(page.getByRole('button', { name: jobId ?? '' })).toHaveCount(0);
  await expect(page.getByText('Aún no hay lotes.')).toBeVisible();
});
