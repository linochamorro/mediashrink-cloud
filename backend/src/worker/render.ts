/**
 * Renderizador `sharp`: decodifica una vez a píxeles crudos y genera tres salidas.
 *
 * El paso por datos RAW es el strip de metadatos: los bytes de píxeles no
 * contienen EXIF/GPS/XMP/IPTC y jamás se invoca `withMetadata()`.
 */

import type { Preset } from '../contracts/index';
import type { RasterFormat } from '../domain/index';
import sharp from 'sharp';

export interface RenderedOutputs {
  readonly webp: Uint8Array;
  readonly avif: Uint8Array;
  readonly thumbnail: Uint8Array;
}

export interface RenderInput {
  readonly bytes: Uint8Array;
  readonly format: RasterFormat;
  readonly preset: Preset;
}

export type ImageRenderer = (input: RenderInput) => Promise<RenderedOutputs>;

/** Lado máximo de la miniatura WebP (detalle de implementación, sin decisión de producto). */
export const THUMBNAIL_MAX_EDGE = 256;

/** Calidades por preset; el preset no altera el strip ni los formatos de salida. */
const PRESET_QUALITY: Readonly<Record<Preset, { readonly webp: number; readonly avif: number }>> = {
  HIGH: { webp: 90, avif: 80 },
  BALANCED: { webp: 75, avif: 60 },
  MAX_COMPRESSION: { webp: 55, avif: 40 },
};

/**
 * Verificación en caliente: `exifStripped` solo se certifica si las tres
 * salidas realmente carecen de EXIF, XMP e IPTC tras la codificación.
 */
async function assertMetadataStripped(outputs: RenderedOutputs): Promise<void> {
  for (const [name, bytes] of Object.entries(outputs) as Array<[string, Uint8Array]>) {
    const metadata = await sharp(bytes).metadata();
    if (metadata.exif !== undefined || metadata.xmp !== undefined || metadata.iptc !== undefined) {
      throw new Error(`Metadatos residuales en la salida ${name}`);
    }
  }
}

export const renderWithSharp: ImageRenderer = async ({ bytes, preset }) => {
  // Decodificación única a píxeles crudos: aquí se descartan todos los metadatos.
  const decoded = await sharp(bytes).raw().toBuffer({ resolveWithObject: true });
  const raw = {
    width: decoded.info.width,
    height: decoded.info.height,
    channels: decoded.info.channels,
  };
  const fromRaw = () => sharp(decoded.data, { raw });
  const quality = PRESET_QUALITY[preset];

  const [webp, avif, thumbnail] = await Promise.all([
    fromRaw().webp({ quality: quality.webp }).toBuffer(),
    fromRaw().avif({ quality: quality.avif, effort: 4 }).toBuffer(),
    fromRaw()
      .resize(THUMBNAIL_MAX_EDGE, THUMBNAIL_MAX_EDGE, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: quality.webp })
      .toBuffer(),
  ]);

  const outputs: RenderedOutputs = { webp, avif, thumbnail };
  await assertMetadataStripped(outputs);
  return outputs;
};
