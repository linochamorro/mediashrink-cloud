/**
 * Fábrica del cliente SQS del consumidor (F02-T04).
 *
 * Apunta al `AWS_ENDPOINT_URL` configurado (emulador en local/CI) y lee las
 * credenciales efímeras generadas por el emulador mediante `fromIni`: nunca
 * credenciales fijas ni secretos en variables de entorno (G-3/A-03).
 *
 * Las QueueUrl son canónicas (`https://sqs.<región>.amazonaws.com/<cuenta>/<cola>`)
 * y `AWS_ENDPOINT_URL` actúa **solo como transporte**: en el SDK JS v3 esto se
 * fija con `useQueueUrlAsEndpoint: false`. Nunca se usa el puerto retirado :9324
 * ni se reescribe el host de la QueueUrl con el del endpoint.
 */

import { readFileSync } from 'node:fs';
import { Agent } from 'node:https';

import { SQSClient } from '@aws-sdk/client-sqs';
import { fromIni } from '@aws-sdk/credential-providers';
import { NodeHttpHandler } from '@smithy/node-http-handler';

import type { AppConfig } from '../config/index';

export interface SqsClientOptions {
  readonly region: string;
  readonly endpointUrl: string;
  readonly sharedCredentialsFile: string;
  readonly configFile: string;
  readonly caBundlePath?: string;
  readonly useSsl?: boolean;
}

export function createSqsClient(options: SqsClientOptions): SQSClient {
  const httpsAgent =
    options.useSsl !== false && options.caBundlePath !== undefined
      ? new Agent({ ca: readFileSync(options.caBundlePath), keepAlive: true })
      : undefined;

  return new SQSClient({
    region: options.region,
    endpoint: options.endpointUrl,
    // La QueueUrl es un identificador lógico: el host del endpoint es solo
    // transporte (A-03). No reescribir la URL ni usar :9324.
    useQueueUrlAsEndpoint: false,
    credentials: fromIni({
      filepath: options.sharedCredentialsFile,
      configFilepath: options.configFile,
    }),
    ...(httpsAgent === undefined ? {} : { requestHandler: new NodeHttpHandler({ httpsAgent }) }),
  });
}

/** Conveniencia para el resto del backend: consume la configuración validada. */
export function createSqsClientFromConfig(config: AppConfig): SQSClient {
  return createSqsClient({
    region: config.aws.region,
    endpointUrl: config.aws.endpointUrl,
    sharedCredentialsFile: config.aws.sharedCredentialsFile,
    configFile: config.aws.configFile,
    caBundlePath: config.aws.caBundlePath,
    useSsl: config.aws.useSsl,
  });
}
