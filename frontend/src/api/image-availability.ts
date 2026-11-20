import type { ImageRecord } from './types.generated';

const UNPROCESSED_BASE_MESSAGE = 'Imagen no procesada.';
const PENDING_MESSAGE = 'Imagen en procesamiento. La comparativa estará disponible al completarse.';

/**
 * Decide si una imagen debe cargar la variante optimizada para la comparativa.
 * Devuelve `true` solo para `COMPLETED`, el único estado con el artefacto
 * optimizado confirmado. Para `PENDING`, `PROCESSING`, `FAILED`, `PARTIAL` y
 * cualquier estado ausente o desconocido devuelve `false`, de modo que no se
 * pida una variante inexistente a S3 (404 transitorio en E5-01, QA-HUMAN-04).
 */
export function shouldLoadOptimized(image: Pick<ImageRecord, 'status' | 'failureReason'>): boolean {
  return image.status === 'COMPLETED';
}

/**
 * Aviso en español para imágenes aún en espera (`PENDING`/`PROCESSING`): la
 * comparativa se mostrará en cuanto el worker confirme la variante optimizada.
 * Es total y no refleja `failureReason` ni secretos. Para cualquier otro estado
 * delega en `failedImageMessage` (aviso terminal).
 */
export function pendingImageMessage(image: Pick<ImageRecord, 'status' | 'failureReason'>): string {
  const isWaiting = image.status === 'PENDING' || image.status === 'PROCESSING';
  return isWaiting ? PENDING_MESSAGE : failedImageMessage(image);
}

/**
 * Aviso en español para imágenes no procesadas. Incluye `failureReason` solo
 * cuando está presente, de modo que no se pidan ni se muestren artefactos
 * inexistentes (QA-HUMAN-03) sin filtrar secretos en el texto.
 */
export function failedImageMessage(image: Pick<ImageRecord, 'status' | 'failureReason'>): string {
  const reason = image.failureReason?.trim();
  return reason ? `${UNPROCESSED_BASE_MESSAGE} Motivo: ${reason}.` : UNPROCESSED_BASE_MESSAGE;
}
