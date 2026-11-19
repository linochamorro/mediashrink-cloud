/**
 * ARCHIVO GENERADO — NO EDITAR A MANO.
 * Fuente canónica: <PROJECT_ROOT>/backend/src/contracts/catalog.ts
 * Contratos v1.0.0 · hash SHA-256 del catálogo: 110ddd82b9fcacc0afb95eedd53c50575bdf4813fcd363c0e5d089e299af0c2d
 * Regenerar: npm run generate:types --workspace=@mediashrink/backend
 */

/** v1 · Alta de usuario: correo y contraseña en claro solo en la petición. */
export type RegisterInput = {
  email: string;
  password: string;
};

/** v1 · Credenciales de acceso; la contraseña nunca se almacena en claro. */
export type LoginInput = {
  email: string;
  password: string;
};

/** v1 · Renovación de sesión sin reenviar credenciales. */
export type RefreshInput = {
  refreshToken: string;
};

/** v1 · Par JWT (access + refresh) emitido por auth. */
export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: number;
};

/** v1 · Usuario autenticado; userId es la clave de aislamiento (PR-07). */
export type AuthenticatedUser = {
  userId: string;
  email: string;
  createdAt: string;
};

/** v1 · Uno de los tres presets de calidad (IN-02). */
export type Preset = "HIGH" | "BALANCED" | "MAX_COMPRESSION";

/** v1 · Estados agregados del lote (FR-14, §6 del spec). */
export type JobStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "PARTIAL" | "FAILED";

/** v1 · Formatos de salida permitidos; miniaturas WebP (IN-01, A-04). */
export type OutputFormat = "webp" | "avif";

/** v1 · Ítem hijo por imagen: estado individual, bytes y motivo de fallo. */
export type ImageRecord = {
  imageId: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "PARTIAL" | "FAILED";
  bytesBefore?: number;
  bytesAfter?: number;
  failureReason?: string;
  exifStripped: boolean;
};

/** v1 · Métricas reales: ahorro calculado con bytes, sin ocultar 0 % ni negativo. */
export type JobMetrics = {
  bytesBefore: number;
  bytesAfter: number;
  savingsPct: number;
  exifStripped: boolean;
};

/** v1 · Lote completo: identidad, estado, preset, formatos, métricas y TTL. */
export type Job = {
  jobId: string;
  userId: string;
  name?: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "PARTIAL" | "FAILED";
  preset: "HIGH" | "BALANCED" | "MAX_COMPRESSION";
  formats: Array<"webp" | "avif">;
  bytesBefore: number;
  bytesAfter: number;
  savingsPct: number;
  exifStripped: boolean;
  createdAt: string;
  updatedAt: string;
  ttl: number;
};

/** v1 · Límites de validación estricta y anti-bomba leídos desde la configuración. */
export type LimitsConfig = {
  maxFileSizeMb: number;
  maxImagesPerBatch: number;
  maxPixels: number;
};

/** v1 · Colas canónicas (host AWS lógico) con AWS_ENDPOINT_URL como transporte; sin :9324 ni :9297 en la QueueUrl. */
export type AwsTransport = {
  region: string;
  accountId: string;
  endpointUrl: string;
  queueUrl: string;
  dlqUrl: string;
};

/** v1 · Ciclo de vida S3 y TTL DynamoDB fijados en 30 días (IN-09). */
export type RetentionPolicy = {
  retentionDays: 30;
  ttlSeconds: 2592000;
};
