/**
 * Transiciones atómicas de estado del lote (addendum A-01/A-02 de F02-T01).
 *
 * Capa API, no `backend/src/db/job-store.ts`: ese módulo pertenece a F01 y su
 * `updateJob` solo condiciona la existencia de la clave, por lo que dos
 * confirmaciones concurrentes podían publicar dos mensajes. Aquí se usa la
 * fábrica de cliente documental exportada por `backend/src/db/index.ts` y una
 * escritura condicional sobre `#status` para que solo un ganador publicue.
 */

import { UpdateCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

import { schemas, type Job, type JobStatus } from '../contracts/index';
import { JOB_FIELDS } from './job-list-store';

export class JobAlreadyConfirmedError extends Error {
  constructor() {
    super('El lote ya fue confirmado por otra petición');
    this.name = 'JobAlreadyConfirmedError';
  }
}

export class JobStateConflictError extends Error {
  constructor() {
    super('El lote cambió de estado durante la confirmación');
    this.name = 'JobStateConflictError';
  }
}

export interface JobTransitionStore {
  /** PENDING → PROCESSING. Lanza `JobAlreadyConfirmedError` si otro ganó. */
  confirmPending(userId: string, jobId: string, updatedAt: string): Promise<Job>;
  /** PROCESSING → PENDING. Lanza `JobStateConflictError` si el estado cambió. */
  revertToPending(userId: string, jobId: string, updatedAt: string): Promise<Job>;
}

export interface DynamoJobTransitionStoreOptions {
  tableName: string;
  client: DynamoDBDocumentClient;
}

function isConditionalFailure(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: string }).name === 'ConditionalCheckFailedException'
  );
}

function parseUpdatedJob(attributes: Record<string, unknown> | undefined): Job {
  const candidate: Record<string, unknown> = {};
  for (const field of JOB_FIELDS) {
    if (attributes?.[field] !== undefined) candidate[field] = attributes[field];
  }
  return schemas.Job.parse(candidate);
}

export function createDynamoJobTransitionStore(
  options: DynamoJobTransitionStoreOptions,
): JobTransitionStore {
  const { tableName, client } = options;

  async function transition(
    userId: string,
    jobId: string,
    from: JobStatus,
    to: JobStatus,
    updatedAt: string,
    onConflict: () => Error,
  ): Promise<Job> {
    try {
      const result = await client.send(
        new UpdateCommand({
          TableName: tableName,
          Key: { userId, jobId },
          UpdateExpression: 'SET #status = :to, #updatedAt = :updatedAt',
          ConditionExpression: '#status = :from',
          ExpressionAttributeNames: { '#status': 'status', '#updatedAt': 'updatedAt' },
          ExpressionAttributeValues: { ':from': from, ':to': to, ':updatedAt': updatedAt },
          ReturnValues: 'ALL_NEW',
        }),
      );
      return parseUpdatedJob(result.Attributes);
    } catch (error) {
      if (isConditionalFailure(error)) throw onConflict();
      throw error;
    }
  }

  return {
    confirmPending: (userId, jobId, updatedAt) =>
      transition(userId, jobId, 'PENDING', 'PROCESSING', updatedAt, () => new JobAlreadyConfirmedError()),
    revertToPending: (userId, jobId, updatedAt) =>
      transition(userId, jobId, 'PROCESSING', 'PENDING', updatedAt, () => new JobStateConflictError()),
  };
}
