# Entrega Developer — `F02-T06`

| Campo | Valor |
|---|---|
| **ID completo** | `F02-T06` — Métricas reales e integración backend completa |
| **Fase / paquete** | Fase 2 — `docs/sdd/packages/P-02-api-and-worker.md` |
| **Versión / Loop usado** | `v1 — Loop 1/3` (sin loops adicionales) |
| **Riesgo / rol** | `2 (Relevante)` · Developer (Tester + Auditor posteriores) |
| **Harness** | OpenCode |
| **Estado de entrega** | **`DONE_WITH_CONCERNS`** — retorno a Architect; **no emito `PASSED` ni cierro la tarea** |
| **CA cubierto** | `CA-06` (P-02 §5) |

## 1. Fuentes y criterio de aceptación

- `AGENTS.md`, `STATE.md`, `.agents/roles/developer.md` (lectura obligatoria).
- `docs/sdd/packages/P-02-api-and-worker.md` §5 (`CA-06`); `spec.md` **FR-12** (métricas reales), **FR-14** (consulta por polling), **PR-12**; `constitution.md` **PR-12** (métricas honestas, sin ocultar 0 % ni negativos) e **IN-08** (3 reintentos + DLQ sin abortar lote).
- `reports/implementation/F02/F02-T06-task.md` (fuente de verdad de alcance) y cierres `F02-T01…T05-architect.md`. En especial: T01 `A-02` (`CONFIRM_INCONSISTENT`), T03 `A-02` (usar `processImage`), T04 `A-04` (usar `publishJob`, no `publish`) y exposición de `dlqFailures`/`dlqDeliveryFailed`/`skippedAsDuplicate`.
- Código previo leído como referencia funcional: `backend/src/api/{app,publisher,jobs,job-transition}.ts`, `backend/src/worker/{index,publisher,consumer,messages,processImage,render,preflight}.ts`, `backend/src/contracts/{index,zod-schemas,catalog}.ts`, `backend/src/db/{index,types}.ts`, `backend/src/config/index.ts`, `backend/src/storage/{keys,client,objects}.ts`.

**CA-06:** al completar el job se persisten `bytesBefore`, `bytesAfter`, `savingsPct` y `exifStripped` con bytes reales (0 % y negativos permitidos, sin recorte), estados coherentes (`COMPLETED`/`PARTIAL`/`FAILED`) e integración E2E del backend contra el emulador. **Cubierto** con evidencia propia (§3, §5).

## 2. Cronología TDD

| Fase | Acción | Resultado |
|---|---|---|
| **RED** | Nueva prueba E2E `tests/integration/api/e2e-metrics.test.ts` + fixture `e2e-fixture.ts`, usando **solo APIs existentes** y el publicador real de `worker/**` inyectado tal cual. `npx vitest run tests/integration/api/e2e-metrics.test.ts` | **3 fallos por comportamiento**: el confirm publicaba `{userId, jobId}` sin `images`; el consumidor procesaba 0 imágenes → lote `FAILED` con `bytesBefore=0`, `exifStripped=false`, `dlqFailures=0`. La prueba de `CONFIRM_INCONSISTENT` ya pasaba (regresión documental). EXIT 1. |
| **GREEN** | Implementación mínima: `backend/src/api/enriched-publisher.ts` (lee los objetos de `raw` en S3 y delega en `publishJob`) + cableado condicional en `createApiApp()` + export en `backend/src/api/index.ts`. | **4/4** EXIT 0: confirm publica el sobre enriquecido, el worker procesa las imágenes y persiste métricas reales. |
| **REFACTOR** | `backend/src/worker/observability.ts` (`summarizeConsumeResult`), pruebas focales de 0 %/negativo y de strip byte-level, assert adicional `bytesAfter == suma de salidas reales`, timeouts explícitos. | **8/8** EXIT 0; regresión integración **47/47**, unit **266/266**. |

No se debilitó ninguna expectativa: el RED se conserva en `F02-T06-red.txt` y el GREEN en `F02-T06-green.txt`.

## 3. Comandos y evidencias

