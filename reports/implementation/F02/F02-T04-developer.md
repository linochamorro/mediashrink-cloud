# Entrega de Developer — `F02-T04`

| Campo | Valor |
|---|---|
| **Tarea** | `F02-T04` — Consumidor SQS + DLQ (reintentos, fallo parcial, publicador real) |
| **Fase / paquete** | Fase 2 — `docs/sdd/packages/P-02-api-and-worker.md` |
| **Versión / Loop** | `v1 — Loop 1/3` |
| **Rol / verificadores** | Developer / Tester + Auditor (riesgo 3 sensible) |
| **Fuente de verdad de alcance** | `reports/implementation/F02/F02-T04-task.md` |
| **Estado de entrega** | **`DONE`** (pendiente de Tester y Auditor; no se emite `PASSED` ni se cierra la tarea) |
| **Harness** | OpenCode · raíz autorizada del proyecto |

## 1. Fuentes consultadas

- `AGENTS.md`, `STATE.md`, `.agents/roles/developer.md`.
- `docs/sdd/packages/P-02-api-and-worker.md` §5 (`CA-04`); `docs/sdd/spec.md` FR-10/FR-13; `docs/sdd/constitution.md` IN-08; `docs/runbooks/development-workflow.md` §1.2–1.4.
- `reports/implementation/F02/F02-T04-task.md` (alcance), `F02-T03-architect.md` (usar `processImage`, **no** `renderWithSharp`; A-02 del Auditor) y `F02-T01-architect.md` (puerto `JobQueuePublisher` inyectado).
- Código leído sin modificar: `backend/src/worker/{index,processImage,preflight,render}.ts`, `backend/src/contracts/index.ts`, `backend/src/db/**` (API pública), `backend/src/config/index.ts`, `backend/src/api/publisher.ts`, `backend/src/storage/client.ts`, `backend/package.json`, `.env.example`.

## 2. Criterio de aceptación atendido — `CA-04`

Consumidor SQS con **3 intentos** (`SQS_MAX_RETRIES`, dato de configuración), envío a **DLQ** al agotarlos, imagen marcada **`FAILED`** en DynamoDB y **el resto del lote continúa**. QueueUrls canónicas `https://sqs.us-east-1.amazonaws.com/000000000000/<cola>` con `AWS_ENDPOINT_URL=https://127.0.0.1:9297` **solo como transporte** (`useQueueUrlAsEndpoint: false`), `fromIni` + CA explícito; sin `:9324`, sin credenciales fijas. Mensaje válido se elimina tras procesar; `drainQueue` acotado para evitar bucles infinitos. Estados y métricas agregadas validados por los esquemas congelados (`schemas.Job`, `schemas.ImageRecord`, `schemas.JobMetrics` vía `computeSavings`).

## 3. Cronología (TDD)

| Hora | Hito | Resultado |
|---|---|---|
| 22:00 | Arranque emulador (`docker compose up -d`), `healthy`, `memory=2147483648`, `nanoCpus=2000000000`, `docker cp` de CA/config/credenciales, healthcheck `ok` | G-7 conforme |
| 22:01 | **RED**: stubs `NOT_IMPLEMENTED` + pruebas de integración | 11 fallos (5 `NOT_IMPLEMENTED`, 6 por timeout de 5 s en la fixture) |
| 22:02 | Corrección del timeout de fixture (helper `itIntegration`, 30 s) y del import sin uso | — |
| 22:04 | **GREEN**: implementación de cliente, mensajes, publicador y consumidor | 18/18 |
| 22:05 | **REFACTOR**: sobre DLQ tipado, lecturas únicas de campos opcionales, import estático | 18/18 |
| 22:06–22:07 | Evidencias focalizadas retry / DLQ / fallo parcial / publicador | 1/1, 1/1, 1/1, 5/5 |
| 22:08 | Re-verificación final tras limpieza de lint | 18/18 |
| 22:09 | Regresión unitaria | 241/241 |
| 22:10 | `docker compose down`; `docker compose ps` y `docker ps -a` vacíos | G-7 conforme |

## 4. Comandos ejecutados y resultados

