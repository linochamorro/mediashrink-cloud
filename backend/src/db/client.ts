/**
 * Fábrica del cliente DynamoDB documental (F01-T02).
 *
 * Apunta siempre al `AWS_ENDPOINT_URL` configurado (emulador en local/CI) y
 * lee las credenciales efímeras de los archivos generados por el emulador:
 * nunca credenciales fijas ni secretos en variables de entorno (G-3/A-03).
 */

import { readFileSync } from 'node:fs';
import { Agent } from 'node:https';

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { fromIni } from '@aws-sdk/credential-providers';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { NodeHttpHandler } from '@smithy/node-http-handler';

import type { AppConfig } from '../config/index';

export interface DynamoDbClientOptions {
  region: string;
  endpointUrl: string;
  sharedCredentialsFile: string;
  configFile: string;
  caBundlePath?: string;
  useSsl?: boolean;
}

export function createDynamoDbDocumentClient(options: DynamoDbClientOptions): DynamoDBDocumentClient {
  const httpsAgent =
    options.useSsl !== false && options.caBundlePath !== undefined
      ? new Agent({ ca: readFileSync(options.caBundlePath), keepAlive: true })
      : undefined;

  const base = new DynamoDBClient({
    region: options.region,
    endpoint: options.endpointUrl,
    credentials: fromIni({
      filepath: options.sharedCredentialsFile,
      configFilepath: options.configFile,
    }),
    ...(httpsAgent === undefined ? {} : { requestHandler: new NodeHttpHandler({ httpsAgent }) }),
  });

  return DynamoDBDocumentClient.from(base, {
    marshallOptions: { removeUndefinedValues: true },
  });
}

/** Conveniencia para el resto del backend: consume la configuración validada. */
export function createDynamoDbDocumentClientFromConfig(config: AppConfig): DynamoDBDocumentClient {
  return createDynamoDbDocumentClient({
    region: config.aws.region,
    endpointUrl: config.aws.endpointUrl,
    sharedCredentialsFile: config.aws.sharedCredentialsFile,
    configFile: config.aws.configFile,
    caBundlePath: config.aws.caBundlePath,
    useSsl: config.aws.useSsl,
  });
}
