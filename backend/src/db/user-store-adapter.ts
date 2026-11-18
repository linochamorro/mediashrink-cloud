/**
 * Adaptador DynamoDB de `UserStore` (cierra T03-A-04).
 *
 * Archivo nuevo: no se modifica ningún otro módulo de `backend/src/db/**`.
 * Convivencia con los jobs en la misma tabla (PK `userId`, SK `jobId`):
 * - perfil:  SK `USER#PROFILE`, PK = userId real;
 * - índice:  SK `USER#EMAIL`,   PK = correo normalizado, apunta al userId.
 * Los prefijos `USER#` no colisionan con `IMAGE#` ni con jobIds opacos.
 * La unicidad del correo se garantiza con un TransactWrite condicional.
 */

import {
  GetCommand,
  TransactWriteCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';

import { normalizeEmail } from '../auth/identity';
import {
  EmailAlreadyExistsError,
  type NewUser,
  type UserRecord,
  type UserStore,
} from '../auth/user-store';
import { schemas } from '../contracts/index';

export const USER_PROFILE_SK = 'USER#PROFILE';
export const USER_EMAIL_SK = 'USER#EMAIL';

const USER_ITEM_TYPE = 'USER';
const USER_EMAIL_ITEM_TYPE = 'USER_EMAIL';
const NO_CONDITION = 'attribute_not_exists(userId) AND attribute_not_exists(jobId)';

export interface DynamoUserStoreOptions {
  tableName: string;
  client: DynamoDBDocumentClient;
}

type StoredItem = Record<string, unknown>;

/** Lee un perfil y lo valida contra el contrato congelado `AuthenticatedUser`. */
function parseStoredUser(item: StoredItem | undefined): UserRecord | null {
  if (item === undefined || item.itemType !== USER_ITEM_TYPE) return null;

  const publicUser = schemas.AuthenticatedUser.parse({
    userId: item.userId,
    email: item.email,
    createdAt: item.createdAt,
  });
  const passwordHash = item.passwordHash;
  if (typeof passwordHash !== 'string' || passwordHash.length === 0) {
    throw new Error('passwordHash almacenado no válido');
  }
  return { ...publicUser, passwordHash };
}

function isEmailConflict(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as {
    name?: string;
    CancellationReasons?: ReadonlyArray<{ Code?: string }>;
  };
  if (candidate.name !== 'TransactionCanceledException') return false;
  return (candidate.CancellationReasons ?? []).some(
    (reason) => reason.Code === 'ConditionalCheckFailed',
  );
}

export function createDynamoUserStore(options: DynamoUserStoreOptions): UserStore {
  const { tableName, client } = options;

  async function findById(userId: string): Promise<UserRecord | null> {
    const result = await client.send(
      new GetCommand({
        TableName: tableName,
        Key: { userId, jobId: USER_PROFILE_SK },
      }),
    );
    return parseStoredUser(result.Item);
  }

  return {
    async create(user: NewUser): Promise<UserRecord> {
      const publicUser = schemas.AuthenticatedUser.parse({
        userId: user.userId,
        email: normalizeEmail(user.email),
        createdAt: user.createdAt,
      });
      if (typeof user.passwordHash !== 'string' || user.passwordHash.length === 0) {
        throw new Error('passwordHash es obligatorio');
      }
      const email = normalizeEmail(publicUser.email);

      try {
        await client.send(
          new TransactWriteCommand({
            TransactItems: [
              {
                Put: {
                  TableName: tableName,
                  Item: {
                    ...publicUser,
                    jobId: USER_PROFILE_SK,
                    itemType: USER_ITEM_TYPE,
                    email,
                    passwordHash: user.passwordHash,
                  },
                  ConditionExpression: NO_CONDITION,
                },
              },
              {
                Put: {
                  TableName: tableName,
                  Item: {
                    userId: email,
                    jobId: USER_EMAIL_SK,
                    itemType: USER_EMAIL_ITEM_TYPE,
                    ownerUserId: publicUser.userId,
                    email,
                  },
                  ConditionExpression: NO_CONDITION,
                },
              },
            ],
          }),
        );
      } catch (error) {
        if (isEmailConflict(error)) throw new EmailAlreadyExistsError();
        throw error;
      }

      return { ...publicUser, email, passwordHash: user.passwordHash };
    },

    async findByEmail(email: string): Promise<UserRecord | null> {
      const normalized = normalizeEmail(email);
      const result = await client.send(
        new GetCommand({
          TableName: tableName,
          Key: { userId: normalized, jobId: USER_EMAIL_SK },
        }),
      );
      const index = result.Item;
      if (
        index === undefined ||
        index.itemType !== USER_EMAIL_ITEM_TYPE ||
        typeof index.ownerUserId !== 'string'
      ) {
        return null;
      }
      return findById(index.ownerUserId);
    },

    findById,
  };
}
