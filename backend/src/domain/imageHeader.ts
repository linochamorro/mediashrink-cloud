/**
 * Validación estricta de cabeceras (F01-T05, FR-07 / IN-10).
 *
 * Comprueba magic bytes reales (JPEG/PNG/WebP/AVIF), extrae dimensiones para
 * la anti-bomba y exige coherencia entre MIME declarado y extensión. Rechaza
 * SVG, GIF (animado y estático) y cualquier formato no raster permitido.
 * Determinista y sin I/O: solo Node built-ins (`node:buffer`).
 */

import { Buffer } from 'node:buffer';

import type { ImageDimensions } from './antiBomb';
import { DomainError, isPositiveSafeInt } from './guards';

export type RasterFormat = 'jpeg' | 'png' | 'webp' | 'avif';

export type HeaderRejectionReason =
  | 'EMPTY_INPUT'
  | 'SVG_NOT_ALLOWED'
  | 'GIF_ANIMATED_NOT_ALLOWED'
  | 'GIF_NOT_ALLOWED'
  | 'FORMAT_NOT_ALLOWED'
  | 'MIME_MISMATCH'
  | 'EXTENSION_MISMATCH'
  | 'DIMENSIONS_UNAVAILABLE'
  | 'INVALID_DIMENSIONS';

export type FormatDetection =
  | { readonly kind: 'raster'; readonly format: RasterFormat }
  | { readonly kind: 'rejected'; readonly reason: HeaderRejectionReason };

export type HeaderValidation =
  | { readonly ok: true; readonly format: RasterFormat; readonly dimensions: ImageDimensions }
  | { readonly ok: false; readonly reason: HeaderRejectionReason };

export interface HeaderValidationInput {
  readonly bytes: Uint8Array;
  readonly filename?: string;
  readonly mimeType?: string;
}

const PNG_SIGNATURE = '89504e470d0a1a0a';
const GIF_ANIMATION_SIGNATURE = 'NETSCAPE2.0';
const SVG_PATTERN = /^\s*(?:<\?xml[\s\S]*?\?>\s*)?<svg(?:\s|>)/i;

const EXTENSION_FORMAT: Readonly<Record<string, RasterFormat>> = {
  jpg: 'jpeg',
  jpeg: 'jpeg',
  png: 'png',
  webp: 'webp',
  avif: 'avif',
  avifs: 'avif',
};

const MIME_FORMAT: Readonly<Record<string, RasterFormat>> = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/avif-sequence': 'avif',
};

