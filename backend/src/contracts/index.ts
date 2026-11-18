/**
 * Puerta pública de los contratos congelados de MediaShrink Cloud (F01-T01).
 *
 * Las fases posteriores importan desde aquí: esquemas Zod, constantes,
 * tipos inferidos del catálogo y el generador de tipos del frontend.
 */

export * from './catalog';
export * from './zod-schemas';
export * from './generate';

import type { ContractTypes } from './catalog';

export type RegisterInput = ContractTypes['RegisterInput'];
export type LoginInput = ContractTypes['LoginInput'];
export type RefreshInput = ContractTypes['RefreshInput'];
export type TokenPair = ContractTypes['TokenPair'];
export type AuthenticatedUser = ContractTypes['AuthenticatedUser'];
export type Preset = ContractTypes['Preset'];
export type JobStatus = ContractTypes['JobStatus'];
export type OutputFormat = ContractTypes['OutputFormat'];
export type ImageRecord = ContractTypes['ImageRecord'];
export type JobMetrics = ContractTypes['JobMetrics'];
export type Job = ContractTypes['Job'];
export type LimitsConfig = ContractTypes['LimitsConfig'];
export type AwsTransport = ContractTypes['AwsTransport'];
export type RetentionPolicy = ContractTypes['RetentionPolicy'];
