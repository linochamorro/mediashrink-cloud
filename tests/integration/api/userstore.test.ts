import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { GetCommand } from '@aws-sdk/lib-dynamodb';

import { EmailAlreadyExistsError } from '../../../backend/src/auth/user-store';
import {
  createDynamoUserStore,
  USER_EMAIL_SK,
  USER_PROFILE_SK,
} from '../../../backend/src/db/user-store-adapter';
import { createTestTable, type TestTable } from '../db/table-fixture';
import type { UserStore } from '../../../backend/src/auth/user-store';

describe('adaptador UserStore contra DynamoDB real (T03-A-04)', () => {
  let table: TestTable;
  let users: UserStore;

  beforeAll(async () => {
    table = await createTestTable('api-userstore');
    users = createDynamoUserStore({ tableName: table.tableName, client: table.documentClient });
  });

  afterAll(async () => {
    if (table !== undefined) await table.dispose();
  });

  it('create/findByEmail/findById funcionan sobre la tabla aislada', async () => {
    const created = await users.create({
      userId: 'user_integration_1',
      email: 'User.Integration@Example.COM',
      passwordHash: 'scrypt$16384$8$1$c2FsdA$digest',
      createdAt: '2026-11-17T12:00:00.000Z',
    });

    expect(created.email).toBe('user.integration@example.com');
    expect(await users.findByEmail('USER.INTEGRATION@example.com')).toEqual(created);
    expect(await users.findById('user_integration_1')).toEqual(created);

    const profile = await table.documentClient.send(
      new GetCommand({
        TableName: table.tableName,
        Key: { userId: 'user_integration_1', jobId: USER_PROFILE_SK },
      }),
    );
    expect(profile.Item).toMatchObject({ itemType: 'USER', email: created.email });

    const index = await table.documentClient.send(
      new GetCommand({
        TableName: table.tableName,
        Key: { userId: created.email, jobId: USER_EMAIL_SK },
      }),
    );
    expect(index.Item).toMatchObject({ ownerUserId: created.userId });
  });

  it('un correo duplicado se rechaza de forma atómica', async () => {
    await expect(
      users.create({
        userId: 'user_integration_2',
        email: 'user.integration@example.com',
        passwordHash: 'scrypt$16384$8$1$c2FsdA$digest',
        createdAt: '2026-11-17T12:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(EmailAlreadyExistsError);

    expect(await users.findById('user_integration_2')).toBeNull();
  });

  it('un correo y un id inexistentes devuelven null', async () => {
    expect(await users.findByEmail('nadie@example.com')).toBeNull();
    expect(await users.findById('no_existe')).toBeNull();
  });
});
