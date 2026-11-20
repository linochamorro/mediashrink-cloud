/**
 * Almacén de jobs en DynamoDB (F01-T02, fase GREEN).
 *
 * Contrato congelado: `schemas.Job` y `schemas.ImageRecord` validan toda
 * escritura, de modo que el TTL y la coherencia de métricas no se puedan
 * falsear desde la capa de persistencia. El `userId` siempre forma parte de
 * la clave: un usuario ajeno solo obtiene "no encontrado".
 */

import {
  BatchWriteCommand,
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';

import { schemas, type ImageRecord, type Job } from '../contracts/index';
import {
  ImageNotFoundError,
  JobAlreadyExistsError,
  JobNotFoundError,
} from './errors';
import {
  IMAGE_ITEM_TYPE,
  JOB_ITEM_TYPE,
  assertOpaqueId,
  imageKeyPrefix,
  imageSortKey,
} from './keys';
import type { ImagePatch, JobPatch, JobStore } from './types';

interface JobStoreOptions {
  tableName: string;
  client: DynamoDBDocumentClient;
}

type StoredItem = Record<string, unknown>;

function isConditionalCheckFailure(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: string }).name === 'ConditionalCheckFailedException'
  );
}

/** Un `undefined` explícito en un patch no debe borrar el valor almacenado. */
function withoutUndefined<T extends object>(patch: T): Partial<T> {
  return Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)) as Partial<T>;
}

function parseStoredJob(item: StoredItem | undefined): Job | null {
  if (item === undefined || item.itemType !== JOB_ITEM_TYPE) return null;
  const job: Record<string, unknown> = {};
  for (const key of [
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
  ]) {
    job[key] = item[key];
  }
  // UX-02: el nombre es opcional y retrocompatible con lotes antiguos/seed.
  if (typeof item.name === 'string' && item.name.trim() !== '') job.name = item.name;
  return schemas.Job.parse(job);
}

function parseStoredImage(item: StoredItem): ImageRecord {
  const image: Record<string, unknown> = {
    imageId: item.imageId,
    status: item.status,
    exifStripped: item.exifStripped,
  };
  for (const key of ['bytesBefore', 'bytesAfter', 'failureReason'] as const) {
    if (item[key] !== undefined) image[key] = item[key];
  }
  return schemas.ImageRecord.parse(image);
}

function imageItem(userId: string, jobId: string, image: ImageRecord, ttl: number): StoredItem {
  return {
    userId,
    jobId: imageSortKey(jobId, image.imageId),
    itemType: IMAGE_ITEM_TYPE,
    parentJobId: jobId,
    ...image,
    // El hijo expira con el padre: misma retención de 30 días (IN-09).
    ttl,
  };
}

