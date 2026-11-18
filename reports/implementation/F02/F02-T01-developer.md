# `F02-T01` — Entrega del Developer

| Campo | Valor |
|---|---|
| **ID / tarea** | `F02-T01` — Rutas Hono `/jobs` + adaptador `UserStore` + rate limit |
| **Fase / paquete** | Fase 2 — `docs/sdd/packages/P-02-api-and-worker.md` |
| **Versión / loop** | `v1 — Loop 1/3` (sin addendum previo) |
| **Rol / harness** | Developer · OpenCode |
| **Riesgo** | `3 (Sensible)` — autenticación, aislamiento y API |
| **Estado final** | **`DONE_WITH_CONCERNS`** (detalle en §7; no se emite `PASSED` ni se cierra la tarea) |
| **Fecha** | `2026-11-17` |

---

## 1. Fuentes consultadas

- `AGENTS.md`; `STATE.md`; `.agents/roles/developer.md`.
- `docs/sdd/packages/P-02-api-and-worker.md` (§3 ámbito, §5 `CA-01`).
- `docs/sdd/spec.md` §5 y FR-08/FR-10/FR-14/FR-21; `docs/sdd/plan.md` §3; `docs/architecture/04-api-and-component-contract.md` §4.
- **`reports/implementation/F02/F02-T01-task.md` — fuente de verdad de alcance** (§3 ámbito exclusivo, §4 método y entregables).
- `reports/verification/F01-architect.md` §3 (`T03-A-01`, `T03-A-04`, `A-05`) y `reports/audits/F01/F01-T03-auditor.md` (hallazgo `T03-A-01`).
- Módulos F01 consumidos **sin modificar**: `backend/src/contracts/{index,catalog,zod-schemas}.ts`, `backend/src/auth/{index,routes,middleware,errors,rate-limit,service,user-store,identity,jwt}.ts`, `backend/src/db/{index,client,job-store,keys,types,errors}.ts`, `backend/src/config/index.ts`, `backend/src/domain/stateMachine.ts`, `backend/src/index.ts`.
- Runbook `docs/runbooks/development-workflow.md` §1.3/§1.4 (arranque, `docker cp`, apagado).

## 2. Criterio `CA-01` y cobertura

| Requisito de `CA-01` | Implementación | Evidencia |
|---|---|---|
| `POST /jobs`, `POST /jobs/:id/confirm`, `GET /jobs`, `GET /jobs/:id` | `backend/src/api/jobs.ts` montadas en `createApiApp()` (`backend/src/api/app.ts`) | `F02-T01-green.txt`, `F02-T01-integration.txt` |
| Filtro estricto por `userId` | `requireAuth` inyecta `c.userId` del JWT; **todas** las llamadas al almacén usan ese valor. No existe parámetro `userId` en las rutas | `F02-T01-authz.txt` (9/9), `F02-T01-regression.txt` |
| 401 sin token; 404 ajeno = inexistente | Guarda de autenticación antes del límite; `getJob(userId, jobId)` devuelve `null` tanto para ajeno como para inexistente; mismo `authErrorResponse(resourceNotFound())` | `F02-T01-authz.txt` |
| `confirm` idempotente y publica **después** | Transición `PENDING → PROCESSING` (grafo congelado) y luego `publisher.publish()`; estados no-`PENDING` responden sin publicar; si falla la publicación se revierte a `PENDING` y responde 503 | `F02-T01-green.txt` (8/8) |
| Publicador inyectable, sin simulación en producto | `backend/src/api/publisher.ts`: `JobQueuePublisher` + `JobConfirmationMessage`. `publisher` es dependencia **obligatoria** de `createApiApp()`; la implementación SQS real queda para `F02-T04`. Los dobles de test viven solo en `tests/**` | `F02-T01-green.txt` |
| Adaptador DynamoDB de `UserStore` (`T03-A-04`) | `backend/src/db/user-store-adapter.ts` (archivo nuevo único): perfil `USER#PROFILE` + índice `USER#EMAIL`, `TransactWriteCommand` condicional para unicidad, validación con `schemas.AuthenticatedUser` | `F02-T01-userstore.txt` (9/9) |
| Clave de rate limit no suplantable (`T03-A-01`) | `/jobs`: `limiter.check(c.get('userId'))`; `/auth`: `NonSpoofableAuthLimiter` descarta el argumento derivado de `x-forwarded-for`/`x-real-ip` por `mountAuthRoutes` y usa un principal fijado por middleware (`AsyncLocalStorage`) | `F02-T01-rate-limit.txt` (5/5) |
| Validación con esquemas congelados, sin redefinirlos | `schemas.Preset`, `schemas.ImageRecord`, `schemas.JobMetrics`, `schemas.LimitsConfig`, `schemas.Job` y `computeTtl()` desde `backend/src/contracts/index.ts` | `F02-T01-green.txt`, `F02-T01-regression.txt` (32/32 contratos) |
| Punto de entrada | `backend/src/api/app.ts::createApiApp()` monta `mountAuthRoutes` + rutas `/jobs`. **`backend/src/index.ts` intacto** | `git status --short`: sin entrada para `backend/src/index.ts` |

