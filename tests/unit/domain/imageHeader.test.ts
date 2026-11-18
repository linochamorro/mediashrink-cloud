import { describe, expect, it } from 'vitest';

import { DomainError } from '../../../backend/src/domain/guards';
import {
  assertValidImageHeader,
  detectFormat,
  extractDimensions,
  validateImageHeader,
} from '../../../backend/src/domain/imageHeader';
import {
  animatedGifFixture,
  avifFixture,
  jpegFixture,
  pngFixture,
  staticGifFixture,
  svgFixture,
  svgWithBomFixture,
  webpUnknownChunkFixture,
  webpVp8Fixture,
  webpVp8lFixture,
  webpVp8xFixture,
  zipFixture,
} from './fixtures';

describe('cabeceras — magic bytes reales (FR-07 / IN-10)', () => {
  it('detecta JPEG, PNG, WebP y AVIF por sus magic bytes reales', () => {
    expect(detectFormat(jpegFixture())).toEqual({ kind: 'raster', format: 'jpeg' });
    expect(detectFormat(pngFixture())).toEqual({ kind: 'raster', format: 'png' });
    expect(detectFormat(webpVp8xFixture())).toEqual({ kind: 'raster', format: 'webp' });
    expect(detectFormat(avifFixture())).toEqual({ kind: 'raster', format: 'avif' });
  });

  it('rechaza entrada vacía y formatos no raster permitidos', () => {
    expect(detectFormat(new Uint8Array())).toEqual({ kind: 'rejected', reason: 'EMPTY_INPUT' });
    expect(detectFormat(zipFixture())).toEqual({ kind: 'rejected', reason: 'FORMAT_NOT_ALLOWED' });
    expect(detectFormat(new Uint8Array(Buffer.from('abc', 'latin1')))).toEqual({
      kind: 'rejected',
      reason: 'FORMAT_NOT_ALLOWED',
    });
    expect(detectFormat(new Uint8Array(Buffer.from('RIFF\x00\x00\x00\x00JUNK', 'latin1')))).toEqual({
      kind: 'rejected',
      reason: 'FORMAT_NOT_ALLOWED',
    });
  });

  it('acepta la marca avis de secuencia AVIF y rechaza otras marcas ftyp', () => {
    const avifSequence = avifFixture();
    avifSequence[8] = 0x61;
    avifSequence[9] = 0x76;
    avifSequence[10] = 0x69;
    avifSequence[11] = 0x73;
    expect(detectFormat(avifSequence)).toEqual({ kind: 'raster', format: 'avif' });

    const unknownBrand = avifFixture();
    unknownBrand[8] = 0x6d;
    unknownBrand[9] = 0x70;
    unknownBrand[10] = 0x34;
    unknownBrand[11] = 0x32;
    expect(detectFormat(unknownBrand)).toEqual({ kind: 'rejected', reason: 'FORMAT_NOT_ALLOWED' });
  });

  it('rechaza SVG, incluso con declaración XML o BOM', () => {
    expect(detectFormat(svgFixture())).toEqual({ kind: 'rejected', reason: 'SVG_NOT_ALLOWED' });
    expect(detectFormat(svgWithBomFixture())).toEqual({
      kind: 'rejected',
      reason: 'SVG_NOT_ALLOWED',
    });
  });

  it('rechaza GIF animado y GIF estático (formato no permitido)', () => {
    expect(detectFormat(animatedGifFixture())).toEqual({
      kind: 'rejected',
      reason: 'GIF_ANIMATED_NOT_ALLOWED',
    });
    expect(detectFormat(staticGifFixture())).toEqual({ kind: 'rejected', reason: 'GIF_NOT_ALLOWED' });
  });
});

describe('cabeceras — extracción de dimensiones para anti-bomba', () => {
  it('extrae dimensiones de PNG, JPEG y las tres variantes de WebP', () => {
    expect(extractDimensions(pngFixture(12, 9), 'png')).toEqual({ width: 12, height: 9 });
    expect(extractDimensions(jpegFixture(12, 9), 'jpeg')).toEqual({ width: 12, height: 9 });
    expect(extractDimensions(webpVp8xFixture(12, 9), 'webp')).toEqual({ width: 12, height: 9 });
    expect(extractDimensions(webpVp8Fixture(12, 9), 'webp')).toEqual({ width: 12, height: 9 });
    expect(extractDimensions(webpVp8lFixture(12, 9), 'webp')).toEqual({ width: 12, height: 9 });
  });

  it('extrae dimensiones de AVIF desde la caja ispe', () => {
    expect(extractDimensions(avifFixture(12, 9), 'avif')).toEqual({ width: 12, height: 9 });
  });

  it('devuelve null cuando la cabecera está truncada o no declara dimensiones', () => {
    expect(extractDimensions(pngFixture().subarray(0, 12), 'png')).toBeNull();
    expect(extractDimensions(new Uint8Array(Buffer.from([0xff, 0xd8, 0xff])), 'jpeg')).toBeNull();
    expect(
      extractDimensions(new Uint8Array(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])), 'jpeg'),
    ).toBeNull();
    expect(extractDimensions(webpUnknownChunkFixture(), 'webp')).toBeNull();
    expect(extractDimensions(webpVp8xFixture().subarray(0, 20), 'webp')).toBeNull();
    expect(extractDimensions(webpVp8Fixture().subarray(0, 20), 'webp')).toBeNull();
    expect(extractDimensions(webpVp8lFixture().subarray(0, 21), 'webp')).toBeNull();
    expect(extractDimensions(avifFixture(12, 9, false), 'avif')).toBeNull();
    expect(extractDimensions(new Uint8Array(4), 'avif')).toBeNull();
  });
});

