# `F02-T01` — Dictamen del Tester (verificación independiente)

| Campo | Valor |
|---|---|
| **ID / tarea** | `F02-T01` — Rutas Hono `/jobs` + adaptador `UserStore` + rate limit |
| **Fase / paquete / criterio** | Fase 2 — `docs/sdd/packages/P-02-api-and-worker.md` · `CA-01` |
| **Rol / riesgo / loop** | Tester independiente · Riesgo `3 (Sensible)` · `Loop 1/3` |
| **Entregado por** | Developer (`F02-T01-developer.md`, estado `DONE_WITH_CONCERNS`) |
| **Fecha** | `2026-11-17` |
| **Veredicto global** | **`PASSED`** |
| **Loops activados** | **Ninguno** (no se emite `NO-PASSED`) |

---

## 1. Fuentes, alcance e independencia

Leídas sin editar: `AGENTS.md`, `STATE.md`, `.agents/roles/tester.md`, `docs/sdd/packages/P-02-api-and-worker.md`, `docs/sdd/spec.md` (§5/§6, FR-08/FR-10/FR-14/FR-21), `docs/architecture/04-api-and-component-contract.md` (§4), `reports/verification/F01-architect.md` (§3: `T03-A-01`, `T03-A-04`), `F02-T01-task.md` (fuente de verdad de alcance), `F02-T01-developer.md`, `backend/src/api/**`, `backend/src/db/user-store-adapter.ts`, `backend/src/auth/{index,routes,middleware,rate-limit}.ts`, `tests/{unit,integration}/api/**`, `docs/runbooks/development-workflow.md` y la auditoría `reports/audits/F02/F02-T01-auditor.md`.

Regla aplicada: todo lo que se acredita como ejecución propia proviene de comandos lanzados por este Tester y se conserva en `reports/implementation/F02/evidence/F02-T01-tester-*.txt`. La evidencia del Developer (`F02-T01-{red,green,refactor,...}.txt`) se cita **solo como registro cronológico**, nunca como evidencia propia.

## 2. Verificación por criterio

