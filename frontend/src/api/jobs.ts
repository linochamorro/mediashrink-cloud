import type { ImageRecord, Job, Preset } from './types.generated';

export type JobUploadRequest = { preset: Preset; files: Array<{ fileName: string; contentType: string; sizeBytes: number }> };
export type JobUploadPlan = { job: Job; uploads: Array<{ imageId: string; uploadUrl: string; method: 'PUT'; headers?: Record<string, string> }> };
export type DownloadVariant = 'original' | 'webp' | 'avif' | 'thumbnail';
export type DownloadLink = { downloadUrl: string; expiresAt: string };
type Fetcher = typeof fetch;

export class JobsApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); this.name = 'JobsApiError'; }
}

export function validateSecureUrl(value: string): string {
  let parsed: URL;
  try { parsed = new URL(value); }
  catch { throw new Error('La API devolvió una dirección no válida.'); }
  if (parsed.protocol !== 'https:' || !parsed.hostname || parsed.username || parsed.password)
    throw new Error('La API devolvió una dirección HTTPS no segura.');
  return parsed.href;
}

export function createJobsClient(baseUrl = '', fetcher: Fetcher = fetch) {
  async function json<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
    const response = await fetcher(`${baseUrl}${path}`, { ...init, headers: { authorization: `Bearer ${token}`, ...(init.body ? { 'content-type': 'application/json' } : {}), ...init.headers } });
    if (!response.ok) throw new JobsApiError(`La solicitud falló (HTTP ${response.status}).`, response.status);
    return response.status === 204 ? undefined as T : response.json() as Promise<T>;
  }
  return {
    list: (token: string) => json<{ jobs: Job[] }>('/jobs', token),
    create: (token: string, input: JobUploadRequest) => json<JobUploadPlan>('/jobs', token, { method: 'POST', body: JSON.stringify(input) }),
    upload: (uploadUrl: string, file: Blob, headers: Record<string, string> = {}) => fetcher(validateSecureUrl(uploadUrl), { method: 'PUT', headers, body: file }),
    confirm: (token: string, jobId: string, imageIds: string[]) => json<{ job: Job }>(`/jobs/${encodeURIComponent(jobId)}/confirm`, token, { method: 'POST', body: JSON.stringify({ imageIds }) }),
    get: (token: string, jobId: string) => json<{ job: Job; images: ImageRecord[] }>(`/jobs/${encodeURIComponent(jobId)}`, token),
    download: async (token: string, jobId: string, imageId: string, variant: DownloadVariant) => {
      const link = await json<DownloadLink>(`/jobs/${encodeURIComponent(jobId)}/download/${encodeURIComponent(imageId)}?variant=${variant}`, token);
      return { ...link, downloadUrl: validateSecureUrl(link.downloadUrl) };
    },
    zip: async (token: string, jobId: string) => {
      const response = await fetcher(`${baseUrl}/jobs/${encodeURIComponent(jobId)}/download.zip`, { headers: { authorization: `Bearer ${token}` } });
      if (!response.ok) throw new JobsApiError(`No se pudo completar la solicitud (HTTP ${response.status}).`, response.status);
      return response;
    },
    remove: (token: string, jobId: string) => json<void>(`/jobs/${encodeURIComponent(jobId)}`, token, { method: 'DELETE' }),
  };
}
