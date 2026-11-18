/**
 * Superficie pública del almacén de jobs (F01-T02).
 *
 * Todas las operaciones exigen `userId`: la clave de partición es el usuario,
 * por lo que es imposible direccionar un lote ajeno sin falsificar esa clave.
 * Los tipos `Job`/`ImageRecord` se importan del catálogo congelado (F01-T01)
 * y no se redefinen aquí.
 */

import type { ImageRecord, Job, JobStatus, OutputFormat, Preset } from '../contracts/index';

/** Campos mutables de un job. `createdAt`/`ttl` solo cambian de forma coherente. */
export interface JobPatch {
  status?: JobStatus;
  preset?: Preset;
  formats?: OutputFormat[];
  bytesBefore?: number;
  bytesAfter?: number;
  savingsPct?: number;
  exifStripped?: boolean;
  updatedAt?: string;
}

/** Campos mutables de un ítem hijo por imagen. */
export interface ImagePatch {
  status?: JobStatus;
  bytesBefore?: number;
  bytesAfter?: number;
  failureReason?: string;
  exifStripped?: boolean;
}

export interface JobStore {
  createJob(job: Job): Promise<Job>;
  getJob(userId: string, jobId: string): Promise<Job | null>;
  updateJob(userId: string, jobId: string, patch: JobPatch): Promise<Job>;
  deleteJob(userId: string, jobId: string): Promise<void>;
  putImage(userId: string, jobId: string, image: ImageRecord): Promise<ImageRecord>;
  getImage(userId: string, jobId: string, imageId: string): Promise<ImageRecord | null>;
  listImages(userId: string, jobId: string): Promise<ImageRecord[]>;
  updateImage(
    userId: string,
    jobId: string,
    imageId: string,
    patch: ImagePatch,
  ): Promise<ImageRecord>;
  deleteImages(userId: string, jobId: string): Promise<void>;
  deleteJobWithImages(userId: string, jobId: string): Promise<void>;
}
