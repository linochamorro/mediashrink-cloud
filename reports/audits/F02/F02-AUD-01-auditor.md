# Auditoría `F02-AUD-01` — Interoperabilidad `POST /jobs` F02↔F03 (addendum de riesgo 3)

| Campo | Valor |
|---|---|
| **Auditoría / tarea / fase** | `F02-AUD-01` · Addendum de interoperabilidad · Fase 2 (`docs/sdd/packages/P-02-api-and-worker.md`) |
| **Rol / riesgo** | `Auditor` · **Riesgo `3 (Sensible)`** — contrato público y superficie de subida |
| **Fecha / loop** | `2026-11-18` · `Loop 1/3` |
| **Encargo** | Auditoría de riesgo 3 del addendum aprobado por Lino/CTO: (1) **Contrato** — forma exacta `JobUploadRequest`/`JobUploadPlan` de F03 y resolución de `F03-AUD-01` (HIGH); (2) **Seguridad** — `userId` del JWT, `imageId` UUID seguro, MIME raster, límites desde config, claves desconocidas, URL HTTPS PUT sobre `rawImageKey`, sin bucket/key/secretos; (3) **Congelación** — `contracts/**` y `types.generated.ts` intactos (hash `5d0082f8…`), sin tocar `frontend/`, `infra/`, `.github/`, `STATE.md`, `tasks.md`, manifiestos ni push; (4) **No regresión** de `/presign`, `/confirm`, descarga y T06 según evidencia del Developer, **sin repetir la suite funcional del Tester**. |
| **Fuentes leídas** | `.agents/roles/auditor.md`; `AGENTS.md`; `STATE.md`; plantilla de 7 campos `<LAB_ROOT>/docs/templates/problema-solucion.md`; `reports/implementation/F02/F02-AUD-01-{task,developer}.md`; `reports/audits/F03/F03-auditor.md` (`F03-AUD-01`, HIGH, base y addendum Loop 3); cliente de referencia **solo lectura** `frontend/src/api/jobs.ts` y `frontend/src/api/types.generated.ts`; `backend/src/api/{jobs,app}.ts`; `backend/src/storage/{presigner,keys}.ts`; `backend/src/contracts/{index,catalog,generate}.ts`. Comprobaciones de solo lectura de metadatos de archivo (`LastWriteTime`) para contrastar la congelación. |
| **Conclusión** | **`READY_WITH_CONCERNS`** |
| **Cobertura** | **`SUFFICIENT`** para el alcance asignado (contrato, seguridad estática, congelación documental/temporal y no regresión por inspección de wiring) · **`LIMITED`** para ejecución dinámica (PUT real con emulador, suite funcional y test de congelación), que se **atribuye a la evidencia del Developer y no se repite** por instrucción, y para historial Git (prohibido) |
| **Hallazgos** | 3 (`1 INFO` de cierre, `1 LOW`, `1 INFO` de limitación metodológica) · **0 `CRITICAL` / 0 `HIGH` / 0 `MEDIUM`** · **0 bloqueantes de auditoría** · **ningún riesgo aceptado en nombre de Lino (sin G-10)** |

> **Frontera respetada:** no implementé código, **no emití `PASSED`/`NO-PASSED`**, no repetí la suite funcional del Tester, no usé Git/GitHub, Docker, AWS ni `.env` real, y **no acepté riesgo por Lino (G-10)**. Escribo **únicamente** este archivo. No registro secretos ni rutas Windows absolutas: las fuentes ajenas al cuerpo versionado se citan con los marcadores `<PROJECT_ROOT>` y `<LAB_ROOT>`. Registro `append-only`.

---

## 1. Hallazgos (7 campos obligatorios)

