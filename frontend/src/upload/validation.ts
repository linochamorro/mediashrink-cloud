import type { LimitsConfig, Preset } from '../api/types.generated';

export const PRESETS: readonly Preset[] = ['HIGH', 'BALANCED', 'MAX_COMPRESSION'];
export type UploadLimits = Pick<LimitsConfig, 'maxFileSizeMb' | 'maxImagesPerBatch'>;
export type FileValidation = { valid: boolean; errors: string[] };
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

export function validateFiles(files: readonly Pick<File, 'name' | 'type' | 'size'>[], limits: UploadLimits): FileValidation {
  const errors: string[] = [];
  if (files.length === 0) errors.push('Selecciona al menos una imagen.');
  if (files.length > limits.maxImagesPerBatch) errors.push(`El máximo es ${limits.maxImagesPerBatch} imágenes por lote.`);
  for (const file of files) {
    if (!ALLOWED_TYPES.has(file.type)) errors.push(`${file.name}: formato no permitido. Usa JPEG, PNG, WebP o AVIF.`);
    if (file.size > limits.maxFileSizeMb * 1024 * 1024) errors.push(`${file.name}: supera el límite de ${limits.maxFileSizeMb} MB.`);
  }
  return { valid: errors.length === 0, errors };
}

// El tope de lote se comprueba antes que los archivos individuales para no relajar E2-03.
export function selectValidFiles<T extends Pick<File, 'name' | 'type' | 'size'>>(
  files: readonly T[],
  limits: UploadLimits,
): { accepted: T[]; errors: string[] } {
  const errors: string[] = [];
  if (files.length === 0) errors.push('Selecciona al menos una imagen.');
  if (files.length > limits.maxImagesPerBatch) errors.push(`El máximo es ${limits.maxImagesPerBatch} imágenes por lote.`);
  if (errors.length > 0) return { accepted: [], errors };

  const accepted: T[] = [];
  for (const file of files) {
    const result = validateFiles([file], limits);
    if (result.valid) accepted.push(file);
    else errors.push(...result.errors);
  }
  return { accepted, errors };
}
