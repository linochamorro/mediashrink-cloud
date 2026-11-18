# Dictamen de Tester independiente — `F02-T04`

| Campo | Valor |
|---|---|
| **Tarea** | `F02-T04` — Consumidor SQS + DLQ (reintentos, fallo parcial, publicador real) |
| **Fase / paquete** | Fase 2 — `docs/sdd/packages/P-02-api-and-worker.md` (`CA-04`) |
| **Criterio verificado** | `CA-04`: 3 intentos, DLQ al agotarlos, imagen `FAILED` sin abortar el lote, QueueUrls canónicas con `AWS_ENDPOINT_URL` como transporte, sin `:9324` |
| **Fuentes superiores** | `spec.md` FR-10/FR-13 · `constitution.md` IN-08 · `plan.md` §3.2 · `task.md` §1 · `F02-T03-architect.md` (A-02) · `F02-T01-architect.md` (puerto inyectado) |
| **Rol / riesgo** | Tester independiente · riesgo 3 (resiliencia y pérdida de trabajos) |
| **Harness / Loop** | OpenCode · `v1 — Loop 1/3` (no consumido; no se activa loop) |
| **Dictamen global** | **`PASSED`** |
| **Fecha** | 2026-11-17 |

## 1. Método y entorno

Lectura obligatoria completada: `.agents/roles/tester.md`, `AGENTS.md`, `STATE.md`, paquete `P-02`, `spec.md`/`constitution.md`, los tres reportes indicados, todo `backend/src/worker/**`, `config/index.ts`, `contracts/index.ts`, `db/index.ts`, `.env.example`, las pruebas `tests/integration/worker/**` y la evidencia del Developer (esta última **solo como registro cronológico**, nunca presentada como propia).

Ejecución propia contra `aws/aws-emulator` en vivo: `docker compose up -d`, contenedor `healthy`, límites efectivos `memory=2147483648` / `nanoCpus=2000000000`, `docker cp` de `ca.pem`/`config`/`emulator_credentials` repetido en este arranque, healthcheck HTTPS `ok`, único puerto `127.0.0.1:9297`. Todo el trabajo se ejecutó desde la raíz autorizada; la salida de vitest se saneó para no versionar rutas absolutas (`<repo-root>`).

## 2. Verificación por criterio