### Problema `A-01` — `F03-AUD-01` queda resuelto: el contrato acordado está adoptado con forma exacta

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID: `A-01` (cierre de `F03-AUD-01`) · Tarea: `F02-AUD-01` · Fase: `P-02` · Loop: `1/3` · Fecha: `2026-11-18` · Entorno: inspección estática TypeScript/Node, sin Docker/AWS/Git |
| **2. Problema** | **Síntoma:** el handler auditado en F03 leía `body.images: [{imageId, bytes}]` y respondía `{ job }` (201), divergiendo del cliente. **Esperado:** decisión de Lino/CTO de que F02 adopte el acuerdo F03: request `{ preset, files:[{fileName, contentType, sizeBytes}] }` → 201 `{ job, uploads:[{imageId, uploadUrl, method:'PUT', headers?}] }`. **Observado:** `backend/src/api/jobs.ts` ll. 48–69 define tipos locales idénticos (`CreateJobInput`, `JobUploadPlanItem`, `CreateJobResponse`); ll. 99–143 parsean exactamente `preset` + `files` y ll. 192–241 responden `c.json({ job: stored, uploads }, 201)`. Coincidencia campo por campo con `JobUploadRequest`/`JobUploadPlan` de `frontend/src/api/jobs.ts` ll. 3–4 (incluido `headers?` opcional, no emitido porque `PresignResult` no lo produce). **Impacto:** se elimina el bloqueo comprobado de interoperabilidad que sostenía el `NOT_READY` de F03. **Reproducción:** cotejar `backend/src/api/jobs.ts` ll. 6–9, 48–69, 99–143, 226–237 con `frontend/src/api/jobs.ts` ll. 3–4 y `reports/audits/F03/F03-auditor.md` ll. 14–27, 170–182. |
| **3. Causa** | **Estado:** `DEMOSTRADA`. **Evidencia:** código del handler citado + `F02-AUD-01-developer.md` §4.1 y §5 (`UPLOAD_KEYS = ["imageId","uploadUrl","method"]`) + sonda de forma `F02-AUD-01-contract-shape.txt` (reportada) + entrada RED `F02-AUD-01-red.txt` (7 fallos por comportamiento antes del cambio). **Alternativas descartadas:** parchear el cliente o regenerar tipos (prohibido por alcance); modificar contratos congelados (innecesario: se usaron tipos locales validando con `schemas.*`). |
| **4. Solución** | **Cambios aplicados:** `POST /jobs` adoptó el acuerdo F03 con tipos locales en `backend/src/api/**`; `imageId` generado con `randomUUID()` por archivo; firma integrada del plan de subida vía `PresignService` inyectado; cableado perezoso en `backend/src/api/app.ts` ll. 112–126. **Motivo técnico:** la fuente de verdad es el cliente ya implementado; resolver la divergencia en el servidor evita tocar el catálogo congelado ni el frontend. **Intentos fallidos relevantes:** el Developer documenta el fallo intermedio de `savings-coherence` (P-2), corregido dentro de GREEN; no se reabre aquí. **Disposición propuesta:** dar por **RESUELTO** `F03-AUD-01` en el expediente F03 por el responsable de cierre; no conceder G-10. |
| **5. Verificación** | **Verificador independiente:** `Auditor` (alcance de contrato) · **Comando/procedimiento:** inspección estática comparativa handler ↔ cliente ↔ acuerdo documentado; **sin reejecutar `vitest`** · **Resultado y evidencia:** coincidencia exacta de nombres, tipos y estructura de respuesta; 201 con `uploads` confirmado en código · **Regresión comprobada:** no aplica a este eje (no se reejecutó la suite; ver §2.4) · **Límites:** la ejecución real del PUT y la forma observada en caliente se atribuyen a `F02-AUD-01-contract-shape.txt` y `F02-AUD-01-upload-put.txt`, **no reproducidas** por esta auditoría. |
| **6. Pendientes** | **Riesgo residual:** ninguno en la forma del contrato · **Cobertura ausente:** verificación dinámica independiente del Tester (fuera de este encargo) · **Responsable y siguiente paso:** Architect — reflejar el cierre de `F03-AUD-01` en el addendum de `reports/verification/F02-architect.md` y notificar al responsable F03; Tester — mantener su dictamen funcional propio. |
| **7. Aprendizaje** | **Prevención propuesta:** cuando dos fases comparten un contrato HTTP, la fuente de verdad es el cliente implementado y la divergencia se resuelve en el servidor sin alterar esquemas congelados · **Ámbito candidato:** `PROPUESTA_GLOBAL` · **Estado:** `PENDIENTE_DE_EVALUAR`. |

**Severidad:** `INFO` (cierre de hallazgo HIGH previo; no es un defecto nuevo) · **Confianza:** `HIGH` (cotejo directo de código y acuerdo documentado) · **Evidencia:** `CORROBORATED` (código + reporte del Developer; ejecución reportada, no reproducida) · **Bloqueante de auditoría:** `NO`.

---

