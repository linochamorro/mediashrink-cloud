/**
 * Fixture de integración de IaC: clientes AWS SDK v3 contra `aws/aws-emulator`.
 *
 * Verifica los recursos APROVISIONADOS POR TERRAFORM (a diferencia del resto de
 * `tests/integration/`, que crea sus propios recursos efímeros). Por eso no
 * crea ni borra nada: solo lee el estado real del emulador tras `terraform apply`.
 *
 * Credenciales y CA: archivos efímeros generados por el emulador y exportados
 * con `docker cp` (runbook §1.3). Nunca credenciales fijas (G-3). Rutas
 * relativas a la raíz del repositorio: sin rutas Windows absolutas.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { Agent } from 'node:https';

import { fromIni } from '@aws-sdk/credential-providers';
import {
  GetBucketCorsCommand,
  GetBucketLifecycleConfigurationCommand,
  GetBucketNotificationConfigurationCommand,
  ListBucketsCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  GetQueueAttributesCommand,
  ListQueuesCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';
import {
  DescribeTableCommand,
  DescribeTimeToLiveCommand,
  DynamoDBClient,
} from '@aws-sdk/client-dynamodb';
import { NodeHttpHandler } from '@smithy/node-http-handler';

export const ENDPOINT_URL = 'https://127.0.0.1:9297';
export const REGION = 'us-east-1';
export const ACCOUNT_ID = '000000000000';

export const RAW_BUCKET = 'mediashrink-raw-local';
export const OPTIMIZED_BUCKET = 'mediashrink-optimized-local';
export const JOBS_QUEUE = 'mediashrink-jobs';
export const DLQ_QUEUE = 'mediashrink-jobs-dlq';
export const JOBS_TABLE = 'mediashrink-jobs';
export const CORS_ORIGIN = 'http://localhost:5173';
export const EXPECTED_RETENTION_DAYS = 30;
export const EXPECTED_TTL_SECONDS = 2_592_000;

const CA_BUNDLE = './.local/aws-emulator/ca.pem';
const CREDENTIALS = './.local/aws-emulator/emulator_credentials';
const CONFIG = './.local/aws-emulator/config';

function httpsAgent(): Agent {
  return new Agent({ ca: readFileSync(CA_BUNDLE), keepAlive: true });
}

function credentials(): ReturnType<typeof fromIni> {
  return fromIni({ filepath: CREDENTIALS, configFilepath: CONFIG });
}

export function createS3(): S3Client {
  return new S3Client({
    region: REGION,
    endpoint: ENDPOINT_URL,
    forcePathStyle: true,
    credentials: credentials(),
    requestHandler: new NodeHttpHandler({ httpsAgent: httpsAgent() }),
  });
}

export function createSQS(): SQSClient {
  return new SQSClient({
    region: REGION,
    endpoint: ENDPOINT_URL,
    // QueueUrls canónicas (host AWS lógico): :9297 es solo transporte (A-03).
    useQueueUrlAsEndpoint: false,
    credentials: credentials(),
    requestHandler: new NodeHttpHandler({ httpsAgent: httpsAgent() }),
  });
}

export function createDynamoDB(): DynamoDBClient {
  return new DynamoDBClient({
    region: REGION,
    endpoint: ENDPOINT_URL,
    credentials: credentials(),
    requestHandler: new NodeHttpHandler({ httpsAgent: httpsAgent() }),
  });
}

export function canonicalQueueUrl(name: string): string {
  return `https://sqs.${REGION}.amazonaws.com/${ACCOUNT_ID}/${name}`;
}

/** Salidas JSON reales del `apply` (fuente de verdad de la guardia de retención). */
export interface TerraformOutputEntry<T> {
  sensitive: boolean;
  type: unknown;
  value: T;
}

export type TerraformOutputs = Record<string, TerraformOutputEntry<unknown>>;

export function readTerraformOutputs(): TerraformOutputs {
  const raw = execFileSync('terraform', ['-chdir=infra/terraform', 'output', '-json'], {
    encoding: 'utf8',
  });
  return JSON.parse(raw) as TerraformOutputs;
}

export function tfValue<T>(outputs: TerraformOutputs, key: string): T {
  const entry = outputs[key];
  if (entry === undefined || !('value' in entry)) {
    throw new Error(`Falta la salida Terraform '${key}'`);
  }
  return entry.value as T;
}

export function asList(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

export async function getQueueArn(sqs: SQSClient, queueUrl: string): Promise<string> {
  const result = await sqs.send(
    new GetQueueAttributesCommand({ QueueUrl: queueUrl, AttributeNames: ['QueueArn'] }),
  );
  const arn = result.Attributes?.QueueArn;
  if (arn === undefined) throw new Error(`Sin QueueArn para ${queueUrl}`);
  return arn;
}

export {
  GetBucketCorsCommand,
  GetBucketLifecycleConfigurationCommand,
  GetBucketNotificationConfigurationCommand,
  ListBucketsCommand,
  GetQueueAttributesCommand,
  ListQueuesCommand,
  DescribeTableCommand,
  DescribeTimeToLiveCommand,
};