## 3. Cronología (v1, loop 1/3)

| Hito | Acción | Resultado |
|---|---|---|
| 1 | Lectura obligatoria y contraste de alcance (`F02-T01-task.md` como fuente de verdad) | Alcance confirmado; detectado el conflicto aparente `T03-A-01` vs. prohibición de tocar `backend/src/auth/**` |
| 2 | Esqueletos `NOT_IMPLEMENTED` + 24 tests RED en `tests/unit/api/**` | `F02-T01-red.txt`: **24/24 fallos por comportamiento**, sin errores de importación |
| 3 | Implementación GREEN (api + adaptador) | Tras 3 correcciones: `F02-T01-green.txt` **24/24**, exit 0 |
| 4 | REFACTOR: correcciones de tipos, dobles y consistencia de métricas | `F02-T01-refactor.txt` **24/24**, `F02-T01-typecheck.txt` exit 0, `F02-T01-lint-scoped.txt` exit 0 |
| 5 | Integración real en `aws/aws-emulator` (G-7) | `F02-T01-integration.txt` **7/7**; certificado/credenciales exportados con `docker cp` |
| 6 | Evidencias específicas de authz / rate-limit / userstore | 9/9, 5/5 y 9/9, exit 0 |
| 7 | Apagado del emulador y verificación | `F02-T01-docker-down.txt`: exit 0, `docker ps -a` sin contenedores |
| 8 | Regresión global de unitarias y comprobación de confinamiento | `F02-T01-regression.txt`: **194/194**, exit 0; `git status --short` sin rutas prohibidas propias |
| 9 | Sanitización P4 de evidencias | Sin rutas Windows absolutas ni secretos en `evidence/*.txt` (marcador `<PROJECT_ROOT>`) |

## 4. Comandos ejecutados y códigos de salida

Todos desde `<PROJECT_ROOT>`. Docker con `PATH` antecompuesto con `<DOCKER_CLI_DIR>`.