| # | Criterio / fuente | Evidencia propia | Observación ejecutada | Estado |
|---|---|---|---|---|
| 1 | Suite de integración del worker — `task.md` §4 | `F02-T04-tester-worker.txt` | `npx vitest run tests/integration/worker` → exit 0 · **4 archivos, 18/18**. Sin `skip`/`only`/`todo` (búsqueda de `.skip\|.only\|.todo\|xit\|xdescribe\|.concurrent` en `tests/integration/worker/**`: 0 coincidencias). | **CUMPLIDO** |
| 2 | Reintentos = 3 y recuperación transitoria — FR-13 / IN-08 | `F02-T04-tester-retry.txt`, `F02-T04-tester-transport.txt` §7 | `config.worker.sqsMaxRetries = 3` (`config/index.ts:331`, `.env.example:69`); el consumidor usa `while (attempt < maxAttempts)` (`consumer.ts:79,100`). Corrida focal: 2 fallos lanzados y éxito en el 3º intento, `attempts=3`, `COMPLETED`, `deadLettered=0`, **0 mensajes en DLQ**, imagen `COMPLETED` en DynamoDB. exit 0. | **CUMPLIDO** |
| 3 | DLQ al agotar reintentos — FR-13 / IN-08 | `F02-T04-tester-dlq.txt` | Corrida focal: el procesador falla siempre; `calls = sqsMaxRetries`, imagen `FAILED` con `failureReason` no vacío y `exifStripped=false`, job `FAILED`, **1 mensaje en la DLQ real** con sobre `{userId, jobId, imageId, attempts}`. exit 0. | **CUMPLIDO** |
| 4 | Fallo parcial sin abortar lote — IN-08 / D-09 | `F02-T04-tester-partial.txt` | Corrida focal: 1 imagen fallida → DLQ + `FAILED`; las otras dos → `COMPLETED` en DynamoDB; job `PARTIAL`; DLQ con 1 mensaje. exit 0. Agregación de métricas verificada por inspección (`consumer.ts:166-180`: `bytesBefore`/`bytesAfter` se suman solo sobre imágenes exitosas y `computeSavings` calcula `savingsPct`); **límite**: la prueba afirma estados y recuentos, no valores numéricos de métricas (esos son `CA-06`/T06). | **CUMPLIDO** |
| 5 | Mensaje válido, borrado acotado, sin duplicados — `task.md` §4 | `F02-T04-tester-drain.txt` (y `F02-T04-tester-worker.txt`) | Corrida focal: `drainQueue` con `maxRounds: 3` devuelve **1** resultado, cola principal vacía, DLQ vacía; reprocesar el mismo sobre deja `listImages` en 1 (sin duplicados). `drainQueue` tiene tope de 10 rondas por defecto (`consumer.ts:227`), por lo que un mensaje no borrado no genera bucle infinito. exit 0. | **CUMPLIDO** |
| 6 | Publicador real y puerto de T01 — `F02-T01-architect.md` | `F02-T04-tester-publisher.txt`, `F02-T04-tester-transport.txt` §8 | `npx vitest run tests/integration/worker/publisher.test.ts` → **5/5**. `SqsJobQueuePublisher implements JobQueuePublisher` (typecheck exit 0): `publish()` envía exactamente `{userId, jobId}`; `publishJob()` envía el sobre enriquecido; `publishToDeadLetter()` usa la DLQ canónica; `createSqsClient` hace un envío real con `fromIni` + CA y `schemas.AwsTransport` valida la configuración. `backend/src/api/**` conserva el puerto sin cliente SQS (0 referencias). | **CUMPLIDO** |
| 7 | Transporte, URLs, secretos y default del procesador — A-03/A-02 | `F02-T04-tester-transport.txt`, `F02-T04-tester-worker.txt` (caso «siempre usa processImage») | `useQueueUrlAsEndpoint: false`, `endpoint = AWS_ENDPOINT_URL` (solo transporte), `fromIni` + `Agent({ca: readFileSync(...)})`; QueueUrls canónicas `https://sqs.us-east-1.amazonaws.com/000000000000/...`. `:9324` aparece solo en guardas/comentarios de prohibición; 0 credenciales fijas. `consumer.ts:77` usa `deps.processor ?? processImage`; 0 llamadas a `renderWithSharp` en consumidor/publicador/cliente; la prueba de guarda A-05 da `FILE_TOO_LARGE` para 2 MB y `exifStripped: true` para la imagen válida. | **CUMPLIDO** |
| 8 | Regresión, typecheck y lint — `task.md` §11 | `F02-T04-tester-regression.txt` | `npm run test:unit` → exit 0 · **25 archivos, 241/241**; `npm run typecheck` → exit 0; `npx eslint backend/src/worker tests/integration/worker/{consumer,publisher,sqs-fixture}.ts --ext .ts` → exit 0. `npm run lint` global → exit 1 por `tests/unit/frontend/core.test.ts` (`Theme` sin usar), archivo **F03 ajeno**; interferencia de harness paralelo, no aceptada como riesgo de F02. | **CUMPLIDO** |
| 9 | Cronología TDD como registro — contrato de rol §2 | `F02-T04-tester-regression.txt` §«Revisión cronológica» | RED documentado: exit 1, 11 fallos (5 `NOT_IMPLEMENTED` + 6 timeouts de fixture corregidos a 30 s sin debilitar expectativas); GREEN 18/18; REFACTOR 18/18; focalizadas del registro. **No se recreó el RED**: se acepta como registro, no como evidencia propia. | **CUMPLIDO (como registro)** |
| 10 | Ámbito, gates y limpieza — `task.md` §3, G-7 | `F02-T04-tester-scope.txt`, `F02-T04-tester-up.txt`, `F02-T04-tester-down.txt` | Código en `backend/src/worker/**` y `tests/integration/worker/**`; `backend/src/index.ts` intacto; `backend/src/api/**` intacto; sin dependencias de `temporary/`; sin cambios de manifiestos imputables a T04; `main...origin/main` sin `ahead` → **sin push**. Docker apagado: `docker compose ps` y `docker ps -a` sin filas. | **CUMPLIDO** |

## 3. Cobertura y límites

- La cobertura HTTP de la API no sustituye a la integración SQS/DynamoDB ejecutada aquí; T04 no expone rutas nuevas (compatibilidad con `F02-T01-architect.md`).
- Los fallos se inyectan mediante la costura `processor` documentada (`consumer.ts:24-36`), que en el camino de éxito delega en `processImage`: es una costura de prueba, no un procesador de producción.
- El sobre enriquecido (`publishJob`) transporta los bytes en base64 dentro del mensaje; la resolución de contenido desde S3 y las métricas E2E quedan para T06 (`CA-06`), según `F02-T04-developer.md` §5.5.
- El sobre de DLQ se valida con `parseDeadLetterMessage` como defensa en profundidad; la corrida verificó el envío real y el contenido mínimo del sobre.
- El barrel `worker/index.ts` sigue exportando `renderWithSharp` (A-02 heredado de T03, LOW): no es usado por ninguna ruta de T04; se registra para la auditoría, no como incumplimiento de `CA-04`.