/** Marcadores SOF de JPEG que declaran alto/ancho. */
const SOF_MARKERS = new Set<number>([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

function hexAt(bytes: Uint8Array, offset: number, length: number): string {
  return Buffer.from(bytes.subarray(offset, offset + length)).toString('hex');
}

function asciiAt(bytes: Uint8Array, offset: number, length: number): string {
  return Buffer.from(bytes.subarray(offset, offset + length)).toString('latin1');
}

/** REFACTOR: una sola comparación para todos los magic bytes ASCII. */
function hasAscii(bytes: Uint8Array, offset: number, value: string): boolean {
  return asciiAt(bytes, offset, value.length) === value;
}

/** REFACTOR: una sola comparación para todos los magic bytes hexadecimales. */
function hasHex(bytes: Uint8Array, offset: number, value: string): boolean {
  return hexAt(bytes, offset, value.length / 2) === value;
}

function readU16BE(bytes: Uint8Array, offset: number): number {
  return Buffer.from(bytes.subarray(offset, offset + 2)).readUInt16BE(0);
}

function readU16LE(bytes: Uint8Array, offset: number): number {
  return Buffer.from(bytes.subarray(offset, offset + 2)).readUInt16LE(0);
}

function readU32BE(bytes: Uint8Array, offset: number): number {
  return Buffer.from(bytes.subarray(offset, offset + 4)).readUInt32BE(0);
}

function readU32LE(bytes: Uint8Array, offset: number): number {
  return Buffer.from(bytes.subarray(offset, offset + 4)).readUInt32LE(0);
}

function readLe24(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function isSvg(bytes: Uint8Array): boolean {
  const head = Buffer.from(bytes.subarray(0, 1024)).toString('utf8').replace(/^\uFEFF/, '');
  return SVG_PATTERN.test(head);
}

function isGif(bytes: Uint8Array): boolean {
  return hasAscii(bytes, 0, 'GIF');
}

function isAnimatedGif(bytes: Uint8Array): boolean {
  return Buffer.from(bytes).toString('latin1').includes(GIF_ANIMATION_SIGNATURE);
}

function isJpeg(bytes: Uint8Array): boolean {
  return hasHex(bytes, 0, 'ffd8ff');
}

function isPng(bytes: Uint8Array): boolean {
  return hasHex(bytes, 0, PNG_SIGNATURE);
}

function isWebp(bytes: Uint8Array): boolean {
  return hasAscii(bytes, 0, 'RIFF') && hasAscii(bytes, 8, 'WEBP');
}

function isAvif(bytes: Uint8Array): boolean {
  const brand = asciiAt(bytes, 8, 4);
  return hasAscii(bytes, 4, 'ftyp') && (brand === 'avif' || brand === 'avis');
}

function rejected(reason: HeaderRejectionReason): FormatDetection {
  return { kind: 'rejected', reason };
}

/** Identifica el formato por magic bytes, aplicando primero los rechazos de seguridad. */
export function detectFormat(bytes: Uint8Array): FormatDetection {
  if (bytes.length === 0) return rejected('EMPTY_INPUT');
  if (isSvg(bytes)) return rejected('SVG_NOT_ALLOWED');
  if (isGif(bytes)) {
    return rejected(isAnimatedGif(bytes) ? 'GIF_ANIMATED_NOT_ALLOWED' : 'GIF_NOT_ALLOWED');
  }
  if (isJpeg(bytes)) return { kind: 'raster', format: 'jpeg' };
  if (isPng(bytes)) return { kind: 'raster', format: 'png' };
  if (isWebp(bytes)) return { kind: 'raster', format: 'webp' };
  if (isAvif(bytes)) return { kind: 'raster', format: 'avif' };
  return rejected('FORMAT_NOT_ALLOWED');
}

function pngDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (bytes.length < 24) return null;
  return { width: readU32BE(bytes, 16), height: readU32BE(bytes, 20) };
}

function jpegDimensions(bytes: Uint8Array): ImageDimensions | null {
  for (let i = 1; i + 9 < bytes.length; i++) {
    if (bytes[i] === 0xff && SOF_MARKERS.has(bytes[i + 1])) {
      return { height: readU16BE(bytes, i + 5), width: readU16BE(bytes, i + 7) };
    }
  }
  return null;
}

function webpDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (hasAscii(bytes, 12, 'VP8X')) {
    if (bytes.length < 30) return null;
    return { width: readLe24(bytes, 24) + 1, height: readLe24(bytes, 27) + 1 };
  }
  if (hasAscii(bytes, 12, 'VP8 ')) {
    if (bytes.length < 30) return null;
    return { width: readU16LE(bytes, 26) & 0x3fff, height: readU16LE(bytes, 28) & 0x3fff };
  }
  if (hasAscii(bytes, 12, 'VP8L')) {
    if (bytes.length < 25) return null;
    const packed = readU32LE(bytes, 21);
    return {
      width: (packed & 0x3fff) + 1,
      height: ((packed >>> 14) & 0x3fff) + 1,
    };
  }
  return null;
}

function avifDimensions(bytes: Uint8Array): ImageDimensions | null {
  for (let i = 0; i + 16 <= bytes.length; i++) {
    if (hasAscii(bytes, i, 'ispe')) {
      return { width: readU32BE(bytes, i + 8), height: readU32BE(bytes, i + 12) };
    }
  }
  return null;
}

/** Extrae dimensiones del encabezado; `null` equivale a "no verificable". */
export function extractDimensions(bytes: Uint8Array, format: RasterFormat): ImageDimensions | null {
  if (format === 'png') return pngDimensions(bytes);
  if (format === 'jpeg') return jpegDimensions(bytes);
  if (format === 'webp') return webpDimensions(bytes);
  return avifDimensions(bytes);
}

function normalizeMime(mime: string): string {
  return mime.split(';')[0].trim().toLowerCase();
}

function extensionOf(filename: string): string | null {
  const dot = filename.lastIndexOf('.');
  if (dot < 0 || dot === filename.length - 1) return null;
  return filename.slice(dot + 1).toLowerCase();
}

/**
 * Regla completa de validación de cabecera. Falla cerrado: si faltan
 * dimensiones o son inválidas, rechaza antes de cualquier procesamiento.
 */
export function validateImageHeader(input: HeaderValidationInput): HeaderValidation {
  const detection = detectFormat(input.bytes);
  if (detection.kind === 'rejected') return { ok: false, reason: detection.reason };

  const format = detection.format;
  if (input.mimeType !== undefined) {
    const declaredFormat = MIME_FORMAT[normalizeMime(input.mimeType)];
    if (declaredFormat !== format) return { ok: false, reason: 'MIME_MISMATCH' };
  }
  if (input.filename !== undefined) {
    const extension = extensionOf(input.filename);
    if (extension === null || EXTENSION_FORMAT[extension] !== format) {
      return { ok: false, reason: 'EXTENSION_MISMATCH' };
    }
  }

  const dimensions = extractDimensions(input.bytes, format);
  if (dimensions === null) return { ok: false, reason: 'DIMENSIONS_UNAVAILABLE' };
  if (!isPositiveSafeInt(dimensions.width) || !isPositiveSafeInt(dimensions.height)) {
    return { ok: false, reason: 'INVALID_DIMENSIONS' };
  }

  return { ok: true, format, dimensions };
}

/** Variante asertiva para el worker: convierte cualquier rechazo en `DomainError`. */
export function assertValidImageHeader(
  input: HeaderValidationInput,
): Extract<HeaderValidation, { ok: true }> {
  const result = validateImageHeader(input);
  if (!result.ok) {
    throw new DomainError(result.reason, `Cabecera de imagen rechazada: ${result.reason}`);
  }
  return result;
}
