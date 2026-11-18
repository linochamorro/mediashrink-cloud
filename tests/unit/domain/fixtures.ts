/**
 * Fixtures mínimas de cabeceras raster (NFR-05: 100×100 px o menos).
 *
 * Construyen bytes reales de magic bytes y campos de dimensión con Node
 * built-ins (`Buffer`). No son imágenes decodificables: solo ejercitan las
 * reglas puras de cabecera/anti-bomba, que es exactamente el alcance de F01-T05.
 */

/** JPEG con marcador SOF0 que declara `width`×`height`. */
export function jpegFixture(width = 8, height = 8): Uint8Array {
  const head = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00,
    0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
  ]);
  const sof = Buffer.alloc(17);
  sof[0] = 0xff;
  sof[1] = 0xc0;
  sof[2] = 0x00;
  sof[3] = 0x11;
  sof[4] = 0x08;
  sof.writeUInt16BE(height, 5);
  sof.writeUInt16BE(width, 7);
  return new Uint8Array(Buffer.concat([head, sof, Buffer.from([0xff, 0xd9])]));
}

/** PNG con chunk IHDR que declara `width`×`height`. */
export function pngFixture(width = 8, height = 8): Uint8Array {
  const buffer = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer, 0);
  buffer.writeUInt32BE(13, 8);
  Buffer.from('IHDR', 'latin1').copy(buffer, 12);
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return new Uint8Array(buffer);
}

/** WebP VP8X (extendido): dimensiones little-endian de 24 bits + 1. */
export function webpVp8xFixture(width = 8, height = 6): Uint8Array {
  const buffer = Buffer.alloc(30);
  Buffer.from('RIFF', 'latin1').copy(buffer, 0);
  buffer.writeUInt32LE(22, 4);
  Buffer.from('WEBP', 'latin1').copy(buffer, 8);
  Buffer.from('VP8X', 'latin1').copy(buffer, 12);
  buffer.writeUInt32LE(10, 16);
  writeLe24(buffer, 24, width - 1);
  writeLe24(buffer, 27, height - 1);
  return new Uint8Array(buffer);
}

/** WebP VP8 (pérdida): dimensiones de 14 bits en los offsets 26 y 28. */
export function webpVp8Fixture(width = 8, height = 6): Uint8Array {
  const buffer = Buffer.alloc(30);
  Buffer.from('RIFF', 'latin1').copy(buffer, 0);
  Buffer.from('WEBP', 'latin1').copy(buffer, 8);
  Buffer.from('VP8 ', 'latin1').copy(buffer, 12);
  Buffer.from([0x9d, 0x01, 0x2a]).copy(buffer, 23);
  buffer.writeUInt16LE(width, 26);
  buffer.writeUInt16LE(height, 28);
  return new Uint8Array(buffer);
}

/** WebP VP8L (sin pérdida): dimensiones empaquetadas tras el byte 0x2f. */
export function webpVp8lFixture(width = 8, height = 6): Uint8Array {
  const buffer = Buffer.alloc(25);
  Buffer.from('RIFF', 'latin1').copy(buffer, 0);
  Buffer.from('WEBP', 'latin1').copy(buffer, 8);
  Buffer.from('VP8L', 'latin1').copy(buffer, 12);
  buffer[20] = 0x2f;
  const packed =
    ((width - 1) & 0x3fff) | (((height - 1) & 0x3fff) << 14);
  buffer.writeUInt32LE(packed >>> 0, 21);
  return new Uint8Array(buffer);
}

/** WebP con un chunk desconocido: la dimensión no es extraíble. */
export function webpUnknownChunkFixture(): Uint8Array {
  const buffer = Buffer.alloc(30);
  Buffer.from('RIFF', 'latin1').copy(buffer, 0);
  Buffer.from('WEBP', 'latin1').copy(buffer, 8);
  Buffer.from('VP8Z', 'latin1').copy(buffer, 12);
  return new Uint8Array(buffer);
}

/** AVIF con caja `ispe` que declara `width`×`height`. */
export function avifFixture(width = 8, height = 6, withIspe = true): Uint8Array {
  const buffer = Buffer.alloc(40);
  Buffer.from('ftyp', 'latin1').copy(buffer, 4);
  Buffer.from('avif', 'latin1').copy(buffer, 8);
  if (withIspe) {
    Buffer.from('ispe', 'latin1').copy(buffer, 16);
    buffer.writeUInt32BE(width, 24);
    buffer.writeUInt32BE(height, 28);
  }
  return new Uint8Array(buffer);
}

export function svgFixture(): Uint8Array {
  return new Uint8Array(
    Buffer.from('  <?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg"/>', 'utf8'),
  );
}

export function svgWithBomFixture(): Uint8Array {
  return new Uint8Array(Buffer.from('\uFEFF<svg viewBox="0 0 1 1"/>', 'utf8'));
}

export function animatedGifFixture(): Uint8Array {
  return new Uint8Array(
    Buffer.from('GIF89aNETSCAPE2.0\x03\x01\x00\x00\x00', 'latin1'),
  );
}

export function staticGifFixture(): Uint8Array {
  return new Uint8Array(Buffer.from('GIF89a\x01\x00\x01\x00', 'latin1'));
}

export function zipFixture(): Uint8Array {
  return new Uint8Array(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]));
}

function writeLe24(buffer: Buffer, offset: number, value: number): void {
  buffer[offset] = value & 0xff;
  buffer[offset + 1] = (value >>> 8) & 0xff;
  buffer[offset + 2] = (value >>> 16) & 0xff;
}
