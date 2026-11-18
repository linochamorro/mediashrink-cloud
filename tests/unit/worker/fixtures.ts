/**
 * Fixtures sintéticas del worker (NFR-05: 100×100 px).
 *
 * Las imágenes se generan en memoria con `sharp`, sin red, sin S3 y sin
 * archivos. La fixture con metadatos inyecta EXIF (incluidas etiquetas GPS),
 * XMP e IPTC para verificar el strip total exigido por PR-01/IN-10.
 */

import { Buffer } from 'node:buffer';

import { loadConfig, type AppConfig } from '../../../backend/src/config/index';
import sharp from 'sharp';

export const METADATA_MARKERS = [
  'GPS-TEST',
  'XMP-TEST',
  'IPTC-TEST',
  'PRIVATE-EXIF',
] as const;

/** Entorno mínimo y determinista; los límites se pueden sobreescribir por prueba. */
export function testEnv(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    NODE_ENV: 'test',
    JWT_ACCESS_SECRET: 'REPLACE_WITH_LOCAL_DEV_SECRET',
    JWT_REFRESH_SECRET: 'REPLACE_WITH_LOCAL_DEV_SECRET',
    AWS_ENDPOINT_URL: 'https://127.0.0.1:9297',
    S3_BUCKET_RAW: 'mediashrink-raw-local',
    S3_BUCKET_OPTIMIZED: 'mediashrink-optimized-local',
    SQS_QUEUE_URL: 'https://sqs.us-east-1.amazonaws.com/000000000000/mediashrink-jobs',
    SQS_DLQ_URL: 'https://sqs.us-east-1.amazonaws.com/000000000000/mediashrink-jobs-dlq',
    DYNAMODB_TABLE_JOBS: 'mediashrink-jobs',
    MAX_PIXELS: '25000000',
    MAX_FILE_SIZE_MB: '15',
    ...overrides,
  };
}

/** Configuración real cargada desde el entorno de prueba (sin constantes propias). */
export function testConfig(overrides: Record<string, string> = {}): AppConfig {
  return loadConfig(testEnv(overrides));
}

/** JPEG raster sólido de 100×100 por defecto. */
export async function createJpeg(width = 100, height = 100): Promise<Uint8Array> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 120, g: 60, b: 30 } },
  })
    .jpeg()
    .toBuffer();
}

function jpegSegment(marker: number, payload: Buffer): Buffer {
  const segment = Buffer.alloc(4 + payload.length);
  segment[0] = 0xff;
  segment[1] = marker;
  segment.writeUInt16BE(payload.length + 2, 2);
  payload.copy(segment, 4);
  return segment;
}

/**
 * JPEG de 100×100 con EXIF (Copyright + GPS), XMP e IPTC.
 * Los marcadores ASCII permiten comprobar la ausencia de metadatos en la salida
 * tanto por `sharp().metadata()` como por búsqueda en bytes crudos.
 */
/** sharp 0.33 no declara `GPS` en su tipo `Exif`, pero libvips sí escribe el IFD GPS. */
interface ExifForFixture {
  IFD0: Record<string, string>;
  GPS?: Record<string, string>;
}

export async function createJpegWithMetadata(width = 100, height = 100): Promise<Uint8Array> {
  const base = await createJpeg(width, height);
  const exif: ExifForFixture = {
    IFD0: {
      Copyright: 'GPS-TEST-LAT-40.4168-LON-3.7038',
      ImageDescription: 'PRIVATE-EXIF-MARKER',
    },
    GPS: { GPSLatitude: '40.4168', GPSLongitude: '-3.7038' },
  };
  const withExif = await sharp(base).withExif(exif).jpeg().toBuffer();

  const xmp = Buffer.from(
    'http://ns.adobe.com/xap/1.0/\0<x:xmpmeta xmlns:x="adobe:ns:meta/"><private>XMP-TEST-MARKER</private></x:xmpmeta>',
    'latin1',
  );
  const iptc = Buffer.from(
    'Photoshop 3.0\0' + '8BIM\x04\x04\0\0\0\x0bIPTC-TEST-MARKER',
    'latin1',
  );

  // Se insertan los segmentos APP1/APP13 justo después del SOI (FFD8).
  return Buffer.concat([
    withExif.subarray(0, 2),
    jpegSegment(0xe1, xmp),
    jpegSegment(0xed, iptc),
    withExif.subarray(2),
  ]);
}

/** Buffer sobredimensionado que además empieza con magic bytes de JPEG. */
export function oversizedBuffer(sizeBytes: number): Uint8Array {
  const bytes = Buffer.alloc(sizeBytes, 0xff);
  Buffer.from([0xff, 0xd8, 0xff]).copy(bytes, 0);
  return bytes;
}

/** Contiene alguno de los marcadores de metadatos de la fixture. */
export function hasMetadataMarker(bytes: Uint8Array): boolean {
  const raw = Buffer.from(bytes).toString('latin1');
  return METADATA_MARKERS.some((marker) => raw.includes(marker));
}
