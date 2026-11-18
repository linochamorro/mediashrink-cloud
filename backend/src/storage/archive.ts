/**
 * Generador de ZIP en memoria (F02-T05, CA-05, FR-18 / A-05; reforzado en
 * loop 2 con A-01).
 *
 * El archivo se construye íntegramente en un `Buffer`: nunca se escriben
 * archivos temporales en disco y el binario del lote solo existe en la
 * respuesta HTTP final. Se usa el método de almacenamiento `STORE` (sin
 * compresión adicional), válido para cualquier lector de ZIP y sin añadir
 * dependencias al manifiesto (T02 ya declaró las tres de la fase).
 *
 * Formato acordado del ZIP del lote: entradas planas, una por objeto S3
 * existente, con `<imageId>.webp`, `<imageId>.avif` y
 * `<imageId>_thumb.webp` (miniatura WebP, A-04). No se incluye un manifest
 * adicional: el contenido es exactamente el resultado optimizado del lote.
 *
 * A-01: el generador verifica un tope explícito de entradas y de bytes ANTES
 * de copiar datos, y reserva un único `Buffer` de salida. Las entradas se
 * escriben directamente desde su vista original (sin `Buffer.from` intermedia)
 * para no triplicar la memoria del lote.
 */

/** Entrada ya resuelta: nombre dentro del ZIP y bytes del objeto S3. */
export interface ArchiveEntry {
  name: string;
  bytes: Uint8Array;
}

export interface ZipArchive {
  bytes: Buffer;
  entryCount: number;
}

/** Topes por defecto: agregado de 256 MiB y 60 entradas (20 imágenes × 3). */
export const DEFAULT_ZIP_MAX_BYTES = 256 * 1024 * 1024;
export const DEFAULT_ZIP_MAX_ENTRIES = 60;

export interface ZipLimits {
  maxBytes: number;
  maxEntries: number;
}

/** Error de límite: mensaje genérico, sin claves ni datos del lote (G-3). */
export class ZipLimitError extends Error {
  constructor(
    readonly kind: 'bytes' | 'entries',
    readonly limit: number,
    readonly actual: number,
  ) {
    super('El ZIP del lote supera el tamaño permitido');
    this.name = 'ZipLimitError';
  }
}

export function defaultZipLimits(): ZipLimits {
  return { maxBytes: DEFAULT_ZIP_MAX_BYTES, maxEntries: DEFAULT_ZIP_MAX_ENTRIES };
}

const LOCAL_FILE_SIGNATURE = 0x04034b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const VERSION = 20;
const FLAGS = 0x0800; // nombres UTF-8
const METHOD_STORE = 0;
/** Fecha DOS fija (1980-01-01 00:00:00): el ZIP es reproducible y no filtra hora. */
const DOS_TIME = 0;
const DOS_DATE = 0x0021;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) !== 0 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Vista `Buffer` sin copiar: evita duplicar cada objeto en memoria. */
function asBuffer(bytes: Uint8Array): Buffer {
  return Buffer.isBuffer(bytes)
    ? bytes
    : Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

interface PlannedEntry {
  name: Buffer;
  bytes: Buffer;
  crc: number;
  localOffset: number;
}

/**
 * Construye un ZIP en memoria a partir de las entradas.
 * Lanza `ZipLimitError` antes de copiar ningún byte si excede los topes.
 */
export function createZipArchive(
  entries: readonly ArchiveEntry[],
  limits: ZipLimits = defaultZipLimits(),
): ZipArchive {
  if (entries.length > limits.maxEntries) {
    throw new ZipLimitError('entries', limits.maxEntries, entries.length);
  }

  const planned: PlannedEntry[] = [];
  let payloadBytes = 0;
  let localSize = 0;
  let centralSize = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const bytes = asBuffer(entry.bytes);
    const crc = crc32(bytes);
    payloadBytes += bytes.length;
    localSize += 30 + name.length + bytes.length;
    centralSize += 46 + name.length;
    planned.push({ name, bytes, crc, localOffset: 0 });
  }

  // Comprobar antes de reservar/copiar: ni el agregado ni el ZIP final pueden
  // superar el tope (los offsets ZIP son de 32 bits, así que 4 GiB es el techo).
  const totalSize = localSize + centralSize + 22;
  if (payloadBytes > limits.maxBytes || totalSize > limits.maxBytes) {
    throw new ZipLimitError('bytes', limits.maxBytes, Math.max(payloadBytes, totalSize));
  }

  const out = Buffer.allocUnsafe(totalSize);
  let cursor = 0;
  for (const entry of planned) {
    entry.localOffset = cursor;
    const header = out.subarray(cursor, cursor + 30);
    header.writeUInt32LE(LOCAL_FILE_SIGNATURE, 0);
    header.writeUInt16LE(VERSION, 4);
    header.writeUInt16LE(FLAGS, 6);
    header.writeUInt16LE(METHOD_STORE, 8);
    header.writeUInt16LE(DOS_TIME, 10);
    header.writeUInt16LE(DOS_DATE, 12);
    header.writeUInt32LE(entry.crc, 14);
    header.writeUInt32LE(entry.bytes.length, 18);
    header.writeUInt32LE(entry.bytes.length, 22);
    header.writeUInt16LE(entry.name.length, 26);
    header.writeUInt16LE(0, 28);
    cursor += 30;
    entry.name.copy(out, cursor);
    cursor += entry.name.length;
    // Una sola copia de los bytes del objeto al buffer final.
    entry.bytes.copy(out, cursor);
    cursor += entry.bytes.length;
  }

  for (const entry of planned) {
    const header = out.subarray(cursor, cursor + 46);
    header.writeUInt32LE(CENTRAL_DIRECTORY_SIGNATURE, 0);
    header.writeUInt16LE(VERSION, 4);
    header.writeUInt16LE(VERSION, 6);
    header.writeUInt16LE(FLAGS, 8);
    header.writeUInt16LE(METHOD_STORE, 10);
    header.writeUInt16LE(DOS_TIME, 12);
    header.writeUInt16LE(DOS_DATE, 14);
    header.writeUInt32LE(entry.crc, 16);
    header.writeUInt32LE(entry.bytes.length, 20);
    header.writeUInt32LE(entry.bytes.length, 24);
    header.writeUInt16LE(entry.name.length, 28);
    header.writeUInt16LE(0, 30);
    header.writeUInt16LE(0, 32);
    header.writeUInt16LE(0, 34);
    header.writeUInt16LE(0, 36);
    header.writeUInt32LE(0, 38);
    header.writeUInt32LE(entry.localOffset, 42);
    cursor += 46;
    entry.name.copy(out, cursor);
    cursor += entry.name.length;
  }

  const end = out.subarray(cursor, cursor + 22);
  end.writeUInt32LE(END_OF_CENTRAL_DIRECTORY_SIGNATURE, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(planned.length, 8);
  end.writeUInt16LE(planned.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(localSize, 16);
  end.writeUInt16LE(0, 20);

  return { bytes: out, entryCount: planned.length };
}