| Comando | exit | Salida / evidencia |
|---|---|---|
| `npx vitest run tests/unit/api` (RED) | `1` | 24/24 fallos por comportamiento · `F02-T01-red.txt` |
| `npx vitest run tests/unit/api` (GREEN, 3 intentos) | `1`, `1`, `0` | último: 4 archivos, 24/24 · `F02-T01-green.txt` |
| `npm run typecheck` | `0` | sin diagnósticos · `F02-T01-typecheck.txt` |
| `npx eslint backend/src/api backend/src/db/user-store-adapter.ts tests/unit/api tests/integration/api --ext .ts` | `0` | sin hallazgos · `F02-T01-lint-scoped.txt` |
| `npx vitest run tests/unit/api` (REFACTOR) | `0` | 24/24 · `F02-T01-refactor.txt` |
| `docker compose up -d` / inspección de `health` | `0` | contenedor `healthy` en `127.0.0.1:9297` |
| `docker cp` (CA/config/credenciales) + `curl.exe --cacert … /__admin/health` | `0` | cuerpo `ok` |
| `npx vitest run tests/integration/api` | `0` | 2 archivos, 7/7 · `F02-T01-integration.txt` |
| `npx vitest run tests/unit/api/authz.test.ts tests/integration/api/routes.test.ts` | `0` | 9/9 · `F02-T01-authz.txt` |
| `npx vitest run tests/unit/api/rate-limit.test.ts` | `0` | 5/5 · `F02-T01-rate-limit.txt` |
| `npx vitest run tests/unit/api/userstore.test.ts tests/integration/api/userstore.test.ts` | `0` | 9/9 · `F02-T01-userstore.txt` |
| `docker compose down` + `docker ps -a` | `0` | contenedor y red eliminados; sin contenedores · `F02-T01-docker-down.txt` |
| `npx vitest run tests/unit` | `0` | 22 archivos, 194/194 · `F02-T01-regression.txt` |
| `npm run lint` (global) | **`1`** | 1 error **fuera de mi ámbito**: `tests/unit/frontend/core.test.ts:6` (`Theme` sin usar, F03 en paralelo) · `F02-T01-lint.txt` |

## 5. Decisiones de diseño

1. **Firma de la interfaz de publicación** (`backend/src/api/publisher.ts`): `JobQueuePublisher.publish(message: JobConfirmationMessage): Promise<void>` con `JobConfirmationMessage = { readonly userId: string; readonly jobId: string }`. Se eligió el mensaje mínimo porque en `F02-T01` aún no existen claves S3 ni registros de imagen; `F02-T04` podrá enriquecerlo de forma retrocompatible. No hay implementación SQS en producto: `publisher` es obligatorio en `ApiAppDeps` y los tests inyectan un grabador. La reversión a `PENDING` ante fallo de publicación evita que un lote quede atrapado en `PROCESSING` sin mensaje en cola.
2. **Adaptador `UserStore`** (`backend/src/db/user-store-adapter.ts`): una sola tabla (PK `userId`, SK `jobId`) con dos ítems por usuario — perfil (`USER#PROFILE`, PK = userId) e índice de correo (`USER#EMAIL`, PK = correo normalizado). Un `TransactWriteCommand` con condiciones `attribute_not_exists` en ambos ítems hace atómica la unicidad del correo y mapea la cancelación a `EmailAlreadyExistsError`. Los prefijos `USER#` no colisionan con `IMAGE#` ni con jobIds opacos. No se modificó ningún otro archivo de `backend/src/db/**`.
3. **Rate limit**: `/jobs` usa directamente el `userId` del JWT. `/auth` no puede derivar un `userId` (es pre-autenticación) y `mountAuthRoutes` le pasa una clave de cabeceras suplantables; sin tocar F01 se inyectó `NonSpoofableAuthLimiter` (subclase de `FixedWindowRateLimiter`) que **ignora** ese argumento y usa un principal de servidor fijado por middleware. Es fail-closed: si falta el middleware, cae a `auth:anonimo`, nunca a la cabecera. Coste acknowledged: todas las rutas `/auth` comparten cubo; el ajuste por proxy de confianza queda para el wiring de F05.
4. **Métricas del lote PENDING**: el contrato congelado exige `savingsPct = (bytesBefore − bytesAfter)/bytesBefore × 100`. Un lote recién creado con `bytesBefore > 0` y `bytesAfter = 0` daría un falso `100 %`; por PR-12 se persiste `0/0/0` hasta que el worker mida bytes reales. Los bytes declarados por imagen se validan contra `maxFileSizeMb` y `maxImagesPerBatch`, y quedarán disponibles para T02/T04.
5. **Listado**: `JobStore` de F01 no expone `listJobs`, por lo que se definió el puerto `JobListStore` en `backend/src/api/**` con implementación DynamoDB (`QueryCommand` por PK + filtro `itemType === 'JOB'`), en vez de ampliar un módulo congelado de F01.

