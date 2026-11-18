/**
 * F04-T05 — CA-05. Recursos reales aprovisionados por `terraform apply` en
 * `aws/aws-emulator`: buckets + lifecycle + CORS, SQS + DLQ + redrive numérico,
 * DynamoDB + TTL y política IAM derivada de esos recursos.
 */

import { afterAll, describe, expect, it } from 'vitest';

import {
  CORS_ORIGIN,
  DLQ_QUEUE,
  EXPECTED_RETENTION_DAYS,
  JOBS_QUEUE,
  JOBS_TABLE,
  OPTIMIZED_BUCKET,
  RAW_BUCKET,
  asList,
  canonicalQueueUrl,
  createDynamoDB,
  createS3,
  createSQS,
  getQueueArn,
  readTerraformOutputs,
  tfValue,
  DescribeTableCommand,
  DescribeTimeToLiveCommand,
  GetBucketCorsCommand,
  GetBucketLifecycleConfigurationCommand,
  GetBucketNotificationConfigurationCommand,
  GetQueueAttributesCommand,
  ListBucketsCommand,
  ListQueuesCommand,
} from './emulator';

const s3 = createS3();
const sqs = createSQS();
const ddb = createDynamoDB();

afterAll(() => {
  s3.destroy();
  sqs.destroy();
  ddb.destroy();
});

