import { describe, expect, it } from 'vitest';

import { processImage, type ProcessedImageSuccess } from '../../../backend/src/worker/index';
import sharp from 'sharp';
import {
  createJpegWithMetadata,
  hasMetadataMarker,
  testConfig,
} from '../../unit/worker/fixtures';

/** La fixture debe contener EXIF/GPS, XMP e IPTC para que la prueba sea significativa. */
async function assertFixtureHasMetadata(bytes: Uint8Array): Promise<void> {
  const meta = await sharp(bytes).metadata();
  expect(meta.exif?.length ?? 0).toBeGreaterThan(0);
  expect(meta.xmp?.length ?? 0).toBeGreaterThan(0);
  expect(meta.iptc?.length ?? 0).toBeGreaterThan(0);
  expect(hasMetadataMarker(bytes)).toBe(true);
}

async function assertOutputIsClean(name: string, bytes: Uint8Array): Promise<void> {
  const meta = await sharp(bytes).metadata();
  expect(meta.exif, `${name}: EXIF residual`).toBeUndefined();
  expect(meta.xmp, `${name}: XMP residual`).toBeUndefined();
  expect(meta.iptc, `${name}: IPTC residual`).toBeUndefined();
  expect(hasMetadataMarker(bytes), `${name}: marcador de privacidad residual`).toBe(false);
}

describe('worker integración — strip total de metadatos (PR-01 / IN-10 / FR-11)', () => {
  it('la fixture contiene EXIF/GPS, XMP e IPTC y sharp podría conservarlos', async () => {
    const fixture = await createJpegWithMetadata(100, 100);
    await assertFixtureHasMetadata(fixture);

    // Control negativo: con withMetadata({}) sharp 0.33 SÍ filtra EXIF y XMP;
    // por tanto la limpieza de nuestro pipeline no es un artefacto de la fixture.
    const leaking = await sharp(fixture).withMetadata({}).webp().toBuffer();
    expect(hasMetadataMarker(leaking)).toBe(true);
  });

  it('WebP, AVIF y miniatura salen sin EXIF/GPS, XMP ni IPTC', async () => {
    const fixture = await createJpegWithMetadata(100, 100);
    await assertFixtureHasMetadata(fixture);

    const result = await processImage(fixture, {
      config: testConfig(),
      imageId: 'img-private',
      filename: 'privada.jpg',
      mimeType: 'image/jpeg',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.failureReason);
    const success: ProcessedImageSuccess = result;
    expect(success.metrics.exifStripped).toBe(true);

    await assertOutputIsClean('webp', success.outputs.webp);
    await assertOutputIsClean('avif', success.outputs.avif);
    await assertOutputIsClean('thumbnail', success.outputs.thumbnail);
  });

  it('no propaga metadatos aunque la entrada sea PNG con EXIF', async () => {
    const jpeg = await createJpegWithMetadata(100, 100);
    const png = await sharp(jpeg).png().toBuffer();
    const fixtureWithExif = await sharp(png).withExif({
      IFD0: { ImageDescription: 'PRIVATE-EXIF-MARKER' },
    }).png().toBuffer();
    expect(hasMetadataMarker(fixtureWithExif)).toBe(true);

    const result = await processImage(fixtureWithExif, {
      config: testConfig(),
      mimeType: 'image/png',
      filename: 'privada.png',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.failureReason);
    expect(result.metrics.exifStripped).toBe(true);
    await assertOutputIsClean('webp(png)', result.outputs.webp);
    await assertOutputIsClean('avif(png)', result.outputs.avif);
    await assertOutputIsClean('thumbnail(png)', result.outputs.thumbnail);
  });
});