## 4. Problemas y disposición

No se encontraron incumplimientos de `CA-04`, por lo que **no proceden los 7 campos obligatorios de `NO-PASSED`**. Los tres puntos anteriores son límites de cobertura o seguimientos de fase, sin severidad bloqueante:

| Observación | Clasificación | Disposición |
|---|---|---|
| Métricas numéricas del job en caso parcial no afirmadas por la prueba | INFO | Verificadas por inspección de código; validación E2E en T06 (`CA-06`) |
| `renderWithSharp` aún exportado por el barrel (A-02 de T03) | LOW heredado | Sin uso en T04; a resolve en la auditoría de T04 / cierre de fase |
| Lint global rojo por archivo F03 | INFO (ajeno) | No aceptado como riesgo de F02; lint acotado a F02 en verde |

## 5. Dictamen global

**`PASSED`** — `CA-04` queda satisfecho con ejecución propia e independiente: reintentos (3 intentos, recuperación en el 3º), DLQ real al agotarlos, imagen `FAILED` con `failureReason`, continuación del lote con `PARTIAL`, mensaje válido borrado sin duplicados ni bucles, publicador real que implementa el puerto de T01, transporte canónico sin `:9324` ni credenciales fijas, `processImage` como default, regresión 241/241, typecheck y lint F02 en verde, sin secretos ni rutas Windows absolutas en los artefactos propios, sin push y Docker apagado.

No se activa loop (continúa `Loop 1/3`). Procede la auditoría obligatoria de riesgo 3 y, tras ella, el cierre del Architect. No se emitieron `PASSED` condicionales ni se aceptaron riesgos en nombre de Lino.

---

## Addendum — `v2 — Loop 2/3` (re-verificación de `A-01`/`A-02`)

| Campo | Valor |
|---|---|
| **Versión / Loop** | `v2 — Loop 2/3` (último loop; no se activa otro) |
| **Registro** | **Append-only**: el `PASSED` de v1 (§1–§5) permanece íntegro y no se retira |
| **Origen** | `reports/audits/F02/F02-T04-auditor.md` `A-01`/`A-02` (`MEDIUM`) y `A-03` (`LOW`); corrección del Developer en `F02-T04-developer.md` §Addendum |
| **Ámbito re-verificado** | Solo criterios afectados por la corrección: idempotencia de mensaje, aislamiento del fallo de DLQ, precondición de `ImageRecord`, y verifies de no-colisión (`db/**`, `api/**`, manifiestos) |
| **Veredicto del addendum** | **`PASSED`** |
| **Fecha** | 2026-11-17 |

### A. Ejecución propia del loop 2

Emulador arrancado de nuevo bajo G-7: `docker compose up -d`, `healthy`, `memory=2147483648` / `nanoCpus=2000000000`, `docker cp` de CA/config/credenciales repetido, healthcheck `ok`, único puerto `127.0.0.1:9297` (`F02-T04-tester-loop2-up.txt`). Apagado al final: `docker compose ps` y `docker ps -a` sin filas (`F02-T04-tester-loop2-down.txt`).

