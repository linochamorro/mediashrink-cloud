import { describe, expect, it, vi } from 'vitest';
import { Buffer } from 'node:buffer';

import { schemas } from '../../../backend/src/contracts/index';
import { validateImageHeader } from '../../../backend/src/domain/index';
import {
  processImage,
  THUMBNAIL_MAX_EDGE,
  type RenderInput,
  type RenderedOutputs,
} from '../../../backend/src/worker/index';
import { createJpeg, testConfig } from './fixtures';

const parseOutput = (bytes: Uint8Array) => validateImageHeader({ bytes });

describe('worker — formatos y métricas (CA-03 / IN-01 / FR-12)', () => {
  it('produce WebP, AVIF y miniatura WebP con bytes reales y dimensiones válidas', async () => {
    const bytes = await createJpeg(100, 100);
    const result = await processImage(bytes, {
      config: testConfig(),
      imageId: 'img-formats',
      filename: 'foto.jpg',
      mimeType: 'image/jpeg',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.failureReason);
    expect(result.status).toBe('COMPLETED');
    expect(result.imageId).toBe('img-formats');

    const { webp, avif, thumbnail } = result.outputs;
    expect(webp.byteLength).toBeGreaterThan(0);
    expect(avif.byteLength).toBeGreaterThan(0);
    expect(thumbnail.byteLength).toBeGreaterThan(0);

    const webpHeader = parseOutput(webp);
    const avifHeader = parseOutput(avif);
    const thumbHeader = parseOutput(thumbnail);
    for (const header of [webpHeader, avifHeader, thumbHeader]) {
      if (!header.ok) throw new Error(`salida rechazada por la regla de cabecera: ${header.reason}`);
    }
    if (!webpHeader.ok || !avifHeader.ok || !thumbHeader.ok) throw new Error('cabeceras inválidas');
    expect(webpHeader.format).toBe('webp');
    expect(webpHeader.dimensions).toEqual({ width: 100, height: 100 });
    expect(avifHeader.format).toBe('avif');
    expect(avifHeader.dimensions).toEqual({ width: 100, height: 100 });
    expect(thumbHeader.format).toBe('webp');
    expect(thumbHeader.dimensions.width).toBeLessThanOrEqual(THUMBNAIL_MAX_EDGE);
    expect(thumbHeader.dimensions.height).toBeLessThanOrEqual(THUMBNAIL_MAX_EDGE);
  });

  it('calcula métricas con bytes reales y las coherencia con el contrato congelado', async () => {
    const bytes = await createJpeg(100, 100);
    const result = await processImage(bytes, { config: testConfig(), imageId: 'img-metrics' });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.failureReason);

    const totalAfter =
      result.outputs.webp.byteLength +
      result.outputs.avif.byteLength +
      result.outputs.thumbnail.byteLength;
    expect(result.metrics.bytesBefore).toBe(bytes.byteLength);
    expect(result.metrics.bytesAfter).toBe(totalAfter);
    expect(result.metrics.savingsPct).toBe(
      bytes.byteLength === 0 ? 0 : ((bytes.byteLength - totalAfter) / bytes.byteLength) * 100,
    );
    expect(result.metrics.exifStripped).toBe(true);
    expect(schemas.JobMetrics.safeParse(result.metrics).success).toBe(true);
  });

  it('reporta ahorro negativo sin recortarlo cuando las salidas pesan más que la entrada', async () => {
    const bytes = await createJpeg(100, 100);
    const big = Buffer.alloc(512, 0x41);
    const render = vi.fn(async (_input: RenderInput): Promise<RenderedOutputs> => ({
      webp: big,
      avif: big,
      thumbnail: big,
    }));

    const result = await processImage(bytes, { config: testConfig(), hooks: { render } });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.failureReason);
    expect(render).toHaveBeenCalledTimes(1);
    expect(result.metrics.bytesAfter).toBe(big.byteLength * 3);
    expect(result.metrics.savingsPct).toBeLessThan(0);
    expect(result.metrics.savingsPct).toBe(
      ((bytes.byteLength - big.byteLength * 3) / bytes.byteLength) * 100,
    );
    expect(schemas.JobMetrics.safeParse(result.metrics).success).toBe(true);
  });

  it('genera un imageId cuando no se aporta y respeta el preset solicitado', async () => {
    const bytes = await createJpeg(100, 100);
    const render = vi.fn(async (_input: RenderInput): Promise<RenderedOutputs> => ({
      webp: Buffer.from('w'),
      avif: Buffer.from('a'),
      thumbnail: Buffer.from('t'),
    }));

    const result = await processImage(bytes, {
      config: testConfig(),
      preset: 'MAX_COMPRESSION',
      hooks: { render },
    });
    expect(result.ok).toBe(true);
    expect(result.imageId).toMatch(/^[0-9a-f-]{36}$/);
    expect(render.mock.calls[0][0].preset).toBe('MAX_COMPRESSION');
    expect(render.mock.calls[0][0].format).toBe('jpeg');
  });
});
