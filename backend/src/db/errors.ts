/**
 * Errores de la capa de persistencia de MediaShrink Cloud (F01-T02).
 *
 * Un acceso con un `userId` distinto al dueño se trata como "no encontrado":
 * la capa nunca revela si el lote existe para otro usuario (PR-07, spec §6).
 */

export class JobNotFoundError extends Error {
  constructor(userId: string, jobId: string) {
    super(`Job no encontrado para userId=${userId} jobId=${jobId}`);
    this.name = 'JobNotFoundError';
  }
}

export class ImageNotFoundError extends Error {
  constructor(userId: string, jobId: string, imageId: string) {
    super(`Imagen no encontrada para userId=${userId} jobId=${jobId} imageId=${imageId}`);
    this.name = 'ImageNotFoundError';
  }
}

export class JobAlreadyExistsError extends Error {
  constructor(userId: string, jobId: string) {
    super(`El job ya existe para userId=${userId} jobId=${jobId}`);
    this.name = 'JobAlreadyExistsError';
  }
}
