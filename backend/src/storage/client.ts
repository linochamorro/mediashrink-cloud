/**
 * Fábrica del cliente S3 (F02-T02).
 *
 * Apunta siempre al `AWS_ENDPOINT_URL` configurado (emulador en local/CI) y lee
 * las credenciales efímeras de los archivos generados por el emulador mediante
 * `fromIni`: nunca credenciales fijas ni secretos en variables de entorno
 * (G-3/A-03). El CA se pasa de forma explícita y se fuerza el estilo de ruta
 * para que las URLs firmadas usen el host del endpoint, no un subdominio.
 */

import { readFileSync } from 'node:fs';
import { Agent } from 'node:https';

import { S3Client } from '@aws-sdk/client-s3';
import { fromIni } from '@aws-sdk/credential-providers';
import { NodeHttpHandler } from '@smithy/node-http-handler';

import type { AppConfig } from '../config/index';

export interface S3ClientOptions {
  region: string;
  endpointUrl: string;
  sharedCredentialsFile: string;
  configFile: string;
  caBundlePath?: string;
  useSsl?: boolean;
}

export function createS3Client(options: S3ClientOptions): S3Client {
  const httpsAgent =
    options.useSsl !== false && options.caBundlePath !== undefined
      ? new Agent({ ca: readFileSync(options.caBundlePath), keepAlive: true })
      : undefined;

  return new S3Client({
    region: options.region,
    endpoint: options.endpointUrl,
    forcePathStyle: true,
    credentials: fromIni({
      filepath: options.sharedCredentialsFile,
      configFilepath: options.configFile,
    }),
    ...(httpsAgent === undefined ? {} : { requestHandler: new NodeHttpHandler({ httpsAgent }) }),
  });
}

/** Conveniencia para el resto del backend: consume la configuración validada. */
export function createS3ClientFromConfig(config: AppConfig): S3Client {
  return createS3Client({
    region: config.aws.region,
    endpointUrl: config.aws.endpointUrl,
    sharedCredentialsFile: config.aws.sharedCredentialsFile,
    configFile: config.aws.configFile,
    caBundlePath: config.aws.caBundlePath,
    useSsl: config.aws.useSsl,
  });
}