Todos ejecutados desde la raíz del proyecto. Las rutas concretas de Docker fuera de PATH no se versionan (G-6b); se anteponen al `PATH` como en `AGENTS.md` §6.

| Evidencia (`reports/implementation/F02/evidence/`) | Comando | Resultado |
|---|---|---|
| `F02-T06-red.txt` | `npx vitest run tests/integration/api/e2e-metrics.test.ts` | 3 fallos por comportamiento, EXIT 1 |
| `F02-T06-green.txt` | ídem tras la implementación | 4/4, EXIT 0 |
| `F02-T06-refactor.txt` | `npx vitest run tests/integration/api/e2e-metrics.test.ts tests/integration/worker/metrics-coherence.test.ts tests/integration/worker/observability.test.ts` | 3 archivos, 8/8, EXIT 0 |
| `F02-T06-metrics.txt` | foco `flujo completo\|0 %\|negativo` | 3/3, EXIT 0 |
| `F02-T06-states.txt` | foco `estados coherentes` | 1/1, EXIT 0 |
| `F02-T06-e2e.txt` | `npx vitest run tests/integration/api/e2e-metrics.test.ts` | 5/5, EXIT 0 |
| `F02-T06-observability.txt` | foco `observabilidad\|summarizeConsumeResult` | 2/2, EXIT 0 |
| `F02-T06-regression.txt` | `npx vitest run tests/integration/api tests/integration/worker` | 11 archivos, **47/47**, EXIT 0 |
| `F02-T06-unit.txt` | `npm run test:unit` | 30 archivos, **266/266**, EXIT 0 |
| `F02-T06-typecheck.txt` | `npm run typecheck` | EXIT 0, sin diagnósticos |
| `F02-T06-lint-scoped.txt` | `npx eslint backend/src/api backend/src/worker tests/integration/api tests/integration/worker --ext .ts` | EXIT 0, sin hallazgos |
| `F02-T06-metrics-probe.txt` | sonda efímera (`npx tsx`, eliminada después) | valores reales de la §5 |
| `F02-T06-emulator-down.txt` | `docker compose down` + `docker compose ps` + sondeo `:9297` | contenedor y red eliminados; `curl: (7) Could not connect` |

**G-7:** contenedor levantado solo durante las pruebas con `memory=2147483648`, `nanoCpus=2000000000`, `user=1000:1000`; `docker cp` de `ca.pem`/`config`/`emulator_credentials` repetido en cada arranque; `health=ok`; **apagado dos veces, la última tras toda la evidencia**. Sin secretos ni rutas Windows absolutas en artefactos nuevos.

## 4. Decisiones

### 4.1 Cableado de `publishJob()` en `createApiApp()`
- El puerto de T01 (`JobQueuePublisher.publish({userId, jobId})`) se conserva **sin cambios**. Se inyecta el publicador **real** de `worker/**` (`SqsJobQueuePublisher`) en `createApiApp()` a través de `deps.publisher`.
- `supportsJobEnvelope()` detecta la capacidad `publishJob()` y, solo entonces, `createS3EnrichedPublisher()` envuelve al delegado: lista `<userId>/<jobId>/raw/` en el bucket configurado, lee cada objeto con `GetObjectCommand`, construye `JobImagePayload[]` con `contentBase64` (sin `mimeType`/`filename` para no disparar `MIME_MISMATCH`/`EXTENSION_MISMATCH`; el formato se detecta por magic bytes) e incorpora el `preset` del lote; finalmente llama a `delegate.publishJob(envelope)`.
- **No se usa `publish()`** en el flujo E2E (cierra T04-A-04). Los dobles que solo implementan `publish()` (tests unitarios de T01/T05) quedan intactos por la comprobación de capacidad.
- Claves validadas con `assertSafeKeySegment`/`assertKeyWithinPrefix` (PR-07); cliente S3 perezoso construido desde `config` (`fromIni` + CA explícito, sin secretos fijos). No se tocaron `backend/src/storage/**` ni `backend/src/db/**`.