## 6. Archivos creados (ámbito exclusivo)

- Producto: `backend/src/api/{publisher,job-list-store,rate-limit,jobs,app,index}.ts` y `backend/src/db/user-store-adapter.ts`.
- Pruebas: `tests/unit/api/{fixtures,routes,authz,rate-limit,userstore}.test.ts` (más `fixtures.ts`) y `tests/integration/api/{fixtures,routes,userstore}.test.ts`.
- Evidencia: `reports/implementation/F02/evidence/F02-T01-{red,green,refactor,authz,rate-limit,userstore,integration,typecheck,lint,lint-scoped,regression,docker-down}.txt`.
- Reporte: este archivo.

**No tocados:** `backend/src/index.ts`, otros módulos de F01, `frontend/`, `infra/terraform/`, `.github/`, manifiestos, `STATE.md`, `docs/sdd/tasks.md`, reportes ajenos. Sin push ni secretos.

## 7. Problemas registrados (7 campos obligatorios)

### P-01 — `AuthService` importado solo como tipo
1. **Identificación:** `F02-T01` · v1 loop 1/3 · fase GREEN, primer intento · entorno local.
2. **Problema:** 21 de 24 tests fallaron con `ReferenceError: AuthService is not defined` al construir la app.
3. **Causa:** `DEMOSTRADA`. `import type { AuthService }` se eliminó en la emisión y se usó `new AuthService(...)` en `app.ts`.
4. **Solución e intentos fallidos:** cambiar a import de valor (`import { AuthService } from '../auth/service'`). No hubo intentos fallidos adicionales.
5. **Verificación:** segundo intento de GREEN: 12/24; tras el resto de correcciones, 24/24.
6. **Pendientes:** ninguno.
7. **Aprendizaje candidato:** revisar imports `type` antes de usar constructores en la capa de composición (`PROPUESTA_GLOBAL`).

### P-02 — Doble de cliente DynamoDB guardaba bajo clave `undefined|undefined`
1. **Identificación:** `F02-T01` · v1 loop 1/3 · GREEN, primer intento · tests unitarios sin emulador.
2. **Problema:** `create()` resolvía sin error pero los ítems no aparecían; `findByEmail` devolvía `null`.
3. **Causa:** `DEMOSTRADA`. El doble leía `write.userId`/`write.jobId` del objeto `Put` en vez de `write.Item.userId`/`write.Item.jobId`.
4. **Solución e intentos fallidos:** corregir el doble para leer `Put.Item` y tipar la entrada del fake con `Item | undefined`. Intentos fallidos: ninguno en producto; el error estaba exclusivamente en el test double.
5. **Verificación:** `F02-T01-green.txt`, `userstore.test.ts` 6/6; integración real 3/3.
6. **Pendientes:** ninguno.
7. **Aprendizaje candidato:** los dobles de SDK deben tiparse contra la forma real del `input` (anidado `TransactItems[].Put.Item`) para fallar en tiempo de compilación.

### P-03 — Contrato congelado rechazaba métricas de lote PENDING
1. **Identificación:** `F02-T01` · v1 loop 1/3 · GREEN, primer intento · validación `schemas.Job`.
2. **Problema:** `POST /jobs` respondía 500 con `ZodError: savingsPct no coincide con bytesBefore y bytesAfter`.
3. **Causa:** `DEMOSTRADA`. Se proponía `bytesBefore = suma(bytes)`, `bytesAfter = 0`, `savingsPct = 0`, lo que contradice la coherencia PR-12 del catálogo congelado.
4. **Solución e intentos fallidos:** fijar `0/0/0` hasta la medición real del worker. Se descartó `savingsPct = 100` (falso ahorro en PENDING) y `bytesAfter = bytesBefore` (falsa salida optimizada). Se actualizó la expectativa del test con la justificación documentada, sin relajar el esquema.
5. **Verificación:** `F02-T01-green.txt` (routes 8/8) y `F02-T01-regression.txt` (contratos 32/32).
6. **Pendientes:** `F02-T06` debe persistir las métricas reales al terminar el worker.
7. **Aprendizaje candidato:** los estados iniciales deben satisfacer las coherencias del contrato congelado; "sin medir" se representa con ceros, no con valores plausibles.

