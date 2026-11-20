import { useCallback, useEffect, useRef, useState } from 'react';

import { createAuthClient, serializeStoredRefreshToken, type AuthSession } from './api/auth';
import { createJobsClient, JobsApiError } from './api/jobs';
import { PRESETS, validateFiles } from './upload/validation';
import type { ImageRecord, Job, JobStatus, Preset } from './api/types.generated';
import { readTheme, saveTheme, type Theme } from './theme';
import './styles.css';

const limits = { maxFileSizeMb: 15, maxImagesPerBatch: 20 };
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '';

export default function App() {
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [session, setSession] = useState<AuthSession | null>(null);
  const [error, setError] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [batchName, setBatchName] = useState('');
  const [preset, setPreset] = useState<Preset>('BALANCED');
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [jobBusy, setJobBusy] = useState(false);
  const [jobMessage, setJobMessage] = useState('');
  const [jobError, setJobError] = useState('');
  const [jobs, setJobs] = useState<Array<{ jobId: string; status: string; createdAt: string; name?: string }>>([]);
  const [activeJob, setActiveJob] = useState<string | null>(null);
  const [jobDetail, setJobDetail] = useState<{ job: Job; images: ImageRecord[] } | null>(null);
  const [pollError, setPollError] = useState('');
  const [polling, setPolling] = useState(false);

  function clearPrivateState() {
    setSession(null); sessionStorage.removeItem('mediashrink-session');
    setJobs([]); setActiveJob(null); setJobDetail(null); setFiles([]); setFileErrors([]);
    setSourcesResetKey((value) => value + 1); setJobMessage(''); setJobError(''); setPollError('');
    setError(''); setPassword(''); setEmail('');
  }
  const [sourcesResetKey, setSourcesResetKey] = useState(0);

  const authorized = useCallback(async function authorizedRequest<T>(request: (accessToken: string) => Promise<T>): Promise<T> {
    if (!session) throw new Error('Inicia sesión para continuar.');
    try { return await request(session.accessToken); }
    catch (reason) {
      if (!(reason instanceof JobsApiError) || reason.status !== 401) throw reason;
      let refreshed: AuthSession;
      try {
        refreshed = await createAuthClient(apiBaseUrl).refresh(session.refreshToken);
      } catch {
        clearPrivateState();
        throw new Error('Tu sesión caducó. Inicia sesión otra vez.');
      }
      setSession(refreshed); sessionStorage.setItem('mediashrink-session', serializeStoredRefreshToken(refreshed));
      try { return await request(refreshed.accessToken); }
      catch (retryReason) {
        if (retryReason instanceof JobsApiError && retryReason.status === 401) {
          clearPrivateState();
          throw new Error('Tu sesión caducó. Inicia sesión otra vez.');
        }
        throw retryReason;
      }
    }
  }, [session]);

  const loadImageSources = useCallback(async (jobId: string, imageId: string, format: 'webp' | 'avif') => {
    const client = createJobsClient(apiBaseUrl);
    const [original, optimized] = await Promise.all([
      authorized((token) => client.download(token, jobId, imageId, 'original')),
      authorized((token) => client.download(token, jobId, imageId, format)),
    ]);
    return { original: original.downloadUrl, optimized: optimized.downloadUrl };
  }, [authorized]);

  useEffect(() => { document.documentElement.dataset.theme = theme; saveTheme(theme); }, [theme]);
  useEffect(() => {
    const saved = sessionStorage.getItem('mediashrink-session');
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as { refreshToken?: unknown };
      if (typeof parsed.refreshToken === 'string' && parsed.refreshToken) void createAuthClient(apiBaseUrl).refresh(parsed.refreshToken).then((next) => { setSession(next); sessionStorage.setItem('mediashrink-session', serializeStoredRefreshToken(next)); }).catch(() => sessionStorage.removeItem('mediashrink-session'));
    } catch { sessionStorage.removeItem('mediashrink-session'); }
  }, []);

  useEffect(() => {
    if (!session || !activeJob) return;
    let cancelled = false;
    let timer: number | undefined;
    let transientFailures = 0;
    setPolling(true);
    const poll = async () => {
      try {
        const detail = await authorized((token) => createJobsClient(apiBaseUrl).get(token, activeJob));
        if (cancelled) return;
        transientFailures = 0;
        setPollError('');
        setJobDetail(detail);
        setJobs((current) => current.map((job) => job.jobId === activeJob ? { ...job, status: detail.job.status } : job));
        if (!['COMPLETED', 'PARTIAL', 'FAILED'].includes(detail.job.status)) timer = window.setTimeout(poll, 2000);
        else setPolling(false);
      } catch (reason) {
        if (cancelled) return;
        transientFailures += 1;
        setPollError(reason instanceof Error ? reason.message : 'No se pudo consultar el lote.');
        if (transientFailures <= 3) timer = window.setTimeout(poll, 2000);
        else setPolling(false);
      }
    };
    void poll();
    return () => { cancelled = true; if (timer) window.clearTimeout(timer); };
  }, [session, activeJob]);

  async function submitAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    try {
      const client = createAuthClient(apiBaseUrl);
      const next = mode === 'register' ? await client.register({ email, password }) : await client.login({ email, password });
      setSession(next); sessionStorage.setItem('mediashrink-session', serializeStoredRefreshToken(next)); setPassword('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo completar el acceso.'); }
  }

  function acceptFiles(incoming: FileList | File[]) {
    const chosen = Array.from(incoming);
    const result = validateFiles(chosen, limits);
    setFileErrors(result.errors);
    setFiles(result.valid ? chosen : []);
  }

  async function startJob() {
    if (!session || !files.length) return;
    setJobBusy(true); setJobError(''); setJobMessage('Preparando la carga segura…');
    try {
      const client = createJobsClient(apiBaseUrl);
      const plan = await authorized((token) => client.create(token, { preset, ...(batchName.trim() ? { name: batchName.trim().slice(0, 80) } : {}), files: files.map((file) => ({ fileName: file.name, contentType: file.type, sizeBytes: file.size })) }));
      if (plan.uploads.length !== files.length || plan.uploads.some((upload) => upload.method !== 'PUT')) throw new Error('La API devolvió un plan de carga incompleto.');
      for (const [index, upload] of plan.uploads.entries()) {
        const result = await client.upload(upload.uploadUrl, files[index], upload.headers);
        if (!result.ok) throw new Error(`No se pudo subir ${files[index].name} (HTTP ${result.status}).`);
      }
      const confirmed = await authorized((token) => client.confirm(token, plan.job.jobId, plan.uploads.map((upload) => upload.imageId)));
      setJobMessage(`Lote ${confirmed.job.jobId} confirmado · estado ${confirmed.job.status}.`);
      setActiveJob(confirmed.job.jobId);
      setFiles([]); setBatchName('');
      const listing = await authorized((token) => client.list(token));
      setJobs(listing.jobs);
    } catch (reason) {
      setJobError(reason instanceof Error ? reason.message : 'No se pudo iniciar el lote.');
      setJobMessage('');
    } finally { setJobBusy(false); }
  }

  async function loadJobs() {
    if (!session) return;
    setJobError('');
    try {
      const client = createJobsClient(apiBaseUrl);
      const listing = await authorized((token) => client.list(token));
      setJobs(listing.jobs);
    } catch (reason) {
      setJobError(reason instanceof Error ? reason.message : 'No se pudo cargar el historial.');
    }
  }

  async function downloadImage(jobId: string, imageId: string, variant: 'original' | 'webp' | 'avif' | 'thumbnail') {
    if (!session) return;
    let popup: Window | null = null;
    try {
      popup = window.open('about:blank', '_blank');
      if (!popup) throw new Error('Permite ventanas emergentes para abrir la descarga.');
      popup.opener = null;
      const link = await authorized((token) => createJobsClient(apiBaseUrl).download(token, jobId, imageId, variant));
      // URL absoluta: el popup puede abrir una ruta relativa del relay local.
      popup.location.replace(new URL(link.downloadUrl, window.location.origin).href);
    } catch (reason) { popup?.close(); setJobError(reason instanceof Error ? reason.message : 'No se pudo preparar la descarga.'); }
  }

  async function downloadZip(jobId: string) {
    if (!session) return;
    try {
      const response = await authorized((token) => createJobsClient(apiBaseUrl).zip(token, jobId));
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${jobId}.zip`; anchor.click(); URL.revokeObjectURL(url);
    } catch (reason) { setJobError(reason instanceof Error ? reason.message : 'No se pudo descargar el ZIP.'); }
  }

  async function deleteJob(jobId: string) {
    if (!session || !window.confirm(`¿Borrar el lote ${jobId} y sus archivos? Esta acción no se puede deshacer.`)) return;
    try {
      await authorized((token) => createJobsClient(apiBaseUrl).remove(token, jobId));
      setJobs((current) => current.filter((job) => job.jobId !== jobId));
      if (activeJob === jobId) { setActiveJob(null); setJobDetail(null); }
    } catch (reason) { setJobError(reason instanceof Error ? reason.message : 'No se pudo borrar el lote.'); }
  }

  const statusLabel: Record<JobStatus, string> = { PENDING: 'En espera', PROCESSING: 'Procesando', COMPLETED: 'Completado', PARTIAL: 'Completado parcialmente', FAILED: 'Fallido' };

  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="/" aria-label="MediaShrink, inicio"><span className="brand-mark">M</span><span>media<span className="brand-strong">shrink</span><small>ESTUDIO DE IMAGEN</small></span></a>
      <nav aria-label="Navegación principal"><a href="#optimizar">Optimizar</a><a href="#privacidad">Privacidad</a></nav>
      <div className="top-actions"><span className="secure-label"><span aria-hidden="true">●</span> Tus imágenes, bajo tu control</span><button className="theme-toggle" type="button" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label={`Cambiar a tema ${theme === 'light' ? 'oscuro' : 'claro'}`}>{theme === 'light' ? '☾' : '☀'} <span>{theme === 'light' ? 'Oscuro' : 'Claro'}</span></button></div>
    </header>
    <main>
      <section className="intro"><p className="eyebrow">UN TALLER PARA TUS FOTOGRAFÍAS</p><h1>Menos peso.<br/><em>La misma imagen.</em></h1><p className="intro-copy">Optimiza tus fotos en privado. Conserva cada detalle y recupera espacio, con métricas claras en cada paso.</p><div className="intro-notes"><span>↗ WebP + AVIF</span><span>⌁ Metadatos privados</span><span>◷ Tú decides cuándo borrar</span></div></section>
      <section className="workspace" id="optimizar" aria-labelledby="workspace-title"><div className="section-heading"><div><p className="eyebrow">TU ESPACIO DE TRABAJO</p><h2 id="workspace-title">Prepara un lote</h2></div><span className="step-pill"><b>01</b> · Añade fotografías</span></div>
        {!session ? <div className="auth-strip"><form onSubmit={submitAuth} className="auth-form"><label>Correo electrónico<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Contraseña<input type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} minLength={mode === 'register' ? 8 : 1} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} required /></label><button className="primary-button" type="submit">{mode === 'register' ? 'Crear cuenta' : 'Iniciar sesión'} <span aria-hidden="true">↗</span></button><button className="text-button" type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>{mode === 'login' ? 'Crear cuenta' : 'Ya tengo cuenta'}</button></form>{error && <p role="alert" className="error-message">{error}</p>}</div> : <div className="session-bar"><span>Sesión iniciada como <strong>{session.user.email}</strong></span><button className="text-button" onClick={clearPrivateState}>Cerrar sesión</button></div>}
        <div className={`dropzone ${dragging ? 'is-dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); acceptFiles(event.dataTransfer.files); }}>
          <input id="file-picker" className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple onChange={(event) => { if (event.target.files) acceptFiles(event.target.files); }} />
          <div className="upload-icon" aria-hidden="true">↑</div><h3>Arrastra tus imágenes aquí</h3><p>o <label htmlFor="file-picker" className="inline-link">explora tus archivos</label></p><small>JPEG, PNG, WebP o AVIF · Hasta {limits.maxFileSizeMb} MB por imagen · Máximo {limits.maxImagesPerBatch} imágenes</small>
        </div>
        {fileErrors.length > 0 && <ul className="validation-errors" role="alert">{fileErrors.map((message) => <li key={message}>{message}</li>)}</ul>}
        {files.length > 0 && <div className="file-summary" aria-live="polite"><strong>{files.length} imágenes listas</strong><span>{files.map((file) => file.name).join(' · ')}</span></div>}
        <div className="preset-area"><div><p className="eyebrow">NIVEL DE COMPRESIÓN</p><div className="preset-options" role="radiogroup" aria-label="Preset de compresión">{PRESETS.map((item) => <button type="button" role="radio" aria-checked={preset === item} key={item} className={`preset-card ${preset === item ? 'selected' : ''}`} onClick={() => setPreset(item)}><span className="radio-dot"/><strong>{item === 'HIGH' ? 'Alta calidad' : item === 'BALANCED' ? 'Equilibrado' : 'Máxima compresión'}</strong><small>{item === 'HIGH' ? 'Prioriza el detalle' : item === 'BALANCED' ? 'Un punto medio versátil' : 'Archivos más pequeños'}</small></button>)}</div></div><aside className="privacy-note" id="privacidad"><span aria-hidden="true">✳</span><p><strong>Privacidad por diseño</strong><br/>Eliminamos los metadatos de ubicación y cámara al optimizar.</p></aside></div>
        <label className="batch-name-field">Nombre del lote (opcional)<input type="text" maxLength={80} placeholder="Ej. Fotos vacaciones noviembre" value={batchName} onChange={(event) => setBatchName(event.target.value.slice(0, 80))} disabled={jobBusy} /></label>
        <button className="start-button" type="button" disabled={!session || files.length === 0 || jobBusy} onClick={startJob} title={!session ? 'Inicia sesión para continuar' : files.length === 0 ? 'Añade imágenes válidas para continuar' : `Preset ${preset}`}>{jobBusy ? 'Subiendo imágenes…' : `Optimizar ${files.length || 'tus'} imágenes`} <span aria-hidden="true">→</span></button>
        <p className="local-validation-note">La selección se valida en este dispositivo antes de iniciar un lote.</p>
        {jobMessage && <p className="job-message" aria-live="polite">{jobMessage}</p>}
        {jobError && <p className="error-message" role="alert">{jobError}</p>}
        <div className="jobs-heading"><span className="eyebrow">TUS LOTES</span><button type="button" className="text-button" disabled={!session || jobBusy} onClick={loadJobs}>Actualizar historial</button></div>
        {jobs.length > 0 && <ul className="jobs-list" aria-label="Historial de lotes">{[...jobs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((job) => { const canZip = ['COMPLETED', 'PARTIAL'].includes(job.status); return <li key={job.jobId}><button className="job-open" type="button" onClick={() => setActiveJob(job.jobId)}>{job.name && job.name.trim() ? job.name : job.jobId}</button><strong>{statusLabel[job.status as JobStatus] ?? job.status}</strong><time>{new Date(job.createdAt).toLocaleString('es', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</time><button type="button" className="text-button" disabled={!canZip} onClick={() => void downloadZip(job.jobId)}>Descargar ZIP</button><button type="button" className="text-button danger-button" onClick={() => void deleteJob(job.jobId)}>Borrar</button></li>; })}</ul>}
        {jobs.length === 0 && <p className="empty-state">Aún no hay lotes. Cuando optimices imágenes, aparecerán aquí.</p>}
        {activeJob && !jobDetail && <p className="loading-state" role="status">Consultando el lote…</p>}
        {pollError && <p className="error-message" role="alert">{pollError}{polling ? ' Reintentando en unos segundos…' : ' No se pudo actualizar; vuelve a seleccionar el lote para reintentar.'}</p>}
        {jobDetail && <section className="job-results" aria-label="Resultados del lote"><div className="results-heading"><div><p className="eyebrow">RESULTADO DEL LOTE</p><h3>{jobDetail.job.name && jobDetail.job.name.trim() ? jobDetail.job.name : jobDetail.job.jobId}</h3>{jobDetail.job.name && jobDetail.job.name.trim() && <small className="job-id-secondary">{jobDetail.job.jobId}</small>}</div><span className={`status-chip status-${jobDetail.job.status.toLowerCase()}`} role="status">{statusLabel[jobDetail.job.status]}</span></div>{['PENDING', 'PROCESSING'].includes(jobDetail.job.status) && <p className="processing-state" role="status">Tus imágenes se están procesando. Actualizamos el progreso automáticamente.</p>}<progress aria-label="Progreso del lote" max={jobDetail.images.length || 1} value={jobDetail.images.filter((image) => ['COMPLETED', 'PARTIAL', 'FAILED'].includes(image.status)).length}/><div className="metrics-grid"><div><small>Original</small><strong>{formatBytes(jobDetail.job.bytesBefore)}</strong></div><div><small>Optimizado</small><strong>{formatBytes(jobDetail.job.bytesAfter)}</strong></div><div><small>Ahorro real</small><strong>{jobDetail.job.savingsPct.toFixed(2)}%</strong></div><div><small>Privacidad EXIF</small><strong className={jobDetail.job.exifStripped ? 'exif-clean' : 'exif-pending'}>{jobDetail.job.exifStripped ? '✓ EXIF eliminado' : 'No confirmado'}</strong></div></div>{jobDetail.images.length === 0 ? <p className="empty-state">Este lote todavía no tiene imágenes disponibles.</p> : <div className="comparison-grid">{jobDetail.images.map((image) => <article className="image-result" key={image.imageId}><h4>{image.imageId}</h4><ImageComparison key={`${sourcesResetKey}-${image.imageId}`} loadSources={loadImageSources} jobId={jobDetail.job.jobId} image={image} format={jobDetail.job.formats.includes('webp') ? 'webp' : 'avif'} /><p>Antes: {formatBytes(image.bytesBefore ?? 0)} · Después: {formatBytes(image.bytesAfter ?? 0)}</p><p>Ahorro: {image.bytesBefore ? (((image.bytesBefore - (image.bytesAfter ?? 0)) / image.bytesBefore) * 100).toFixed(2) : '0.00'}%</p><span className={image.exifStripped ? 'exif-clean' : 'exif-pending'}>{image.exifStripped ? '✓ EXIF limpio' : 'EXIF pendiente'}</span><div className="result-actions"><button type="button" className="text-button" onClick={() => void downloadImage(jobDetail.job.jobId, image.imageId, 'original')}>Descargar original</button>{jobDetail.job.formats.map((format) => <button key={format} type="button" className="text-button" onClick={() => void downloadImage(jobDetail.job.jobId, image.imageId, format)}>Descargar {format.toUpperCase()}</button>)}</div></article>)}</div>}</section>}
      </section>
      <footer><span>MediaShrink Cloud <span className="footer-sep">/</span> Cuidado para tus imágenes</span><span>Diseñado para la privacidad <span aria-hidden="true">✳</span></span></footer>
    </main>
  </div>;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function ImageComparison({ loadSources, jobId, image, format }: { loadSources: (jobId: string, imageId: string, format: 'webp' | 'avif') => Promise<{ original: string; optimized: string }>; jobId: string; image: ImageRecord; format: 'webp' | 'avif' }) {
  const container = useRef<HTMLDivElement>(null);
  const [sources, setSources] = useState<{ original?: string; optimized?: string }>({});
  const [previewError, setPreviewError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let requested = false;
    const requestSources = () => {
      if (requested || cancelled) return;
      requested = true;
      setLoading(true);
      void loadSources(jobId, image.imageId, format).then((nextSources) => {
        if (!cancelled) setSources(nextSources);
      }).catch((reason: unknown) => {
        if (!cancelled) setPreviewError(reason instanceof Error ? reason.message : 'No se pudieron cargar las vistas previas.');
      }).finally(() => { if (!cancelled) setLoading(false); });
    };
    if (typeof IntersectionObserver === 'undefined') requestSources();
    else {
      const observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) { requestSources(); observer.disconnect(); }
      }, { rootMargin: '160px' });
      if (container.current) observer.observe(container.current);
      return () => { cancelled = true; observer.disconnect(); };
    }
    return () => { cancelled = true; };
  }, [loadSources, jobId, image.imageId, format]);

  return <div ref={container} className="visual-comparison" aria-label={`Comparativa visual de ${image.imageId}`}>
    <figure><figcaption>Original</figcaption>{sources.original ? <img src={sources.original} alt={`Imagen original ${image.imageId}`} loading="lazy" onError={() => setPreviewError('La vista original no está disponible.')} /> : <span className="preview-placeholder">{loading ? 'Cargando vista…' : 'Vista no disponible'}</span>}</figure>
    <figure><figcaption>Optimizada · {format.toUpperCase()}</figcaption>{sources.optimized ? <img src={sources.optimized} alt={`Imagen optimizada ${image.imageId} en ${format.toUpperCase()}`} loading="lazy" onError={() => setPreviewError('La vista optimizada no está disponible.')} /> : <span className="preview-placeholder">{loading ? 'Cargando vista…' : 'Vista no disponible'}</span>}</figure>
    {previewError && <p className="preview-error" role="status">{previewError}</p>}
  </div>;
}