function buildUpdate(
  values: Record<string, unknown>,
): Pick<UpdateExpressionParts, 'UpdateExpression' | 'ExpressionAttributeNames' | 'ExpressionAttributeValues'> {
  const names: Record<string, string> = {};
  const attributeValues: Record<string, unknown> = {};
  const assignments: string[] = [];
  for (const [key, value] of Object.entries(values)) {
    const name = `#${key}`;
    names[name] = key;
    attributeValues[`:${key}`] = value;
    assignments.push(`${name} = :${key}`);
  }
  return {
    UpdateExpression: `SET ${assignments.join(', ')}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: attributeValues,
  };
}

/** Subtipo mínimo para no acoplar el constructor de expresiones al SDK. */
type UpdateExpressionParts = {
  UpdateExpression?: string;
  ExpressionAttributeNames?: Record<string, string>;
  ExpressionAttributeValues?: Record<string, unknown>;
};

export function createJobStore(options: JobStoreOptions): JobStore {
  const { tableName, client } = options;

  async function getJob(userId: string, jobId: string): Promise<Job | null> {
    assertOpaqueId(userId, 'userId');
    assertOpaqueId(jobId, 'jobId');
    const result = await client.send(
      new GetCommand({ TableName: tableName, Key: { userId, jobId } }),
    );
    return parseStoredJob(result.Item);
  }

  async function listImages(userId: string, jobId: string): Promise<ImageRecord[]> {
    assertOpaqueId(userId, 'userId');
    const result = await client.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: 'userId = :u AND begins_with(jobId, :p)',
        ExpressionAttributeValues: { ':u': userId, ':p': imageKeyPrefix(jobId) },
      }),
    );
    return (result.Items ?? [])
      .filter(
        (item) => item.itemType === IMAGE_ITEM_TYPE && item.parentJobId === jobId,
      )
      .map(parseStoredImage);
  }

  async function getImage(
    userId: string,
    jobId: string,
    imageId: string,
  ): Promise<ImageRecord | null> {
    assertOpaqueId(userId, 'userId');
    const result = await client.send(
      new GetCommand({
        TableName: tableName,
        Key: { userId, jobId: imageSortKey(jobId, imageId) },
      }),
    );
    const item = result.Item;
    if (
      item === undefined ||
      item.itemType !== IMAGE_ITEM_TYPE ||
      item.parentJobId !== jobId ||
      typeof item.imageId !== 'string'
    ) {
      return null;
    }
    return parseStoredImage(item);
  }

  async function deleteImages(userId: string, jobId: string): Promise<void> {
    const pages: StoredItem[] = [];
    let lastKey: Record<string, unknown> | undefined;
    do {
      const result = await client.send(
        new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: 'userId = :u AND begins_with(jobId, :p)',
          ProjectionExpression: 'userId, jobId',
          ExpressionAttributeValues: { ':u': userId, ':p': imageKeyPrefix(jobId) },
          ExclusiveStartKey: lastKey,
        }),
      );
      pages.push(...(result.Items ?? []));
      lastKey = result.LastEvaluatedKey;
    } while (lastKey !== undefined);

    for (let index = 0; index < pages.length; index += 25) {
      await client.send(
        new BatchWriteCommand({
          RequestItems: {
            [tableName]: pages
              .slice(index, index + 25)
              .map((item) => ({ DeleteRequest: { Key: { userId: item.userId, jobId: item.jobId } } })),
          },
        }),
      );
    }
  }

  return {
    async createJob(job: Job): Promise<Job> {
      const parsed = schemas.Job.parse(job);
      assertOpaqueId(parsed.userId, 'userId');
      assertOpaqueId(parsed.jobId, 'jobId');
      try {
        await client.send(
          new PutCommand({
            TableName: tableName,
            Item: { ...parsed, itemType: JOB_ITEM_TYPE },
            ConditionExpression: 'attribute_not_exists(userId) AND attribute_not_exists(jobId)',
          }),
        );
      } catch (error) {
        if (isConditionalCheckFailure(error)) {
          throw new JobAlreadyExistsError(parsed.userId, parsed.jobId);
        }
        throw error;
      }
      return parsed;
    },

    getJob,

    async updateJob(userId: string, jobId: string, patch: JobPatch): Promise<Job> {
      const current = await getJob(userId, jobId);
      if (current === null) throw new JobNotFoundError(userId, jobId);

      const next: Job = {
        ...current,
        ...withoutUndefined(patch),
        updatedAt: patch.updatedAt ?? new Date().toISOString(),
      };
      const parsed = schemas.Job.parse(next);
      const mutable: Record<string, unknown> = { ...parsed };
      delete mutable.userId;
      delete mutable.jobId;

      await client.send(
        new UpdateCommand({
          TableName: tableName,
          Key: { userId, jobId },
          ...buildUpdate(mutable),
          ConditionExpression: 'attribute_exists(userId) AND attribute_exists(jobId)',
        }),
      );
      return parsed;
    },

    async deleteJob(userId: string, jobId: string): Promise<void> {
      if ((await getJob(userId, jobId)) === null) throw new JobNotFoundError(userId, jobId);
      await client.send(new DeleteCommand({ TableName: tableName, Key: { userId, jobId } }));
    },

    async putImage(userId: string, jobId: string, image: ImageRecord): Promise<ImageRecord> {
      const parsed = schemas.ImageRecord.parse(image);
      const parent = await getJob(userId, jobId);
      if (parent === null) throw new JobNotFoundError(userId, jobId);

      await client.send(
        new PutCommand({
          TableName: tableName,
          Item: imageItem(userId, jobId, parsed, parent.ttl),
          ConditionExpression: 'attribute_not_exists(userId) AND attribute_not_exists(jobId)',
        }),
      );
      return parsed;
    },

    getImage,

    listImages,

    async updateImage(
      userId: string,
      jobId: string,
      imageId: string,
      patch: ImagePatch,
    ): Promise<ImageRecord> {
      // Comprobar primero el job: un userId ajeno recibe "job no encontrado"
      // y no puede sondear la existencia de imágenes de otro usuario.
      const parent = await getJob(userId, jobId);
      if (parent === null) throw new JobNotFoundError(userId, jobId);
      const current = await getImage(userId, jobId, imageId);
      if (current === null) throw new ImageNotFoundError(userId, jobId, imageId);
      const parsed = schemas.ImageRecord.parse({ ...current, ...withoutUndefined(patch) });

      await client.send(
        new PutCommand({
          TableName: tableName,
          Item: imageItem(userId, jobId, parsed, parent.ttl),
          ConditionExpression: 'attribute_exists(userId) AND attribute_exists(jobId)',
        }),
      );
      return parsed;
    },

    deleteImages,

    async deleteJobWithImages(userId: string, jobId: string): Promise<void> {
      if ((await getJob(userId, jobId)) === null) throw new JobNotFoundError(userId, jobId);
      await deleteImages(userId, jobId);
      await client.send(new DeleteCommand({ TableName: tableName, Key: { userId, jobId } }));
    },
  };
}
