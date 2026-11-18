/**
 * Fixture de integración SQS: crea una cola principal y su DLQ aisladas en el
 * emulador `aws/aws-emulator`, con QueueUrls canónicas. No depende del código
 * de producto para que la fase RED pueda ejecutarse antes de implementar.
 */

import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Agent } from 'node:https';

import { CreateQueueCommand, DeleteQueueCommand, SQSClient } from '@aws-sdk/client-sqs';
import { fromIni } from '@aws-sdk/credential-providers';
import { NodeHttpHandler } from '@smithy/node-http-handler';

/** Rutas relativas a la raíz del repositorio (sin rutas Windows absolutas). */
const CA_BUNDLE_PATH = './.local/aws-emulator/ca.pem';
const CREDENTIALS_PATH = './.local/aws-emulator/emulator_credentials';
const CONFIG_PATH = './.local/aws-emulator/config';
const ENDPOINT_URL = 'https://127.0.0.1:9297';
const REGION = 'us-east-1';
const ACCOUNT_ID = '000000000000';

export interface TestQueues {
  readonly sqs: SQSClient;
  readonly queueUrl: string;
  readonly dlqUrl: string;
  readonly queueName: string;
  readonly dlqName: string;
  dispose(): Promise<void>;
}

function canonicalUrl(name: string): string {
  return `https://sqs.${REGION}.amazonaws.com/${ACCOUNT_ID}/${name}`;
}

export async function createTestQueues(tag: string): Promise<TestQueues> {
  const agent = new Agent({ ca: readFileSync(CA_BUNDLE_PATH), keepAlive: true });
  const sqs = new SQSClient({
    region: REGION,
    endpoint: ENDPOINT_URL,
    useQueueUrlAsEndpoint: false,
    // Credenciales efímeras generadas por el emulador; nunca secretos fijos (G-3).
    credentials: fromIni({ filepath: CREDENTIALS_PATH, configFilepath: CONFIG_PATH }),
    requestHandler: new NodeHttpHandler({ httpsAgent: agent }),
  });

  const suffix = `${tag}-${randomUUID().slice(0, 8)}`;
  const queueName = `mshrink-${suffix}`;
  const dlqName = `mshrink-${suffix}-dlq`;

  await sqs.send(new CreateQueueCommand({ QueueName: queueName }));
  await sqs.send(new CreateQueueCommand({ QueueName: dlqName }));

  return {
    sqs,
    queueUrl: canonicalUrl(queueName),
    dlqUrl: canonicalUrl(dlqName),
    queueName,
    dlqName,
    dispose: async () => {
      await sqs.send(new DeleteQueueCommand({ QueueUrl: canonicalUrl(queueName) }));
      await sqs.send(new DeleteQueueCommand({ QueueUrl: canonicalUrl(dlqName) }));
      sqs.destroy();
    },
  };
}
