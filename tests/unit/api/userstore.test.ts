import {
  GetCommand,
  PutCommand,
  TransactWriteCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import { describe, expect, it } from 'vitest';

import { AuthService } from '../../../backend/src/auth/service';
import { EmailAlreadyExistsError, type UserRecord } from '../../../backend/src/auth/user-store';
import { loadConfig } from '../../../backend/src/config/index';
import { schemas } from '../../../backend/src/contracts/index';
import {
  createDynamoUserStore,
  USER_EMAIL_SK,
  USER_PROFILE_SK,
} from '../../../backend/src/db/user-store-adapter';
import { apiTestEnv } from './fixtures';

type Item = Record<string, unknown>;

/** Doble mínimo del cliente documental: suficiente para Get/Put/TransactWrite. */
class FakeDynamoClient {
  readonly items = new Map<string, Item>();

  private keyOf(userId: string, jobId: string): string {
    return `${userId}|${jobId}`;
  }

  async send(command: unknown): Promise<{ Item?: Item }> {
    if (command instanceof GetCommand) {
      const input = command.input as { TableName?: string; Key?: Item };
      expect(input.TableName).toBe('users-test');
      if (input.Key === undefined) throw new Error('Get sin Key');
      return {
        Item: this.items.get(
          this.keyOf(String(input.Key.userId), String(input.Key.jobId)),
        ),
      };
    }

    if (command instanceof PutCommand) {
      const input = command.input as { Item?: Item };
      if (input.Item === undefined) throw new Error('Put sin Item');
      const item = input.Item;
      const key = this.keyOf(String(item.userId), String(item.jobId));
      if (typeof item.ConditionExpression === 'string' && this.items.has(key)) {
        throw { name: 'ConditionalCheckFailedException' };
      }
      this.items.set(key, item);
      return {};
    }

    if (command instanceof TransactWriteCommand) {
      const input = command.input as {
        TransactItems?: Array<{ Put?: { Item?: Item } }>;
      };
      const writes = (input.TransactItems ?? [])
        .map((entry) => entry.Put?.Item)
        .filter((item): item is Item => item !== undefined);
      const keys = writes.map((item) => this.keyOf(String(item.userId), String(item.jobId)));
      if (keys.some((key) => this.items.has(key))) {
        throw Object.assign(new Error('transacción cancelada'), {
          name: 'TransactionCanceledException',
          CancellationReasons: keys.map((key) => ({
            Code: this.items.has(key) ? 'ConditionalCheckFailed' : 'None',
          })),
        });
      }
      writes.forEach((item, index) => this.items.set(keys[index], item));
      return {};
    }

    throw new Error(`Comando no soportado por el doble: ${(command as object).constructor.name}`);
  }
}

function sampleUser(email = 'User@Example.COM'): UserRecord {
  return {
    userId: 'user_abc',
    email,
    passwordHash: 'scrypt$16384$8$1$c2FsdA$digest',
    createdAt: '2026-11-17T12:00:00.000Z',
  };
}

describe('adaptador DynamoDB de UserStore (cierra T03-A-04)', () => {
  function setup() {
    const client = new FakeDynamoClient();
    const store = createDynamoUserStore({
      tableName: 'users-test',
      client: client as unknown as DynamoDBDocumentClient,
    });
    return { client, store };
  }

  it('create guarda perfil e índice de correo con el email normalizado', async () => {
    const { client, store } = setup();
    const created = await store.create(sampleUser());

    expect(created.email).toBe('user@example.com');
    expect(created.passwordHash).toBe(sampleUser().passwordHash);
    expect(client.items.get(`user_abc|${USER_PROFILE_SK}`)).toMatchObject({
      itemType: 'USER',
      userId: 'user_abc',
      email: 'user@example.com',
    });
    expect(client.items.get(`user@example.com|${USER_EMAIL_SK}`)).toMatchObject({
      itemType: 'USER_EMAIL',
      ownerUserId: 'user_abc',
    });
  });

  it('findByEmail es insensible a mayúsculas y findById devuelve el hash', async () => {
    const { store } = setup();
    await store.create(sampleUser());

    expect(await store.findByEmail('  USER@example.com  ')).toEqual({
      userId: 'user_abc',
      email: 'user@example.com',
      passwordHash: sampleUser().passwordHash,
      createdAt: '2026-11-17T12:00:00.000Z',
    });
    expect(await store.findById('user_abc')).toEqual(await store.findByEmail('user@example.com'));
  });

  it('un correo duplicado lanza EmailAlreadyExistsError y no sobrescribe', async () => {
    const { client, store } = setup();
    await store.create(sampleUser());
    const before = client.items.size;

    await expect(store.create({ ...sampleUser(), userId: 'otro_id' })).rejects.toBeInstanceOf(
      EmailAlreadyExistsError,
    );
    expect(client.items.size).toBe(before);
    expect(client.items.get(`otro_id|${USER_PROFILE_SK}`)).toBeUndefined();
  });

  it('correo o id desconocidos devuelven null sin filtrar nada', async () => {
    const { store } = setup();
    expect(await store.findByEmail('nadie@example.com')).toBeNull();
    expect(await store.findById('no_existe')).toBeNull();
  });

  it('rechaza un perfil almacenado que no satisface el contrato congelado', async () => {
    const { client, store } = setup();
    client.items.set(`user_abc|${USER_PROFILE_SK}`, {
      itemType: 'USER',
      userId: 'user_abc',
      email: 'no-es-correo',
      createdAt: '2026-11-17T12:00:00.000Z',
      passwordHash: 'hash',
    });
    await expect(store.findById('user_abc')).rejects.toThrow();
  });

  it('AuthService registra y hace login sobre el adaptador DynamoDB', async () => {
    const { store } = setup();
    const config = loadConfig(apiTestEnv());
    const service = new AuthService({ config, users: store });

    const registered = await service.register({ email: 'demo@example.com', password: 'Segura1234' });
    expect(schemas.AuthenticatedUser.parse(registered.user)).toMatchObject({
      email: 'demo@example.com',
    });

    const loggedIn = await service.login({ email: 'DEMO@example.com', password: 'Segura1234' });
    expect(loggedIn.user.userId).toBe(registered.user.userId);
    await expect(
      service.login({ email: 'demo@example.com', password: 'Incorrecta123' }),
    ).rejects.toThrow();
  });
});