| # | Criterio / verificación | Método propio | Resultado | Evidencia propia |
|---|---|---|---|---|
| V1 | `npx vitest run tests/unit/api tests/integration/api` | Ejecución directa, sin `skip`/`only`/`todo` (buscados con grep en `tests/**`): 4 archivos unit 24/24 + 2 archivos integración 7/7 | **`31/31`, exit 0** | `F02-T01-tester-api.txt`, `F02-T01-tester-unit-api.txt` |
| V2 | Suite unitaria global y tipos | `npm run test:unit` → 22 archivos, **194/194**, exit 0; `npm run typecheck` → exit 0, sin diagnósticos | **Conforme** | `F02-T01-tester-unit.txt`, `F02-T01-tester-typecheck.txt` |
| V3 | 401 sin token; 404 ajeno = inexistente; `POST /jobs` con preset congelado y métricas `0/0/0`; `confirm` idempotente con `PENDING→PROCESSING` y rollback; `GET /jobs`/`GET /jobs/:id` solo del usuario del token | Lectura de `jobs.ts`, `app.ts`, `job-list-store.ts`, `auth/middleware.ts` + ejecución de `authz.test.ts` (5/5), `routes.test.ts` (8/8) e integración `routes.test.ts` (4/4) | **Conforme.** 401 antes que el limitador; 404 con cuerpo idéntico; `schemas.Preset` rechaza `ULTRA` con 400; `schemas.Job.parse` valida el job `PENDING` con `0/0/0` y TTL; `confirm` publica una sola vez y revierte a `PENDING` si falla; `x-user-id` no suplanta | `F02-T01-tester-authz.txt` |
| V4 | Rate limit no suplantable (`T03-A-01`): clave = `userId` del token (o principal fijado por middleware); `x-forwarded-for`/`x-real-ip` no cambian la clave; fail-closed | Lectura de `api/rate-limit.ts`, `api/app.ts`, `auth/routes.ts` + ejecución de `rate-limit.test.ts` (5/5) | **Conforme.** Agotar A no afecta B; rotar cabeceras en `/jobs` da 429; cabecera con `userId` ajeno no consume su cupo; tres `x-forwarded-for` distintos en `/auth/login` → 429 en la tercera; `NonSpoofableAuthLimiter` descarta la clave de cabeceras y cae a `auth:anonimo` si falta el middleware | `F02-T01-tester-rate-limit.txt` |
| V5 | `UserStore` DynamoDB (`T03-A-04`): `TransactWriteCommand` condicional, validación con `schemas.AuthenticatedUser`, sin duplicar contratos | Lectura de `user-store-adapter.ts` + unit `userstore.test.ts` (6/6) e integración `userstore.test.ts` (3/3) contra DynamoDB real | **Conforme.** Dos `Put` con `attribute_not_exists`, mapeo a `EmailAlreadyExistsError`, `normalizeEmail` importado de F01, hash no expuesto, archivo nuevo sin tocar otros módulos de `backend/src/db/**` | `F02-T01-tester-userstore.txt` |
| V6 | Publicador SQS inyectado; sin cliente SQS real en producto | Búsquedas de solo lectura en `backend/src/api/**` | **Conforme.** `publisher.ts` es solo un puerto; `ApiAppDeps.publisher` obligatorio; 0 importaciones de `client-sqs`, 0 `SQSClient`/`SendMessageCommand`/`QueueUrl`; el único `.send(` es un `QueryCommand` de DynamoDB. Implementación real diferida a `F02-T04` | `F02-T01-tester-publisher.txt` |
| V7 | Lint global rojo por F03 paralelo; lint acotado a F02 verde; interferencia externa no bloqueante | `npx eslint backend/src/api backend/src/db/user-store-adapter.ts tests/unit/api tests/integration/api --ext .ts` → exit 0; `npm run lint` → exit 1 | **Conforme.** El lint global falla por 3 errores, todos en archivos propiedad de F03 (`frontend/src/App.tsx` ×2, `tests/unit/frontend/core.test.ts` ×1). Ningún hallazgo en archivos de F02-T01 | `F02-T01-tester-lint.txt`, `F02-T01-tester-lint-global.txt` |
| V8 | Ámbito: sin tocar `backend/src/index.ts`, manifiestos, `STATE.md`, `tasks.md`, frontend, IaC; Docker apagado | `git status --short`, `git diff --name-only` sobre rutas prohibidas; `docker compose down` + `docker ps -a` | **Conforme.** `backend/src/index.ts`, `package.json`, `package-lock.json` e `infra/terraform/` sin cambios. `STATE.md` y `docs/sdd/tasks.md` aparecen modificados por consolidación del CTO (ya presentes al iniciar mi sesión), no por F02-T01 ni por este Tester. `docker ps -a` sin contenedores | `F02-T01-tester-scope.txt`, `F02-T01-tester-down.txt` |
| V9 | Cronología `RED → GREEN → REFACTOR` como registro | Revisión de evidencia cronológica del Developer (no recreada, no certificada como propia) | **Registro íntegro**: 24 fallos por comportamiento (`NOT_IMPLEMENTED`, sin errores de importación) → GREEN 24/24 → REFACTOR 24/24 | `F02-T01-{red,green,refactor}.txt` (ajenas, §3) |
| V10 | Sin hallazgos críticos/altos | Revisión propia + lectura de la auditoría de riesgo 3 | **Conforme.** Auditoría `READY_WITH_CONCERNS` con **0 `CRITICAL` / 0 `HIGH`** y 0 bloqueantes para `F02-T01`; mis 10 verificaciones no producen hallazgos propios de severidad crítica/alta | `reports/audits/F02/F02-T01-auditor.md` |

**Integración real:** el emulador `aws/aws-emulator` se levantó con `docker compose up -d` bajo G-7 (`memory=2147483648`, `nanoCpus=2000000000`, `user=1000:1000`), se exportaron `ca.pem`/`config`/`emulator_credentials` con `docker cp` según el runbook y el healthcheck HTTPS devolvió `ok`. Se apagó con `docker compose down`; `docker ps -a` quedó vacío. No se usó AWS real ni `terraform apply`.

