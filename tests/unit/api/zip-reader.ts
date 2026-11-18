/** Lector mínimo de ZIP (método STORE) usado solo para verificar las pruebas. */

export interface ReadEntry {
  name: string;
  bytes: Buffer;
}

/** Parte un ZIP en memoria y devuelve sus entradas en orden. */
export function readZip(bytes: Buffer): ReadEntry[] {
  const entries: ReadEntry[] = [];
  let offset = 0;
  while (offset + 30 <= bytes.length && bytes.readUInt32LE(offset) === 0x04034b50) {
    const method = bytes.readUInt16LE(offset + 8);
    const crc = bytes.readUInt32LE(offset + 14);
    const compressedSize = bytes.readUInt32LE(offset + 18);
    const nameLength = bytes.readUInt16LE(offset + 26);
    const extraLength = bytes.readUInt16LE(offset + 28);
    if (method !== 0) throw new Error('El ZIP de prueba debe usar el método STORE');
    const nameStart = offset + 30;
    const name = bytes.subarray(nameStart, nameStart + nameLength).toString('utf8');
    const dataStart = nameStart + nameLength + extraLength;
    const data = bytes.subarray(dataStart, dataStart + compressedSize);
    entries.push({ name, bytes: Buffer.from(data) });
    if (crc >>> 0 !== crc32(data)) throw new Error(`CRC inválido para ${name}`);
    offset = dataStart + compressedSize;
  }
  return entries;
}

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
