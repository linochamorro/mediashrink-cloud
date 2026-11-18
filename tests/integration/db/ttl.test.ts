/** F01-T02 — TTL de 30 días: configuración de tabla, atributo y herencia (CA-02). */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DescribeTimeToLiveCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { GetCommand } from '@aws-sdk/lib-dynamodb';

import {
  computeTtl,
  RETENTION_DAYS,
  schemas,
  TTL_SECONDS,
} from '../../../backend/src/contracts/index';
import { createJobStore, type JobStore } from '../../../backend/src/db/index';
import { FIXED_CREATED_AT, makeImage, makeJob } from './factories';
import { createTestTable, type TestTable } from './table-fixture';

describe('F01-T02 — TTL de 30 días (IN-09)', () => {
  let table: TestTable;
  let store: JobStore;

  beforeAll(async () => {
    table = await createTestTable('ttl');
    store = createJobStore({ tableName: table.tableName, client: table.documentClient });
  });

  afterAll(async () => {
    await table?.dispose();
  });

  it('usa la retención congelada de 30 días (2.592.000 segundos)', () => {
    expect(RETENTION_DAYS).toBe(30);
    expect(TTL_SECONDS).toBe(2_592_000);
    expect(computeTtl(FIXED_CREATED_AT)).toBe(
      Math.floor(Date.parse(FIXED_CREATED_AT) / 1000) + TTL_SECONDS,
    );
  });

  it('la tabla aislada tiene TTL habilitado sobre el atributo ttl', async () => {
    const result = await table.rawClient.send(
      new DescribeTimeToLiveCommand({ TableName: table.tableName }),
    );

    expect(result.TimeToLiveDescription?.TimeToLiveStatus).toBe('ENABLED');
    expect(result.TimeToLiveDescription?.AttributeName).toBe('ttl');
  });

  it('el job almacenado lleva ttl = createdAt + 30 días en segundos Unix', async () => {
    const job = makeJob();
    await store.createJob(job);

    const raw = await table.documentClient.send(
      new GetCommand({ TableName: table.tableName, Key: { userId: job.userId, jobId: job.jobId } }),
    );

    expect(raw.Item?.ttl).toBe(computeTtl(job.createdAt));
    expect(Number.isInteger(raw.Item?.ttl)).toBe(true);
  });

  it('los ítems hijo heredan el TTL del job padre', async () => {
    const job = makeJob();
    await store.createJob(job);
    await store.putImage(job.userId, job.jobId, makeImage({ imageId: 'img-ttl' }));

    const raw = await table.rawClient.send(
      new QueryCommand({
        TableName: table.tableName,
        KeyConditionExpression: 'userId = :u',
        FilterExpression: 'parentJobId = :j',
        ExpressionAttributeValues: { ':u': { S: job.userId }, ':j': { S: job.jobId } },
      }),
    );

    expect(raw.Items).toHaveLength(1);
    expect(Number(raw.Items?.[0]?.ttl?.N)).toBe(computeTtl(job.createdAt));
  });

  it('rechaza un ttl incoherente usando el contrato congelado', () => {
    const job = makeJob();

    expect(() => schemas.Job.parse({ ...job, ttl: 60 })).toThrow();
  });
});