### 4.2 Observabilidad
- El consumidor ya devolvía `dlqFailures`, `dlqDeliveryFailed` (por outcome) y `skippedAsDuplicate` (T04). Se añade `summarizeConsumeResult()` en `backend/src/worker/observability.ts` para exponerlos como un snapshot serializable y se exporta desde `worker/index.ts`.
- La E2E los captura y verifica: DLQ caída → `dlqFailures=1`, `dlqDeliveryFailed=true`, lote `PARTIAL` sin abortar; redelivery de lote terminal → `skippedAsDuplicate=true`, sin reprocesar ni reenviar a DLQ (IN-08, T04 A-01/A-02).

### 4.3 `CONFIRM_INCONSISTENT` — política at-most-once (heredada T01 A-02)
- **No se finge reparación automática.** Si fallan publicación y reversión, `POST /jobs/:id/confirm` responde `503 CONFIRM_INCONSISTENT` y el lote queda en `PROCESSING`.
- Un reintento **no** republica: como el lote ya no está `PENDING`, la ruta devuelve `{ confirmed: true }` sin tocar SQS (**at-most-once**). Queda documentado con prueba E2E dedicada (cola principal vacía, `publishCalls=1`) y con el test unitario `tests/unit/api/confirm.test.ts`.
- **Sin G-10**: no se acepta riesgo en nombre de Lino. Queda como seguimiento funcional un marcador duradero / operación de reconciliación para F05 o fase posterior.

### 4.4 Métricas honestas (PR-12)
- `bytesBefore` = `ContentLength` del objeto real en S3 `raw` (verificado con `HeadObject` en la fixture); el valor declarado por el cliente se usa solo como dato de entrada del create y se demuestra que **no** coincide.
- `bytesAfter` = suma exacta de los tres buffers renderizados por `processImage` (WebP + AVIF + miniatura), verificada contra la suma de `byteLength` capturada en caliente.
- `savingsPct` = `computeSavings()` de F01-T05, sin recorte. `exifStripped: true` solo tras `assertMetadataStripped()`; la prueba comprueba ausencia de marcadores en las tres salidas y control positivo en la entrada.
- Persistencia validada con los esquemas congelados `schemas.Job` (refinamientos `savings-coherence` + `ttl-coherence`) y `schemas.JobMetrics`.

## 5. Resultado observable (sonda real)

Fixture 100×100 con EXIF/GPS/XMP/IPTC; `declaredBytes: 1` (estimación deliberadamente errónea):

| Campo | Valor |
|---|---|
| `HeadObject.ContentLength` en `raw` | **768** (= bytes de la fixture, ≠ 1) |
| `job.bytesBefore` | **768** |
| `job.bytesAfter` | **508** (suma real de las 3 salidas) |
| `job.savingsPct` | **33.85416666666667** (`computeSavings`, exacto) |
| `job.exifStripped` | **true** (3 salidas sin marcadores) |
| `job.status` / `batchStatus` | **COMPLETED** / **COMPLETED** |
| `dlqFailures` / `dlqDeliveryFailed` / `skippedAsDuplicate` | 0 / false / false |

0 % y negativo se cubren en DynamoDB real: `(1000,1000) → 0 %`, `(100,150) → -50 %`, ambos válidos con `schemas.Job` (PR-12).

## 6. Problemas registrados (7 campos)

