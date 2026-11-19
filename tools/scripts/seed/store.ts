/**
 * Persistencia del seed en DynamoDB (F01-T04; F05-H01: tabla de producto).
 *
 * Los datos se escriben con el cliente documental de F01-T02
 * (`createDynamoDbDocumentClientFromConfig`), sin redefinirlo. Las únicas
 * operaciones de bajo nivel son DDL/ conteo (CreateTable, DescribeTable,
 * Scan...), que no forman parte de la API del almacén de T02.
 *
 * F05-H01: el seed escribe en la MISMA tabla que la app
 * (`DYNAMODB_TABLE_JOBS`, default `mediashrink-jobs` según `.env.example` y
 * `infra/terraform/dynamodb.tf`). La tabla efímera propia de F01 se retiró:
 * `ensureSeedTable` respeta la tabla existente y solo crea la ausente.
 */

import {
  CreateTableCommand,
  DeleteTableCommand,
  DescribeTableCommand,
  DescribeTimeToLiveCommand,
  ScanCommand,
  UpdateTimeToLiveCommand,
} from '@aws-sdk/client-dynamodb';
import {
  GetCommand,
  PutCommand,
  TransactWriteCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';

import { normalizeEmail } from '../../../backend/src/auth/identity';
import { computeTtl } from '../../../backend/src/contracts/index';
import type { DemoUserSpec } from './demo-data';

/** Clave de ordenación reservada al perfil de un usuario demo (no colisiona con JOB/IMAGE). */
export const USER_SORT_KEY = 'USER#PROFILE';
export const USER_ITEM_TYPE = 'USER';
/**
 * Índice por correo del seed: MISMA forma que `createDynamoUserStore`
 * (`backend/src/db/user-store-adapter.ts:111-123`): PK = correo normalizado,
 * SK `USER#EMAIL`, `itemType` `USER_EMAIL`, `ownerUserId` al perfil. Sin `ttl`:
 * el adaptador no lo escribe en el índice y las cuentas no expiran.
 */
export const USER_EMAIL_SORT_KEY = 'USER#EMAIL';
export const USER_EMAIL_ITEM_TYPE = 'USER_EMAIL';
const NO_CONDITION = 'attribute_not_exists(userId) AND attribute_not_exists(jobId)';
export const JOB_ITEM_TYPE = 'JOB';
export const IMAGE_ITEM_TYPE = 'IMAGE';

export interface ItemCounts {
  users: number;
  jobs: number;
  images: number;
  total: number;
}

export interface SeedUserRecord {
  userId: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

/** Los comandos DDL no son `DocumentClientCommand`: se envían por el stack base. */
async function sendLowLevel<T>(client: DynamoDBDocumentClient, command: unknown): Promise<T> {
  return (client as unknown as { send(c: unknown): Promise<T> }).send(command);
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: string }).name === 'ResourceNotFoundException'
  );
}

function isConditionalCheckFailure(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: string }).name === 'ConditionalCheckFailedException'
  );
}

function isTransactionConditionalFailure(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as {
    name?: string;
    CancellationReasons?: ReadonlyArray<{ Code?: string }>;
  };
  if (candidate.name !== 'TransactionCanceledException') return false;
  return (candidate.CancellationReasons ?? []).some((reason) => reason.Code === 'ConditionalCheckFailed');
}

/** Crea el índice por correo solo si no existe. Seguro si ya estaba. */
async function putEmailIndexIfAbsent(
  client: DynamoDBDocumentClient,
  tableName: string,
  email: string,
  ownerUserId: string,
): Promise<void> {
  try {
    await client.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          userId: email,
          jobId: USER_EMAIL_SORT_KEY,
          itemType: USER_EMAIL_ITEM_TYPE,
          ownerUserId,
          email,
        },
        ConditionExpression: NO_CONDITION,
      }),
    );
  } catch (error) {
    if (isConditionalCheckFailure(error)) return;
    throw error;
  }
}
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Asegura la tabla destino del seed. Idempotente:
 * - Si la tabla YA existe (p. ej. la creada por Terraform con billing
 *   `PROVISIONED` y TTL sobre `ttl`), devuelve `false` SIN modificar su
 *   facturación, sus claves ni su especificación TTL: la respeta tal cual.
 * - Si NO existe (p. ej. tablas de prueba `…-idem` / `…-dbcheck`), la crea con
 *   el mismo esquema de claves (`userId` HASH + `jobId` RANGE) y TTL sobre
 *   `ttl`, y devuelve `true`.
 */