### Problema `A-02` — `contentType` y `sizeBytes` se validan como metadatos declarados, no se vinculan criptográficamente a la PUT

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID: `A-02` · Tarea: `F02-AUD-01` · Fase: `P-02` · Loop: `1/3` · Fecha: `2026-11-18` · Entorno: inspección estática, S3 `raw` vía URL presignada, sin emulador |
| **2. Problema** | **Síntoma:** `parseCreateBody` rechaza SVG/GIF/PDF y cualquier MIME no raster (`ALLOWED_CONTENT_TYPES`, ll. 74–79) y exige `sizeBytes` entero `> 0` y `<= config.limits.maxFileSizeMb` (ll. 112, 127–137), pero `deps.presign.presignUpload({ userId, jobId, imageId })` (l. 229) **no recibe** `contentType` ni `sizeBytes`; `createPresignService().presignUpload` (`presigner.ts` ll. 101–112) firma un `PutObjectCommand({ Bucket, Key })` sin `ContentType` ni condición de tamaño. **Esperado:** el criterio del addendum exige validación MIME/tamaño en el endpoint, no fijar el tipo en la firma. **Observado:** la validación exigida **sí se cumple** en el request; la URL firmada autoriza una PUT de cualquier bytes/`Content-Type` a la clave correcta. **Impacto:** defensa en profundidad incompleta frente a un usuario autenticado que declare `image/png` y suba otro contenido; el procesamiento real con `sharp` (worker, F02-T01…T06) es el que determina el formato efectivo. **No se demuestra** bypass de aislamiento ni subida fuera del prefijo del usuario. **Reproducción:** leer `jobs.ts` ll. 74–79, 115–140, 226–233 y `presigner.ts` ll. 82–112. |
| **3. Causa** | **Estado:** `DEMOSTRADA` para la no vinculación; `HIPÓTESIS` para abuso efectivo. **Evidencia:** código citado; `PresignRequest` (`presigner.ts` ll. 39–44) no admite `contentType`/`sizeBytes`. **Alternativas descartadas:** atribuirlo a F03 (el cliente solo envía los metadatos acordados); considerarlo regresión del addendum (el patrón de presigned PUT ya existía en `/presign`, no modificado). |
| **4. Solución** | **Cambios aplicados:** ninguno (el Auditor no implementa). **Motivo técnico:** el acuerdo F03 define la validación en la creación del lote; restringir la PUT exigiría ampliar `PresignRequest` y el interfaces `PresignService`, lo cual está **fuera del ámbito** (`backend/src/storage/**` solo consumo de API pública). **Intentos fallidos relevantes:** no endurecer la firma de forma ad-hoc desde `api/**`. **Disposición propuesta:** seguimiento documental para F04/F05 (validación real del binario en worker y cotejo `HeadObject.ContentLength` contra `sizeBytes`); **no se concede G-10**. |
| **5. Verificación** | **Verificador independiente:** `Auditor` · **Comando/procedimiento:** traza de datos desde `body.files[].contentType`/`sizeBytes` hasta la llamada de firma, y lectura de `PresignRequest`/`PutObjectCommand` · **Resultado y evidencia:** los metadatos se consumen solo en validación; no aparecen en la firma · **Regresión comprobada:** no aplica · **Límites:** no se ejecutó una PUT con contenido hostil (sin emulador ni suite funcional, por instrucción). |
| **6. Pendientes** | **Riesgo residual:** bajo, acotado a usuario autenticado; contenido no conforme sería procesado/rechazado aguas abajo · **Cobertura ausente:** aserción de formato real y de tamaño del objeto en `raw` frente a lo declarado · **Responsable y siguiente paso:** Architect — derivar a F04/F05; Tester — añadir cobertura de binario hostil si se amplía el alcance. **No bloquea** este addendum. |
| **7. Aprendizaje** | **Prevención propuesta:** cuando un endpoint solo devuelve una URL presignada, tratar los metadatos declarados como pista y anclar la verdad al objeto (tipo/tamaño) en la confirmación o en el worker · **Ámbito candidato:** `PROPUESTA_GLOBAL` · **Estado:** `PENDIENTE_DE_EVALUAR`. |

**Severidad:** `LOW` · **Confianza:** `HIGH` para la no vinculación (código) / `MEDIA` para el impacto (depende del worker) · **Evidencia:** `CORROBORATED` (inspección estática) · **Bloqueante de auditoría:** `NO` (inherente al patrón presigned PUT; no incumple el criterio del addendum).

---

