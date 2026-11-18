# Entrega Developer — `F02-AUD-01` (Addendum de interoperabilidad F02↔F03)

| Campo | Valor |
|---|---|
| **ID completo** | `F02-AUD-01` — Contrato interoperable de `POST /jobs` con F03 (riesgo 3) |
| **Fase / paquete** | Fase 2 — `docs/sdd/packages/P-02-api-and-worker.md` (addendum) |
| **Versión / Loop usado** | `v1 — Loop 1/3` (sin loops adicionales) |
| **Riesgo / rol** | `3 (Sensible)` · Developer (Tester + Auditor posteriores) |
| **Harness** | OpenCode |
| **Estado de entrega** | **`DONE`** — retorno a Architect; **no emito `PASSED` ni cierro la tarea** |
| **Criterio del addendum** | Interoperabilidad demostrada con el contrato acordado, preservando validación, `userId` del JWT, clave `raw/<userId>/<jobId>/<imageId>` y sin secretos |

## 1. Fuentes y criterio

- Lectura obligatoria: `AGENTS.md`, `STATE.md`, `.agents/roles/developer.md`.
- **Fuente de verdad de alcance:** `reports/implementation/F02/F02-AUD-01-task.md`.
- Hallazgo de origen: `reports/audits/F03/F03-auditor.md` **`F03-AUD-01` (HIGH)**, líneas 14–27.
- Contrato de referencia (solo lectura): `frontend/src/api/jobs.ts` (`JobUploadRequest`, `JobUploadPlan`, `validateSecureUrl`).
- Código leído como referencia funcional: `backend/src/api/{jobs,app,presign,enriched-publisher}.ts`, `backend/src/storage/{index,presigner,keys}.ts`, `backend/src/contracts/{index,zod-schemas,catalog}.ts`, `backend/src/config/index.ts`, `backend/src/auth/errors.ts` y `backend/src/auth/middleware.ts`.
- Contratos congelados v1 (hash de catálogo `5d0082f8…68d626d`, declarado en `frontend/src/api/types.generated.ts`): **no se modificaron**. No se regeneraron tipos ni se tocó `backend/src/contracts/**`. Se definieron tipos locales en `backend/src/api/jobs.ts` y se validó con `schemas.Preset` y `schemas.JobMetrics`.
- Gates: G-3 (sin secretos), G-6b (sin rutas Windows absolutas en artefactos), **G-7** (Docker con 2 GiB / 2.0 CPU, arrancado solo durante pruebas y apagado al terminar).

## 2. Cronología TDD

| Fase | Acción | Resultado |
|---|---|---|
| **RED** | Test unitario nuevo `tests/unit/api/jobs-contract.test.ts` (9 pruebas) con doble `RecordingUploadPresign`; `validBatch` migrado a `{ files }`. El handler vigente aún leía `images` y devolvía `{ job }`. `npx vitest run tests/unit/api/jobs-contract.test.ts` | **7 fallos por comportamiento** (`expected 400 to be 201` en positivos y en los límites válidos), 2 negativos pasaban. EXIT 1. `F02-AUD-01-red.txt`. |
| **GREEN** | `backend/src/api/jobs.ts`: parsing estricto de `{ preset, files }`, `randomUUID` por archivo, MIME raster, validación de `fileName`, `sizeBytes` vía `schemas.JobMetrics`, firma PUT con `PresignService` y respuesta `{ job, uploads }`. `backend/src/api/app.ts`: inyección perezosa vía `getPresignService()`. Tests existentes migrados a `files`. | `tests/unit/api`: **103/103**, EXIT 0. `F02-AUD-01-green.txt`. (Durante el GREEN apareció un fallo intermedio por el refinamiento `savings-coherence`, corregido en la misma fase; ver P-2). |
| **REFACTOR** | Extracción de `verifiedUploadUrl()` para centralizar la defensa en profundidad (PUT HTTPS, sin userinfo, clave exacta `rawImageKey`). Sin debilitar expectativas. | `tests/unit/api`: **103/103**; `npm run typecheck` y `eslint` acotado sin hallazgos. `F02-AUD-01-refactor.txt`, `F02-AUD-01-typecheck.txt`, `F02-AUD-01-lint-scoped.txt`. |

