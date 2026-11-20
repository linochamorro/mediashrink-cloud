import { expect, test, type BrowserContext, type Download, type Page } from '@playwright/test';
import sharp from 'sharp';

import { readZip } from '../unit/api/zip-reader';

const BATCH_NAME = 'Vacaciones E2E Real';
const BASE_URL = 'http://localhost:5173';
const ANA_EMAIL = 'ana.demo@example.com';
const ANA_PASSWORD = 'DemoAna2026!';
const BRUNO_EMAIL = 'bruno.demo@example.com';
const BRUNO_PASSWORD = 'DemoBruno2026!';

interface CapturedResponse {
  contextLabel: string;
  method: string;
  status: number;
  path: string;
}

interface InitialZipState {
  disabled: boolean;
  status: string;
}

interface BrowserElement {
  textContent: string | null;
  dataset: Record<string, string | undefined>;
  disabled: boolean;
  querySelector: (selector: string) => BrowserElement | null;
  querySelectorAll: (selector: string) => BrowserElement[];
  removeAttribute: (name: string) => void;
}

interface BrowserDocument {
  body: BrowserElement;
  documentElement: BrowserElement;
  querySelectorAll: (selector: string) => BrowserElement[];
}

interface BrowserMutationObserver {
  disconnect: () => void;
  observe: (target: BrowserElement, options: { childList: boolean; subtree: boolean }) => void;
}

/** JPEG real y grande a partir de ruido determinista, sin fixtures binarias. */
async function createLargeJpeg(index: number): Promise<Buffer> {
  const width = 900;
  const height = 900;
  const channels = 3;
  const pixels = Buffer.alloc(width * height * channels);
  let seed = 123456789 + index * 7919;

  for (let pixelIndex = 0; pixelIndex < pixels.length; pixelIndex += 1) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    pixels[pixelIndex] = seed & 0xff;
  }

  return sharp(pixels, { raw: { width, height, channels } })
    .jpeg({ quality: 100 })
    .toBuffer();
}

function sanitizeDiagnostic(value: string): string {
  return value.replace(/(https?:\/\/[^\s?]+)\?[^\s]+/g, '$1?[redacted]');
}

function responsePath(rawUrl: string): string {
  try {
    return new URL(rawUrl).pathname;
  } catch {
    return rawUrl.split('?')[0] ?? rawUrl;
  }
}

function diagnosticUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    return `${url.origin}${url.pathname}`;
  } catch {
    return responsePath(rawUrl);
  }
}

function monitorPage(page: Page, contextLabel: string, consoleErrors: string[]): void {
  page.on('pageerror', (error) => {
    consoleErrors.push(`${contextLabel} pageerror: ${sanitizeDiagnostic(error.message)}`);
  });
}

function monitorContext(
  context: BrowserContext,
  contextLabel: string,
  consoleErrors: string[],
  responses: CapturedResponse[],
): void {
  context.on('console', (message) => {
    if (message.type() === 'error') {
      const location = message.location();
      const source = location.url === '' ? '' : ` @ ${diagnosticUrl(location.url)}`;
      consoleErrors.push(`${contextLabel} console: ${sanitizeDiagnostic(message.text())}${source}`);
    }
  });
  context.on('page', (newPage) => monitorPage(newPage, contextLabel, consoleErrors));
  context.on('response', (response) => {
    responses.push({
      contextLabel,
      method: response.request().method(),
      status: response.status(),
      path: responsePath(response.url()),
    });
  });
}

async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: /Iniciar sesión/ }).click();
  await expect(page.getByText('Sesión iniciada como', { exact: false })).toBeVisible();
}

/**
 * Captura el primer render DOM de la fila nueva. Esto evita una carrera con
 * el worker: si el lote termina antes de que Playwright vuelva a consultar el
 * DOM, se conserva igualmente el estado `disabled` del primer render.
 */
async function captureInitialZipState(page: Page, batchName: string): Promise<void> {
  await page.evaluate((expectedName) => {
    const browserGlobal = globalThis as unknown as {
      document: BrowserDocument;
      MutationObserver: new (callback: () => void) => BrowserMutationObserver;
    };
    const root = browserGlobal.document.documentElement;
    root.removeAttribute('data-f05-initial-zip-state');

    const capture = (): boolean => {
      const rows = Array.from(browserGlobal.document.querySelectorAll('.jobs-list > li'));
      const row = rows.find((candidate) => {
        const title = candidate.querySelector('.job-open');
        return title?.textContent?.trim() === expectedName;
      });
      if (!row) return false;

      const zipButton = Array.from(row.querySelectorAll('button'))
        .find((button) => button.textContent?.trim() === 'Descargar ZIP');
      if (!zipButton) return false;

      const state: InitialZipState = {
        disabled: zipButton.disabled,
        status: row.querySelector('strong')?.textContent?.trim() ?? '',
      };
      root.dataset.f05InitialZipState = JSON.stringify(state);
      observer.disconnect();
      return true;
    };

    const observer = new browserGlobal.MutationObserver(() => {
      capture();
    });
    observer.observe(browserGlobal.document.body, { childList: true, subtree: true });
    capture();
  }, batchName);
}

