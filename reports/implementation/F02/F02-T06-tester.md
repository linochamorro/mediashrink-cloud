# Dictamen de Tester independiente — `F02-T06`

| Campo | Valor |
|---|---|
| **Tarea** | `F02-T06` — Métricas reales e integración backend completa |
| **Fase / paquete** | Fase 2 — `docs/sdd/packages/P-02-api-and-worker.md` (`CA-06`) |
| **Rol / harness** | Tester independiente · OpenCode |
| **Riesgo** | 2 (Relevante) |
| **Versión revisada** | `v1 — Loop 1/3` (entrega del Developer, `DONE_WITH_CONCERNS`) |
| **Loop consumido por este dictamen** | **`Ninguno`** (veredicto `PASSED` en la primera revisión; no se activan loops) |
| **Ejecución propia** | Sí: 14 evidencias `F02-T06-tester-*.txt`, emulador G-7 levantado y apagado, 4 sondas propias (métricas, coherencia, estados/observabilidad, `CONFIRM_INCONSISTENT`) sin ficheros temporales |
| **Veredicto global** | **`PASSED`** |

## 1. Fuentes y criterio aplicado

Contrato de rol (`.agents/roles/tester.md`), `AGENTS.md`, `STATE.md`, `docs/sdd/packages/P-02-api-and-worker.md` (`CA-06`), `docs/sdd/spec.md` (FR-12/FR-14, PR-12), `docs/sdd/constitution.md` (PR-12/IN-08), `F02-T06-task.md`, `F02-T06-developer.md`, cierres `F02-T01-architect.md` (A-02/`CONFIRM_INCONSISTENT`, A-05) y `F02-T04-architect.md` (A-04/`publishJob`), `docs/runbooks/development-workflow.md` §1, y código sin modificar en `backend/src/api/**` y `backend/src/worker/**`.

Criterio: **ejecución propia** contra la aceptación aprobada, no contra la interpretación del implementador. La evidencia del Developer se consultó solo como registro cronológico (TDD); ningún artefacto ajeno se presenta como evidencia propia. Sin secretos ni rutas Windows absolutas en los artefactos nuevos (`SCAN_CLEAN`: 13/13 evidencias escaneadas, 0 coincidencias de unidad `Projects/Programs/Users/Temp` ni de patrones de credenciales).

## 2. Dictamen por criterio