describe('cabeceras — coherencia MIME/extensión (rechazo de polimorfismo)', () => {
  it('acepta formatos raster con MIME y extensión coherentes', () => {
    expect(
      validateImageHeader({ bytes: pngFixture(), filename: 'foto.png', mimeType: 'image/png' }),
    ).toEqual({ ok: true, format: 'png', dimensions: { width: 8, height: 8 } });
    expect(validateImageHeader({ bytes: jpegFixture() })).toEqual({
      ok: true,
      format: 'jpeg',
      dimensions: { width: 8, height: 8 },
    });
  });

  it('normaliza mayúsculas y parámetros del MIME', () => {
    expect(
      validateImageHeader({
        bytes: webpVp8xFixture(),
        filename: 'FOTO.WEBP',
        mimeType: 'IMAGE/WEBP; charset=binary',
      }),
    ).toMatchObject({ ok: true, format: 'webp' });
    expect(
      validateImageHeader({ bytes: avifFixture(), filename: 'foto.AVIFS', mimeType: 'image/avif' }),
    ).toMatchObject({ ok: true, format: 'avif' });
  });

  it('rechaza MIME incoherente o desconocido', () => {
    expect(
      validateImageHeader({ bytes: pngFixture(), mimeType: 'image/jpeg' }),
    ).toMatchObject({ ok: false, reason: 'MIME_MISMATCH' });
    expect(
      validateImageHeader({ bytes: pngFixture(), mimeType: 'application/octet-stream' }),
    ).toMatchObject({ ok: false, reason: 'MIME_MISMATCH' });
  });

  it('rechaza extensiones engañosas, desconocidas y vacías', () => {
    for (const filename of ['foto.jpg', 'foto.svg', 'foto.gif', 'foto.txt', 'foto', 'foto.']) {
      expect(validateImageHeader({ bytes: pngFixture(), filename })).toMatchObject({
        ok: false,
        reason: 'EXTENSION_MISMATCH',
      });
    }
  });

  it('propaga el rechazo de formato antes de mirar MIME o extensión', () => {
    expect(
      validateImageHeader({ bytes: svgFixture(), filename: 'vector.svg', mimeType: 'image/svg+xml' }),
    ).toMatchObject({ ok: false, reason: 'SVG_NOT_ALLOWED' });
    expect(validateImageHeader({ bytes: animatedGifFixture(), filename: 'ani.gif' })).toMatchObject({
      ok: false,
      reason: 'GIF_ANIMATED_NOT_ALLOWED',
    });
  });

  it('falla cerrado si no hay dimensiones o son inválidas', () => {
    expect(
      validateImageHeader({ bytes: new Uint8Array(Buffer.from([0xff, 0xd8, 0xff])) }),
    ).toMatchObject({ ok: false, reason: 'DIMENSIONS_UNAVAILABLE' });
    expect(validateImageHeader({ bytes: pngFixture(0, 8) })).toMatchObject({
      ok: false,
      reason: 'INVALID_DIMENSIONS',
    });
    const webpAnchoCero = webpVp8Fixture();
    webpAnchoCero[26] = 0;
    webpAnchoCero[27] = 0;
    expect(validateImageHeader({ bytes: webpAnchoCero })).toMatchObject({
      ok: false,
      reason: 'INVALID_DIMENSIONS',
    });
    const webpAltoCero = webpVp8Fixture();
    webpAltoCero[28] = 0;
    webpAltoCero[29] = 0;
    expect(validateImageHeader({ bytes: webpAltoCero })).toMatchObject({
      ok: false,
      reason: 'INVALID_DIMENSIONS',
    });
  });

  it('assertValidImageHeader devuelve el resultado válido y lanza si se rechaza', () => {
    expect(assertValidImageHeader({ bytes: pngFixture() })).toMatchObject({ ok: true });
    try {
      assertValidImageHeader({ bytes: zipFixture() });
      throw new Error('debió lanzar');
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).code).toBe('FORMAT_NOT_ALLOWED');
    }
  });
});