| Comando | Resultado |
|---|---|
| `docker compose up -d` / `docker compose ps` | contenedor `healthy`, límites 2 GiB / 2 CPU |
| `docker cp …ca.pem/config/emulator_credentials` + `curl.exe --cacert … /__admin/health` | cuerpo `ok` |
| `npx vitest run tests/integration/worker --reporter=verbose` (RED) | exit 1 · 11 fallos / 7 pasan |
| `npx vitest run tests/integration/worker --reporter=verbose` (GREEN) | exit 0 · **18/18** (11 nuevos + 7 regresión) |
| `npx vitest run tests/integration/worker --reporter=dot` (REFACTOR y final) | exit 0 · **18/18** |
| `npx vitest run …consumer.test.ts -t 'reintento transitorio'` | exit 0 · 1/1 |
| `npx vitest run …consumer.test.ts -t 'reintentos agotados'` | exit 0 · 1/1 |
| `npx vitest run …consumer.test.ts -t 'fallo parcial'` | exit 0 · 1/1 |
| `npx vitest run tests/integration/worker/publisher.test.ts` | exit 0 · 5/5 |
| `npm run typecheck` | exit 0 · sin diagnósticos |
| `npx eslint backend/src/worker tests/integration/worker/{consumer.test,publisher.test,sqs-fixture}.ts --ext .ts` | exit 0 · sin hallazgos (lint acotado a F02) |
| `npm run test:unit` | exit 0 · 25 archivos, **241/241** |
| `docker compose down` / `docker compose ps` / `docker ps -a` | contenedor y red eliminados; `docker ps -a` vacío |

**Evidencia:** `reports/implementation/F02/evidence/F02-T04-{red,green,refactor,retry,dlq,partial-failure,publisher,emulator-down,typecheck,typecheck-green,lint-f02,unit-regression}.txt`.

## 5. Decisiones de implementación

### 5.1 Cola y transporte
- `backend/src/worker/sqs-client.ts`: `SQSClient` con `endpoint: AWS_ENDPOINT_URL`, `useQueueUrlAsEndpoint: false`, `fromIni({ filepath, configFilepath })` y `NodeHttpHandler` con `Agent({ ca: readFileSync(caBundlePath) })`. Es el mismo patrón que `backend/src/storage/client.ts` y `backend/src/db/client.ts`, sin credenciales fijas (G-3/A-03).
- Las QueueUrls se toman **tal cual** de `config.resources.sqsQueueUrl` / `sqsDlqUrl`; no se reescribe su host ni se usa `:9324`. Contrato `schemas.AwsTransport` verificado en prueba.

### 5.2 Reintentos y DLQ
- `maxAttempts = config.worker.sqsMaxRetries` (3). Por cada imagen: bucle acotado de intentos; un éxito detiene el bucle; un `result.ok === false` conserva `reasonCode`/`failureReason`; una excepción del procesador se normaliza al mensaje estable `RENDER_FAILED` (sin rutas ni valores de entorno, G-3).
- Agotados: `SendMessageCommand` a la DLQ con sobre tipado `DeadLetterMessage` (`userId`, `jobId`, `imageId`, `attempts`, `reasonCode`, `failureReason`), `updateImage(... FAILED, exifStripped:false, failureReason)` y **continúa** con la siguiente imagen. El job se cierra con `resolveBatchStatus` (`COMPLETED`/`PARTIAL`/`FAILED`) y métricas agregadas con `computeSavings`.
- `handleJobMessage` **no borra** el mensaje; `pollAndProcessOnce` lo borra solo tras completar todas las imágenes. `drainQueue` tiene `maxRounds` (10 por defecto): un mensaje no borrado no genera bucle infinito.
- `backend/src/worker/messages.ts` valida el sobre (IDs opacos, base64 estricto, preset del catálogo) y es retrocompatible con el mensaje mínimo de T01 (`images` ausente ⇒ arreglo vacío).