| # | Criterio / fuente | Verificación propia y evidencia | Resultado |
|---|---|---|---|
| 1 | Suite de integración (`F02-T06-tester-integration.txt`) | `npx vitest run tests/integration/api tests/integration/worker` → **11 archivos, 47/47**, exit 0. Escaneo de `tests/integration/**` con `\.(skip\|only\|todo)\(` y `xit`/`xdescribe`: **NINGUNO**. Incluye 5/5 E2E, 2/2 coherencia (0 %/negativo), 1/1 snapshot de observabilidad y 9/9 consumidor SQS. | **CUMPLIDO** |
| 2 | Métricas reales en DynamoDB (`F02-T06-tester-metrics-probe.txt`, `F02-T06-tester-coherence-probe.txt`, `F02-T06-tester-integration.txt`) | Sonda propia E2E: `declaredBytes=1`, `HeadObject.ContentLength=768`, `job.bytesBefore=768` (≠ declarado), `bytesAfter=508` (suma exacta WebP+AVIF+miniatura), `savingsPct=33.85416666666667` (`computeSavings`), `exifStripped=true`, `COMPLETED`. El test E2E comprueba control positivo de marcadores en la entrada y ausencia en las tres salidas antes de certificar `exifStripped`. Coherencia propia en DynamoDB real: `(1000,1000)→0 %` y `(100,150)→−50 %`, ambos con `schemas.Job` y `schemas.JobMetrics` en `success=true`; el refinamiento congelado `savings-coherence` **recalcula** `(antes−después)/antes*100` y rechaza discrepancias >0.01, por lo que la validación no es meramente declarativa. Sin recorte de 0 % ni negativos (PR-12). | **CUMPLIDO** |
| 3 | Estados coherentes (`F02-T06-tester-states-probe.txt`, `F02-T06-tester-integration.txt`) | Sondas propias: (a) una imagen `FAILED` + una `COMPLETED` → `batchStatus=PARTIAL`, `job.status=PARTIAL`, imágenes `img-bad=FAILED`/`img-good=COMPLETED` (el lote **no** se aborta); (b) todas `FAILED` → `batchStatus=FAILED`, `job.status=FAILED`. Ambos validados con `schemas.Job.safeParse(...).success=true` en sonda y en el test E2E. Comportamiento `COMPLETED` cubierto en el criterio 2. Transiciones gobernadas por la máquina de estados congelada (`ALLOWED_TRANSITIONS`/`nextStatus`/`resolveBatchStatus`). | **CUMPLIDO** |
| 4 | E2E backend completo (`F02-T06-tester-integration.txt`, `F02-T06-tester-metrics-probe.txt`) | 5/5 E2E con `app.request()` contra el emulador: `register` → `POST /jobs` → `/presign/upload` + PUT a `raw` → `confirm` → publicador real `SqsJobQueuePublisher` → consumidor SQS (`drainQueue`) → `processImage` → DynamoDB → `GET /jobs/:id`. La sonda propia reproduce el flujo y lee el job persistido (`status`, métricas, imágenes) desde DynamoDB. El binario sube por URL firmada, nunca por el cuerpo declarado. | **CUMPLIDO** |
| 5 | Cableado `publishJob` y observabilidad (`F02-T06-tester-integration.txt`, `F02-T06-tester-states-probe.txt`) | Revisión de código: `enriched-publisher.ts` lee los objetos `raw` reales y llama a `delegate.publishJob(envelope)` (nunca `publish()`); `app.ts` lo inyecta solo si `supportsJobEnvelope()`, preservando los dobles de T01/T05 (cierra T04 A-04). Sonda propia con DLQ caída: `dlqFailures=1`, `dlqDeliveryFailed=true`, lote `PARTIAL` sin abortar; redelivery de sobre terminal: `skippedAsDuplicate=true`, `outcomes=0`, `dlqFailures=0` (sin reprocesar ni reenviar a DLQ). `summarizeConsumeResult()` expone los tres campos en snapshot serializable (1/1 integración). | **CUMPLIDO** |
| 6 | `CONFIRM_INCONSISTENT` at-most-once (`F02-T06-tester-inconsistent-probe.txt`, `F02-T06-tester-integration.txt`) | Sonda propia con publicación y reversión fallidas: primer `confirm` → `503` con `error.code=CONFIRM_INCONSISTENT`, lote en `PROCESSING`; reintento → `200` `confirmed:true` con `publishCalls=1` y cola principal vacía. **No se finge reparación**: no se republica en el reintento. Coincide con el test E2E y con el seguimiento P-3 del Developer; sin `G-10`. | **CUMPLIDO** |
| 7 | Regresión y gates (`F02-T06-tester-unit.txt`, `F02-T06-tester-typecheck.txt`, `F02-T06-tester-lint-scoped.txt`, `F02-T06-tester-lint-global.txt`) | `npm run test:unit` → **30 archivos, 266/266**, exit 0. `npm run typecheck` → exit 0, sin diagnósticos. ESLint acotado a `backend/src/api`, `backend/src/worker`, `tests/integration/api`, `tests/integration/worker` → exit 0. `npm run lint` global → exit 1 por **1 error en `tests/unit/frontend/core.test.ts`** (`Theme` sin usar), código de **F03 paralelo, ajeno a F02**: interferencia documentada, **0 hallazgos en rutas F02**, no bloqueante. | **CUMPLIDO** |
| 8 | Ámbito, sin push y Docker (`F02-T06-tester-docker-*.txt`, `F02-T06-tester-emulator-down.txt`) | `git status -sb` → `## main...origin/main` sin delante/atrás (**sin push**). Escrituras propias limitadas a 14 evidencias y este dictamen; sin edición de código, tests, manifiestos, `STATE.md`, `tasks.md` ni reportes ajenos; sin dependencia de `temporary/`. Emulador `up` con `memory=2147483648`, `nanoCpus=2000000000`, `user=1000:1000`, `host_ip=127.0.0.1` (sin `:9324`), `docker cp` ×3 y healthcheck `ok`; al cerrar: `docker compose down` exit 0, `docker ps -a` vacío (solo cabecera), red eliminada y `:9297` cerrado (curl exit 7). | **CUMPLIDO** |

## 3. Notas

