/**
 * Puerto de listado de lotes por usuario (F02-T01).
 *
 * `JobStore` de F01 no expone `listJobs`, así que la API define este puerto
 * mínimo y su implementación DynamoDB sobre el cliente y la tabla de F01.
 * La partición por `userId` hace imposible listar lotes ajenos.
 */

import { QueryCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

import { schemas, type Job } from '../contracts/index';
import { JOB_ITEM_TYPE } from '../db/keys';

export interface JobListStore {
  listByUser(userId: string): Promise<Job[]>;
}

export interface DynamoJobListStoreOptions {
  tableName: string;
  client: DynamoDBDocumentClient;
}

/** Campos del contrato `Job`; se reutilizan al hidratar resultados de UpdateCommand. */
export const JOB_FIELDS = [
  'jobId',
  'userId',
  'status',
  'preset',
  'formats',
  'bytesBefore',
  'bytesAfter',
  'savingsPct',
  'exifStripped',
  'createdAt',
  'updatedAt',
  'ttl',
] as const;

export function createDynamoJobListStore(options: DynamoJobListStoreOptions): JobListStore {
  const { tableName, client } = options;

  return {
    async listByUser(userId: string): Promise<Job[]> {
      const jobs: Job[] = [];
      let lastKey: Record<string, unknown> | undefined;

      do {
        const result = await client.send(
          new QueryCommand({
            TableName: tableName,
            KeyConditionExpression: 'userId = :u',
            ExpressionAttributeValues: { ':u': userId },
            ExclusiveStartKey: lastKey,
          }),
        );

        for (const item of result.Items ?? []) {
          if (item.itemType !== JOB_ITEM_TYPE) continue;
          const candidate: Record<string, unknown> = {};
          for (const field of JOB_FIELDS) candidate[field] = item[field];
          jobs.push(schemas.Job.parse(candidate));
        }
        lastKey = result.LastEvaluatedKey;
      } while (lastKey !== undefined);

      return jobs.sort(
        (a, b) => a.createdAt.localeCompare(b.createdAt) || a.jobId.localeCompare(b.jobId),
      );
    },
  };
}