### Problema `A-03` — La congelación y la ausencia de push se acreditan por declaración y metadatos, no por Git ni por el test de congelación

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID: `A-03` · Tarea: `F02-AUD-01` · Fase: `P-02` · Loop: `1/3` · Fecha: `2026-11-18` · Entorno: comprobación de solo lectura de metadatos de archivo; Git/Docker/AWS prohibidos |
| **2. Problema** | **Síntoma:** el encargo exige verificar `contracts/**` y `types.generated.ts` intactos (hash `5d0082f8…`), sin tocar `frontend/`, `infra/`, `.github/`, `STATE.md`, `tasks.md`, manifiestos ni push. **Esperado:** evidencia de que el addendum solo modificó `backend/src/api/**`, tests y reportes. **Observado:** (a) `types.generated.ts` l. 4 declara el hash `5d0082f8d97e0329862739123b7599c75ff7261834430039fa6e815bf68d626d`, coincidente con el citado en `STATE.md` y en el Developer; (b) `LastWriteTime` de los cuatro archivos de `backend/src/contracts/**` y de `types.generated.ts` es `17/11/2026` (F01), mientras `jobs.ts`/`app.ts` son `18/11/2026 05:32–05:34`; (c) `STATE.md` (`18/11 05:25`) y `tasks.md` (`18/11 05:20`) son **anteriores** a los cambios del addendum; (d) el Developer declara explícitamente no haber tocado esas rutas ni hecho push. **Impacto:** ninguna contradicción observada; la limitación es metodológica, no un defecto. **Reproducción:** `LastWriteTime` de las rutas citadas + §1 y §7 del reporte del Developer + l. 4 de `types.generated.ts`. |
| **3. Causa** | **Estado:** `DEMOSTRADA` para la limitación (prohibición de Git y de reejecutar tests en el encargo). **Evidencia:** metadatos y declaraciones citadas. **Alternativas descartadas:** usar `git diff`/`git status` o ejecutar el test de congelación de F01-T01 (ambos fuera del encargo de este Auditor). |
| **4. Solución** | **Cambios aplicados:** ninguno. **Motivo técnico:** separar severidad de confianza y de cobertura: la congelación queda `CORROBORATED` por evidencia documental/temporal y el test de congelación reportado en `F02-AUD-01-unit.txt` (275/275), sin presentarlo como reproducido por mí. **Intentos fallidos relevantes:** no inferir "sin push" de los timestamps: se registra como **no verificado por este rol**. **Disposición propuesta:** el Architect puede cerrar el apartado de congelación con el test reportado; **no se concede G-10**. |
| **5. Verificación** | **Verificador independiente:** `Auditor` · **Comando/procedimiento:** lectura de metadatos de archivo (sin Git) y cotejo de declaraciones · **Resultado y evidencia:** coherencia temporal y documental; sin indicio de modificación de las rutas prohibidas · **Regresión comprobada:** no aplica · **Límites:** no se validó el byte-a-byte del catálogo ni el historial Git/push. |
| **6. Pendientes** | **Riesgo residual:** nulo dentro del alcance · **Cobertura ausente:** `git diff --name-only`, hash calculado sobre `canonicalCatalogJson()` y comprobación de `git status` (competencia de cierre del Architect con G-6) · **Responsable y siguiente paso:** Architect — contrastar con el cierre de F02 cuando corresponda, sin que este reporte lo sustituya. |
| **7. Aprendizaje** | **Prevención propuesta:** en auditorías sin Git, declarar explícitamente la congelación como evidencia documental/temporal y no como verificación de diff · **Ámbito candidato:** `SOLO_LOCAL` · **Estado:** `PENDIENTE_DE_EVALUAR`. |

**Severidad:** `INFO` · **Confianza:** `HIGH` (acotación metodológica) · **Evidencia:** `CORROBORATED` para metadatos/declaraciones; `INDICATIVE` para "sin push" (no verificable aquí) · **Bloqueante de auditoría:** `NO`.

---

## 2. Verificación por eje del encargo

### 2.1 Contrato — forma exacta (sin duplicar la suite del Tester)

| Comprobación | Resultado | Evidencia estática |
|---|---|---|
| Request `{ preset, files:[{fileName, contentType, sizeBytes}] }` | ✅ Conforme | `jobs.ts` ll. 48–57, 99–143; coincide con `JobUploadRequest` (`frontend/src/api/jobs.ts` l. 3) |
| Response `201 { job, uploads:[{imageId, uploadUrl, method:'PUT', headers?}] }` | ✅ Conforme | `jobs.ts` ll. 59–69, 226–237; coincide con `JobUploadPlan` (l. 4). `headers?` se conserva opcional y no se emite (no lo produce `PresignResult`): el tipo lo admite, por lo que la forma es un subconjunto compatible |
| Preservación de validación de preset | ✅ Conforme | `schemas.Preset` vía `parseWith` (l. 107) |
| `F03-AUD-01` resuelto | ✅ **SÍ** | Ver §4 |