async function downloadBytes(download: Download): Promise<Buffer> {
  const stream = await download.createReadStream();
  if (stream === null) throw new Error('El evento de descarga no expuso un stream de bytes.');
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

test('F05 real: lote nombrado → processing → completed → comparativa → descargas → aislamiento → borrado', async ({
  browser,
  context,
  page,
}) => {
  const consoleErrors: string[] = [];
  const responses: CapturedResponse[] = [];
  monitorContext(context, 'ana', consoleErrors, responses);
  monitorPage(page, 'ana', consoleErrors);

  const files: Array<{ name: string; mimeType: string; buffer: Buffer }> = [];
  for (let index = 0; index < 3; index += 1) {
    const buffer = await createLargeJpeg(index);
    expect(buffer.byteLength, `la imagen ${index + 1} debe superar 300 KiB reales`).toBeGreaterThan(300_000);
    files.push({ name: `vacaciones-real-${index + 1}.jpg`, mimeType: 'image/jpeg', buffer });
  }

  await login(page, ANA_EMAIL, ANA_PASSWORD);

  const batchInput = page.getByLabel('Nombre del lote (opcional)', { exact: true });
  await expect(batchInput).toHaveAttribute('placeholder', 'Ej. Fotos vacaciones noviembre');
  await expect(batchInput).toHaveAttribute('maxlength', '80');
  await batchInput.fill(BATCH_NAME);

  await page.locator('#file-picker').setInputFiles(files);
  await expect(page.getByText('3 imágenes listas', { exact: true })).toBeVisible();

  await captureInitialZipState(page, BATCH_NAME);
  await page.getByRole('button', { name: /Optimizar 3 imágenes/ }).click();

  const confirmation = page.getByText(/Lote \S+ confirmado/);
  await expect(confirmation).toBeVisible({ timeout: 60_000 });
  const confirmationText = await confirmation.textContent();
  const jobId = confirmationText?.match(/Lote ([^\s]+) confirmado/)?.[1];
  expect(jobId, 'la confirmación debe exponer el jobId real').toBeTruthy();

  await expect.poll(
    async () => page.locator('html').getAttribute('data-f05-initial-zip-state'),
    { timeout: 30_000, message: 'la fila nueva debe capturarse en su primer render DOM' },
  ).not.toBeNull();
  const initialStateJson = await page.locator('html').getAttribute('data-f05-initial-zip-state');
  expect(initialStateJson).not.toBeNull();
  const initialState = JSON.parse(initialStateJson ?? '{}') as InitialZipState;
  expect(initialState.disabled, 'UX-03: ZIP debe estar deshabilitado en el primer render del lote').toBe(true);
  expect(initialState.status).toMatch(/En espera|Procesando/);

  const history = page.getByRole('list', { name: 'Historial de lotes' });
  await expect(history).toBeVisible();
  const jobRow = history.locator('li').filter({ hasText: BATCH_NAME });
  await expect(jobRow).toHaveCount(1);
  await expect(jobRow.getByRole('button', { name: BATCH_NAME, exact: true })).toHaveCount(1);

  await expect(history.locator('li').first().getByRole('button', { name: BATCH_NAME, exact: true }))
    .toHaveCount(1);
  await expect(jobRow.locator('time')).toHaveText(/\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}/);

  const results = page.getByRole('region', { name: 'Resultados del lote' });
  await expect(results).toBeVisible();
  await expect(results.getByRole('heading', { name: BATCH_NAME, exact: true })).toBeVisible();
  await expect(results.locator('.job-id-secondary')).toHaveText(jobId ?? '');

  await expect(results.locator('.status-chip')).toHaveText('Completado', { timeout: 180_000 });
  const pollingResponses = responses.filter((response) =>
    response.contextLabel === 'ana'
    && response.method === 'GET'
    && response.path === `/jobs/${jobId}`,
  );
  expect(pollingResponses.length, 'el lote debe avanzar mediante polling real').toBeGreaterThan(0);
  expect(pollingResponses.every((response) => response.status === 200)).toBe(true);
  expect(responses.filter((response) => response.status === 429)).toEqual([]);

  const cards = results.locator('.image-result');
  await expect(cards).toHaveCount(3);
  for (let cardIndex = 0; cardIndex < 3; cardIndex += 1) {
    const card = cards.nth(cardIndex);
    await card.scrollIntoViewIfNeeded();
    const images = card.locator('.visual-comparison img');
    await expect(images).toHaveCount(2);

    for (let imageIndex = 0; imageIndex < 2; imageIndex += 1) {
      const image = images.nth(imageIndex);
      await expect(image).toBeVisible();
      await expect.poll(() => image.evaluate((node) => {
        const raster = node as unknown as { complete: boolean; naturalWidth: number };
        return raster.complete && raster.naturalWidth > 0;
      })).toBe(true);

      const src = await image.getAttribute('src');
      expect(src, 'la vista debe usar el relay local del producto').toMatch(/^\/__s3_local\//);
      expect(src, 'la vista debe ser una ruta del mismo origen').not.toMatch(/^https?:\/\//);

      const preview = await page.request.get(src ?? '');
      expect(preview.ok(), `la vista ${imageIndex + 1} debe descargarse con bytes reales`).toBe(true);
      const bytes = await preview.body();
      if (imageIndex === 0) {
        expect(bytes.subarray(0, 3).toString('hex'), 'JPEG original').toBe('ffd8ff');
      } else {
        expect(bytes.subarray(0, 4).toString('ascii'), 'WebP optimizado').toBe('RIFF');
        expect(bytes.subarray(8, 12).toString('ascii'), 'WebP optimizado').toBe('WEBP');
      }
    }
  }

  const firstCard = cards.first();
  for (const variant of ['WEBP', 'AVIF'] as const) {
    const popupPromise = page.waitForEvent('popup');
    await firstCard.getByRole('button', { name: `Descargar ${variant}`, exact: true }).click();
    const popup = await popupPromise;
    await popup.waitForURL((url) => url.pathname.startsWith('/__s3_local/'), { timeout: 30_000 });
    await popup.waitForLoadState('domcontentloaded');

    const popupUrl = new URL(popup.url());
    expect(popupUrl.origin, 'la descarga debe seguir siendo del mismo origen').toBe(BASE_URL);
    expect(popupUrl.pathname).toMatch(/^\/__s3_local\//);
    const downloaded = await page.request.get(popup.url());
    expect(downloaded.ok(), `${variant} debe devolver bytes reales`).toBe(true);
    const bytes = await downloaded.body();
    if (variant === 'WEBP') {
      expect(bytes.subarray(0, 4).toString('ascii')).toBe('RIFF');
      expect(bytes.subarray(8, 12).toString('ascii')).toBe('WEBP');
    } else {
      expect(bytes.subarray(4, 8).toString('ascii'), 'AVIF ftyp').toBe('ftyp');
    }
    await popup.close();
  }

  const zipButton = jobRow.getByRole('button', { name: 'Descargar ZIP', exact: true });
  await expect(zipButton).toBeEnabled({ timeout: 30_000 });
  const downloadPromise = page.waitForEvent('download');
  await zipButton.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(`${jobId}.zip`);
  const zipBytes = await downloadBytes(download);
  const entries = readZip(zipBytes);
  expect(entries, '3 imágenes × WebP/AVIF/miniatura').toHaveLength(9);
  expect(entries.every((entry) => entry.bytes.length > 0)).toBe(true);
  const entryNames = entries.map((entry) => entry.name);
  expect(entryNames.some((name) => name.endsWith('.webp'))).toBe(true);
  expect(entryNames.some((name) => name.endsWith('.avif'))).toBe(true);
  expect(entryNames.some((name) => name.endsWith('_thumb.webp'))).toBe(true);

  const brunoContext = await browser.newContext({
    baseURL: BASE_URL,
    ignoreHTTPSErrors: true,
    acceptDownloads: true,
  });
  monitorContext(brunoContext, 'bruno', consoleErrors, responses);
  const brunoPage = await brunoContext.newPage();
  monitorPage(brunoPage, 'bruno', consoleErrors);

  await login(brunoPage, BRUNO_EMAIL, BRUNO_PASSWORD);
  const brunoListResponsePromise = brunoPage.waitForResponse((response) =>
    response.request().method() === 'GET' && responsePath(response.url()) === '/jobs',
  );
  await brunoPage.getByRole('button', { name: 'Actualizar historial' }).click();
  const brunoListResponse = await brunoListResponsePromise;
  expect(brunoListResponse.status()).toBe(200);
  await expect(brunoPage.getByText(BATCH_NAME, { exact: false })).toHaveCount(0);
  await expect(brunoPage.getByText(jobId ?? '', { exact: false })).toHaveCount(0);

  page.once('dialog', (dialog) => void dialog.accept());
  await jobRow.getByRole('button', { name: 'Borrar', exact: true }).click();
  await expect(jobRow).toHaveCount(0);

  const anaRefreshResponsePromise = page.waitForResponse((response) =>
    response.request().method() === 'GET' && responsePath(response.url()) === '/jobs',
  );
  await page.getByRole('button', { name: 'Actualizar historial' }).click();
  const anaRefreshResponse = await anaRefreshResponsePromise;
  expect(anaRefreshResponse.status()).toBe(200);
  await expect(jobRow).toHaveCount(0);
  await expect(history.locator('li').filter({ hasText: BATCH_NAME })).toHaveCount(0);
  await expect(history.getByText(jobId ?? '', { exact: false })).toHaveCount(0);

  await brunoContext.close();

  const rateLimitedResponses = responses.filter((response) => response.status === 429);
  expect(rateLimitedResponses, 'ninguna respuesta real puede devolver 429').toEqual([]);
  const unexpectedResponses = responses.filter((response) => response.status >= 400);
  expect(unexpectedResponses, 'no debe haber respuestas HTTP 4xx/5xx inesperadas').toEqual([]);
  expect(consoleErrors, 'no debe haber errores de consola ni pageerror').toEqual([]);
});