### P-04 — Clave `userId` duplicada en literal de objeto (TS2783)
1. **Identificación:** `F02-T01` · v1 loop 1/3 · REFACTOR · `npm run typecheck`.
2. **Problema:** `backend/src/db/user-store-adapter.ts:102` — `userId` se especificaba antes de `...publicUser` y era sobrescrito.
3. **Causa:** `DEMOSTRADA`. Orden de propagación en el literal del ítem de perfil.
4. **Solución e intentos fallidos:** colocar `...publicUser` primero y mantener `jobId`/`itemType` explícitos. Sin intentos fallidos.
5. **Verificación:** `F02-T01-typecheck.txt` exit 0; integración 3/3.
6. **Pendientes:** ninguno.
7. **Aprendizaje candidato:** al combinar spreads con campos de clave, el spread debe ir primero para evitar sobreescrituras silenciosas.

### P-05 — Cuerpo de respuesta leído dos veces en test de 404
1. **Identificación:** `F02-T01` · v1 loop 1/3 · GREEN, segundo intento · `authz.test.ts`.
2. **Problema:** `TypeError: Body is unusable: Body has already been read`.
3. **Causa:** `DEMOSTRADA`. Se llamó `foreign.text()` y después `jsonOf(missing)` sobre la misma respuesta.
4. **Solución e intentos fallidos:** parsear ambas respuestas una sola vez con `jsonOf()` y comparar `JSON.stringify`.
5. **Verificación:** `F02-T01-green.txt`, `authz.test.ts` 5/5 y `F02-T01-authz.txt` 9/9.
6. **Pendientes:** ninguno.
7. **Aprendizaje candidato:** en `app.request`, cada `Response` solo se consume una vez; comparar objetos parseados, no streams.

### P-06 — Constante inexistente importada en test de integración
1. **Identificación:** `F02-T01` · v1 loop 1/3 · integración, primer intento · `tests/integration/api/userstore.test.ts`.
2. **Problema:** aserción `itemType: undefined` frente a `"USER"`; el test falló aunque el adaptador funcionaba.
3. **Causa:** `DEMOSTRADA`. Se importó `USER_ITEM_TYPE` desde `backend/src/db/keys.ts`, que solo exporta `JOB_ITEM_TYPE` e `IMAGE_ITEM_TYPE`.
4. **Solución e intentos fallidos:** usar el literal `'USER'` en la aserción (la constante del adaptador es privada). Sin intentos fallidos posteriores.
5. **Verificación:** `F02-T01-integration.txt` 7/7, exit 0; typecheck posterior exit 0.
6. **Pendientes:** ninguno.
7. **Aprendizaje candidato:** ejecutar `npm run typecheck` también después de crear tests de integración, no solo tras el código de producto.

### P-07 — `npm run lint` global en rojo por archivo de F03 en paralelo (ABIERTO, fuera de ámbito)
1. **Identificación:** `F02-T01` · v1 loop 1/3 · verificación final · `tests/unit/frontend/core.test.ts:6`.
2. **Problema:** `npm run lint` devuelve exit 1 por `'Theme' is defined but never used` en un archivo propiedad de F03 (harness paralelo).
3. **Causa:** `DEMOSTRADA`. Archivo añadido por otro harness durante esta tarea; aparece en `git status --short` como `?? tests/unit/frontend/`. Está prohibido por `F02-T01-task.md` §3.
4. **Solución e intentos fallidos:** no se modificó. Se ejecutó un lint **acotado** a los archivos propios (`npx eslint backend/src/api backend/src/db/user-store-adapter.ts tests/unit/api tests/integration/api --ext .ts`) con exit 0. Intentos fallidos: dos ejecuciones globales (primero `ApiError` y `Theme`, luego solo `Theme`), ambas fuera de alcance.
5. **Verificación:** `F02-T01-lint-scoped.txt` exit 0; `F02-T01-lint.txt` exit 1 con el único hallazgo ajeno documentado.
6. **Pendientes:** que el Developer/Architect de F03 corrija el import sin usar; el Tester de F02 debe decidir si acepta el lint acotado como evidencia propia.
7. **Aprendizaje candidato:** en fases paralelas, reporting de lint global debe distinguir hallazgos propios de hallazgos de otro harness con propiedad de archivo explícita.