## 3. Comandos y evidencias

Ejecutados desde la raíz. El binario de Docker se anteponía al `PATH` mediante la ruta concreta del harness, que no se versiona (G-6b); los comandos reproducibles usan `docker compose`.

| Evidencia (`reports/implementation/F02/evidence/`) | Comando | Resultado |
|---|---|---|
| `F02-AUD-01-red.txt` | `npx vitest run tests/unit/api/jobs-contract.test.ts` | 1 archivo, 7 fallos por comportamiento / 2 pasan, EXIT 1 |
| `F02-AUD-01-green.txt` | `npx vitest run tests/unit/api` | 13 archivos, **103/103**, EXIT 0 |
| `F02-AUD-01-refactor.txt` | ídem tras extraer `verifiedUploadUrl()` | 13 archivos, **103/103**, EXIT 0 |
| `F02-AUD-01-unit.txt` | `npm run test:unit -- --reporter=basic` | 31 archivos, **275/275**, EXIT 0 |
| `F02-AUD-01-integration.txt` | `npx vitest run tests/integration/api` | 7 archivos, **29/29**, EXIT 0 (T06 incluido) |
| `F02-AUD-01-upload-put.txt` | `npx vitest run tests/integration/api/jobs-contract.test.ts` | **3/3**, EXIT 0; PUT real → `HeadObject` 200 y `ContentLength` exacto |
| `F02-AUD-01-contract-shape.txt` | sonda efímera `npx tsx` (eliminada tras ejecutar) | request/response reales; `UPLOAD_KEYS = ["imageId","uploadUrl","method"]` |
| `F02-AUD-01-typecheck.txt` | `npm run typecheck` | EXIT 0, sin diagnósticos |
| `F02-AUD-01-lint-scoped.txt` | `npx eslint backend/src/api tests/unit/api tests/integration/api --ext .ts` | EXIT 0, sin hallazgos |
| `F02-AUD-01-docker-config.txt` | `docker compose config` | `memory=2147483648`, `cpus=2`, `host_ip=127.0.0.1` |
| `F02-AUD-01-emulator-up.txt`, `-emulator-health.txt`, `-emulator-ca.txt` | `docker compose up -d`, `ps`, `docker cp` (CA/config/credenciales) + `curl.exe --cacert … /__admin/health` | `healthy`; cuerpo `ok`, EXIT 0 |
| `F02-AUD-01-emulator-down.txt` | `docker compose down`, `compose ps`, `docker ps -a`, sonda `:9297` | contenedor y red eliminados; `docker ps -a` vacío; `curl: (7) Could not connect` |

**G-7:** contenedor levantado únicamente durante la integración; `docker cp` de `ca.pem`/`config`/`emulator_credentials` repetido en este arranque; apagado al terminar toda la evidencia. Sin secretos ni rutas Windows absolutas en artefactos nuevos.

## 4. Decisiones

### 4.1 Forma del contrato (idéntica a `frontend/src/api/jobs.ts`)
- Request: `{ preset, files: [{ fileName: string, contentType: string, sizeBytes: number }] }`.
- Response 201: `{ job, uploads: [{ imageId: string, uploadUrl: string, method: 'PUT' }] }`. `headers?` se conserva como campo opcional en el tipo local (`JobUploadPlanItem`), pero el `PresignResult` actual no lo produce, así que no se emite. **No se exponen `bucket`, `key`, `expiresIn` ni `expiresAt`** (seguimiento F05).

### 4.2 MIME raster permitido (D-11/IN-10)
- Lista blanca exacta: `image/jpeg`, `image/png`, `image/webp`, `image/avif`. Se rechazan `image/svg+xml`, `image/gif`, `application/pdf`, variantes con distinta capitalización y valores con parámetros (`image/jpeg; charset=…`). La comparación es sensible a mayúsculas a propósito (MIME canónico).

