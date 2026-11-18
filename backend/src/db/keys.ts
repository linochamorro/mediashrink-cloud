/**
 * Convención de claves del almacén (F01-T02).
 *
 * - Job:       PK `userId`, SK `jobId` (exactamente como spec.md §4).
 * - Imagen:    PK `userId`, SK `IMAGE#<jobId>#<imageId>`, con `parentJobId`
 *              para filtrar y heredando el `ttl` del job padre.
 *
 * La partición por `userId` es la barrera de aislamiento (PR-07): ninguna
 * operación del almacén acepta un `jobId` sin su `userId` dueño.
 */

export const JOB_ITEM_TYPE = 'JOB';
export const IMAGE_ITEM_TYPE = 'IMAGE';
export const IMAGE_SK_PREFIX = 'IMAGE#';

/** Los IDs son opacos y no contienen '#': reservado para claves compuestas. */
export function assertOpaqueId(value: string, name: string): void {
  if (value.length === 0 || value.includes('#')) {
    throw new Error(`${name} debe ser un identificador opaco sin '#'`);
  }
}

export function imageSortKey(jobId: string, imageId: string): string {
  assertOpaqueId(jobId, 'jobId');
  assertOpaqueId(imageId, 'imageId');
  return `${IMAGE_SK_PREFIX}${jobId}#${imageId}`;
}

export function imageKeyPrefix(jobId: string): string {
  assertOpaqueId(jobId, 'jobId');
  return `${IMAGE_SK_PREFIX}${jobId}#`;
}