### 5.3 Publicador real
- `backend/src/worker/publisher.ts`: `SqsJobQueuePublisher implements JobQueuePublisher` (tipo importado de `backend/src/api/publisher.ts`, **sin modificar** `backend/src/api/**`). `publish(msg)` envía exactamente `{ userId, jobId }` (cumple el puerto de T01); `publishJob(msg)` y `publishToDeadLetter(msg)` son extensiones retrocompatibles. `createJobQueuePublisherFromConfig(config)` es la fábrica que T06 inyectará en `createApiApp()`.
- Se exporta desde `backend/src/worker/index.ts`. No se tocaron manifiestos, `backend/src/db/**`, `backend/src/api/**`, frontend, IaC, `.github`, `STATE.md` ni `tasks.md`.

### 5.4 Regla A-02 del Auditor (T03)
- El default del procesador es **`processImage`**, nunca `renderWithSharp`. La costura `processor` existe solo para inyectar fallos transitorios en pruebas y en los casos de éxito delega en `processImage`. Prueba dedicada verifica que, con el default, la guarda A-05 rechaza un buffer de 2 MB (`FILE_TOO_LARGE`) y que una imagen válida produce `exifStripped: true`.

### 5.5 Nota de integración para T06
- Si T06 cablea el publicador mediante `publish()`, el mensaje será el mínimo `{ userId, jobId }` y el worker no tendrá imágenes que procesar. Para el flujo E2E, T06 debe publicar el sobre enriquecido con `publishJob(...)` (o resolver los bytes desde S3 y construir `JobQueueMessage`). El seguimiento `CONFIRM_INCONSISTENT` de T01 (at-most-once) sigue en manos de T06; T04 no introduce un marcador duradero nuevo.

## 6. Registro de problemas (7 campos)

### Problema 1
1. **Identificación:** `F02-T04-P1` — timeout de 5 s en pruebas de integración del consumidor durante RED.
2. **Problema:** las seis pruebas de `consumer.test.ts` agotaban el timeout por defecto de Vitest antes de alcanzar la aserción, enmascarando el fallo real por comportamiento (`NOT_IMPLEMENTED`).
3. **Causa:** **demostrada** — la fixture crea una tabla DynamoDB, espera su TTL `ENABLED` y crea dos colas SQS; ~6,2 s por caso (medido en GREEN: 6,19–6,65 s).
4. **Solución e intentos fallidos:** se intentó primero aumentar el timeout desde la CLI, pero el Tester ejecuta el comando declarado sin banderas; se sustituyó cada `it` por un helper `itIntegration` con timeout de 30 s dentro del propio archivo de prueba. No se debilitó ninguna expectativa.
5. **Verificación:** RED mostró los seis fallos por comportamiento tras el ajuste; GREEN/REFACTOR 18/18 con la suite completa.
6. **Pendientes:** ninguno en T04. El tiempo de ejecución de la suite de integración queda documentado (~40 s).
7. **Aprendizaje candidato:** toda prueba que cree infraestructura en el emulador debe declarar su propio timeout; el valor por defecto de Vitest no cubre la creación de tabla + TTL + colas.

### Problema 2
1. **Identificación:** `F02-T04-P2` — hallazgo A-02 heredado del Auditor de T03: el barrel exporta `renderWithSharp` sin guardas.
2. **Problema:** riesgo de que el consumidor invoque directamente el renderizador y salte la guarda de tamaño A-05 y el strip real.
3. **Causa:** **demostrada** — `backend/src/worker/render.ts` expone `renderWithSharp` y `index.ts` lo reexporta; la decisión correcta la coordinó el Architect de T03.
4. **Solución e intentos fallidos:** se usa `processImage` como procesador por defecto; la costura de inyección se documenta como seam de pruebas que delega en `processImage` en el camino de éxito. No se exportó ni se llamó `renderWithSharp` desde el consumidor.
5. **Verificación:** prueba «siempre usa processImage»: `FILE_TOO_LARGE` para 2 MB con `MAX_FILE_SIZE_MB=1`, `exifStripped: true` para la imagen válida del mismo lote, resultado `PARTIAL`.
6. **Pendientes:** auditoría de T04 debe confirmar que ninguna ruta productiva usa `renderWithSharp`.
7. **Aprendizaje candidato:** las costuras de inyección deben nombrarse y documentarse como seams de fallo, con el default apuntando siempre a la función que impone las guardas.

