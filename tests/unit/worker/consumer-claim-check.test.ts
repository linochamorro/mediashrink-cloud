/**
 * F05-AF-AUD-02 — Claim Check: la identidad que forma una clave S3 debe
 * superar la allowlist canónica de `storage/keys.ts`.
 *
 * El cliente S3 está simulado para demostrar que un identificador no canónico
 * no llega al transporte. El mensaje de error es estable y no contiene ni la
 * clave ni el identificador rechazado (G-3).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SQSClient } from '@aws-sdk/client-sqs';

import type { Job } from '../../../backend/src/contracts/index';
import type { OptimizedObjectWriter } from '../../../backend/src/storage/index';
import {
  handleJobMessage,
  type ConsumeDependencies,
  type ImageProcessor,
} from '../../../backend/src/worker/consumer';
import { FakeJobStore } from '../api/fixtures';
import { testConfig } from './fixtures';

const { s3Send } = vi.hoisted(() => ({ s3Send: vi.fn() }));

vi.mock('../../../backend/src/storage/client', () => ({
  createS3ClientFromConfig: () => ({ send: s3Send }),
}));

const USER_ID = 'u-1';
const JOB_ID = 'j-1';
const IMAGE_ID = 'img-1';
const RAW_BYTES = new Uint8Array([1, 2, 3]);
const GENERIC_ERROR = 'Objeto raw no disponible para la imagen del lote';

const processor: ImageProcessor = async (_bytes, options) => ({
  ok: true,
  imageId: options.imageId ?? IMAGE_ID,
  status: 'COMPLETED',
  metrics: {
    bytesBefore: RAW_BYTES.byteLength,
    bytesAfter: RAW_BYTES.byteLength,
    savingsPct: 0,
    exifStripped: true,
  },
  outputs: {
    webp: new Uint8Array([1]),
    avif: new Uint8Array([2]),
    thumbnail: new Uint8Array([3]),
  },
});

const objects: OptimizedObjectWriter = {
  async writeOptimizedVariants() {
    return {
      keys: {
        webp: `${USER_ID}/${JOB_ID}/optimized/${IMAGE_ID}.webp`,
        avif: `${USER_ID}/${JOB_ID}/optimized/${IMAGE_ID}.avif`,
        thumbnail: `${USER_ID}/${JOB_ID}/optimized/${IMAGE_ID}_thumb.webp`,
      },
      bytesByVariant: { webp: 1, avif: 1, thumbnail: 1 },
      totalBytes: 3,
    };
  },
};

async function setup(): Promise<ConsumeDependencies> {
  const jobs = new FakeJobStore();
  const job: Job = {
    jobId: JOB_ID,
    userId: USER_ID,
    status: 'PENDING',
    preset: 'BALANCED',
    formats: ['webp', 'avif'],
    bytesBefore: 0,
    bytesAfter: 0,
    savingsPct: 0,
    exifStripped: false,
    createdAt: '2026-11-19T00:00:00.000Z',
    updatedAt: '2026-11-19T00:00:00.000Z',
    ttl: 2_592_000,
  };
  await jobs.createJob(job);

  return {
    config: testConfig(),
    sqs: { send: vi.fn() } as unknown as SQSClient,
    jobs,
    processor,
    objects,
  };
}

function claimCheckBody(imageId: string): string {
  return JSON.stringify({
    userId: USER_ID,
    jobId: JOB_ID,
    images: [{ imageId }],
  });
}

beforeEach(() => {
  s3Send.mockReset();
  s3Send.mockResolvedValue({
    Body: {
      transformToByteArray: async () => RAW_BYTES,
    },
  });
});

describe('F05-AF-AUD-02 — Claim Check con constructor canónico de claves', () => {
  it.each(['a/b', '..', 'a\\b', '%2e'])(
    'rechaza el imageId no canónico %j antes de llamar a S3 y sin exponerlo',
    async (imageId) => {
      const deps = await setup();

      let error: unknown;
      try {
        await handleJobMessage(claimCheckBody(imageId), deps);
      } catch (caught) {
        error = caught;
      }

      expect(error).toBeInstanceOf(Error);
      const message = error instanceof Error ? error.message : String(error);
      expect(message).toBe(GENERIC_ERROR);
      expect(s3Send).not.toHaveBeenCalled();
      expect(message).not.toContain(imageId);
      expect(message).not.toContain('raw/');
    },
  );

  it('usa rawImageKey para el camino Claim Check válido y completa la imagen', async () => {
    const deps = await setup();

    const result = await handleJobMessage(claimCheckBody(IMAGE_ID), deps);

    expect(result.completed).toBe(1);
    expect(result.batchStatus).toBe('COMPLETED');
    expect(s3Send).toHaveBeenCalledTimes(1);
    const command = s3Send.mock.calls[0]?.[0] as { input: { Key?: string } };
    expect(command.input.Key).toBe(`${USER_ID}/${JOB_ID}/raw/${IMAGE_ID}`);
  });

  it('mantiene el camino con contentBase64 sin tocar S3', async () => {
    const deps = await setup();
    const body = JSON.stringify({
      userId: USER_ID,
      jobId: JOB_ID,
      images: [
        {
          imageId: IMAGE_ID,
          contentBase64: Buffer.from(RAW_BYTES).toString('base64'),
        },
      ],
    });

    const result = await handleJobMessage(body, deps);

    expect(result.completed).toBe(1);
    expect(result.batchStatus).toBe('COMPLETED');
    expect(s3Send).not.toHaveBeenCalled();
  });

  it('devuelve un error genérico si el objeto raw no tiene cuerpo, sin clave ni imageId', async () => {
    const deps = await setup();
    s3Send.mockResolvedValueOnce({});

    let error: unknown;
    try {
      await handleJobMessage(claimCheckBody(IMAGE_ID), deps);
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(Error);
    const message = error instanceof Error ? error.message : String(error);
    expect(message).toBe(GENERIC_ERROR);
    expect(message).not.toContain(IMAGE_ID);
    expect(message).not.toContain(`${USER_ID}/${JOB_ID}/raw/`);
  });
});