### 2.2 Seguridad

| Comprobación | Resultado | Evidencia estática |
|---|---|---|
| `userId` del JWT, nunca del cuerpo | ✅ Conforme | `c.get('userId')` (ll. 183, 203, 254, 265); `BODY_KEYS` solo `preset`/`files` (l. 71) y clave desconocida → 400 (l. 105); `requireAuth` antes del resto (l. 181) |
| `imageId` UUID seguro, no derivado de `fileName` | ✅ Conforme | `randomUUID()` por archivo (ll. 204, 228); `fileName` se valida con `isSafeFileName` (ll. 82–91) y **no interviene** en la clave |
| MIME raster / rechazo SVG, GIF, PDF y variantes | ✅ Conforme | `ALLOWED_CONTENT_TYPES` = `image/jpeg`, `image/png`, `image/webp`, `image/avif` (ll. 74–79); comparación exacta sensible a mayúsculas; parámetros → rechazo |
| `sizeBytes` y lote desde config | ✅ Conforme | `config.limits.maxImagesPerBatch` (l. 110) y `maxFileSizeMb` (l. 112); `schemas.LimitsConfig.safeParse` fail-closed (l. 101); `sizeBytes` entero `> 0` y `<= maxBytes` (ll. 127–137) |
| Claves desconocidas rechazadas | ✅ Conforme | `BODY_KEYS` (l. 71) + `FILE_KEYS` (l. 72) + comprobaciones ll. 105 y 118 |
| URL HTTPS PUT sobre `rawImageKey` del usuario | ✅ Conforme | `verifiedUploadUrl` (ll. 150–171) exige `method === 'PUT'`, `key === rawImageKey({userId, jobId, imageId})`, `https:`, sin userinfo; `rawImageKey` = `userId/jobId/raw/imageId` con segmentos validados (`keys.ts` ll. 31–53); `assertKeyWithinPrefix` en `presigner.ts` l. 103 |
| Sin exponer bucket/key/secretos | ✅ Conforme | `uploads` solo `{imageId, uploadUrl, method}` (l. 232); `verifiedUploadUrl` devuelve únicamente `result.url` (l. 170); ni `bucket`, `key`, `expiresIn` ni `expiresAt` en la respuesta. Mensajes de error genéricos (`validationError()`), sin valores rechazados |
| Orden de guardas / rate limit no suplantable (seguimiento F01) | ✅ Conforme | auth → límite por `c.get('userId')` → resto (ll. 180–190); la clave no sale de `x-forwarded-for`/`x-real-ip` |
| Vinculación de metadatos a la PUT | ⚠️ `LOW` (A-02) | Validación declarada correcta; no fijada en la firma. Inherente al patrón, fuera del criterio del addendum |

### 2.3 Congelación y ámbito

- **`backend/src/contracts/**` y `types.generated.ts`:** sin indicios de modificación (fecha `17/11`, hash declarado `5d0082f8…68d626d` coherente, §1 `A-03`). No se regeneraron tipos: se usaron tipos locales en `api/**`.
- **`frontend/`, `infra/`, `.github/`, `STATE.md`, `tasks.md`, manifiestos:** sin indicios de escritura por el addendum; `STATE.md`/`tasks.md` tienen timestamps previos a `jobs.ts`/`app.ts` y el Developer declara no haberlos tocado. **"Sin push" no es verificable por este rol** (sin Git): se registra como tal, no como affirmación.
- **Sin secretos / rutas Windows absolutas en artefactos nuevos:** el reporte del Developer usa marcadores de entorno y no muestra valores de `.env` (G-3/G-6b). ✅

### 2.4 No regresión de `/presign`, `/confirm`, descarga y T06 (según evidencia, sin repetir pruebas)

