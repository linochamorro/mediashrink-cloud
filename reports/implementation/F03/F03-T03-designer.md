# F03-T03 — Designer

## Loop 1 — handoff

- **Estado:** `PARTIAL · NEEDS_CONTEXT` para integración con API; validación local implementada.
- **Implementación:** drag & drop y file picker; selector limitado por `Preset` generado (HIGH, BALANCED, MAX_COMPRESSION); reglas locales MIME/tamaño/cantidad; mensajes de rechazo y selección visible. Acción Optimizar crea lote, ejecuta PUT binarios, confirma y actualiza historial. El workspace compartido incluye además polling y panel de resultados, preservados durante este turno.
- **Contrato del cliente:** la SPA sigue `F03-api-contract-agreement.md`; los tipos `Job`, `ImageRecord` y `Preset` vienen de `types.generated.ts` sin redefinición.
- **Límites:** `LimitsConfig` solo existe como tipo generado; frontend no tiene un origen runtime. Defaults de cliente explícitos 15 MB y 20 imágenes, reflejados de la configuración actual por defecto del backend. El límite real se vuelve a validar en servidor; parámetros personalizados de despliegue no se reflejan en UI hasta exponer configuración a frontend.
- **Archivos:** `frontend/src/App.tsx`, `frontend/src/api/jobs.ts`, `frontend/src/upload/validation.ts`, `frontend/src/styles.css`, `tests/unit/frontend/core.test.ts`.
- **TDD:** casos de MIME/tamaño/cantidad, metadatos de POST, PUT binario con headers, confirmación y listado/descarga mock; evidencia `evidence/F03-T03-verification.txt`.
- **Bloqueo externo:** lectura de implementación actual F02 mostró `POST /jobs` con cuerpo `images` y respuesta `{job}`; la propuesta F03 requiere `files` y `uploads` presignadas. No se modificó backend ni se adaptó la SPA a un contrato distinto. F02 debe confirmar/adoptar el acuerdo; hasta entonces no se considera integración real cerrada. Si discrepa, `NEEDS_CONTEXT` a Architect/CTO.

### Problema relevante (7 campos)

1. **ID:** F03-T03-P01.
2. **Título:** contrato de creación de jobs divergente entre la propuesta F03 y la ruta F02 observada.
3. **Contexto:** acuerdo operativo de Architect permite `files`/`uploads`; implementación concurrente F02 actualmente acepta `images` y no devuelve plan de subida presignada.
4. **Resultado esperado:** F02 confirma/adopta el acuerdo para que la SPA pida URLs y cargue binarios directamente.
5. **Resultado observado:** incompatibilidad de request/response al revisar `backend/src/api/jobs.ts` (solo lectura).
6. **Impacto:** el flujo interactivo no puede interoperar con la ruta actual; E2E realista daría fallo si se ejecuta contra ella.
7. **Resolución/seguimiento:** F02 confirma/adopta el contrato en su ámbito; si no puede, devolver `NEEDS_CONTEXT` a Architect/CTO antes de modificar contratos/tipos.

### Problema relevante (7 campos)

1. **ID:** F03-T03-P02.
2. **Título:** límites de carga sin fuente runtime frontend.
3. **Contexto:** el tipo `LimitsConfig` está disponible, pero no hay configuración runtime frontend ni endpoint de configuración acordado.
4. **Resultado esperado:** cliente muestra y aplica los mismos máximos configurados en cada despliegue.
5. **Resultado observado:** defaults locales 15 MB/20 imágenes se alinean con defaults actuales del backend, pero no con overrides de entorno.
6. **Impacto:** con despliegue personalizado la validación cliente puede diferir; backend conserva validación autoritativa.
7. **Resolución/seguimiento:** exponer `LimitsConfig` al frontend o aprobar configuración pública Vite; mantener validación del servidor. No se inventó un endpoint.

## Addendum append-only — UI interactiva y smoke E2E

- UI conecta el contrato a create → PUT firmado → confirm → list; el workspace compartido también aporta polling/estado, historial y controles de resultados. Caso Playwright mock imprimió `ok 1` para login, subida, métricas, ZIP y borrado; la envoltura del runner no terminó limpiamente y se interrumpió después de ese PASS, sin listener residual. Evidencia: `evidence/F03-playwright.txt`.
- Sigue `NEEDS_CONTEXT` para interoperabilidad: la ruta F02 observada usa `images`/`{job}`, incompatible con `files`/`uploads` del acuerdo. La prueba Playwright intercepta API y no acredita compatibilidad con backend real.

## Addendum append-only — forma exacta del contrato operativo para adopción F02

- `POST /jobs` request `{ preset: Preset, files: Array<{ fileName: string; contentType: string; sizeBytes: number }> }` → `201 { job: Job, uploads: Array<{ imageId: string; uploadUrl: string; method: 'PUT'; headers?: Record<string, string> }> }`.
- Por cada archivo, `PUT uploadUrl` con el binario y los `headers` indicados por la firma.
- `POST /jobs/:id/confirm` request `{ imageIds: string[] }` → `{ job: Job }`.
- `GET /jobs` → `{ jobs: Job[] }`.
- `GET /jobs/:id` → `{ job: Job, images: ImageRecord[] }`.
- `GET /jobs/:id/download/:imageId?variant=original|webp|avif|thumbnail` → JSON `{ downloadUrl: string, expiresAt: string }`; `original` da acceso a la fuente para comparativa.
- `GET /jobs/:id/download.zip` → cuerpo binario ZIP.
- `DELETE /jobs/:id` → `204 No Content`.
- `Job`, `ImageRecord`, `Preset` se importan exclusivamente de `frontend/src/api/types.generated.ts`; son tipos solo lectura. F02 debe confirmar/adoptar cada request/response en su propio ámbito. Si detecta incompatibilidad, `NEEDS_CONTEXT` al Architect/CTO; este rol no edita backend ni tipos generados.
