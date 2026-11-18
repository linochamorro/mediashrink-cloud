import { describe, expect, it, vi } from 'vitest';
import { Buffer } from 'node:buffer';

import type {
  HeaderValidationInput,
  HeaderValidation,
} from '../../../backend/src/domain/index';
import { validateImageHeader } from '../../../backend/src/domain/index';
import {
  processImage,
  type RenderInput,
  type RenderedOutputs,
} from '../../../backend/src/worker/index';
import { createJpeg, oversizedBuffer, testConfig } from './fixtures';

const MEGABYTE = 1024 * 1024;

function spies() {
  const scanHeader = vi.fn((input: HeaderValidationInput): HeaderValidation =>
    validateImageHeader(input),
  );
  const render = vi.fn(async (_input: RenderInput): Promise<RenderedOutputs> => ({
    webp: Buffer.from('w'),
    avif: Buffer.from('a'),
    thumbnail: Buffer.from('t'),
  }));
  return { scanHeader, render, hooks: { scanHeader, render } };
}

/** SVG y GIF son formatos peligrosos rechazados por la regla pura de cabecera. */
function svgBytes(): Uint8Array {
  return new Uint8Array(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>', 'utf8'));
}
function animatedGifBytes(): Uint8Array {
  return new Uint8Array(Buffer.from('GIF89aNETSCAPE2.0\x03\x01\x00\x00\x00', 'latin1'));
}

describe('worker — orden de guardas y anti-bomba (A-05 / IN-10)', () => {
  it('rechaza por tamaño ANTES de escanear la cabecera o decodificar (A-05)', async () => {
    const { scanHeader, render, hooks } = spies();
    const bytes = oversizedBuffer(MEGABYTE + 1); // 1 MB + 1 con MAX_FILE_SIZE_MB=1

    const result = await processImage(bytes, {
      config: testConfig({ MAX_FILE_SIZE_MB: '1' }),
      hooks,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('el buffer sobredimensionado fue aceptado');
    expect(result.reasonCode).toBe('FILE_TOO_LARGE');
    expect(result.exifStripped).toBe(false);
    expect(scanHeader).not.toHaveBeenCalled();
    expect(render).not.toHaveBeenCalled();
  });

  it('usa MAX_FILE_SIZE_MB de loadConfig(), no un literal embebido', async () => {
    const { scanHeader, hooks } = spies();
    const bytes = oversizedBuffer(MEGABYTE + 1);

    const result = await processImage(bytes, {
      config: testConfig({ MAX_FILE_SIZE_MB: '2' }),
      hooks,
    });

    // Con el límite más alto pasa la guarda de tamaño y se intenta escanear;
    // el relleno simula un JPEG sin marcador SOF: la cabecera lo rechaza.
    expect(scanHeader).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('relleno inválido aceptado');
    expect(result.reasonCode).toBe('DIMENSIONS_UNAVAILABLE');
  });

  it('rechaza bombas de píxeles ANTES de invocar a sharp', async () => {
    const { render, hooks } = spies();
    const bytes = await createJpeg(100, 100);

    const result = await processImage(bytes, {
      config: testConfig({ MAX_PIXELS: '100' }),
      hooks,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('la bomba de píxeles fue aceptada');
    expect(result.reasonCode).toBe('TOO_MANY_PIXELS');
    expect(render).not.toHaveBeenCalled();
  });

  it('con MAX_PIXELS suficiente la imagen válida llega al renderizador', async () => {
    const { render, hooks } = spies();
    const bytes = await createJpeg(100, 100);

    const result = await processImage(bytes, {
      config: testConfig({ MAX_PIXELS: '20000' }),
      hooks,
    });

    expect(result.ok).toBe(true);
    expect(render).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['SVG', svgBytes(), 'SVG_NOT_ALLOWED'],
    ['GIF animado', animatedGifBytes(), 'GIF_ANIMATED_NOT_ALLOWED'],
  ])('rechaza %s antes de decodificar', async (_label, bytes, reason) => {
    const { render, hooks } = spies();
    const result = await processImage(bytes, { config: testConfig(), hooks });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('formato peligroso aceptado');
    expect(result.reasonCode).toBe(reason);
    expect(render).not.toHaveBeenCalled();
  });

  it('rechaza inconsistencia MIME/extensión sin llegar a sharp', async () => {
    const { render, hooks } = spies();
    const bytes = await createJpeg(100, 100);
    const result = await processImage(bytes, {
      config: testConfig(),
      filename: 'foto.png',
      mimeType: 'image/png',
      hooks,
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('inconsistencia aceptada');
    expect(result.reasonCode).toBe('MIME_MISMATCH');
    expect(render).not.toHaveBeenCalled();
  });
});