### P-1 — Confirm publicaba el sobre mínimo sin imágenes
1. **Identificación:** `F02-T06-P-1` (RED, causa raíz del CA-06).
2. **Problema:** `POST /jobs/:id/confirm` publicaba `{userId, jobId}`; el consumidor recibía `images: []` y cerraba el lote como `FAILED` con métricas a 0.
3. **Causa (demostrada):** el puerto de T01 solo transporta identificadores; T04 enriqueció el sobre con `publishJob()` pero nadie lo cableó en la app (seguimiento T04-A-04). Evidencia: `F02-T06-red.txt` (3 fallos: `completed=0`, `FAILED` en vez de `PARTIAL`, `dlqFailures=0`).
4. **Solución e intentos fallidos:** adaptador `createS3EnrichedPublisher()` en `api/**` + cableado condicional en `createApiApp()`. No hubo parches encadenados; el único intento intermedio fue el RED esperado (no se corrigió antes de implementar).
5. **Verificación:** GREEN 4/4; E2E 5/5; regresión 47/47. `bytesBefore=768` vs declarado `1`.
6. **Pendientes:** ninguno dentro de T06.
7. **Aprendizaje candidato:** cuando un puerto heredado transporta menos datos que el consumidor, la conversión debe vivir en la capa que ya conoce el almacén (api/**), no en el productor ni en db/**.

### P-2 — Timeout de 5 s en pruebas de integración nuevas
1. **Identificación:** `F02-T06-P-2` (infraestructura de prueba).
2. **Problema:** los dos archivos nuevos de `tests/integration/worker/**` agotaban el timeout por defecto de Vitest (5 s) al crear tabla + TTL + colas.
3. **Causa (demostrada):** la fixture `createTestTable` espera `TableStatus=ACTIVE` y `TimeToLiveStatus=ENABLED`; `createTestQueues` crea dos colas. Salida: `Test timed out in 5000ms`.
4. **Solución e intentos fallidos:** declarar `30_000` ms en los `it()` afectados. Intento fallido: reejecutar sin cambiar el timeout (mismo resultado).
5. **Verificación:** `F02-T06-refactor.txt` → 8/8 EXIT 0; las pruebas E2E ya usaban `itE2e` con 40 s.
6. **Pendientes:** ninguno.
7. **Aprendizaje candidato:** toda prueba que invoque `createTestTable`/`createTestQueues`/`createTestBuckets` debe fijar timeout explícito desde el primer commit.

### P-3 — `CONFIRM_INCONSISTENT`: at-most-once sin reparación
1. **Identificación:** `F02-T06-P-3` (seguimiento T01 A-02 / T04).
2. **Problema:** fallo simultáneo de publicación y reversión deja el lote en `PROCESSING`; un reintento responde `confirmed: true` sin encolar.
3. **Causa (demostrada):** diseño at-most-once de T01; la reversión ya no es posible y no hay marcador duradero de inconsistencia. No es regresión de T06.
4. **Solución e intentos fallidos:** **documentar y probar la política, no simular reparación**. Se descartó "republicar en el reintento" porque rompería at-most-once y podría duplicar el procesamiento de imágenes ya completadas.
5. **Verificación:** prueba E2E `CONFIRM_INCONSISTENT` (503 sin `confirmed`, reintento 200 `confirmed:true`, `publishCalls=1`, cola vacía) + `tests/unit/api/confirm.test.ts`.
6. **Pendientes:** decidir en F05/fase posterior un marcador duradero y una operación de reconciliación; **sin G-10**.
7. **Aprendizaje candidato:** "no reparar automáticamente" es una decisión de producto que debe quedar escrita y probada, no solo implícita en el código.

### P-4 — Lint global rojo por el harness paralelo F03
1. **Identificación:** `F02-T06-P-4` (interferencia externa, heredada T01–T05).
2. **Problema:** el alcance global de ESLint puede verse afectado por archivos de `frontend/**` en edición por Codex (F03).
3. **Causa (hipótesis documentada):** fases paralelas con ámbitos excluyentes y `STATE.md` marcando `F03` en ejecución; no se constató hallazgo en archivos de F02.
4. **Solución e intentos fallidos:** ejecutar lint **acotado** a `backend/src/api`, `backend/src/worker`, `tests/integration/api`, `tests/integration/worker` → 0 hallazgos. No se corrigió código ajeno ni se silenciaron reglas.
5. **Verificación:** `F02-T06-lint-scoped.txt` EXIT 0; `F02-T06-typecheck.txt` EXIT 0.
6. **Pendientes:** el CTO consolida el estado global; no es bloqueante de T06.
7. **Aprendizaje candidato:** en fases paralelas, la evidencia debe delimitarse por rutas de propiedad para no aceptar como propia una señal ajena.

## 7. Estado final y handoff

- **Entrega:** `DONE_WITH_CONCERNS`. `CA-06` cubierto con evidencia real; TDD completo; emulador apagado; sin cambios en manifiestos, `backend/src/db/**`, `backend/src/storage/**`, `backend/src/index.ts`, frontend, infra, `.github`, `STATE.md`, `tasks.md` ni reportes ajenos; **sin push**.
- **Archivos propios nuevos/modificados:** `backend/src/api/enriched-publisher.ts`, `backend/src/api/app.ts`, `backend/src/api/index.ts`, `backend/src/worker/observability.ts`, `backend/src/worker/index.ts`, `tests/integration/api/e2e-fixture.ts`, `tests/integration/api/e2e-metrics.test.ts`, `tests/integration/worker/metrics-coherence.test.ts`, `tests/integration/worker/observability.test.ts`, evidencias `F02-T06-*` y este reporte.
- **Concerns / seguimientos (no bloqueantes, sin G-10):** (a) `CONFIRM_INCONSISTENT` at-most-once sin marcador duradero; (b) lint global dependiente de F03; (c) el worker mide `bytesAfter` a partir de los buffers renderizados reales y **no escribe** las variantes optimizadas en S3 (fuera del alcance de T06: `storage/**` intacto); si se decide persistirlas, verificar `HeadObject` contra la métrica.
- **Retorno:** se entrega a Architect para revisión de alcance y despacho a Tester/Auditor. **Este Developer no emite `PASSED` ni cierra `F02-T06`.**

---

## Addendum — Loop 2/3 (corrección del hallazgo `A-01` del Auditor)

| Campo | Valor |
|---|---|
| **Versión / Loop** | `v2 — Loop 2/3` (addendum append-only; no se borra el contenido v1) |
| **Encargo** | CTO: corregir `A-01` (`reports/audits/F02/F02-T06-auditor.md`): el worker no persistía las variantes en `optimized`, por lo que las URLs de T05 apuntaban a objetos inexistentes y `bytesAfter` no era contrastable |
| **Fuentes añadidas** | Auditoría `F02-T06-auditor.md` §1 `A-01`/V-2; `backend/src/api/download.ts`; `backend/src/storage/{objects,keys,presigner,client}.ts`; `tests/unit/api/zip-reader.ts`; `tests/integration/api/presign-fixture.ts` |
| **Ámbito respetado** | Solo `backend/src/worker/**`, `backend/src/storage/**`, `tests/integration/worker/**`, `tests/integration/api/**`, evidencias y este reporte. Sin manifiestos, `backend/src/db/**`, `backend/src/index.ts`, `backend/src/api/**`, frontend, infra, `.github`, `STATE.md`, `tasks.md`, reportes ajenos ni push |
| **Estado de entrega** | **`DONE_WITH_CONCERNS`** — retorno a Architect. **No emito `PASSED` ni cierro la tarea** |

### Cronología TDD del loop 2

| Fase | Acción | Resultado |
|---|---|---|
| **RED** | `tests/integration/api/e2e-persist.test.ts` (3 pruebas: `HeadObject` de las 3 variantes vs `bytesAfter`, descarga individual byte-idéntica, ZIP con las 3 entradas) sobre el flujo E2E ya verde. | **3 fallos por comportamiento**: `HeadObject` → `NotFound`, GET presignado → `404`, ZIP → entradas `[]`. EXIT 1 (`F02-T06-loop2-red.txt`). |
| **GREEN** | `writeOptimizedVariants()` en `backend/src/storage/objects.ts` (usa el `S3Client` existente, `PutObjectCommand` + `HeadObjectCommand` y `optimizedImageKey`) y llamada en `backend/src/worker/consumer.ts` tras `processImage`, re-derivando `bytesAfter`/`savingsPct` de los bytes persistidos. | **3/3** EXIT 0 (`F02-T06-loop2-green.txt`). |
| **REFACTOR** | Capacidad de escritura aislada en `OptimizedObjectWriter` (no acopla a los dobles unitarios de T05); fixtures del consumidor con buckets reales; verificación de regresiones. | Integración **50/50** (`F02-T06-loop2-all.txt`), E2E **8/8**, typecheck y lint acotado EXIT 0. |

### Decisiones del loop 2

1. **Persistencia en la capa correcta:** `writeOptimizedVariants()` vive en `backend/src/storage/objects.ts` y reutiliza el cliente S3/CA de `createObjectAccessServiceFromConfig`; el worker solo invoca el servicio. Claves `<userId>/<jobId>/optimized/<imageId>.webp|.avif|_thumb.webp`, `ContentType` correcto y doble comprobación `assertKeyWithinPrefix` (PR-07).
2. **Bytes anclados al artefacto final:** tras `PutObject`, un `HeadObject` confirma cada tamaño; si `ContentLength !== bytes.byteLength` se lanza `OptimizedWriteError` (fail-closed). `bytesAfter` y `savingsPct` se recalculan con `computeSavings` sobre esa suma, antes de `updateImage`/`updateJob`. Si la escritura falla, el mensaje SQS no se borra y habrá redelivery.
3. **Interfaz separada:** `ObjectAccessService` permanece intacta para no obligar al ensamblado inline de `api/app.ts` ni al doble de `tests/unit/api/object-access-fixture.ts` (fuera de alcance) a implementar escritura. El consumidor depende de `OptimizedObjectWriter`, que el servicio real satisface.
4. **Seguimientos preservados:** sin tocar `api/**`, el cableado sigue usando `publishJob()`; `summarizeConsumeResult()` sigue exponiendo `dlqFailures`/`dlqDeliveryFailed`/`skippedAsDuplicate`; la máquina congelada y `CONFIRM_INCONSISTENT` (at-most-once, sin G-10) quedan intactos y sus pruebas pasan.

### Evidencias del loop 2 (`reports/implementation/F02/evidence/`)

`F02-T06-loop2-{red,green,persist,headobject,download,e2e,all}.txt` + `F02-T06-loop2-{typecheck,lint-scoped,emulator-down}.txt`. G-7: contenedor con `memory=2147483648`/`nanoCpus=2000000000`, `docker cp` en cada arranque, `health=ok`, **apagado al terminar** (sin contenedor/red, `:9297` sin conexión).

### Problemas del loop 2 (7 campos)

#### L2-1 — Las variantes optimizadas no existían y `bytesAfter` no era contrastable

1. **Identificación:** `F02-T06-L2-1` · corrección de `A-01` (Auditor, MEDIUM) · loop 2/3.
2. **Problema:** el worker calculaba `bytesAfter` de buffers en memoria pero no escribía WebP/AVIF/miniatura en `optimized`; los GET presignados de T05 devolvían `404` y el ZIP quedaba vacío.
3. **Causa (demostrada):** `backend/src/worker/**` no contenía `PutObjectCommand`; `processImage` devolvía `outputs` que nadie persistía. Evidencia RED: `NotFound` en `HeadObject`, `404` en descarga, `[]` en ZIP.
4. **Solución e intentos fallidos:** servicio `writeOptimizedVariants()` en `storage/**` + llamada en el consumidor con re-derivación de métricas desde `HeadObject`. Se descartó «estimar» el tamaño o redondearlo para hacerlo cuadrar (PR-12) y se descartó duplicar el cliente S3 dentro del worker.
5. **Verificación:** `F02-T06-loop2-{persist,headobject,download,e2e,all}.txt`: suma de 3 `ContentLength` == `job.bytesAfter`, URLs y ZIP byte-idénticos a los objetos, 50/50 integración.
6. **Pendientes:** ninguno para `A-01`. Quedan vivos los seguimientos `A-02`/`A-03`/`A-04` del Auditor (F05/CTO; sin G-10).
7. **Aprendizaje candidato:** una métrica de ahorro debe anclarse al artefacto persistido verificado con `HeadObject`, no al buffer que lo originó.

#### L2-2 — Typecheck roto al extender `ObjectAccessService`

1. **Identificación:** `F02-T06-L2-2` · regresión de compilación introducida en GREEN.
2. **Problema:** `npm run typecheck` falló: el ensamblado inline de `api/app.ts` y el doble `tests/unit/api/object-access-fixture.ts` no implementaban el nuevo método obligatorio.
3. **Causa (demostrada):** ampliar una interfaz compartida con un método de escritura ajeno a sus responsabilidades; además faltaba importar `UnsafeObjectKeyError` en `objects.ts`.
4. **Solución e intentos fallidos:** separar la capacidad en `OptimizedObjectWriter` (implementada por el servicio real) y conservar `ObjectAccessService` intacta; añadir el import faltante. Se descartó editar `tests/unit/api/**` (fuera de alcance) y se descartó relajar tipos.
5. **Verificación:** `F02-T06-loop2-typecheck.txt` EXIT 0; `F02-T06-loop2-lint-scoped.txt` EXIT 0.
6. **Pendientes:** ninguno.
7. **Aprendizaje candidato:** las capacidades de escritura deben declararse en una interfaz propia para no propagar errores de tipo a consumidores de solo lectura.

#### L2-3 — Pruebas T04 del consumidor sin buckets S3

1. **Identificación:** `F02-T06-L2-3` · adaptación de fixtures por el nuevo comportamiento por defecto.
2. **Problema:** al escribir optimizadas por defecto, las pruebas de reintentos/DLQ de T04 apuntaban a buckets ficticios y habrían fallado.
3. **Causa (demostrada):** `consumer.test.ts` y `observability.test.ts` construían `config` solo con SQS + DynamoDB; el writer perezoso usa `config.resources.s3BucketRaw/Optimized`.
4. **Solución e intentos fallidos:** crear buckets aislados en sus fixtures, sobreescribir ambos nombres en `testEnv`, disponerlos en `afterEach` e inyectar el servicio real. No se desactivó la escritura ni se simularon respuestas S3.
5. **Verificación:** `F02-T06-loop2-all.txt`: 9/9 consumidor, 1/1 observabilidad, 50/50 total; DLQ, `PARTIAL`/`FAILED` y `skippedAsDuplicate` siguen verdes.
6. **Pendientes:** ninguno.
7. **Aprendizaje candidato:** al hacer obligatoria una nueva dependencia de infraestructura, actualizar las fixtures que antes podían operar sin ella.

#### L2-4 — Riesgo de regresión de los seguimientos ya cerrados

1. **Identificación:** `F02-T06-L2-4` · control de no regresión del loop 2.
2. **Problema:** tocar el consumidor podía alterar `publishJob`, la observabilidad de DLQ, la máquina de estados o la política `CONFIRM_INCONSISTENT`.
3. **Causa (hipótesis controlada):** el cambio se sitúa en el punto exacto donde el consumidor decide el estado de la imagen y agrega métricas.
4. **Solución e intentos fallidos:** mantener el orden `processImage → write → updateImage → resolveBatchStatus → updateJob`, sin modificar `api/**`, `summarizeConsumeResult`, `ALLOWED_TRANSITIONS` ni `jobs.ts`. No se reintentó "republicar" ni se añadió reparación automática.
5. **Verificación:** `F02-T06-loop2-e2e.txt` 8/8 y `F02-T06-loop2-all.txt` 50/50; las 5 pruebas E2E de CA-06 (incluida `CONFIRM_INCONSISTENT`) siguen pasando.
6. **Pendientes:** `CONFIRM_INCONSISTENT` mantiene su seguimiento de reconciliación (sin G-10).
7. **Aprendizaje candidato:** cuando se cambia el punto de agregación de métricas, reejecutar explícitamente las pruebas de estados y de resiliencia, no solo las de la corrección.

### Estado final del addendum

`DONE_WITH_CONCERNS`: `A-01` corregido con evidencia real; regresión completa en verde; emulador apagado; ámbito y gates respetados. Se retorna a Architect para revisión y despacho a Tester/Auditor. **Este Developer no emite `PASSED` ni cierra `F02-T06`.**