- `app.ts` conserva `mountPresignRoutes` (ll. 128–136) y `mountDownloadRoutes` (ll. 138–149) con el **mismo** `getPresignService()` perezoso que se inyecta ahora en `POST /jobs` (ll. 72–73, 122–124): el cambio es **adicional**, no sustitutivo. ✅ por inspección.
- `/confirm` (`jobs.ts` ll. 264–322) y listado/detalle (ll. 243–262) permanecen sin cambios de forma; el bloque de creación es el único adaptado. ✅ por inspección.
- Evidencia **reportada** (no reproducida): `F02-AUD-01-integration.txt` → 29/29 (incluye T06/e2e-metrics/e2e-persist); `F02-AUD-01-upload-put.txt` → 3/3 con PUT real y `HeadObject` 200; `F02-AUD-01-unit.txt` → 275/275; `F02-AUD-01-typecheck.txt` y `-lint-scoped.txt` → EXIT 0. ✅ atribuido al Developer; **cobertura LIMITED** en esta auditoría.
- Estrategia de fixtures de T06 (P-3 del Developer): se conserva la siembra vía `/presign/upload` con ids lógicos y se añade una prueba focal con la URL real de `uploads`. Criterio razonable; no se reabre aquí. ✅

---

## 3. Cobertura, evidencia y dictamen

| Dimensión | Clasificación | Justificación |
|---|---|---|
| Contrato (forma exacta F03) | `SUFFICIENT` · `CORROBORATED` · `HIGH` | Cotejo directo handler ↔ cliente ↔ acuerdo; sin ambigüedad de campos |
| Seguridad estática del endpoint | `SUFFICIENT` · `CORROBORATED` · `HIGH` | Todas las comprobaciones del encargo conformes, salvo el matiz `LOW` de A-02 |
| Congelación / ámbito | `SUFFICIENT` para evidencia documental y temporal; `LIMITED` para diff byte-a-byte y push | Sin Git ni test de congelación ejecutado (A-03) |
| No regresión | `LIMITED` · `INDICATIVE`/reportada | Inspección de wiring propia + evidencia del Developer; suite **no repetida** por instrucción |
| **Cobertura global del alcance asignado** | **`SUFFICIENT`** (con `LIMITED` declarado para ejecución dinámica y Git) | El encargo es de riesgo 3 estático y de contrato, no funcional |
| **Dictamen** | **`READY_WITH_CONCERNS`** | Sin `CRITICAL`/`HIGH`/`MEDIUM` ni bloqueantes; concerns: A-02 (`LOW`), A-03 (limitación metodológica) y dependencia de la verificación funcional del Tester, que no se duplica aquí |

No se concedió ninguna dispensa ni se aceptó riesgo en nombre de Lino (**sin G-10**). Los concerns se proponen como seguimientos con responsable (Architect → F03/F04/F05; Tester → dictamen funcional), no como aceptación.

---

## 4. Resolución explícita de `F03-AUD-01`

**SÍ: `F03-AUD-01` puede darse por resuelto** en lo que a esta auditoría compete.

- La decisión de Lino/CTO exigía que **F02 adoptara el acuerdo F03** (`files` → `{job, uploads}`) y que F03 permaneciera pendiente hasta la confirmación del responsable F02. Esa adopción está **implementada y cotejada** en `backend/src/api/jobs.ts` (forma exacta, sin tocar el catálogo congelado ni el cliente), con firma PUT integrada y `userId` del JWT.
- La divergencia que motivó el hallazgo (`images` → `{job}`) **ya no existe** en el código observado. La evidencia reportada de PUT real y sonda de forma refuerza la interoperabilidad, aunque **no ha sido reproducida por este Auditor** (competencia del Tester).
- Por tanto, la condición de cierre descrita en `reports/audits/F03/F03-auditor.md` ll. 158 y 178 — *"responsable F02 confirma/adopta el acuerdo y aporta evidencia compatible"* — queda satisfecha en el plano del contrato y de la implementación inspeccionada.
- **Condicionamiento:** el cierre formal en el expediente F03 y el dictamen funcional `PASSED`/`NO-PASSED` corresponden al Architect y al Tester, respectivamente. Esta auditoría **no emite** ese dictamen ni sustituye la verificación de integración independiente. Los demás hallazgos F03 (`AUD-03`, `AUD-07`, `AUD-08`, `AUD-09` y el `F03-LOOP3-E2E-01`) **permanecen fuera de este alcance** y no se dan por resueltos aquí; en particular, el concern de allowlist de hosts (`F03-AUD-03`) es de frontend y no se reabre ni se cierra en este addendum.

---

*Fin del reporte — `F02-AUD-01-auditor.md` (append-only; único archivo escrito por este rol).*
