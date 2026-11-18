/**
 * Fixture de integración: crea y destruye una tabla DynamoDB aislada en el
 * emulador `aws/aws-emulator`. No depende del código de producto para que la
 * fase RED pueda ejecutarse antes de implementar el almacén.
 *
 * El nombre de la tabla es único por archivo de prueba; nunca se usa la tabla
 * `DYNAMODB_TABLE_JOBS` que Terraform aprovisionará en F04.
 */

import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Agent } from 'node:https';

import { fromIni } from '@aws-sdk/credential-providers';
import {
  CreateTableCommand,
  DeleteTableCommand,
  DescribeTableCommand,
  DescribeTimeToLiveCommand,
  DynamoDBClient,
  UpdateTimeToLiveCommand,
} from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { NodeHttpHandler } from '@smithy/node-http-handler';

/** Rutas relativas a la raíz del repositorio (sin rutas Windows absolutas). */
const CA_BUNDLE_PATH = './.local/aws-emulator/ca.pem';
const CREDENTIALS_PATH = './.local/aws-emulator/emulator_credentials';
const CONFIG_PATH = './.local/aws-emulator/config';
const ENDPOINT_URL = 'https://127.0.0.1:9297';
const REGION = 'us-east-1';

export interface TestTable {
  tableName: string;
  documentClient: DynamoDBDocumentClient;
  rawClient: DynamoDBClient;
  dispose(): Promise<void>;
}

function buildRawClient(): DynamoDBClient {
  const httpsAgent = new Agent({ ca: readFileSync(CA_BUNDLE_PATH), keepAlive: true });
  return new DynamoDBClient({
    region: REGION,
    endpoint: ENDPOINT_URL,
    // Credenciales efímeras generadas por el emulador; nunca secretos fijos (G-3).
    credentials: fromIni({ filepath: CREDENTIALS_PATH, configFilepath: CONFIG_PATH }),
    requestHandler: new NodeHttpHandler({ httpsAgent }),
  });
}

async function waitUntilActive(client: DynamoDBClient, tableName: string): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const result = await client.send(new DescribeTableCommand({ TableName: tableName }));
    if (result.Table?.TableStatus === 'ACTIVE') return;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`La tabla ${tableName} no alcanzó el estado ACTIVE`);
}

export async function createTestTable(tag: string): Promise<TestTable> {
  const rawClient = buildRawClient();
  const tableName = `mediashrink-dbtest-${tag}-${randomUUID().slice(0, 8)}`;

  await rawClient.send(
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
  await waitUntilActive(rawClient, tableName);
  await rawClient.send(
    new UpdateTimeToLiveCommand({
      TableName: tableName,
      TimeToLiveSpecification: { AttributeName: 'ttl', Enabled: true },
    }),
  );
  // DynamoDB (y el emulador) activan el TTL de forma asíncrona: el estado
  // pasa por ENABLING. Esperar aquí evita una aserción dependiente del tiempo.
  const ttlDeadline = Date.now() + 30_000;
  while (Date.now() < ttlDeadline) {
    const ttl = await rawClient.send(
      new DescribeTimeToLiveCommand({ TableName: tableName }),
    );
    if (ttl.TimeToLiveDescription?.TimeToLiveStatus === 'ENABLED') break;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  const documentClient = DynamoDBDocumentClient.from(rawClient, {
    marshallOptions: { removeUndefinedValues: true },
  });

  return {
    tableName,
    documentClient,
    rawClient,
    dispose: async () => {
      await rawClient.send(new DeleteTableCommand({ TableName: tableName }));
      rawClient.destroy();
    },
  };
}