- Cronología TDD del Developer revisada como **registro íntegro** (RED 3 fallos por comportamiento → GREEN 4/4 → REFACTOR 8/8, regresión 47/47 y unit 266/266). **No se reejecutó el RED ni se invirtió código** para certificarlo; el dictamen se apoya en ejecución propia de comportamiento, no en la lectura del reporte ajeno.
- El worker mide `bytesAfter` a partir de los buffers renderizados reales y **no escribe** las variantes optimizadas en `optimized/**` en este task (alcance de `storage/**` intacto, documentado por el Developer como fuera de T06; la descarga se cubrió en T05). No afecta a CA-06 tal como está redactado (métricas honestas sobre bytes reales renderizados + E2E hasta la consulta), pero queda como **seguimiento no bloqueante**: si se decide persistir las variantes en el wiring de producción, verificar `HeadObject` contra la métrica.
- La interferencia de F03 (frontend en edición) se aisló con gates acotados en verde y evidencia separada; no se modificó código ajeno para «arreglar» el lint global.
- No se encontraron incumplimientos de `CA-06`, por lo que **no se registran problemas con los 7 campos obligatorios** ni se activa ningún loop de corrección.

## 4. Conclusión

`CA-06` queda satisfecho con evidencia de ejecución propia: métricas calculadas con los bytes reales del objeto S3 (`768` frente a `1` declarado; `bytesAfter=508` = suma de salidas reales; `savingsPct` exacto; `exifStripped` verificado contra marcadores), 0 % y negativo persistentes sin recorte y validados por el refinamiento `savings-coherence`, estados `COMPLETED`/`PARTIAL`/`FAILED` coherentes y validados con `schemas.Job`, E2E backend completo contra el emulador, cableado de `publishJob` con observabilidad de DLQ/duplicados, `CONFIRM_INCONSISTENT` documentado como at-most-once sin reparación fingida, regresión 266/266 con typecheck y lint acotado en verde, y Docker apagado. Registros cronológicos íntegros, sin hallazgos bloqueantes CRITICAL/HIGH ni revisiones obligatorias pendientes.

**Veredicto global: `PASSED`.** No se activa ningún loop de corrección. Se entrega a Architect para su integración y cierre.

---

## Addendum — `v2 — Loop 2/3` (re-verificación de la corrección de `A-01`)

| Campo | Valor |
|---|---|
| **Versión revisada** | `v2 — Loop 2/3` (entrega correctiva del Developer; addendum append-only) |
| **Origen** | `reports/audits/F02/F02-T06-auditor.md` §1 `A-01` (`MEDIUM`) y addendum del Developer en `F02-T06-developer.md` §§ Tras-7 |
| **Alcance de esta re-verificación** | **Solo el criterio afectado por la corrección**: persistencia de las tres variantes en `optimized`, anclaje de `bytesAfter`/`savingsPct` a `HeadObject`, descarga/ZIP byte-idénticos y no-regresión de `publishJob`, DLQ/estados y `CONFIRM_INCONSISTENT`. El `PASSED` de v1 se conserva íntegro. |
| **Ejecución propia** | Sí: 8 evidencias `F02-T06-tester-loop2-*.txt`, emulador G-7 levantado/apagado y 2 sondas propias (persistencia y regresión) con clientes reales del emulador |
| **Loop consumido por este addendum** | `Loop 2/3` (ya consumido por la corrección); **no se activa el loop 3** |
| **Veredicto del addendum** | **`PASSED`** |

### A.1 Criterios re-verificados

