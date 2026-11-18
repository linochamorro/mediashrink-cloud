/**
 * Contrato de publicación SQS del lote confirmado (F02-T01).
 *
 * La implementación real (cliente SQS + DLQ) pertenece a F02-T04. Esta tarea
 * solo fija el puerto inyectable para que `POST /jobs/:id/confirm` pueda
 * publicar después de la transición de estado sin simular SQS en producto.
 */

/** Mensaje mínimo de encolado; T04 puede enriquecerlo de forma retrocompatible. */
export interface JobConfirmationMessage {
  readonly userId: string;
  readonly jobId: string;
}

export interface JobQueuePublisher {
  publish(message: JobConfirmationMessage): Promise<void>;
}

export class PublisherNotConfiguredError extends Error {
  constructor() {
    super('Publicador SQS no configurado');
    this.name = 'PublisherNotConfiguredError';
  }
}