## 3. Cronología TDD revisada (como registro)

| Hito | Evidencia del Developer | Contraste del Tester |
|---|---|---|
| RED | `F02-T01-red.txt`: 4 archivos, 24/24 fallos por comportamiento (`NOT_IMPLEMENTED: createApiApp` / `createDynamoUserStore`), `EXIT_CODE=1` | Cronología coherente: los fallos son de comportamiento esperado, no de importación ni de entorno |
| GREEN | `F02-T01-green.txt`: 24/24, `EXIT_CODE=0` | Corroborado por mi `24/24` unitario propio |
| REFACTOR | `F02-T01-refactor.txt`: 24/24, `EXIT_CODE=0`; typecheck exit 0 | Corroborado por mi typecheck y suite global propios |
| Integración | `F02-T01-integration.txt`: 7/7 en emulador | Corroborado por mis 7/7 (incluidos en 31/31) |

No se recreó el RED ni se certifica que ocurrió como ejecución propia: solo se revisa que el registro sea íntegro y compatible con el estado final verificado.

## 4. Interferencias, límites y notas

1. **Lint global (no bloqueante).** Los 3 errores de `npm run lint` pertenecen a F03, que trabaja en paralelo y es propietario exclusivo de `frontend/` y `tests/unit/frontend/` (`P-02` §3). El lint acotado a los archivos de F02-T01 sale limpio. Se registra como interferencia externa; **no** se acepta como riesgo de F02-T01 ni se concede G-10.
2. **Primer intento combinado (transitorio, resuelto).** La primera ejecución de `npx vitest run tests/unit/api tests/integration/api` agotó el `hookTimeout` de 10 s al crear la primera tabla con el emulador aún frío: 24/24 unitarias pasaron y 7 pruebas de integración quedaron *skipped* por el fallo del hook, sin aserciones fallidas. Con el emulador caliente, la repetición aislada dio 7/7 y la combinada exigida dio **31/31**. Queda registrado en `F02-T01-tester-integration-retry.txt` y no se trata como incumplimiento de CA-01.
3. **Límites de cobertura propios.** La idempotencia de `confirm` se verificó en secuencia, no bajo dos peticiones concurrentes; la concurrencia y el cableado de producción (F05) son materia de la auditoría (`A-01`, `A-02`, `A-03`), que los califica como `MEDIUM` **no bloqueantes** para esta tarea. `A-04`/`A-05` son heredados/diferidos a T06. Ninguno fue aceptado como riesgo en nombre de Lino.
4. **Sin secretos ni rutas absolutas.** Todas mis evidencias usan rutas relativas o el marcador `<PROJECT_ROOT>`; se comprobó la ausencia de rutas Windows absolutas, de claves de acceso AWS de 20 caracteres y de marcadores de secreto en `F02-T01-tester-*.txt`. No edité código, tests, manifiestos, `STATE.md`, `tasks.md` ni reportes ajenos.
5. **Procesos y duración propios.** Comandos lanzados: `npx vitest run` (unit API, integración, combinada ×2), `npm run test:unit`, `npm run typecheck`, `npx eslint` (acotado) y `npm run lint` (global), búsquedas de solo lectura, `git status`/`git diff`, y ciclo Docker (`up`, `inspect`, `docker cp`, `curl.exe`, `down`, `ps -a`). Ventana de ejecución aproximada `21:06–21:11` según los tiempos emitidos por las propias herramientas; no reconstruida solo desde fechas de archivo.

## 5. Veredicto global

