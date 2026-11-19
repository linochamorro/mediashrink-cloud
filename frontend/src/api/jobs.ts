import type { ImageRecord, Job, Preset } from './types.generated';

export type JobUploadRequest = { preset: Preset; name?: string; files: Array<{ fileName: string; contentType: string; sizeBytes: number }> };
export type JobUploadPlan = { job: Job; uploads: Array<{ imageId: string; uploadUrl: string; method: 'PUT'; headers?: Record<string, string> }> };
export type DownloadVariant = 'original' | 'webp' | 'avif' | 'thumbnail';
export type DownloadLink = { downloadUrl: string; expiresAt: string };
type Fetcher = typeof fetch;

export class JobsApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); this.name = 'JobsApiError'; }
}

/**
 * F03-AUD-03: hosts permitidos por defecto para las URLs presignadas.
 * El emulador local sirve las firmas desde `https://127.0.0.1:9297`.
 * Un despliegue real amplía la lista con `VITE_ALLOWED_STORAGE_HOSTS`
 * (separada por comas) o con la opción `allowedStorageHosts` del cliente.
 */
export const DEFAULT_ALLOWED_STORAGE_HOSTS: readonly string[] = ['127.0.0.1', 'localhost', '[::1]'];

/** TLD reservados (RFC 2606/6761): nunca resuelven en la Internet pública. */
const RESERVED_TEST_SUFFIXES: readonly string[] = ['.test', '.example', '.invalid', '.localhost'];

export interface JobsClientOptions {
  /** Allowlist explícita de hosts de almacenamiento; tiene prioridad sobre el entorno. */
  readonly allowedStorageHosts?: readonly string[];
}

function normalizeHost(value: string): string {
  return value.trim().toLowerCase().replace(/\.$/, '');
}

/** Parámetro explícito > variable de entorno > default local. Se resuelve en cada llamada. */
export function resolveAllowedStorageHosts(override?: readonly string[]): readonly string[] {
  if (override !== undefined) return override.map(normalizeHost).filter((host) => host.length > 0);
  // Cast en `import.meta` (no en `.env`): el backend compila este módulo desde
  // tests/ con `types: ["node"]`, donde `ImportMeta.env` no está declarado.
  const meta = import.meta as ImportMeta & { env?: Record<string, unknown> };
  const configured = meta.env?.VITE_ALLOWED_STORAGE_HOSTS;
  if (typeof configured === 'string' && configured.trim() !== '') {
    return configured.split(',').map(normalizeHost).filter((host) => host.length > 0);
  }
  return DEFAULT_ALLOWED_STORAGE_HOSTS;
}

function isHostAllowed(hostname: string, allowedHosts: readonly string[]): boolean {
  const host = normalizeHost(hostname);
  return allowedHosts.includes(host) || RESERVED_TEST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

/** Acepta solo HTTPS absoluto, sin credenciales y con host de la allowlist. */
export function validateSecureUrl(value: string, allowedHosts?: readonly string[]): string {
  if (typeof value !== 'string' || value.trim() === '')
    throw new Error('La API devolvió una dirección no válida.');
  let parsed: URL;
  try { parsed = new URL(value); }
  catch { throw new Error('La API devolvió una dirección no válida.'); }
  if (parsed.protocol !== 'https:' || !parsed.hostname || parsed.username || parsed.password)
    throw new Error('La API devolvió una dirección HTTPS no segura.');
  if (!isHostAllowed(parsed.hostname, resolveAllowedStorageHosts(allowedHosts)))
    throw new Error('La API devolvió una dirección de almacenamiento no permitida.');
  return parsed.href;
}

function isValidUploadPlan(value: unknown): value is JobUploadPlan {
  if (typeof value !== 'object' || value === null) return false;
  const plan = value as Record<string, unknown>;
  return plan.job !== undefined && Array.isArray(plan.uploads);
}

export function resolveDevStorageUrl(url: string): string {
  if (url.startsWith('https://127.0.0.1:9297/')) {
    return `/__s3_local/${url.slice('https://127.0.0.1:9297/'.length)}`;
  }
  if (url.startsWith('https://localhost:9297/')) {
    return `/__s3_local/${url.slice('https://localhost:9297/'.length)}`;
  }
  return url;
}

export function createJobsClient(baseUrl = '', fetcher: Fetcher = fetch, options: JobsClientOptions = {}) {
  const validate = (url: string) => validateSecureUrl(url, options.allowedStorageHosts);
  async function json<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
    const response = await fetcher(`${baseUrl}${path}`, { ...init, headers: { authorization: `Bearer ${token}`, ...(init.body ? { 'content-type': 'application/json' } : {}), ...init.headers } });
    if (!response.ok) throw new JobsApiError(`La solicitud falló (HTTP ${response.status}).`, response.status);
    return response.status === 204 ? undefined as T : response.json() as Promise<T>;
  }
  return {
    list: (token: string) => json<{ jobs: Job[] }>('/jobs', token),
    create: async (token: string, input: JobUploadRequest) => {
      const plan: unknown = await json<JobUploadPlan>('/jobs', token, { method: 'POST', body: JSON.stringify(input) });
      if (!isValidUploadPlan(plan)) throw new Error('La API devolvió un plan de subida no válido.');
      // Falla cerrado antes de exponer cualquier PUT a un destino no permitido.
      for (const upload of plan.uploads) validate(upload.uploadUrl);
      return plan;
    },
    upload: async (uploadUrl: string, file: Blob, headers: Record<string, string> = {}) => fetcher(resolveDevStorageUrl(validate(uploadUrl)), { method: 'PUT', headers, body: file }),
    confirm: (token: string, jobId: string, imageIds: string[]) => json<{ job: Job }>(`/jobs/${encodeURIComponent(jobId)}/confirm`, token, { method: 'POST', body: JSON.stringify({ imageIds }) }),
    get: (token: string, jobId: string) => json<{ job: Job; images: ImageRecord[] }>(`/jobs/${encodeURIComponent(jobId)}`, token),
    download: async (token: string, jobId: string, imageId: string, variant: DownloadVariant) => {
      const link: unknown = await json<DownloadLink>(`/jobs/${encodeURIComponent(jobId)}/download/${encodeURIComponent(imageId)}?variant=${variant}`, token);
      if (typeof link !== 'object' || link === null || typeof (link as DownloadLink).downloadUrl !== 'string')
        throw new Error('La API devolvió un enlace de descarga no válido.');
      return { ...(link as DownloadLink), downloadUrl: resolveDevStorageUrl(validate((link as DownloadLink).downloadUrl)) };
    },
    zip: async (token: string, jobId: string) => {
      const response = await fetcher(`${baseUrl}/jobs/${encodeURIComponent(jobId)}/download.zip`, { headers: { authorization: `Bearer ${token}` } });
      if (!response.ok) throw new JobsApiError(`No se pudo completar la solicitud (HTTP ${response.status}).`, response.status);
      return response;
    },
    remove: (token: string, jobId: string) => json<void>(`/jobs/${encodeURIComponent(jobId)}`, token, { method: 'DELETE' }),
  };
}
