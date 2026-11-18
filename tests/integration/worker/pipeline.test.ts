import { describe, expect, it } from 'vitest';

import { schemas } from '../../../backend/src/contracts/index';
import {
  resolveBatchStatus,
  validateImageHeader,
  type RasterFormat,
} from '../../../backend/src/domain/index';
import {
  processImage,
  type ProcessImageResult,
} from '../../../backend/src/worker/index';
import { createJpegWithMetadata, testConfig } from '../../unit/worker/fixtures';

const presets = ['HIGH', 'BALANCED', 'MAX_COMPRESSION'] as const;

describe('worker integración — pipeline real sobre buffers (CA-03 / CA-06)', () => {
  it.each(presets)('el preset %s produce tres salidas válidas y métricas coherentes', async (preset) => {
    const bytes = await createJpegWithMetadata(100, 100);
    const result: ProcessImageResult = await processImage(bytes, {
      config: testConfig(),
      preset,
      mimeType: 'image/jpeg',
      filename: 'foto.jpg',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.failureReason);

    const expected: ReadonlyArray<[keyof typeof result.outputs, RasterFormat]> = [
      ['webp', 'webp'],
      ['avif', 'avif'],
      ['thumbnail', 'webp'],
    ];
    for (const [key, format] of expected) {
      const output = result.outputs[key];
      expect(output.byteLength).toBeGreaterThan(0);
      const header = validateImageHeader({ bytes: output });
      expect(header.ok, `${key} rechazado por la regla de cabecera`).toBe(true);
      if (header.ok) expect(header.format).toBe(format);
    }

    expect(schemas.JobMetrics.safeParse(result.metrics).success).toBe(true);
    const record = {
      imageId: result.imageId,
      status: result.status,
      bytesBefore: result.metrics.bytesBefore,
      bytesAfter: result.metrics.bytesAfter,
      exifStripped: result.metrics.exifStripped,
    };
    expect(schemas.ImageRecord.safeParse(record).success).toBe(true);
  });

  it('compone estados con las reglas puras sin reimplementarlas', async () => {
    const valid = await createJpegWithMetadata(100, 100);
    const ok = await processImage(valid, { config: testConfig() });
    const rejected = await processImage(valid, {
      config: testConfig({ MAX_PIXELS: '100' }),
    });

    expect(ok.ok).toBe(true);
    expect(rejected.ok).toBe(false);
    const summary = {
      completed: ok.ok ? 1 : 0,
      failed: rejected.ok ? 0 : 1,
    };
    expect(summary).toEqual({ completed: 1, failed: 1 });
    expect(resolveBatchStatus(summary)).toBe('PARTIAL');
  });
});