export async function ensureSeedTable(client: DynamoDBDocumentClient, tableName: string): Promise<boolean> {
  try {
    await sendLowLevel(client, new DescribeTableCommand({ TableName: tableName }));
    return false;
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }

  await sendLowLevel(
    client,
    new CreateTableCommand({
      TableName: tableName,
      BillingMode: 'PAY_PER_REQUEST',
      AttributeDefinitions: [
        { AttributeName: 'userId', AttributeType: 'S' },
        { AttributeName: 'jobId', AttributeType: 'S' },
      ],
      KeySchema: [
        { AttributeName: 'userId', KeyType: 'HASH' },
        { AttributeName: 'jobId', KeyType: 'RANGE' },
      ],
    }),
  );

  const activeDeadline = Date.now() + 30_000;
  while (Date.now() < activeDeadline) {
    const described = await sendLowLevel<{ Table?: { TableStatus?: string } }>(
      client,
      new DescribeTableCommand({ TableName: tableName }),
    );
    if (described.Table?.TableStatus === 'ACTIVE') break;
    await delay(150);
  }

  await sendLowLevel(
    client,
    new UpdateTimeToLiveCommand({
      TableName: tableName,
      TimeToLiveSpecification: { AttributeName: 'ttl', Enabled: true },
    }),
  );
  const ttlDeadline = Date.now() + 30_000;
  while (Date.now() < ttlDeadline) {
    const described = await sendLowLevel<{
      TimeToLiveDescription?: { TimeToLiveStatus?: string };
    }>(client, new DescribeTimeToLiveCommand({ TableName: tableName }));
    if (described.TimeToLiveDescription?.TimeToLiveStatus === 'ENABLED') break;
    await delay(150);
  }

  return true;
}

/** Elimina una tabla de prueba del seed. Seguro si ya no existe. */
export async function dropSeedTable(client: DynamoDBDocumentClient, tableName: string): Promise<void> {
  try {
    await sendLowLevel(client, new DeleteTableCommand({ TableName: tableName }));
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }
}

async function countByType(client: DynamoDBDocumentClient, tableName: string, itemType: string): Promise<number> {
  const result = await sendLowLevel<{ Count?: number }>(
    client,
    new ScanCommand({
      TableName: tableName,
      Select: 'COUNT',
      FilterExpression: 'itemType = :t',
      ExpressionAttributeValues: { ':t': { S: itemType } },
      ConsistentRead: true,
    }),
  );
  return result.Count ?? 0;
}

/** Conteo independiente en el emulador, útil como evidencia de idempotencia. */
export async function countAllItems(client: DynamoDBDocumentClient, tableName: string): Promise<ItemCounts> {
  const [users, jobs, images] = await Promise.all([
    countByType(client, tableName, USER_ITEM_TYPE),
    countByType(client, tableName, JOB_ITEM_TYPE),
    countByType(client, tableName, IMAGE_ITEM_TYPE),
  ]);
  return { users, jobs, images, total: users + jobs + images };
}

export async function readSeedUser(
  client: DynamoDBDocumentClient,
  tableName: string,
  userId: string,
): Promise<SeedUserRecord | null> {
  const result = await client.send(
    new GetCommand({ TableName: tableName, Key: { userId, jobId: USER_SORT_KEY } }),
  );
  const item = result.Item;
  if (item === undefined || item.itemType !== USER_ITEM_TYPE) return null;
  return {
    userId: String(item.userId),
    email: String(item.email),
    passwordHash: String(item.passwordHash),
    createdAt: String(item.createdAt),
  };
}

/**
 * Inserta el usuario demo (perfil + índice por correo) solo si no existe.
 * `false` = ya estaba. Escritura atómica con `TransactWrite` condicional,
 * igual que `createDynamoUserStore.create`: el login (`findByEmail`) exige
 * el índice `{correo, USER#EMAIL}`. Si el perfil ya existía —re-seed o estado
 * legado del loop 1 (perfil sin índice)—, se asegura el índice y se
 * devuelve `false`: el índice queda consistente sin duplicar nada.
 */
export async function putUserIfAbsent(
  client: DynamoDBDocumentClient,
  tableName: string,
  user: DemoUserSpec,
  passwordHash: string,
  createdAt: string,
): Promise<boolean> {
  const email = normalizeEmail(user.email);
  try {
    await client.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: tableName,
              Item: {
                userId: user.userId,
                jobId: USER_SORT_KEY,
                itemType: USER_ITEM_TYPE,
                displayName: user.displayName,
                email,
                passwordHash,
                createdAt,
                ttl: computeTtl(createdAt),
              },
              ConditionExpression: NO_CONDITION,
            },
          },
          {
            Put: {
              TableName: tableName,
              Item: {
                userId: email,
                jobId: USER_EMAIL_SORT_KEY,
                itemType: USER_EMAIL_ITEM_TYPE,
                ownerUserId: user.userId,
                email,
              },
              ConditionExpression: NO_CONDITION,
            },
          },
        ],
      }),
    );
    return true;
  } catch (error) {
    if (!isTransactionConditionalFailure(error)) throw error;
    await putEmailIndexIfAbsent(client, tableName, email, user.userId);
    return false;
  }
}