## 8. Estado final y handoff

- **Estado:** `DONE_WITH_CONCERNS`.
- **TDD:** RED real por comportamiento (24 fallos) → GREEN 24/24 → REFACTOR 24/24. Integración real 7/7. Regresión unitaria 194/194. Typecheck exit 0. Lint propio exit 0; lint global `1` por P-07.
- **Gates:** G-1/G-2/G-3/G-4/G-7 consumidos; sin secretos ni rutas Windows absolutas en artefactos; Docker apagado (`docker ps -a` vacío); sin `terraform apply`; sin AWS real; sin push.
- **Cierres de seguimiento:** `T03-A-01` y `T03-A-04` implementados y cubiertos (el Auditor/Tester de F02 deben dictaminar); `A-05` (orden de guarda de tamaño) pertenece al worker de `F02-T03`, no a esta tarea.
- **Límites del alcance:** las Presigned URLs de subida (`FR-08`) son de `F02-T02`; el publicador SQS real es de `F02-T04`; el wiring del servidor se consolidará en F05. No se han simulado en producto.
- **Handoff:** entregar a Tester independiente (`npx vitest run tests/unit/api tests/integration/api`, `npm run typecheck`, `npm run lint`) y Auditor de riesgo 3. **No se emite `PASSED`; la tarea queda abierta.**

---

# ADDENDUM — Loop 2/3 (corrección de hallazgos de Auditor)

| Campo | Valor |
|---|---|
| **Versión / loop** | `v1 — Loop 2/3` (append-only; el contenido anterior permanece intacto) |
| **Origen** | Auditoría `reports/audits/F02/F02-T01-auditor.md`: hallazgos `A-01` y `A-02` (MEDIUM) |
| **Objetivo** | Idempotencia de `confirm` bajo concurrencia y rollback explícito antes de que T04 cablee el publicador SQS real |
| **Estado del loop** | **`DONE_WITH_CONCERNS`** — sin `PASSED`, tarea abierta |

## A. Cambios de producto

- **Nuevo:** `backend/src/api/job-transition.ts` con el puerto `JobTransitionStore` y `createDynamoJobTransitionStore()`. Usa `UpdateCommand` con `ConditionExpression: '#status = :from'`:
  - `confirmPending`: `PENDING → PROCESSING` con `#status = :PENDING`; si otro confirm gana, `ConditionalCheckFailedException` se traduce a `JobAlreadyConfirmedError` y la ruta responde `confirmed: true` **sin publicar**.
  - `revertToPending`: `PROCESSING → PENDING` con `#status = :PROCESSING`; si falla, se lanza `JobStateConflictError` y la ruta responde **503 `CONFIRM_INCONSISTENT`** (nunca `confirmed: true`).