### Problema 3
1. **Identificación:** `F02-T04-P3` — desajuste entre el mensaje mínimo de T01 y los datos que el worker necesita para procesar.
2. **Problema:** `JobQueuePublisher.publish({ userId, jobId })` no transporta bytes de imagen, pero el consumidor debe invocar `processImage` sobre cada imagen.
3. **Causa:** **demostrada** — la interfaz de T01 fija un mensaje mínimo de control; la resolución de contenido S3 pertenece a la integración E2E de T06.
4. **Solución e intentos fallidos:** se mantuvo `publish()` intacto y se añadió `publishJob(JobQueueMessage)` como extensión retrocompatible; el parser acepta mensajes sin `images` como arreglo vacío. Se descartó modificar `backend/src/api/**` o el contrato congelado.
5. **Verificación:** 5/5 pruebas del publicador: mensaje mínimo exacto, sobre enriquecido, DLQ canónica, cliente `fromIni` y `schemas.AwsTransport` válido; 6/6 del consumidor.
6. **Pendientes:** T06 debe usar `publishJob()` (o resolver bytes desde S3) en el cableado E2E; documentado en §5.5.
7. **Aprendizaje candidato:** los puertos congelados se extienden con métodos concretos en la implementación, no cambiando la interfaz ni los contratos de dominio.

### Problema 4
1. **Identificación:** `F02-T04-P4` — lint con import sin uso y evidence file desactualizada.
2. **Problema:** `npx eslint` acotado a F02 devolvió 1 error (`pollAndProcessOnce` importado pero no usado) y el archivo de evidencia de lint conservaba la salida de esa primera ejecución fallida.
3. **Causa:** **demostrada** — el import quedó tras refactorizar la prueba hacia `drainQueue`; `Tee-Object` no sobrescribe el archivo cuando la nueva salida está vacía.
4. **Solución e intentos fallidos:** se eliminó el import y se regeneró la evidencia escribiendo explícitamente comando, `EXIT=0` y bloque de salida vacío. No se desactivó la regla de lint.
5. **Verificación:** `LINT_EXIT=0`, `F02-T04-lint-f02.txt` sin rutas absolutas; re-verificación 18/18 y typecheck exit 0.
6. **Pendientes:** ninguno.
7. **Aprendizaje candidato:** al capturar evidencia de comandos que pueden no producir salida, escribir siempre el código de salida y un marcador de salida explícito.

## 7. Estado final

- `CA-04` implementado y verificado con integración real contra `aws/aws-emulator`: 18/18 en `tests/integration/worker`, 241/241 en regresión unitaria, typecheck y lint F02 limpios.
- Sin secretos, sin `:9324`, sin credenciales fijas, sin rutas Windows absolutas en artefactos nuevos (escaneo `SCAN_CLEAN`).
- Contenedor Docker **apagado**; `docker ps -a` sin contenedores; volumen named no eliminado (conforme al runbook).
- **No se emite `PASSED` y no se cierra la tarea**: procede revisión de Tester y Auditor.

**Estado: `DONE`.**

---

## Addendum — `v2 — Loop 2/3` (correctivo de auditoría)

| Campo | Valor |
|---|---|
| **Versión / Loop** | `v2 — Loop 2/3` (sin loop 3) |
| **Origen** | `reports/audits/F02/F02-T04-auditor.md` — `A-01` y `A-02` (`MEDIUM`), `A-03` (`LOW`) |
| **Ámbito tocado** | `backend/src/worker/consumer.ts` y `tests/integration/worker/consumer.test.ts` únicamente |
| **Estado del addendum** | **`DONE_WITH_CONCERNS`** — sin `PASSED`, sin cierre; a revisión de Tester/Auditor |
| **Concerns abiertos** | Ninguno dentro de T04. Se reitera el seguimiento a T06: **usar `publishJob()` (no `publish()`)** para publicar el sobre enriquecido con `images`; de lo contrario `resolveBatchStatus({0,0})` cerraría el job como `FAILED` (A-04 del Auditor). |

