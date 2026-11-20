import { expect, test } from '@playwright/test';

const now = '2026-11-17T12:00:00.000Z';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/XioAAAAASUVORK5CYII=', 'base64');
const webp = Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEAAUAmJaQAA3AA/v89WAAAAA==', 'base64');
const makeJob = (status: string, savingsPct = -20, exifStripped = true) => ({ jobId: 'job-demo', userId: 'user-demo', status, preset: 'BALANCED', formats: ['webp', 'avif'], bytesBefore: 1000, bytesAfter: savingsPct === 0 ? 1000 : 1200, savingsPct, exifStripped, createdAt: now, updatedAt: now, ttl: 1794916800 });
const session = { user: { userId: 'user-demo', email: 'demo@example.test', createdAt: now }, accessToken: 'access-demo', refreshToken: 'refresh-demo', tokenType: 'Bearer', expiresIn: 900 };

test('tema claro inicial y selector oscuro persistente tras recargar', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.getByRole('heading', { name: /Menos peso/ })).toBeVisible();
  await page.getByRole('button', { name: 'Cambiar a tema oscuro' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByLabel('explora tus archivos')).toBeVisible();
});

test('registro, error seguro, refresh, upload, polling, resultados, descargas y logout', async ({ page, context }) => {
  let created = false;
  let detailCalls = 0;
  let deleted = false;
  let refreshCalls = 0;
  let selectedStatus = 'PROCESSING';
  let negativeResult = false;
  const detail = () => ({ job: makeJob(selectedStatus, negativeResult ? -20 : 0, negativeResult), images: [{ imageId: 'image-demo', status: 'COMPLETED', bytesBefore: 1000, bytesAfter: negativeResult ? 1200 : 1000, exifStripped: negativeResult }] });

  await page.route('**/auth/register', (route) => route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'internal stack should stay hidden' } }) }));
  await page.route('**/auth/login', async (route) => {
    const body = route.request().postDataJSON() as { email: string };
    if (body.email !== 'demo@example.test') return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: { code: 'INVALID_CREDENTIALS', message: 'secret detail' } }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session) });
  });
  await page.route('**/auth/refresh', async (route) => { refreshCalls += 1; await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...session, accessToken: `access-${refreshCalls}` }) }); });
  await page.route('https://upload.test/**', (route) => route.fulfill({ status: 200 }));
  await context.route('https://storage.test/**', (route) => route.fulfill(route.request().url().includes('/original.')
    ? { status: 200, contentType: 'image/png', body: png }
    : { status: 200, contentType: 'image/webp', body: webp }));
  await page.route((url) => url.pathname === '/jobs' || url.pathname.startsWith('/jobs/'), async (route) => {
    const req = route.request(); const url = new URL(req.url());
    if (req.method() === 'POST' && url.pathname === '/jobs') {
      created = true;
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ job: makeJob('PENDING'), uploads: [{ imageId: 'image-demo', uploadUrl: 'https://upload.test/image', method: 'PUT' }] }) });
    }
    if (req.method() === 'POST' && url.pathname.endsWith('/confirm')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ job: makeJob('PENDING') }) });
    if (req.method() === 'GET' && url.pathname === '/jobs') {
      if (req.headers().authorization === 'Bearer access-demo') return route.fulfill({ status: 401, contentType: 'application/json', body: '{}' });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ jobs: deleted ? [] : [makeJob('COMPLETED'), { ...makeJob('PARTIAL'), jobId: 'job-partial' }, { ...makeJob('FAILED'), jobId: 'job-failed' }] }) });
    }
    if (req.method() === 'GET' && /^\/jobs\/(job-demo|job-partial|job-failed)$/.test(url.pathname)) {
      const id = url.pathname.split('/').pop()!;
      detailCalls += 1;
      if (id === 'job-demo' && detailCalls <= 2) return route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
      selectedStatus = id === 'job-partial' ? 'PARTIAL' : id === 'job-failed' ? 'FAILED' : detailCalls === 3 ? 'PROCESSING' : 'COMPLETED';
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(id === 'job-demo' ? detail() : { job: { ...makeJob(selectedStatus), jobId: id }, images: [] }) });
    }
    if (req.method() === 'GET' && url.pathname.endsWith('/download/image-demo')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ downloadUrl: `https://storage.test/${url.searchParams.get('variant')}.webp`, expiresAt: now }) });
    if (req.method() === 'GET' && url.pathname.endsWith('/download.zip')) return route.fulfill({ status: 200, body: 'zip-fixture' });
    if (req.method() === 'DELETE') { deleted = true; return route.fulfill({ status: 204 }); }
    return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/');
  // F05-UX-HEADER-AUTH: abrir el panel de acceso desde el <header>.
  await page.getByRole('button', { name: 'Abrir panel de acceso' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
  await page.getByLabel('Correo electrónico').fill('demo@example.test');
  await page.getByLabel('Contraseña').fill('password123');
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Revisa el correo');
  await expect(page.getByRole('alert')).not.toContainText('internal stack');
  await page.getByRole('button', { name: 'Ya tengo cuenta' }).click();
  await page.getByLabel('Correo electrónico').fill('wrong@example.test');
  await page.getByLabel('Contraseña').fill('password123');
  await page.getByRole('button', { name: /Iniciar sesión/ }).click();
  await expect(page.getByRole('alert')).toContainText('no son correctos');
  await page.getByLabel('Correo electrónico').fill('demo@example.test');
  await page.getByRole('button', { name: /Iniciar sesión/ }).click();
  await expect(page.getByRole('banner').getByText('demo@example.test')).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('mediashrink-session') ?? '{}'))).toEqual({ refreshToken: 'refresh-demo' });

  const picker = page.locator('#file-picker');
  await picker.setInputFiles([{ name: 'foto.png', mimeType: 'image/png', buffer: png }]);
  await expect(page.getByText('1 imágenes listas')).toBeVisible();
  await page.getByRole('radio', { name: /Máxima compresión/ }).click();
  await expect(page.getByRole('radio', { name: /Máxima compresión/ })).toHaveAttribute('aria-checked', 'true');
  await picker.setInputFiles([{ name: 'vector.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') }]);
  await expect(page.getByRole('alert')).toContainText('formato no permitido');
  await picker.setInputFiles([{ name: 'foto.png', mimeType: 'image/png', buffer: png }]);
  await page.getByRole('button', { name: /Optimizar 1 imágenes/ }).click();
  await expect.poll(() => created).toBe(true);
  await expect(page.getByText('Lote job-demo confirmado')).toBeVisible();
  await expect.poll(() => detailCalls).toBeGreaterThan(2);
  await expect(page.getByRole('region', { name: 'Resultados del lote' }).getByText('Procesando', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Resultados del lote' }).getByText('Completado', { exact: true })).toBeVisible({ timeout: 8000 });
  await expect(page.getByText('0.00%', { exact: true })).toBeVisible();
  await expect(page.getByText('EXIF pendiente')).toBeVisible();
  const originalPreview = page.getByAltText('Imagen original image-demo');
  const optimizedPreview = page.getByAltText('Imagen optimizada image-demo en WEBP');
  // Comparison sources load only after the lazy container enters the viewport.
  await page.getByLabel('Comparativa visual de image-demo').scrollIntoViewIfNeeded();
  await expect(originalPreview).toBeVisible();
  await expect(optimizedPreview).toBeVisible();
  await expect.poll(() => originalPreview.evaluate((image) => {
    const raster = image as unknown as { complete: boolean; naturalWidth: number };
    return raster.complete && raster.naturalWidth > 0;
  })).toBe(true);
  await expect.poll(() => optimizedPreview.evaluate((image) => {
    const raster = image as unknown as { complete: boolean; naturalWidth: number };
    return raster.complete && raster.naturalWidth > 0;
  })).toBe(true);
  await expect.poll(() => refreshCalls).toBeGreaterThan(0);
  const originalPopup = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Descargar original' }).click();
  await expect(await originalPopup).toHaveURL('https://storage.test/original.webp');
  await page.getByRole('button', { name: 'job-partial' }).click();
  await expect(page.getByRole('region', { name: 'Resultados del lote' }).getByText('Completado parcialmente')).toBeVisible();
  await page.getByRole('button', { name: 'job-failed' }).click();
  await expect(page.getByRole('region', { name: 'Resultados del lote' }).getByText('Fallido')).toBeVisible();
  await page.getByRole('button', { name: 'job-demo' }).click();
  const individualPopup = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Descargar WEBP' }).click();
  await expect(await individualPopup).toHaveURL('https://storage.test/webp.webp');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('list', { name: 'Historial de lotes' }).getByRole('button', { name: 'Descargar ZIP' }).first().click();
  await expect(await downloadPromise).toBeTruthy();
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('list', { name: 'Historial de lotes' }).getByRole('button', { name: 'Borrar' }).first().click();
  await expect(page.getByRole('button', { name: 'job-demo' })).toBeVisible();
  page.on('dialog', (dialog) => dialog.accept());
  await page.getByRole('list', { name: 'Historial de lotes' }).getByRole('button', { name: 'Borrar' }).first().click();
  await expect(page.getByRole('button', { name: 'job-demo' })).toHaveCount(0);

  // Rehidrata un resultado privado y verifica que logout lo retira del DOM y del almacenamiento.
  deleted = false;
  negativeResult = true;
  detailCalls = 2;
  await page.getByRole('button', { name: 'Actualizar historial' }).click();
  await page.getByRole('button', { name: 'job-demo' }).click();
  await expect(page.getByRole('region', { name: 'Resultados del lote' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Resultados del lote' }).getByText('-20.00%', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('✓ EXIF limpio')).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page.getByRole('region', { name: 'Resultados del lote' })).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem('mediashrink-session'))).toBeNull();
});

test('validación de drag & drop, teclado y errores de archivos', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Borrar' })).toHaveCount(0);
  const transfer = await page.evaluateHandle((contents) => {
    const browser = globalThis as unknown as {
      DataTransfer: new () => { items: { add(item: unknown): void } };
      File: new (parts: unknown[], name: string, options: { type: string }) => unknown;
    };
    const data = new browser.DataTransfer();
    data.items.add(new browser.File([contents], 'arrastrada.png', { type: 'image/png' }));
    return data;
  }, png.toString('base64'));
  await page.locator('.dropzone').dispatchEvent('drop', { dataTransfer: transfer });
  await transfer.dispose();
  await expect(page.getByText('arrastrada.png')).toBeVisible();
  const tooMany = Array.from({ length: 21 }, (_, index) => ({ name: `foto-${index}.png`, mimeType: 'image/png', buffer: png }));
  await page.locator('#file-picker').setInputFiles(tooMany);
  await expect(page.getByRole('alert')).toContainText('máximo es 20 imágenes');
  await page.locator('#file-picker').setInputFiles([{ name: 'vector.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') }]);
  await expect(page.getByRole('alert')).toContainText('formato no permitido');
  await page.locator('#file-picker').evaluate((element) => {
    const browser = globalThis as unknown as {
      DataTransfer: new () => { items: { add(item: unknown): void }; files: unknown };
      File: new (parts: unknown[], name: string, options: { type: string }) => unknown;
      Event: new (type: string, init: { bubbles: boolean }) => unknown;
    };
    const transfer = new browser.DataTransfer();
    transfer.items.add(new browser.File([new Uint8Array(15 * 1024 * 1024 + 1)], 'muy-grande.png', { type: 'image/png' }));
    (element as unknown as { files: unknown }).files = transfer.files;
    (element as unknown as { dispatchEvent(event: unknown): void }).dispatchEvent(new browser.Event('change', { bubbles: true }));
  });
  await expect(page.getByRole('alert')).toContainText('supera el límite de 15 MB');
  await page.locator('#file-picker').setInputFiles([{ name: 'foto.png', mimeType: 'image/png', buffer: png }]);
  // Confirma que el selector de archivo se alcanza por teclado y hace visible el foco.
  for (let index = 0; index < 15; index += 1) {
    await page.keyboard.press('Tab');
    if (await page.locator('#file-picker').evaluate((input) => (input as unknown as { matches(selector: string): boolean }).matches(':focus'))) break;
  }
  await expect(page.locator('#file-picker')).toBeFocused();
  await expect(page.locator('.dropzone')).toHaveCSS('outline-width', '3px');
});