- `backend/src/api/jobs.ts`: `confirm` usa el puerto inyectado en lugar de `jobs.updateJob`; mantiene el pre-check para 404 y para idempotencia secuencial; al recibir `JobAlreadyConfirmedError` vuelve a leer el lote antes de responder.
- `backend/src/api/app.ts`: la fábrica `createDynamoDbDocumentClientFromConfig` se importa desde **`backend/src/db/index.ts`** (puerta pública de F01) y se crea de forma **perezosa** para que los tests unitarios no dependan del certificado del emulador. Nueva dependencia opcional `jobTransition`, inyectable por tests.
- `backend/src/api/job-list-store.ts`: se exporta `JOB_FIELDS` para hidratar el `ReturnValues: ALL_NEW` filtrando el atributo interno `itemType` antes de validar con `schemas.Job`.
- **Decisión de capa (documentada):** la condición no fue a `backend/src/db/job-store.ts` porque ese módulo es propiedad de F01 y su `updateJob` solo condiciona existencia; además el alcance de `F02-T01` prohíbe modificarlo. La transición atómica vive en `backend/src/api/**` y reutiliza el cliente/contratos de F01 sin redefinirlos. **No se modificó ningún módulo de F01.**

## B. Pruebas añadidas

- `tests/unit/api/confirm.test.ts` (3): dos confirms en paralelo con entrelazamiento forzado (RED publicaba 2 mensajes); fallo de publicación con reversión correcta → 503 `PUBLISH_FAILED` y reintento publica; fallo de publicación **y** reversión → 503 `CONFIRM_INCONSISTENT`, sin `confirmed`, lote en `PROCESSING`.
- `tests/integration/api/routes.test.ts` (2): dos peticiones HTTP concurrentes sobre DynamoDB real publican una sola vez; fallo de publicación contra tabla real revierte a `PENDING`.
- Dobles: `FakeJobTransitionStore` (check-and-set sin `await` intermedio, semántica equivalente a escritura condicional) y `delayNextUpdate`/`failNextUpdate` en `FakeJobStore`.

## C. Criterio A-01 — concurrencia

1. **Identificación:** `A-01` · `F02-T01` · Loop 2/3 · MEDIUM · Auditoría F02.
2. **Problema:** `getJob` → comprobación `PENDING` → `updateJob` (solo existencia) → `publish`: dos confirms simultáneos podían publicar dos mensajes SQS para el mismo lote.
3. **Causa:** `DEMOSTRADA`. RED: `F02-T01-loop2-red.txt` mostró `expected 1 to be 2` mensajes con el doble FORZANDO entrelazamiento; la condición de escritura no protegía el estado.
4. **Solución e intentos fallidos:** escritura condicional `#status = :PENDING` en `job-transition.ts`; `JobAlreadyConfirmedError` se trata como idempotencia. Intentos fallidos: el primer test de concurrencia sin entrelazamiento forzado pasaba en RED (falso verde del doble), por lo que se añadió `delayNextUpdate` para reproducir la carrera real.
5. **Verificación:** RED 2/3 fallos → GREEN `F02-T01-loop2-green.txt` 27/27; `F02-T01-concurrency.txt`: unit 1/1 + integración real 1/1, exit 0; suite completa `F02-T01-loop2-all.txt` 36/36.
6. **Pendientes:** T04 debe conservar el puerto `JobTransitionStore` al cablear el publicador SQS real y no reintroducir `updateJob` directo en `confirm`.
7. **Aprendizaje candidato:** la idempotencia defensiva por lectura no basta; hace falta CAS condicional sobre el estado, y el doble de test debe poder entrelazarse para que la prueba la detecte.

## D. Criterio A-02 — rollback silenciado

1. **Identificación:** `A-02` · `F02-T01` · Loop 2/3 · MEDIUM · Auditoría F02.
2. **Problema:** si fallaban publicación y reversión, el `catch` interno silenciaba el error, devolvía `PUBLISH_FAILED` y dejaba el lote en `PROCESSING`.
3. **Causa:** `DEMOSTRADA`. RED: `F02-T01-loop2-red.txt` devolvió 500 en vez de 503 con código explícito; el `catch` vacío impedía distinguir "revertido" de "inconsistente".
4. **Solución e intentos fallidos:** reversión condicional `PROCESSING → PENDING` y distinción de dos respuestas: `PUBLISH_FAILED` (reversión OK) y `CONFIRM_INCONSISTENT` (reversión fallida), ambas 503 y sin `confirmed`. Se descartó devolver 500 genérico por `authErrorResponse` porque no explicita el código al cliente.
5. **Verificación:** `F02-T01-rollback.txt`: unit 2/2 (ambos casos) + integración real 1/1, exit 0; `F02-T01-loop2-all.txt` 36/36.
6. **Pendientes:** tras un `CONFIRM_INCONSISTENT`, un reintento sigue respondiendo `confirmed: true` sin publicar (política at-most-once). La inconsistencia queda **señalizada** al cliente, no reparada automáticamente; T04/T06 deberán decidir si se añade un marcador duradero de publicación para recuperación automática.
7. **Aprendizaje candidato:** un rollback best-effort sin señal explícita convierte un fallo transitorio en pérdida silenciosa de mensaje; el código de error debe ser parte del contrato observable.