### Cronología y comandos del loop 2

| Hito | Comando / acción | Resultado |
|---|---|---|
| Arranque | `docker compose up -d` + `docker cp` de CA/config/credenciales + healthcheck | `healthy`, `ok`, límites 2 GiB / 2 CPU |
| RED | `npx vitest run tests/integration/worker --reporter=verbose` | exit 1 · **3 fallos de comportamiento** / 18 pasan (`skippedAsDuplicate` y `dlqFailures` ausentes; `ImageNotFoundError`) |
| GREEN | ídem tras la corrección | exit 0 · **21/21** |
| REFACTOR | unificación de la transición de arranque + re-verificación | exit 0 · **21/21** |
| Focalizadas | `-t 'A-01 redelivery'` / `-t 'A-02 fallo de la DLQ'` | 1/1 y 1/1 |
| Gates | `npm run typecheck`; `npx eslint backend/src/worker tests/integration/worker/{consumer.test,publisher.test,sqs-fixture}.ts --ext .ts`; `npm run test:unit` | exit 0 · exit 0 · **241/241** |
| Apagado | `docker compose down` + `docker compose ps` + `docker ps -a` | contenedor/red eliminados; `docker ps -a` vacío |

**Evidencias del loop:** `F02-T04-loop2-{red,green,idempotency,dlq-failure,all,typecheck,lint-f02,unit-regression,down}.txt`.

### Cambios correctivos

1. **A-01 (idempotencia de mensaje).** `handleJobMessage` consulta el job con `getJob` y usa `ALLOWED_TRANSITIONS` / `nextStatus` de `backend/src/domain/stateMachine.ts`: si el estado es terminal (`COMPLETED`/`PARTIAL`/`FAILED`) devuelve un resultado `skippedAsDuplicate: true` sin escrituras ni reprocesamiento; si es `PENDING` transiciona a `PROCESSING` por la máquina de estados; si ya es `PROCESSING` no reescribe. El cierre también usa `nextStatus('PROCESSING', batchStatus, {completed, failed})`. Además, antes de enviar a la DLQ se consulta `getImage`; si la imagen ya está `FAILED`, no se emite un segundo sobre.
2. **A-02 (DLQ aislada).** Se añade `dlqClient?: Pick<SQSClient, 'send'>` a `ConsumeDependencies` (default `sqs`). El `SendMessageCommand` a la DLQ se envuelve en `try/catch`: un fallo se registra como `dlqFailures` y `dlqDeliveryFailed: true` en el outcome, la imagen queda `FAILED` y el bucle continúa con las demás; el mensaje se borra normalmente, evitando redelivery indefinida. Política explícita: **degradación controlada con señal observable**; no se reintenta dentro del worker ni se bloquea el lote. T06/monitorización debe alertar si `dlqFailures > 0`.
3. **A-03 (precondición).** `ensureImageRecord` usa solo la API pública de F01 (`getImage` + `putImage` si falta) para materializar el `ImageRecord` en `PROCESSING`. No se tocó `backend/src/db/**`.
4. **Sin cambios** en manifiestos, `backend/src/api/**`, `backend/src/db/**`, frontend, IaC, `.github`, `STATE.md` ni `tasks.md`; sin push ni secretos/rutas Windows absolutas nuevas.

### Registro de problemas del loop 2 (7 campos)