**`PASSED`.** `CA-01` se cumple con evidencia propia: las cuatro rutas `/jobs` con filtro estricto por `userId`, el adaptador DynamoDB de `UserStore` (`T03-A-04`), la clave de rate limit no suplantable y fail-closed (`T03-A-01`), la validación con esquemas congelados, el `confirm` idempotente con rollback y el publicador inyectado sin SQS en producto. Todas las verificaciones V1–V10 están satisfechas; no hay hallazgos críticos/altos ni bloqueantes; el registro `RED → GREEN → REFACTOR` es íntegro y Docker quedó apagado.

No se activan loops: no hay incumplimiento que documentar con los 7 campos obligatorios. El cierre de la tarea y la integración de los concerns no bloqueantes corresponden al Architect.

---

# ADDENDUM — Loop 2/3 (re-verificación de `A-01` y `A-02`)

| Campo | Valor |
|---|---|
| **Versión / loop** | `v1 — Loop 2/3` · addendum **append-only**: el `PASSED` de v1 y sus secciones 1–5 permanecen intactos |
| **Alcance de la re-verificación** | **Solo** los criterios afectados por los hallazgos `A-01` (concurrencia de `confirm`) y `A-02` (rollback silenciado) |
| **Origen** | Addendum v2 del Developer (`F02-T01-developer.md` §A–F) y auditoría `reports/audits/F02/F02-T01-auditor.md` |
| **Veredicto del addendum** | **`PASSED` para los criterios re-verificados** |
| **Loops activados** | **Ninguno** (no se emite `NO-PASSED`, no se pasa a 3/3) |

## A1. Fuentes y método

Leídas sin editar: `F02-T01-developer.md` (addendum loop 2), `backend/src/api/{job-transition,jobs,app,job-list-store,index}.ts`, `backend/src/db/index.ts`, `tests/unit/api/{confirm,fixtures,routes}.test.ts`, `tests/integration/api/{routes,fixtures}.ts`, y el registro cronológico `F02-T01-loop2-red.txt` del Developer (citado como **registro**, no como evidencia propia).

Ejecución propia: `npx vitest run tests/unit/api tests/integration/api --no-color`, dos corridas dirigidas con `-t` (`paralelo`, `falla`), `npm run typecheck`, `npx eslint` acotado y `npm run lint`, más `git diff`/`git status` y búsquedas de solo lectura. Emulador `aws/aws-emulator` levantado con G-7, `docker cp` según runbook, healthcheck `ok`, apagado con `docker compose down` y `docker ps -a` vacío.

## A2. Tabla de criterios re-verificados

