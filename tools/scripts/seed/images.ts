/**
 * Generación de fixtures de imagen 100×100 (NFR-05).
 *
 * Los píxeles se construyen en memoria con un patrón determinista: no hay
 * archivos personales, descargas externas ni recursos del repositorio. Las
 * métricas del job se calculan con los bytes reales de los buffers generados
 * (PR-12: ahorro honesto, sin cifras inventadas).
 */

import sharp from 'sharp';

import type { DemoImageSpec } from './demo-data';

export interface SyntheticImage {
  width: number;
  height: number;
  rawBytes: number;
  optimizedBytes: number;
  rawContentType: string;
}

/** Patrón suave y reproducible: favorece compresión real sin datos externos. */
function buildPixels(spec: DemoImageSpec): Buffer {
  const pixels = Buffer.alloc(spec.width * spec.height * 3);
  const seed = spec.patternSeed;
  for (let y = 0; y < spec.height; y += 1) {
    for (let x = 0; x < spec.width; x += 1) {
      const offset = (y * spec.width + x) * 3;
      const smooth = (x + y + seed * 17) % 97;
      const noise = (x * (seed * 7 + 3) + y * (seed * 13 + 5)) % 23;
      pixels[offset] = Math.max(0, Math.min(255, smooth * 2 + noise * 5));
      pixels[offset + 1] = Math.max(0, Math.min(255, smooth * 2 - noise * 3));
      pixels[offset + 2] = Math.max(0, Math.min(255, (99 - smooth) * 2 + noise * 4));
    }
  }
  return pixels;
}

export async function generateSyntheticImage(spec: DemoImageSpec): Promise<SyntheticImage> {
  const base = sharp(buildPixels(spec), {
    raw: { width: spec.width, height: spec.height, channels: 3 },
  });
  const png = await base.clone().png().toBuffer();
  const webp = await base.clone().webp({ quality: 80 }).toBuffer();
  const avif = await base.clone().avif({ quality: 50 }).toBuffer();
  const metadata = await sharp(png).metadata();

  if (metadata.width !== spec.width || metadata.height !== spec.height) {
    throw new Error(`La imagen sintética ${spec.imageId} no es ${spec.width}x${spec.height}`);
  }

  return {
    width: metadata.width,
    height: metadata.height,
    rawBytes: png.length,
    // Los dos formatos declarados en el contrato (IN-01) aportan bytes reales.
    optimizedBytes: webp.length + avif.length,
    rawContentType: 'image/png',
  };
}