| # | Criterio afectado | Evidencia propia | Observación ejecutada | Estado |
|---|---|---|---|---|
| L2-1 | Suite de integración del worker | `F02-T04-tester-loop2-worker.txt` | `npx vitest run tests/integration/worker` → exit 0 · **4 archivos, 21/21** (18 de v1 + 3 nuevos). Sin `it.skip`/`it.only`/`it.todo`/`xit`/`xdescribe` en `tests/integration/worker/**` (0 coincidencias). | **CUMPLIDO** |
| L2-2 | A-01 · idempotencia ante redelivery | `F02-T04-tester-loop2-idempotency.txt` (y `loop2-worker.txt`) | Misma entrega dos veces con processor que falla siempre: 1ª `FAILED` con 1 mensaje en DLQ; 2ª `skippedAsDuplicate=true`, 0 outcomes, job sigue `FAILED`, imagen sigue `FAILED`, DLQ sigue con **exactamente 1** mensaje y el procesador se llama **solo 3 veces** (= `sqsMaxRetries`). exit 0 · 1/1. Código: `terminalStatus()` usa `ALLOWED_TRANSITIONS` (`consumer.ts:81-85`), el job terminal se omite en `:144-148`, el cierre usa `nextStatus('PROCESSING', batchStatus, {completed, failed})` (`:265`), y `alreadyFailed` bloquea el segundo sobre (`:161,219`). | **CUMPLIDO** |
| L2-3 | A-02 · fallo de DLQ inyectado | `F02-T04-tester-loop2-dlq-failure.txt` (y `loop2-worker.txt`) | `dlqClient` inyectado que lanza: sin excepción propagada, 1 `COMPLETED` + 1 `FAILED`, `dlqFailures=1`, `dlqDeliveryFailed=true`, `deadLettered=false`, job `PARTIAL`, ambas imágenes con estado correcto en DynamoDB y **0 mensajes en la DLQ real**. exit 0 · 1/1. Código: `try/catch` aislado en `consumer.ts:229-240`. | **CUMPLIDO** |
| L2-4 | A-03 · `ensureImageRecord` con API pública de F01 | `F02-T04-tester-loop2-precondition.txt` (y `loop2-worker.txt`) | Job sin ítems imagen: `getImage` inicial `null`, el consumidor materializa con `putImage`, la imagen queda `COMPLETED` con `exifStripped=true`, el job `COMPLETED` y `listImages().length=1`. exit 0 · 1/1. Código: `consumer.ts:110-126` solo invoca `getImage`/`putImage`. | **CUMPLIDO** |
| L2-5 | Typecheck y lint acotado | `F02-T04-tester-loop2-typecheck.txt`, `F02-T04-tester-loop2-lint.txt` | `npm run typecheck` → exit 0; `npx eslint backend/src/worker tests/integration/worker/{consumer,publisher,sqs-fixture}.ts --ext .ts` → exit 0. El lint global en rojo por `tests/unit/frontend/**` corresponde a F03 (ajeno, documentado en v1); no se reejecutó en este loop por proporcionalidad. | **CUMPLIDO** |
| L2-6 | No-colisión | `F02-T04-tester-loop2-scope.txt` | Solo se modificaron `backend/src/worker/consumer.ts` (22:25:35) y `tests/integration/worker/consumer.test.ts` (22:21:55). `backend/src/db/**` (≤20:54), `backend/src/api/**` (≤21:43), manifiestos (≤21:33) y `backend/src/index.ts` (10:43) con fechas anteriores; `git diff` de manifiestos idéntico al de v1 (solo deps de T02); `main...origin/main` sin `ahead` → sin push. | **CUMPLIDO** |

### B. Límites de cobertura del addendum

- La prueba de A-02 usa `handleJobMessage` directamente: **no afirma explícitamente el `DeleteMessage`** bajo fallo de DLQ. Se verifica por composición de código (`pollAndProcessOnce` borra tras `handleJobMessage` sin excepción; `consumer.ts:303-309`) y por la prueba de drenaje de v1; el bucle de redelivery queda roto por la ausencia de propagación. Cobertura directa pendiente para T06/observabilidad.
- La rama «job en `PROCESSING` con imagen ya `FAILED`» (que también suprime el segundo sobre) está verificada por inspección (`consumer.ts:161,219`); la prueba ejecutada cubre el caso terminal, que es el de redelivery descrito por `A-01`.
- El RED (3 fallos: `skippedAsDuplicate` y `dlqFailures` ausentes, `ImageNotFoundError`) → GREEN 21/21 → REFACTOR 21/21 del loop 2 se acepta **como registro** del reporte del Developer; conforme al contrato de rol no se recreó el RED.
- No se reejecutó la regresión unitaria (241/241 de v1): `tests/unit/**` no contiene pruebas que importen el consumidor (búsqueda 0 coincidencias) y el cambio se limita a `worker/consumer.ts` + su prueba de integración.

### C. Veredicto del addendum

**`PASSED`** — La corrección de `A-01`/`A-02` (y la colateral `A-03`) queda acreditada con ejecución propia: el mensaje duplicado no reabre un job terminal ni duplica la DLQ; el fallo inyectado del cliente DLQ se aísla, se reporta como `dlqFailures`/`dlqDeliveryFailed`, marca la imagen `FAILED`, no aborta el lote y deja el job en `PARTIAL`; la precondición de `ImageRecord` se satisface con API pública de F01. Suite **21/21**, typecheck y lint F02 en verde, `db/**`/`api/**`/manifiestos intactos, sin push y Docker apagado.

No se activa loop adicional (el loop 2/3 queda cerrado con este dictamen). Los seguimientos a T06 — publicar con `publishJob()` y exponer/alertar sobre `dlqFailures` — no son incumplimientos de T04 y permanecen como responsabilidad de fase.