describe('infra aplicada contra aws/aws-emulator', () => {
  it('aprovisiona ambos buckets con ciclo de vida de 30 días, CORS explícito y sin bucles de eventos', async () => {
    const listed = await s3.send(new ListBucketsCommand({}));
    const names = (listed.Buckets ?? []).map((bucket) => bucket.Name ?? '');
    expect(names).toContain(RAW_BUCKET);
    expect(names).toContain(OPTIMIZED_BUCKET);

    for (const bucket of [RAW_BUCKET, OPTIMIZED_BUCKET]) {
      const lifecycle = await s3.send(
        new GetBucketLifecycleConfigurationCommand({ Bucket: bucket }),
      );
      const enabled = (lifecycle.Rules ?? []).filter((rule) => rule.Status === 'Enabled');
      expect(enabled.length, `${bucket}: regla de ciclo de vida habilitada`).toBeGreaterThan(0);
      for (const rule of enabled) {
        expect(rule.Expiration?.Days, `${bucket}: días de expiración`).toBe(
          EXPECTED_RETENTION_DAYS,
        );
      }

      const cors = await s3.send(new GetBucketCorsCommand({ Bucket: bucket }));
      const rules = cors.CORSRules ?? [];
      expect(rules.length, `${bucket}: reglas CORS`).toBeGreaterThan(0);
      for (const rule of rules) {
        expect(rule.AllowedOrigins).toEqual([CORS_ORIGIN]);
        expect((rule.AllowedMethods ?? []).slice().sort()).toEqual(['GET', 'PUT']);
        expect(rule.AllowedHeaders ?? []).not.toContain('*');
        expect(rule.AllowedHeaders ?? []).not.toHaveLength(0);
      }

      const notifications = await s3.send(
        new GetBucketNotificationConfigurationCommand({ Bucket: bucket }),
      );
      // SDK 3.1171 tipa solo Queue/Topic en la salida; el emulador puede
      // devolver además estas claves heredadas. Se leen con una vista
      // estructural para conservar la aserción sin debilitarla.
      const legacyNotifications = notifications as typeof notifications & {
        EventConfigurations?: Record<string, unknown>;
        LambdaConfigurations?: readonly unknown[];
      };
      expect(Object.keys(legacyNotifications.EventConfigurations ?? {})).toHaveLength(0);
      expect(legacyNotifications.LambdaConfigurations ?? []).toHaveLength(0);
      expect(notifications.TopicConfigurations ?? []).toHaveLength(0);
      expect(notifications.QueueConfigurations ?? []).toHaveLength(0);
    }
  });

  it('aprovisiona cola + DLQ con maxReceiveCount numérico 3 y ARN de DLQ real', async () => {
    const listed = await sqs.send(new ListQueuesCommand({}));
    const urls = listed.QueueUrls ?? [];
    const jobsUrl = canonicalQueueUrl(JOBS_QUEUE);
    const dlqUrl = canonicalQueueUrl(DLQ_QUEUE);
    expect(urls).toContain(jobsUrl);
    expect(urls).toContain(dlqUrl);

    const attrs = await sqs.send(
      new GetQueueAttributesCommand({
        QueueUrl: jobsUrl,
        AttributeNames: ['RedrivePolicy', 'VisibilityTimeout'],
      }),
    );
    const rawPolicy = attrs.Attributes?.RedrivePolicy;
    expect(rawPolicy, 'RedrivePolicy declarada en la cola principal').toBeDefined();

    const redrive = JSON.parse(rawPolicy ?? '{}') as {
      maxReceiveCount?: unknown;
      deadLetterTargetArn?: unknown;
    };
    // El emulador normaliza maxReceiveCount a NUMBER: la aserción de tipo es
    // parte del criterio (regresión F04-T02 de string "3" → número 3).
    expect(typeof redrive.maxReceiveCount, 'maxReceiveCount es number').toBe('number');
    expect(redrive.maxReceiveCount).toBe(3);
    expect(redrive.deadLetterTargetArn).toBe(await getQueueArn(sqs, dlqUrl));
    expect(Number(attrs.Attributes?.VisibilityTimeout)).toBe(120);
  });

  it('aprovisiona la tabla con PK/SK del contrato y TTL ENABLED sobre ttl', async () => {
    const described = await ddb.send(new DescribeTableCommand({ TableName: JOBS_TABLE }));
    expect(described.Table?.TableStatus).toBe('ACTIVE');
    expect(described.Table?.KeySchema).toEqual(
      expect.arrayContaining([
        { AttributeName: 'userId', KeyType: 'HASH' },
        { AttributeName: 'jobId', KeyType: 'RANGE' },
      ]),
    );
    const keyTypes = new Map(
      (described.Table?.AttributeDefinitions ?? []).map((attr) => [
        attr.AttributeName,
        attr.AttributeType,
      ]),
    );
    expect(keyTypes.get('userId')).toBe('S');
    expect(keyTypes.get('jobId')).toBe('S');

    // El emulador activa el TTL de forma asíncrona (ENABLING → ENABLED).
    let status: string | undefined;
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      const ttl = await ddb.send(new DescribeTimeToLiveCommand({ TableName: JOBS_TABLE }));
      status = ttl.TimeToLiveDescription?.TimeToLiveStatus;
      if (status === 'ENABLED') break;
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    const ttl = await ddb.send(new DescribeTimeToLiveCommand({ TableName: JOBS_TABLE }));
    expect(status, 'DescribeTimeToLive').toBe('ENABLED');
    expect(ttl.TimeToLiveDescription?.AttributeName).toBe('ttl');
  });

  it('la política IAM se deriva de los recursos reales, sin comodines amplios', async () => {
    const outputs = readTerraformOutputs();
    interface Statement {
      Action?: string | string[];
      Resource?: string | string[];
    }
    interface Policy {
      Statement: Statement[];
    }
    const policy = tfValue<Policy>(outputs, 'iam_inline_policy');
    expect(policy.Statement).toHaveLength(5);

    const allActions = policy.Statement.flatMap((stmt) => asList(stmt.Action));
    const allResources = policy.Statement.flatMap((stmt) => asList(stmt.Resource));
    expect(allActions).not.toContain('*');
    expect(allResources).not.toContain('*');

    const tableArn =
      (await ddb.send(new DescribeTableCommand({ TableName: JOBS_TABLE }))).Table?.TableArn ?? '';
    const known = [
      RAW_BUCKET,
      OPTIMIZED_BUCKET,
      await getQueueArn(sqs, canonicalQueueUrl(JOBS_QUEUE)),
      await getQueueArn(sqs, canonicalQueueUrl(DLQ_QUEUE)),
      tableArn,
    ];
    expect(tableArn, 'ARN real de la tabla').not.toHaveLength(0);
    for (const resource of allResources) {
      expect(
        known.some((candidate) => candidate.length > 0 && resource.includes(candidate)),
        `ARN derivado de un recurso declarado: ${resource}`,
      ).toBe(true);
    }

    const trust = tfValue<{ Statement: Array<{ Principal: { Service?: string } }> }>(
      outputs,
      'iam_trust_policy',
    );
    expect(trust.Statement).toHaveLength(1);
    expect(trust.Statement[0]?.Principal.Service).toBe('lambda.amazonaws.com');
  });
});