#### Problema L2-1 (A-01)
1. **Identificación:** `F02-T04-L2-A01` · Auditoría `A-01` · Loop 2/3.
2. **Problema:** redelivery de un mensaje ya procesado reabría un job terminal y emitía un segundo sobre en la DLQ.
3. **Causa:** **demostrada** — `updateJob` solo mergea el patch sin invocar la máquina de estados, y el envío a DLQ no comprobaba el estado previo de la imagen.
4. **Solución e intentos fallidos:** se gobierna el ciclo con `ALLOWED_TRANSITIONS`/`nextStatus` y se omite la DLQ si `getImage` ya devuelve `FAILED`. Se descartó cambiar la cola a FIFO o añadir `MessageDeduplicationId` (fuera de ámbito y de las colas canónicas declaradas). RED falló con `skippedAsDuplicate === undefined` y DLQ duplicada.
5. **Verificación:** prueba «A-01 redelivery»: dos entregas del mismo sobre → job sigue `FAILED`, imagen sigue `FAILED`, DLQ tiene exactamente 1 mensaje y el procesador se llama solo 3 veces (1/1); suite 21/21.
6. **Pendientes:** Auditor debe confirmar el cierre de `A-01`; el seguimiento `CONFIRM_INCONSISTENT` de T01 (mensaje perdido) no se repara desde `worker/**`.
7. **Aprendizaje candidato:** la idempotencia del consumidor es una propiedad de `jobId` (mensaje), no solo de `imageId`; la máquina de estados congelada es la única fuente válida para decidir si un job puede reabrirse.

#### Problema L2-2 (A-02)
1. **Identificación:** `F02-T04-L2-A02` · Auditoría `A-02` · Loop 2/3.
2. **Problema:** un fallo del `SendMessageCommand` a la DLQ propagaba la excepción, abortaba las imágenes restantes e impedía el `DeleteMessage`, dejando el mensaje para redelivery.
3. **Causa:** **demostrada** — el efecto de infraestructura estaba en la ruta crítica sin `try/catch`; el `catch` existente solo cubría `processor(...)`.
4. **Solución e intentos fallidos:** `dlqClient` inyectable + `try/catch` con `dlqFailures`/`dlqDeliveryFailed`. Se descartó subir `maxRounds` de `drainQueue` (no ataca la causa) y reintentar la DLQ en bucle dentro del worker (riesgo de bloqueo). RED falló con `dlqFailures === undefined`.
5. **Verificación:** prueba «A-02 fallo de la DLQ» con cliente inyectado que lanza: sin excepción, 1 `COMPLETED` + 1 `FAILED`, `dlqFailures === 1`, `deadLettered === false`, job `PARTIAL`, DLQ real sin mensajes (1/1); suite 21/21.
6. **Pendientes:** T06 debe exponer `dlqFailures` en la observabilidad y definir la alerta; fuera del ámbito de T04.
7. **Aprendizaje candidato:** los efectos secundarios de infraestructura nunca deben condicionar la garantía «el resto del lote continúa»; aislarlos y fallar cerrado de forma explícita y medible.

#### Problema L2-3 (A-03)
1. **Identificación:** `F02-T04-L2-A03` · Auditoría `A-03` · Loop 2/3.
2. **Problema:** el consumidor daba por supuesto que cada `ImageRecord` existía; si faltaba, `updateImage` lanzaba `ImageNotFoundError` y el mensaje quedaba para redelivery.
3. **Causa:** **demostrada** — `updateImage` exige existencia previa (F01); la precondición no estaba declarada ni garantizada en el contrato de T04.
4. **Solución e intentos fallidos:** `ensureImageRecord` crea el ítem con `putImage` (API pública) cuando `getImage` devuelve `null`. Se descartó modificar `backend/src/db/**` para convertir `updateImage` en upsert (fuera de ámbito y contrato congelado). RED falló con `ImageNotFoundError`.
5. **Verificación:** prueba «A-03 precondición»: job sin imágenes + sobre válido → se materializa el `ImageRecord`, queda `COMPLETED`, `exifStripped: true`, `listImages().length === 1` (1/1); suite 21/21.
6. **Pendientes:** T06 debe materializar igualmente sus ítems imagen desde el productor para que la métrica inicial del job sea coherente; T04 ya no depende de ello.
7. **Aprendizaje candidato:** declarar y, si es posible, auto-satisfacer las precondiciones de persistencia del consumidor usando solo la API pública de la capa de datos.

### Estado del loop 2

`CA-04` reforzado sin regresiones: **21/21** integración, **241/241** unitario, typecheck y lint F02 limpios, Docker apagado. **No se emite `PASSED` y no se cierra la tarea**: procede nueva revisión de Tester y Auditor.

**Estado: `DONE_WITH_CONCERNS` (loop 2/3).**