| # | Criterio re-verificado | Método propio | Resultado | Evidencia propia |
|---|---|---|---|---|
| R1 | `job-transition.ts` usa `UpdateCommand` con `ConditionExpression: '#status = :from'`; `confirmPending` `PENDING→PROCESSING`; el perdedor de la carrera recibe `ConditionalCheckFailedException` → `JobAlreadyConfirmedError` y responde `confirmed: true` **sin publicar** | Lectura de `job-transition.ts` ll. 61–93 (`UpdateCommand` l. 71, condición l. 75, `:from`/`:to` l. 77, `ALL_NEW` l. 78, mapeo ll. 42–48/82–84) + corrida concurrente unitaria e integración | **Conforme** | `F02-T01-tester-loop2-api.txt`, `F02-T01-tester-loop2-concurrency.txt`, `F02-T01-tester-loop2-scope.txt` |
| R2 | `jobs.ts`: si fallan publicación **y** reversión → 503 `CONFIRM_INCONSISTENT` **sin `confirmed`**; si la reversión funciona → 503 `PUBLISH_FAILED` | Lectura de `jobs.ts` ll. 184–229 (`revertToPending` condicional; rama `CONFIRM_INCONSISTENT` ll. 213–223; rama `PUBLISH_FAILED` ll. 224–228; ninguna incluye `confirmed`) + corrida dirigida `falla` | **Conforme** (2 unit + 1 integración) | `F02-T01-tester-loop2-rollback.txt` |
| R3 | Concurrencia HTTP real + DynamoDB: una sola publicación; rollback cubierto en unit e integración | `npx vitest run tests/unit/api tests/integration/api`: **7 archivos, 36/36, exit 0**; dirigida con `paralelo` → 1 unit + 1 integración (2/2); dirigida con `falla` → 2 unit + 1 integración (3/3). Los `skipped` de las corridas con `-t` son inducidos por el filtro, no `.skip`/`.only`/`.todo` en el código | **Conforme** | `F02-T01-tester-loop2-api.txt`, `F02-T01-tester-loop2-concurrency.txt`, `F02-T01-tester-loop2-rollback.txt` |
| R4 | Gates propios del loop | `npm run typecheck` → exit 0; `npx eslint backend/src/api backend/src/db/user-store-adapter.ts tests/unit/api tests/integration/api --ext .ts` → exit 0 | **Conforme** | `F02-T01-tester-loop2-typecheck.txt`, `F02-T01-tester-loop2-lint.txt` |
| R5 | No tocar `backend/src/db/job-store.ts` ni otros archivos de F01; fábrica de cliente importada desde `backend/src/db/index.ts`; sin secretos ni rutas Windows absolutas | `git diff --name-only` sobre `backend/src/{db,auth,contracts,config,domain}/**` e `index.ts` → **vacío**; `git status --short -- backend/src/db` → solo `user-store-adapter.ts` (nuevo de v1); `app.ts:15` importa de `'../db/index'`, que exporta `./client` (l. 8); búsqueda de rutas absolutas/claves en todas las evidencias `loop2-*` → 0 coincidencias | **Conforme** | `F02-T01-tester-loop2-scope.txt` |
| R6 | Lint global en rojo por F03 (paralelo, ajeno) | `npm run lint` → exit 1 con **un único** hallazgo: `tests/unit/frontend/core.test.ts:6` (`Theme` sin usar), archivo propiedad de F03; el lint acotado a F02 está limpio | **Interferencia externa no bloqueante** (no se acepta como riesgo de F02, sin G-10) | `F02-T01-tester-loop2-lint-global.txt`, `F02-T01-tester-loop2-lint.txt` |
| R7 | Reproducción original y no-regresión | Registro cronológico del Developer `F02-T01-loop2-red.txt`: 2 fallos por comportamiento (doble publicación `expected 1 ... got 2`; `expected 500 to be 503`). Mis corridas posteriores invierten ambos resultados. Proporcionalidad: no se repiten gates v1 ajenos al cambio; el `36/36` cubre todo el ámbito API y por tanto incluye la regresión de los criterios v1 dentro de él | **Conforme** (registro íntegro; no declarado como ejecución propia) | `F02-T01-loop2-red.txt` (ajeno, §A1), `F02-T01-tester-loop2-api.txt` |

## A3. Límites y notas

- La concurrencia se ejerce con dos peticiones HTTP simultáneas sobre una tabla DynamoDB aislada del emulador; el puerto `JobTransitionStore` se inyecta en la app, por lo que el `36/36` acredita la transición condicional real (`createDynamoJobTransitionStore`) en integración y el doble CAS en unitario.
- `CONFIRM_INCONSISTENT` **señaliza** la inconsistencia, no la repara: tras ese estado un reintento responde `confirmed: true` sin publicar (política at-most-once). Queda como seguimiento documentado del Developer para T04/T06, **no** como incumplimiento de los criterios re-verificados (el contrato exigido era dejar de silenciar el fallo y no devolver `confirmed: true` en esa respuesta).
- No se reabrieron los criterios v1 no afectados (V1–V10 permanecen `PASSED` tal cual); no se activó el loop 3/3.

## A4. Veredicto del addendum

**`PASSED` para los criterios re-verificados** (`A-01`, `A-02`). La evidencia propia respalda la transición condicional, la distinción de los dos códigos 503, la publicación única bajo concurrencia HTTP+DynamoDB y el rollback en unit e integración; `typecheck` y lint acotado están limpios; F01 no fue modificado y no hay secretos ni rutas absolutas. El único hallazgo global de lint pertenece a F03 y se registra como interferencia externa no bloqueante. No se activan más loops; el cierre de la tarea corresponde al Architect.
