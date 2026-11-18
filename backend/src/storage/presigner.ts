/**
 * Presigned URLs de subida a `raw` (PUT) y descarga de `optimized` (GET)
 * (F02-T02, CA-02). El binario nunca atraviesa la API: solo se devuelven la
 * URL, la clave y los metadatos de expiración (FR-09).
 */

import { GetObjectCommand, PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import type { AppConfig } from '../config/index';
import { createS3ClientFromConfig } from './client';
import {
  assertKeyWithinPrefix,
  optimizedImageKey,
  rawImageKey,
  type OptimizedVariant,
} from './keys';

export const PRESIGN_DEFAULT_EXPIRY_SECONDS = 900;
export const PRESIGN_MIN_EXPIRY_SECONDS = 60;
export const PRESIGN_MAX_EXPIRY_SECONDS = 3600;

export class InvalidExpiryError extends Error {
  constructor(message = 'Expiración de URL firmada no válida') {
    super(message);
    this.name = 'InvalidExpiryError';
  }
}

export interface PresignResult {
  url: string;
  key: string;
  method: 'PUT' | 'GET';
  bucket: string;
  expiresIn: number;
  expiresAt: string;
}

export interface PresignRequest {
  userId: string;
  jobId: string;
  imageId: string;
  expiresIn?: number;
}

export interface UploadPresignRequest extends PresignRequest {}

export interface DownloadPresignRequest extends PresignRequest {
  variant: OptimizedVariant;
}

export interface PresignService {
  presignUpload(request: UploadPresignRequest): Promise<PresignResult>;
  presignDownload(request: DownloadPresignRequest): Promise<PresignResult>;
}

export interface PresignServiceDeps {
  client: S3Client;
  rawBucket: string;
  optimizedBucket: string;
  now?: () => number;
}

/** Expiración por defecto de 15 min, acotada entre 1 min y 1 hora. */
export function resolveExpiry(requested: number | undefined): number {
  if (requested === undefined) return PRESIGN_DEFAULT_EXPIRY_SECONDS;
  if (
    !Number.isInteger(requested) ||
    requested < PRESIGN_MIN_EXPIRY_SECONDS ||
    requested > PRESIGN_MAX_EXPIRY_SECONDS
  ) {
    throw new InvalidExpiryError(
      `expiresIn debe ser un entero entre ${PRESIGN_MIN_EXPIRY_SECONDS} y ${PRESIGN_MAX_EXPIRY_SECONDS} segundos`,
    );
  }
  return requested;
}

export function createPresignService(deps: PresignServiceDeps): PresignService {
  const now = deps.now ?? (() => Date.now());

  async function sign(
    command: PutObjectCommand | GetObjectCommand,
    bucket: string,
    key: string,
    method: 'PUT' | 'GET',
    expiresIn: number,
  ): Promise<PresignResult> {
    const url = await getSignedUrl(deps.client, command, { expiresIn });
    return {
      url,
      key,
      method,
      bucket,
      expiresIn,
      expiresAt: new Date(now() + expiresIn * 1000).toISOString(),
    };
  }

  return {
    async presignUpload(request) {
      const key = rawImageKey(request);
      assertKeyWithinPrefix(key, request.userId);
      const expiresIn = resolveExpiry(request.expiresIn);
      return sign(
        new PutObjectCommand({ Bucket: deps.rawBucket, Key: key }),
        deps.rawBucket,
        key,
        'PUT',
        expiresIn,
      );
    },

    async presignDownload(request) {
      const key = optimizedImageKey(request, request.variant);
      assertKeyWithinPrefix(key, request.userId);
      const expiresIn = resolveExpiry(request.expiresIn);
      return sign(
        new GetObjectCommand({ Bucket: deps.optimizedBucket, Key: key }),
        deps.optimizedBucket,
        key,
        'GET',
        expiresIn,
      );
    },
  };
}

export function createPresignServiceFromConfig(config: AppConfig): PresignService {
  return createPresignService({
    client: createS3ClientFromConfig(config),
    rawBucket: config.resources.s3BucketRaw,
    optimizedBucket: config.resources.s3BucketOptimized,
  });
}