## E. Verificación del loop 2/3

| Comando | exit | Salida / evidencia |
|---|---|---|
| `npx vitest run tests/unit/api/confirm.test.ts` (RED) | `1` | 2 fallos por comportamiento · `F02-T01-loop2-red.txt` |
| `npx vitest run tests/unit/api` (GREEN) | `0` | 5 archivos, 27/27 · `F02-T01-loop2-green.txt` |
| `npx vitest run tests/unit/api tests/integration/api` | `0` | 7 archivos, 36/36 · `F02-T01-loop2-all.txt` |
| `npx vitest run tests/unit/api/confirm.test.ts -t 'dos confirms en paralelo'` + integración | `0`, `0` | 1/1 + 1/1 · `F02-T01-concurrency.txt` |
| `npx vitest run tests/unit/api/confirm.test.ts -t 'publicación'` + integración | `0`, `0` | 2/2 + 1/1 · `F02-T01-rollback.txt` |
| `npm run typecheck` | `0` | sin diagnósticos · `F02-T01-loop2-typecheck.txt` |
| `npx eslint backend/src/api backend/src/db/user-store-adapter.ts tests/unit/api tests/integration/api --ext .ts` | `0` | sin hallazgos · `F02-T01-loop2-lint-scoped.txt` |
| `docker compose up -d` / `docker cp` / healthcheck / `docker compose down` / `docker ps -a` | `0` | `ok`; contenedor y red eliminados, sin contenedores · `F02-T01-loop2-docker-down.txt` |

## F. Confinamiento y estado

- Sin cambios en `backend/src/db/job-store.ts`, `backend/src/index.ts`, manifiestos, `frontend/`, `infra/`, `.github/`, `STATE.md`, `tasks.md` ni reportes ajenos. Sin push. Sin secretos ni rutas Windows absolutas (todas las evidencias usan `<PROJECT_ROOT>`).
- Archivos propios nuevos del loop: `backend/src/api/job-transition.ts`, `tests/unit/api/confirm.test.ts`; adaptados: `backend/src/api/{app,jobs,job-list-store,index}.ts`, `tests/{unit,integration}/api/fixtures.ts`, `tests/integration/api/routes.test.ts`.
- Docker apagado tras la integración (G-7).
- **Estado: `DONE_WITH_CONCERNS`.** Los dos hallazgos MEDIUM quedan corregidos y cubiertos por Tester/Auditor; persiste el concern P-07 (lint global en rojo por archivo de F03, fuera de este ámbito) y la limitación de recuperación documentada en D.6. **No se emite `PASSED`; la tarea sigue abierta.**

### Nota final de verificación global (append-only)

Tras el loop 2 se reejecutó la suite unitaria completa: **197/198** (`F02-T01-loop2-regression.txt`, exit 1). El único fallo es `tests/unit/frontend/core.test.ts:79` (`downloadUrl` con barra final), archivo propiedad de F03 que cambió durante este loop. Los 36 tests del ámbito F02 (`tests/unit/api` + `tests/integration/api`) siguen en verde (`F02-T01-loop2-all.txt`, exit 0). No se modificó frontend ni ningún archivo ajeno; el hallazgo se reporta, no se silencia.