| # | Criterio | Verificación propia y evidencia | Resultado |
|---|---|---|---|
| 1 | Suite de integración (`F02-T06-tester-loop2-integration.txt`) | `npx vitest run tests/integration/api tests/integration/worker` → **12 archivos, 50/50**, exit 0 (antes 11/47: +3 de `e2e-persist.test.ts`). Sin `skip/only/todo` en el árbol de integración. | **CUMPLIDO** |
| 2 | `A-01` — bytes anclados al artefacto persistido (`F02-T06-tester-loop2-persist-probe.txt`) | Sonda propia E2E: `HeadObject.ContentLength` de las 3 variantes = `webp 98 + avif 304 + thumbnail 98 = 500`; `job.bytesAfter` leído de DynamoDB vía `GET /jobs/:id` = **500**; `sumEqualsBytesAfter=true` y `savingsOk=true` (`computeSavings` sobre la suma confirmada). `confirm=200`, `completed=1`, `batchStatus=COMPLETED` con el publicador real inyectado (`publishJob` vía adaptador enriquecido). Revisión de código: `writeOptimizedVariants()` (`storage/objects.ts`) hace `PutObject` + `HeadObject` por variante y lanza `OptimizedWriteError` si `ContentLength !== bytes.byteLength` (**fail-closed**); el consumidor re-deriva `bytesAfter`/`savingsPct` antes de `updateImage`/`updateJob`. | **CUMPLIDO** |
| 3 | Descarga individual y ZIP byte-idénticos (`F02-T06-tester-loop2-persist-probe.txt`) | Sonda propia: para `webp`, `avif` y `thumbnail`, `GET /jobs/:id/download/:imageId?variant=…` → ruta `200`, URL presignada HTTP `200` y `body.equals(objeto real)=true` en los tres. `GET /jobs/:id/download.zip` → `200`, entradas exactas `[img-persist.avif, img-persist.webp, img-persist_thumb.webp]` y `bytes.equals(objeto real)=true` en las tres. | **CUMPLIDO** |
| 4 | No regresión de DLQ/estados/`CONFIRM_INCONSISTENT` (`F02-T06-tester-loop2-regression-probe.txt`) | Sondas propias tras el cambio del consumidor: (A) una imagen `FAILED` + DLQ caída → `PARTIAL` en lote y job, `dlqFailures=1`, `dlqDeliveryFailed=true`, redelivery `skippedAsDuplicate=true` con `outcomes=0` y `dlqFailures=0`; (B) todas `FAILED` → `FAILED`; (C) publicación y reversión fallidas → `503 CONFIRM_INCONSISTENT`, job en `PROCESSING`, reintento `200 confirmed:true` con `publishCalls=1` (**at-most-once sin reparación fingida, sin G-10**). Coincide con los 50/50 del criterio 1. | **CUMPLIDO** |
| 5 | Gates (`F02-T06-tester-loop2-typecheck.txt`, `F02-T06-tester-loop2-lint-scoped.txt`, `F02-T06-tester-loop2-lint-global.txt`) | `npm run typecheck` → exit 0. ESLint acotado a `backend/src/api`, `backend/src/worker`, `backend/src/storage`, `tests/integration/api`, `tests/integration/worker` (incluye el archivo corregido) → exit 0, sin hallazgos. `npm run lint` global → exit 1 por **1 error en `tests/unit/frontend/core.test.ts`** (`Theme` sin usar), código de **F03 paralelo, ajeno a F02**. | **CUMPLIDO** |
| 6 | Ámbito, sin push y Docker (`F02-T06-tester-loop2-docker-up.txt`, `F02-T06-tester-loop2-emulator-down.txt`) | Escrituras propias limitadas a 8 evidencias `loop2-*` y este addendum; sin editar código, tests, manifiestos ni reportes ajenos; rama `main...origin/main` sin push. Emulador `healthy` con `memory=2147483648`, `nanoCpus=2000000000`, `user=1000:1000`, `host_ip=127.0.0.1`, `docker cp` ×3 y healthcheck `ok`; al cerrar: `docker compose down` exit 0, `docker ps -a` vacío, sin red `mediashrink-cloud_default` y `:9297` cerrado (curl exit 7). `SCAN_CLEAN`: 8/8 evidencias sin secretos ni rutas Windows absolutas. | **CUMPLIDO** |

### A.2 Notas

- La fase RED del loop 2 se revisó como **registro cronológico** del Developer (`NotFound`/`404`/`[]`, 3 fallos por comportamiento); **no se reejecutó**. El dictamen se apoya en ejecución propia de comportamiento y en la suite 50/50.
- `A-01` queda **cerrado por corrección y reverificado**: la cifra de ahorro ya es contrastable con los bytes efectivamente almacenados en `optimized`. Los seguimientos `A-02` (`bytesBefore` del sobre), `A-03`/`A-04` (`CONFIRM_INCONSISTENT` y límite del doble) y `A-05` (lint F03) **no se reabren**; ninguno fue aceptado como riesgo (sin G-10).
- No se encontraron incumplimientos en el criterio re-verificado, por lo que **no se registran problemas con los 7 campos obligatorios** y no se activa ningún loop adicional.

### A.3 Conclusión del addendum

La corrección de `A-01` satisface el criterio afectado con evidencia propia: `suma(HeadObject.ContentLength)` = `job.bytesAfter` = 500 con `savingsPct` re-derivado, descarga individual y ZIP byte-idénticos a los objetos reales, persistencia fail-closed, y sin regresiones en `publishJob`, DLQ/estados ni `CONFIRM_INCONSISTENT`. Gates en verde salvo el lint global ajeno a F03; Docker apagado.

**Veredicto del addendum: `PASSED`.** No se activan más loops. Se entrega a Architect para su integración y cierre.