### 4.3 `imageId` nuevo y seguro
- Se genera con `randomUUID()` por cada elemento de `files`, **nunca se deriva del `fileName`**. El `fileName` se valida (no vacío/espacios, sin `/`, `\`, NUL ni `%xx`) pero no interviene en la clave S3: se descarta tras la validación. Con dos `fileName` idénticos se obtienen dos `imageId` distintos (probado).
- `rawImageKey({ userId, jobId, imageId })` valida cada segmento con la lista blanca existente; `userId` sale del JWT verificado. Los intentos de suplantación por cuerpo (`userId` como clave desconocida → 400) y por `x-forwarded-for`/`x-real-ip` (clave de presign sigue siendo el `userId` del token) están cubiertos.

### 4.4 Mapeo `uploads` y firma
- `PresignService.presignUpload({ userId, jobId, imageId })` se inyecta en `JobsRoutesDeps` y se cablea en `app.ts` con el mismo `getPresignService()` perezoso que `/presign` (no se toca `backend/src/index.ts`). En tests unitarios se inyecta un doble; en integración se usa el servicio real contra el emulador.
- Mapeo: `{ imageId, uploadUrl: result.url, method: 'PUT' }`. `verifiedUploadUrl()` exige `result.method === 'PUT'`, `result.key === rawImageKey(...)`, URL HTTPS y sin userinfo; si algo no cuadra → 400 y no se persiste el lote (la firma ocurre antes de `createJob`).
- El job permanece `PENDING` con `bytesBefore=0`, `bytesAfter=0`, `savingsPct=0`, `exifStripped:false`, `formats:['webp','avif']` y `ttl = computeTtl(createdAt)`, validado por `schemas.Job`. `/presign`, `/confirm`, descarga y T06 siguen intactos (29/29 integración).

### 4.5 Estrategia en fixtures E2E de T06
- `createUploadedJob()` migró su cuerpo a `files` pero conserva los `imageId` lógicos (`img-real-1`, `img-bad`, …) sembrando `raw` vía `/presign/upload` (ruta sin cambios). Así las aserciones del consumidor y de métricas de T06 siguen ejercitando exactamente el mismo flujo. La prueba nueva `tests/integration/api/jobs-contract.test.ts` cubre por separado la PUT real usando la URL devuelta por `POST /jobs`.

## 5. Resultado observable

- `UPLOAD_KEYS = ["imageId","uploadUrl","method"]`; dos archivos → dos `imageId` UUID v4 distintos bajo un mismo `jobId`.
- Integración real: dos PUT a las URLs de `uploads` → `HeadObject` 200 en `raw/<userId>/<jobId>/raw/<imageId>` con `ContentLength` igual al payload enviado. URL con protocolo `https:`.
- Negativos cubiertos: preset inválido, lote vacío/excedido, `sizeBytes` 0/negativo/no entero/excedido, MIME SVG/GIF/PDF, `fileName` traversal/NUL/`%xx`, claves desconocidas en cuerpo y en archivo, suplantación de `userId` por cuerpo y por cabeceras, sin token.

## 6. Problemas registrados (7 campos)

### P-1 — Contrato de creación no interoperable con F03
1. **Identificación:** `F02-AUD-01-P-1` (causa raíz del addendum; `F03-AUD-01` HIGH).
2. **Problema:** `POST /jobs` leía `body.images: [{imageId, bytes}]` y respondía `{ job }`; la SPA enviaba `{ preset, files }` y necesitaba `uploads` con URLs PUT. Ningún flujo extremo a extremo podía funcionar.
3. **Causa (demostrada):** divergencia entre el handler `backend/src/api/jobs.ts` y el acuerdo implementado en `frontend/src/api/jobs.ts`. Evidencia: auditoría F03 líneas 14–27 + `F02-AUD-01-red.txt` (7 fallos: el cuerpo nuevo devolvía 400).
4. **Solución e intentos fallidos:** adoptar el contrato acordado con tipos locales en `api/**` (sin tocar contratos congelados), generar `imageId` con `randomUUID` y firma integrada del plan de subida. No se intentó parchear el cliente ni regenerar tipos (prohibido por alcance).
5. **Verificación:** GREEN 103/103 unit; integración 29/29; sonda de forma en `F02-AUD-01-contract-shape.txt`; PUT real en `F02-AUD-01-upload-put.txt`.
6. **Pendientes:** verificación independiente de Tester/Auditor y cierre por Architect (fuera de este rol).
7. **Aprendizaje candidato:** cuando dos fases comparten un contrato HTTP, la fuente de verdad debe ser el cliente ya implementado y la divergencia debe resolverse en el servidor sin alterar esquemas congelados.

### P-2 — `schemas.JobMetrics` rechazaba `savingsPct: 0` al reutilizarlo para `sizeBytes`
1. **Identificación:** `F02-AUD-01-P-2` (fallo intermedio de GREEN).
2. **Problema:** todas las peticiones válidas devolvían 400 al validar `sizeBytes` con un objeto `{ bytesBefore: n, bytesAfter: 0, savingsPct: 0 }`.
3. **Causa (demostrada):** el refinamiento congelado `savings-coherence` exige `savingsPct === (before-after)/before*100`; con `before>0` y `after=0` eso es 100, no 0. El código anterior de T01 ya usaba `savingsPct: bytes === 0 ? 0 : 100`.
4. **Solución e intentos fallidos:** restaurar la coherencia (`savingsPct: item.sizeBytes === 0 ? 0 : 100`) solo dentro del objeto de validación; el lote persistido sigue anunciando 0/0/0. Intentos fallidos: el primer GREEN con `savingsPct: 0`, corregido antes de continuar.
5. **Verificación:** `F02-AUD-01-green.txt` → 103/103; `F02-AUD-01-unit.txt` → 275/275.
6. **Pendientes:** ninguno dentro del addendum.
7. **Aprendizaje candidato:** reutilizar un esquema con refinamientos cruzados exige construir un objeto coherente en todos sus campos, aunque solo se consuma uno.

### P-3 — `imageId` aleatorio frente a `imageId` fijos en las E2E de T06
1. **Identificación:** `F02-AUD-01-P-3` (riesgo de regresión por el cambio de contrato).
2. **Problema:** las pruebas E2E del worker condicionan su lógica a ids lógicos (`img-bad`, `img-good`, `img-dlq-down`); el nuevo contrato genera UUID imprevisibles, lo que podía romper T06.
3. **Causa (demostrada):** el worker deriva el `imageId` del objeto S3 en `raw`, y la fixture sembraba esos objetos con los ids fijos; el nuevo `uploads` introduce ids distintos para el mismo lote.
4. **Solución e intentos fallidos:** mantener el flujo de siembra de T06 por `/presign/upload` con los ids lógicos (la ruta no cambió) y añadir una prueba de integración dedicada que usa la URL real de `uploads` y verifica el objeto con `HeadObject`. Se descartó reescribir todas las aserciones de T06 porque no aportaba cobertura nueva y aumentaba el riesgo.
5. **Verificación:** `F02-AUD-01-integration.txt` → 29/29 (e2e-metrics y e2e-persist incluidos) + `F02-AUD-01-upload-put.txt` → 3/3.
6. **Pendientes:** ninguno; queda documentado para que el Tester evalúe si prefiere unificar ambos flujos en lo sucesivo.
7. **Aprendizaje candidato:** al cambiar un contrato compartido, preservar las pruebas de integración existentes y añadir una prueba focal del nuevo comportamiento es más seguro que reescribir aserciones auxiliares.

## 7. Estado final y alcance tocado

- **Estado:** `DONE` (entrega del Developer). Sin dictamen `PASSED`, sin cierre de tarea y sin addendum en `reports/verification/F02-architect.md` (competencia exclusiva del Architect).
- **Archivos de producto:** `backend/src/api/jobs.ts`, `backend/src/api/app.ts`.
- **Tests:** `tests/unit/api/{fixtures.ts,routes.test.ts,jobs-contract.test.ts}`, `tests/integration/api/{fixtures.ts,routes.test.ts,e2e-fixture.ts,e2e-metrics.test.ts,jobs-contract.test.ts}`.
- **Reportes:** este archivo y `reports/implementation/F02/evidence/F02-AUD-01-*.txt`.
- **No tocados:** `frontend/`, `infra/`, `.github/`, `STATE.md`, `docs/sdd/tasks.md`, manifiestos, `backend/src/{worker,storage,db}/**`, `backend/src/index.ts`, `backend/src/contracts/**`, `types.generated.ts`, `reports/verification/F02-architect.md`. Sin push a `main`.
