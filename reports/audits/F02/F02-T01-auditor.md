# Auditoría `F02-T01` — Aislamiento `/jobs`, rate limit no suplantable, confirm y `UserStore`

| Campo | Valor |
|---|---|
| **Auditoría / tarea / fase** | `F02-T01` · Fase 2 · `docs/sdd/packages/P-02-api-and-worker.md` (`CA-01`) |
| **Rol / riesgo** | `Auditor` · Riesgo `3 (Sensible)` — autenticación, aislamiento y API |
| **Fecha / loop** | `2026-11-17` · `Loop 1/3` |
| **Encargo** | Aislamiento (PR-07): `userId` del token en todas las rutas, clave de partición en `GET /jobs`, 404 sin oracle; clave de rate limit no suplantable (T03-A-01) y fail-closed; transaccionalidad del `confirm`; adaptador DynamoDB de `UserStore` (T03-A-04); secretos/G-3 y métricas 0/0/0 (PR-12); clasificación del `lint` global de F03 |
| **Fuentes** | `AGENTS.md`; `STATE.md`; `.agents/roles/auditor.md`; `<LAB_ROOT>/docs/METHODOLOGY.md` §3.1/§4/§7 y `<LAB_ROOT>/docs/templates/problema-solucion.md` (7 campos); `P-02` §3/§5 `CA-01`; `spec.md` §5/§6 y FR-08/FR-10/FR-14/FR-21; `constitution.md` PR-07/PR-08/PR-12; `F01-architect.md` §3 (`T03-A-01`, `T03-A-04`); `F02-T01-{task,developer}.md`; `backend/src/api/**`; `backend/src/db/user-store-adapter.ts`; `backend/src/db/{job-store,keys,types}.ts`; `backend/src/auth/{middleware,rate-limit,user-store,routes,errors,service,identity}.ts`; `tests/{unit,integration}/api/**`; evidencia `F02-T01-*.txt` |
| **Conclusión** | **`READY_WITH_CONCERNS`** |
| **Cobertura** | **`SUFFICIENT`** para el alcance asignado (inspección estática de código, tests y evidencia) · **`LIMITED`** para concurrencia real y cableado de producción (F05), ejecución funcional (competencia del Tester) e historial Git (prohibido) |
| **Hallazgos** | 6 (3 `MEDIUM`, 2 `LOW`, 1 `INFO` ajena) · **0 `CRITICAL` / 0 `HIGH`** · **0 bloqueantes de auditoría para `F02-T01`** |

> **Frontera respetada:** no implementé código, no emití `PASSED`/`NO-PASSED`, no repetí la suite funcional del Tester, no usé Git/GitHub, Docker ni AWS, y **no acepté riesgo en nombre de Lino (G-10)**. No escribo secretos ni rutas Windows absolutas nuevas: las fuentes externas al proyecto se nombran con `<LAB_ROOT>` y las rutas internas con `<PROJECT_ROOT>`. Registro **append-only**.

---

## 1. Hallazgos (7 campos obligatorios)

### Problema `A-01` — `confirm` no es idempotente bajo concurrencia: transición sin condición de estado

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID: `A-01` · Tarea: `F02-T01` · Fase: `P-02` · Loop: `1/3` · Fecha: `2026-11-17` · Entorno: inspección estática, Node/TypeScript/DynamoDB, sin AWS |
| **2. Problema** | **Síntoma:** `backend/src/api/jobs.ts` ll. 173–198 hace `getJob` → comprueba `current.status !== 'PENDING'` → `updateJob(userId, jobId, { status: 'PROCESSING' })` → `publisher.publish()`. `backend/src/db/job-store.ts` ll. 233–255 implementa `updateJob` como lectura + escritura cuya `ConditionExpression` es solo `attribute_exists(userId) AND attribute_exists(jobId)`: **no condiciona `#status = 'PENDING'`**. **Esperado:** `CA-01`/FR-10 exigen `confirm` idempotente y una sola publicación por lote. **Observado:** dos peticiones concurrentes pueden leer ambas `PENDING`, pasar la guarda, escribir `PROCESSING` y publicar **dos mensajes**. **Impacto:** mensaje SQS duplicado y procesamiento doble del mismo lote; sin escalada de privilegios ni cruce de usuarios. **Reproducción:** leer `jobs.ts` ll. 177–184 y `job-store.ts` ll. 233–255; contrastar con `tests/unit/api/routes.test.ts` ll. 113–124 y `tests/integration/api/routes.test.ts` ll. 50–64, que prueban idempotencia **solo secuencial**. |
| **3. Causa** | **Estado:** `DEMOSTRADA` para el patrón de código; `HIPÓTESIS` para su explotación en producción (el servidor real se cablea en F05). **Evidencia:** archivos citados + ausencia de prueba concurrente en `tests/{unit,integration}/api/**`. **Alternativas descartadas:** que `updateJob` use `ConditionExpression` sobre el estado (no: la condición es de existencia); que el publicador deduplique (no: `publisher.ts` expone solo `publish(message)`, sin idempotency key). |
| **4. Solución** | **Cambios aplicados:** ninguno (el Auditor no implementa). **Motivo técnico:** una transición condicional `#status = :PENDING` haría que el segundo confirm reciba `ConditionalCheckFailed` y se trate como idempotente; alternativamente, T04 debe tolerar mensajes duplicados. **Intentos fallidos relevantes:** N/A. **Disposición propuesta:** Architect/Developer de F02 — resolver o documentar antes de exponer `POST /jobs/:id/confirm` en `F02-T04`; **no se concede G-10**. |
| **5. Verificación** | **Verificador independiente:** `Auditor` · **Comando/procedimiento:** inspección estática de `jobs.ts`, `job-store.ts` y los tests de idempotencia; sin reejecutar `vitest` · **Resultado y evidencia:** idempotencia demostrada solo en secuencia (`F02-T01-green.txt` 8/8, `F02-T01-integration.txt` 7/7); carrera no cubierta · **Regresión comprobada:** N/A (no se reejecutó la suite) · **Límites:** no se ejecutó una prueba de concurrencia ni se audita el consumidor SQS de T04. |
| **6. Pendientes** | **Riesgo residual:** publicación duplicada bajo concurrencia · **Cobertura ausente:** dos confirms simultáneos sobre el mismo `jobId` · **Responsable y siguiente paso:** Developer/Architect de F02 — transición condicional o tolerancia a duplicados en T04. |
| **7. Aprendizaje** | **Prevención propuesta:** las transiciones de estado que disparan efectos externos deben ser condicionales al estado previo, con el efecto publicado tras la transición · **Ámbito candidato:** `PROPUESTA_GLOBAL` · **Estado:** `PENDIENTE_DE_EVALUAR`. |

**Severidad:** `MEDIUM` · **Confianza:** `HIGH` (código) / `MEDIUM` (explotabilidad actual) · **Evidencia:** `CORROBORATED` (patrón) / `INDICATIVE` (carrera) · **Bloqueante de auditoría:** `NO` para `F02-T01`; condiciona `F02-T04`.

---

### Problema `A-02` — Rollback best-effort del `confirm`: puede quedar un job `PROCESSING` sin mensaje de forma permanente

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID: `A-02` · Tarea: `F02-T01` · Fase: `P-02` · Loop: `1/3` · Fecha: `2026-11-17` · Entorno: inspección estática |
| **2. Problema** | **Síntoma:** en `jobs.ts` ll. 183–197, si `publisher.publish()` falla se intenta revertir a `PENDING`; si esa reversión también falla, el error se **silencia** (`catch { /* Fail-closed */ }`) y se responde 503. Un reintento posterior del cliente encuentra `status === 'PROCESSING'`, entra en la rama de idempotencia (l. 180) y devuelve `200 { confirmed: true }` **sin publicar**. **Esperado:** rollback seguro, "sin estado inconsistente" y sin job `PROCESSING` sin mensaje. **Observado:** el lote puede quedar atrapado en `PROCESSING` sin mensaje en cola hasta el TTL de 30 días, y el reintento recibe una respuesta engañosa. **Impacto:** lote nunca procesado, sin mecanismo de reconciliación; no afecta a otros usuarios. **Reproducción:** leer `jobs.ts` ll. 180 y 185–197; `routes.test.ts` ll. 126–141 cubre solo el caso en que la reversión **sí** funciona. |
| **3. Causa** | **Estado:** `DEMOSTRADA`. **Evidencia:** código citado; no existe outbox, tabla de intentos ni reconciliador en `backend/src/api/**`. **Alternativas descartadas:** que un reintento republicara (no: la guarda de idempotencia lo impide); que el worker escaneara jobs `PROCESSING` huérfanos (no hay evidencia en esta tarea; compete a T04). |
| **4. Solución** | **Cambios aplicados:** ninguno. **Motivo técnico:** revertir solo si la reversión es verificable, o persistir un estado reintentable (p. ej. `PENDING` con marca de publicación pendiente / outbox en T04), evita el hueco entre estado y cola. **Intentos fallidos relevantes:** N/A. **Disposición propuesta:** Architect/Developer de F02 — definir la reconciliación antes de T04; **no se concede G-10**. |
| **5. Verificación** | **Verificador independiente:** `Auditor` · **Comando/procedimiento:** inspección de la rama de fallo y del test de reversión; sin reejecutar `vitest` · **Resultado y evidencia:** caso de reversión fallida no cubierto (`F02-T01-green.txt`, `routes.test.ts` 126–141) · **Regresión comprobada:** N/A · **Límites:** no se inspecciona el worker (T03/T04, fuera de este encargo). |
| **6. Pendientes** | **Riesgo residual:** estado inconsistente `PROCESSING` sin mensaje · **Cobertura ausente:** fallo simultáneo de publicación y reversión · **Responsable y siguiente paso:** Developer/Architect de F02 — outbox o reconciliación en T04. |
| **7. Aprendizaje** | **Prevención propuesta:** todo rollback de un efecto externo debe ser verificable o sustituido por un estado compensable; nunca devolver éxito desde la rama de idempotencia si el efecto no se completó · **Ámbito candidato:** `PROPUESTA_GLOBAL` · **Estado:** `PENDIENTE_DE_EVALUAR`. |

**Severidad:** `MEDIUM` · **Confianza:** `HIGH` · **Evidencia:** `CORROBORATED` · **Bloqueante de auditoría:** `NO` para `F02-T01`; condiciona `F02-T04`.

---

### Problema `A-03` — `/auth`: suplantación corregida, pero cubo global único (`auth:anonimo`) y dependencia del middleware

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID: `A-03` (heredado `T03-A-01`) · Tarea: `F02-T01` · Fase: `P-02` · Loop: `1/3` · Fecha: `2026-11-17` · Entorno: inspección estática |
| **2. Problema** | **Síntoma:** `NonSpoofableAuthLimiter.check()` (`backend/src/api/rate-limit.ts` ll. 33–35) descarta la clave derivada de `x-forwarded-for`/`x-real-ip` (`auth/routes.ts` ll. 23–30) y usa `principalStore.getStore() ?? ANONYMOUS_PRINCIPAL`; `createApiApp()` fija ese principal con `app.use('/auth/*', withPrincipal('auth:anonimo', ...))` (`app.ts` ll. 58–60). La suplantación está corregida y es fail-closed, **pero** todas las rutas `/auth` comparten un único cubo `auth:anonimo`: un atacante puede agotar el cupo global y bloquear registros/logins de todos. Además, si se montan rutas `/auth` fuera de ese prefijo o se compone la app sin el middleware, el limitador cae silenciosamente al cubo anónimo; y el cubo es por proceso (deuda `T03-A-02` de F01). **Esperado:** clave no suplantable **y** disponibilidad razonable por cliente de confianza. **Observado:** `/jobs` usa `c.get('userId')` del JWT firmado (sin fijación por token); `/auth` no tiene identidad previa al login y usa un principal fijo. **Impacto:** denegación de servicio global de autenticación; **no hay suplantación ni evasión por cabeceras**. **Reproducción:** leer `rate-limit.ts` ll. 13–35, `app.ts` ll. 43–60, `auth/routes.ts` ll. 23–38 y `tests/unit/api/rate-limit.test.ts` ll. 26–73. |
| **3. Causa** | **Estado:** `DEMOSTRADA` para el cubo compartido y la dependencia del middleware; `HIPÓTESIS` para el DoS en producción (sin servidor cableado aún). **Evidencia:** código citado + `F02-T01-developer.md` §5.3 ("todas las rutas `/auth` comparten cubo; el ajuste por proxy de confianza queda para F05"). **Alternativas descartadas:** que la clave use el token (no hay token en `/auth`); que las cabeceras sigan influyendo (el test con tres `x-forwarded-for` distintos devuelve 429 en la tercera petición). |
| **4. Solución** | **Cambios aplicados:** ninguno. **Motivo técnico:** derivar el principal de un proxy de confianza o de un valor fijado por el infrastructor en F05, manteniendo el fallback anónimo, conserva la no suplantación sin un cubo único. **Intentos fallidos relevantes:** N/A. **Disposición propuesta:** Architect — asignar a F05 el wiring con proxy de confianza; **no se concede G-10**. |
| **5. Verificación** | **Verificador independiente:** `Auditor` · **Comando/procedimiento:** inspección de `app.ts`, `rate-limit.ts`, `auth/routes.ts` y `F02-T01-rate-limit.txt` (5/5) · **Resultado y evidencia:** no suplantación demostrada por rotación de cabeceras (test ll. 53–73) y por `/jobs` con `userId` ajeno en cabecera (test ll. 41–51) · **Regresión comprobada:** N/A · **Límites:** no se ejecutaron pruebas de carga ni se audita el proxy real (F05). |
| **6. Pendientes** | **Riesgo residual:** cubo `/auth` global y limitador en memoria por proceso · **Cobertura ausente:** composición alternativa de la app sin el middleware `/auth/*` · **Responsable y siguiente paso:** Architect/F05 — principal por proxy de confianza; Tester — verificar tras el wiring. |
| **7. Aprendizaje** | **Prevención propuesta:** un limitador fail-closed anti-suplantación debe acompañarse de una clave de servidor por cliente de confianza para no convertir la seguridad en un cuello de botella compartido · **Ámbito candidato:** `PROPUESTA_GLOBAL` · **Estado:** `PENDIENTE_DE_EVALUAR`. |

**Severidad:** `MEDIUM` · **Confianza:** `HIGH` · **Evidencia:** `CORROBORATED` (código y pruebas) / `INDICATIVE` (DoS en producción) · **Bloqueante de auditoría:** `NO` para `F02-T01`; seguimiento obligatorio para F05.

---

### Problema `A-04` — `UserStore`: unicidad atómica correcta, pero oracle de correo por `409` y correo como clave (heredado de F01)

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID: `A-04` · Tarea: `F02-T01` · Fase: `P-02` · Loop: `1/3` · Fecha: `2026-11-17` · Entorno: inspección estática |
| **2. Problema** | **Síntoma:** el adaptador (`backend/src/db/user-store-adapter.ts` ll. 94–130) usa `TransactWriteCommand` con `attribute_not_exists` en perfil e índice y mapea la cancelación a `EmailAlreadyExistsError`: **no hay condición de carrera en registro duplicado**. Sin embargo `AuthService.register` (`auth/service.ts` ll. 67–72) traduce ese error a `registrationFailed()` → `409`, frente a `201` si el correo es nuevo: el **estado** distinto revela si un correo está registrado aunque el mensaje sea genérico. Además el índice guarda el correo normalizado como PK (`userId: email`, l. 115), dato personal en la clave. **Esperado:** errores sin filtrar si un correo está registrado (NFR-03/§6). **Observado:** comportamiento **pre-existente de F01**, no introducido por el adaptador; este expone la misma semántica sobre DynamoDB real. **Impacto:** enumeración de cuentas; sin exposición de `passwordHash` en HTTP (`service.toAuthenticatedUser`, ll. 45–47). **Reproducción:** leer `auth/service.ts` ll. 55–75 y `user-store-adapter.ts` ll. 83–152. |
| **3. Causa** | **Estado:** `DEMOSTRADA` para la diferencia de estados; `INDICATIVE` para el uso como oracle. **Evidencia:** código citado; `F02-T01-userstore.txt` 9/9 y `F02-T01-integration.txt` 7/7 confirman el mapeo atómico del duplicado. **Alternativas descartadas:** que la transacción permita sobrescribir (no: falla y no escribe el perfil ajeno, test `userstore.test.ts` ll. 127–137); que el hash se devuelva al cliente (no: se recorta en el servicio). |
| **4. Solución** | **Cambios aplicados:** ninguno. **Motivo técnico:** unificar el estado de respuesta para registro duplicado y no duplicado, o aplicar una política anti-enumeración deliberada, es decisión del propietario de F01/CTO; **no es una regresión de F02**. **Intentos fallidos relevantes:** N/A. **Disposición propuesta:** Architect — registrar como seguimiento heredado, **no aceptarlo como riesgo de F02 (sin G-10)**. |
| **5. Verificación** | **Verificador independiente:** `Auditor` · **Comando/procedimiento:** inspección del adaptador, del servicio y de las pruebas unitarias/integración · **Resultado y evidencia:** unicidad atómica y validación con `schemas.AuthenticatedUser` confirmadas; sin secretos ni stacks en mensajes de error (`auth/errors.ts`) · **Regresión comprobada:** N/A · **Límites:** no se audita la política de registro de F01 ni se ejecutan pruebas de enumeración. |
| **6. Pendientes** | **Riesgo residual:** LOW, heredado · **Cobertura ausente:** decisión documental sobre enumeración de correos · **Responsable y siguiente paso:** CTO/Architect — disposición del seguimiento `F01-T03`. |
| **7. Aprendizaje** | **Prevención propuesta:** los errores de registro deben ser indistinguibles en **cuerpo y código de estado**, no solo en el mensaje · **Ámbito candidato:** `PROPUESTA_GLOBAL` · **Estado:** `PENDIENTE_DE_EVALUAR`. |

**Severidad:** `LOW` (heredada, fuera de alcance de F02) · **Confianza:** `HIGH` para el código / `MEDIUM` para explotación · **Evidencia:** `INDICATIVE` · **Bloqueante de auditoría:** `NO`.

---

### Problema `A-05` — Métricas `0/0/0` e imágenes declaradas no persistidas: trazabilidad pendiente de `F02-T06`

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID: `A-05` · Tarea: `F02-T01` · Fase: `P-02` · Loop: `1/3` · Fecha: `2026-11-17` · Entorno: inspección estática |
| **2. Problema** | **Síntoma:** `parseCreateBody()` (`jobs.ts` ll. 52–93) valida `images[].bytes` contra los esquemas congelados, pero `POST /jobs` (ll. 114–150) **no persiste esos bytes ni crea registros de imagen**: el lote `PENDING` se guarda con `bytesBefore = bytesAfter = savingsPct = 0`. **Esperado:** PR-12 y FR-12 exigen métricas reales medidas por el worker, sin cifras falsas. **Observado:** la decisión está **documentada y es honesta** — se descartó `savingsPct = 100` (falso ahorro) y `bytesAfter = bytesBefore` (falsa salida); los ceros significan "sin medir". **Impacto:** riesgo residual de que T06 herede los ceros como métrica final, o de que los bytes declarados por el cliente se pierdan sin rastro. **Reproducción:** leer `jobs.ts` ll. 66–92 y 127–145; `routes.test.ts` ll. 20–31 afirma explícitamente los ceros; `F02-T01-developer.md` §5.4 y problema P-03. |
| **3. Causa** | **Estado:** `DEMOSTRADA` para la no persistencia; `HIPÓTESIS` para el riesgo en T06. **Evidencia:** código citado + `F02-T01-task.md` §4 (métricas reales fuera del alcance de T01). **Alternativas descartadas:** falsificar `100 %` o `bytesAfter = bytesBefore` (ambas contradicen el catálogo congelado, ver P-03 del Developer). |
| **4. Solución** | **Cambios aplicados:** ninguno. **Motivo técnico:** `0/0/0` es la representación correcta de "pendiente de medición"; la corrección compete a T06 al persistir bytes reales del worker. **Intentos fallidos relevantes:** N/A. **Disposición propuesta:** Architect — verificar en T06 que no se reporten ceros como medición real; **no se concede G-10**. |
| **5. Verificación** | **Verificador independiente:** `Auditor` · **Comando/procedimiento:** inspección de `jobs.ts`, `routes.test.ts` y del reporte del Developer · **Resultado y evidencia:** PR-12 satisfecho en T01 (sin falsificación); `F02-T01-regression.txt` 194/194 mantiene los contratos congelados · **Regresión comprobada:** N/A · **Límites:** no se audita T06. |
| **6. Pendientes** | **Riesgo residual:** LOW · **Cobertura ausente:** persistencia de métricas reales y de los bytes declarados · **Responsable y siguiente paso:** Developer/Tester de `F02-T06`. |
| **7. Aprendizaje** | **Prevención propuesta:** los estados iniciales deben satisfacer las coherencias del contrato con "sin medir" representado con ceros explícitos, dejando responsable y fase para la medición real · **Ámbito candidato:** `SOLO_LOCAL` · **Estado:** `PENDIENTE_DE_EVALUAR`. |

**Severidad:** `LOW` · **Confianza:** `HIGH` · **Evidencia:** `CORROBORATED` · **Bloqueante de auditoría:** `NO`.

---

### Problema `A-06` — Fallo global de `lint` por trabajo concurrente de F03 (clasificado como ajeno)

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID: `A-06` (heredado `F02-T01-P7`) · Tarea: `F02-T01` · Fase: `P-02` · Loop: `1/3` · Fecha: `2026-11-17` · Entorno: `npm run lint` en workspace con F03 en paralelo |
| **2. Problema** | **Síntoma:** `npm run lint` global devuelve exit 1 por `'Theme' is defined but never used` en `tests/unit/frontend/core.test.ts` l. 6. **Esperado:** gate limpio para cierre de fase. **Observado:** `F02-T01-lint.txt` registra el único hallazgo en una ruta propiedad de F03; `F02-T01-lint-scoped.txt` (lint acotado a `backend/src/api`, `backend/src/db/user-store-adapter.ts`, `tests/{unit,integration}/api`) sale con exit 0. **Impacto:** ninguno sobre el aislamiento, el rate limit, el confirm o el UserStore de T01. **Reproducción:** leer `F02-T01-lint.txt` y `P-02` §3. |
| **3. Causa** | **Estado:** `DEMOSTRADA` para la procedencia; `CORROBORATED` para la titularidad por el contrato de ámbitos. **Evidencia:** evidencia de lint + `P-02` §3 + `STATE.md` §1 (F02/F03 paralelas). **Alternativas descartadas:** que el hallazgo provenga de `backend/src/api/**` o `tests/**/api/**` (no: el lint acotado está limpio). |
| **4. Solución** | **Cambios aplicados:** ninguno; **clasificado como ajeno a F02-T01, no aceptado como riesgo de F02**. **Motivo técnico:** el Developer no tocó el archivo de F03 y acompañó la ejecución global con una acotada. **Intentos fallidos relevantes:** N/A. **Disposición propuesta:** que el propietario de F03 corrija su import antes del cierre de fase; **no se concede G-10**. |
| **5. Verificación** | **Verificador independiente:** `Auditor` · **Comando/procedimiento:** lectura de la evidencia y del contrato de ámbitos; sin reejecutar `lint` · **Resultado y evidencia:** único hallazgo global ajeno; alcance T01 limpio · **Regresión comprobada:** N/A · **Límites:** no se verificó el estado actual del archivo de F03 (propiedad ajena). |
| **6. Pendientes** | **Riesgo residual:** ninguno para `F02-T01`; gate global de lint pendiente de F03 · **Cobertura ausente:** resolución del hallazgo de F03 · **Responsable y siguiente paso:** F03/Architect — cerrar antes del retorno de fase. |
| **7. Aprendizaje** | **Prevención propuesta:** en fases paralelas, acompañar todo comando global con una ejecución acotada al ámbito propio para no atribuir fallos ajenos · **Ámbito candidato:** `PROPUESTA_GLOBAL` · **Estado:** `PENDIENTE_DE_EVALUAR`. |

**Severidad:** `INFO` (ajena) · **Confianza:** `HIGH` · **Evidencia:** `CORROBORATED` · **Bloqueante de auditoría:** `NO` para `F02-T01`.

---

## 2. Verificaciones sin hallazgo (evidencia de cobertura)

| # | Verificación | Resultado | Clasificación |
|---|---|---|---|
| **V-1** | **PR-07: `userId` solo del token verificado.** Las cuatro rutas (`jobs.ts` ll. 114, 152, 161, 173) leen `c.get('userId')`, fijado por `requireAuth` (`auth/middleware.ts` ll. 47–67) tras `verifyToken` y `findById`. No existe `userId` en body, query ni cabeceras de `backend/src/api/**` (grep exhaustivo: 21 coincidencias, todas de `c.get`, del puerto o del mensaje). El helper `requireOwnershipParam` de F01 no se monta en estas rutas, pero tampoco hace falta: no hay parámetro de usuario. | `CORROBORATED` |
| **V-2** | **404 indistinguible, sin oracle.** `notFound()` usa `authErrorResponse(resourceNotFound())` para ajeno e inexistente (`jobs.ts` ll. 95–97, 165, 178); el middleware de auth va antes del limitador (ll. 102–112), así que sin token se responde 401 antes que 404/429. `authz.test.ts` ll. 45–91 y `tests/integration/api/routes.test.ts` ll. 39–48 comparan cuerpo/código de ajeno vs. inexistente y comprueban que `x-user-id` no suplanta; `F02-T01-authz.txt` 9/9. | `REPRODUCED` (estático + evidencia) |
| **V-3** | **`GET /jobs` usa la clave de partición.** `createDynamoJobListStore` (`job-list-store.ts` ll. 38–67) hace `QueryCommand` con `KeyConditionExpression: 'userId = :u'` alimentado por `c.get('userId')`, pagina con `LastEvaluatedKey`, filtra `itemType === JOB_ITEM_TYPE` y ordena de forma determinista. No hay escaneo de tabla ni `userId` del cliente. | `CORROBORATED` |
| **V-4** | **T03-A-01 corregido en `/jobs` y en `/auth`.** `/jobs`: `deps.limiter.check(c.get('userId'))` (`jobs.ts` l. 105); rotar `x-forwarded-for`/`x-real-ip` no crea cubos nuevos y una cabecera con el `userId` ajeno no consume su cupo (`rate-limit.test.ts` ll. 11–51). `/auth`: `NonSpoofableAuthLimiter` descarga la clave de cabeceras y usa `AsyncLocalStorage` con fallback `auth:anonimo` (`rate-limit.ts` ll. 13–35); el test de tres `x-forwarded-for` distintos confirma 429 en la tercera petición (ll. 53–73). No hay fijación por el propio token: el JWT está firmado y `/auth` es pre-autenticación. **Matiz:** ver `A-03` para el cubo global. | `REPRODUCED` (código + `F02-T01-rate-limit.txt` 5/5) |
| **V-5** | **UserStore y T03-A-04.** `user-store-adapter.ts` valida con `schemas.AuthenticatedUser` (ll. 45–49, 84–88), normaliza el correo con la regla congelada (`auth/identity.ts`), garantiza unicidad con `TransactWriteCommand` condicional (ll. 94–126), mapea `TransactionCanceledException` → `EmailAlreadyExistsError` (ll. 57–67, 127–130) y rechaza hashes vacíos (ll. 50–53, 89–91). `findByEmail` sigue el índice y carga el perfil por `ownerUserId` (ll. 135–152). `F02-T01-userstore.txt` 9/9 e integración 7/7 contra emulador con `createDynamoUserStore` cableado (`tests/integration/api/fixtures.ts` ll. 32–36). | `CORROBORATED` |
| **V-6** | **G-3/PR-08 y saneamiento P4.** No hay rutas Windows absolutas, ni valores `AKIA`, ni claves privadas en `reports/implementation/F02/**` ni en `backend/src/api/**`; las evidencias usan el marcador `<PROJECT_ROOT>`. Los únicos `REPLACE_WITH_*` y `AKIAABCDEFGHIJKLMNOP` del árbol son marcadores de test/heredados de F01 (`tests/unit/{api,config,contracts}/**`), no secretos reales. `authErrorResponse` serializa solo `code` + `message` genéricos sin stacks ni rutas (`auth/middleware.ts` ll. 27–45); el 503 de `confirm` usa `PUBLISH_FAILED` con mensaje genérico. | `CORROBORATED` (greps + lectura de evidencia) |
| **V-7** | **PR-12 honesto.** El job `PENDING` persiste `0/0/0` con justificación documentada (`jobs.ts` ll. 133–139; `routes.test.ts` ll. 25–29; `F02-T01-developer.md` §5.4 y P-03). Se descartaron `100 %` y `bytesAfter = bytesBefore` por falsos. Compete a T06 sustituir los ceros por medición real (`A-05`). | `CORROBORATED` |
| **V-8** | **Publicador sin simulación en producto.** `JobQueuePublisher` (`publisher.ts`) es dependencia **obligatoria** de `createApiApp` (`app.ts` ll. 26–39) y `publish` se invoca después de la transición a `PROCESSING` (`jobs.ts` ll. 182–184). No hay cliente SQS en `backend/src/api/**`; los dobles (`RecordingPublisher`) viven solo en `tests/**`. `backend/src/index.ts` queda intacto; `createApiApp()` es el único punto de entrada nuevo. **Matiz:** ver `A-01`/`A-02` para la atomicidad de esta secuencia. | `CORROBORATED` |
| **V-9** | **Ámbito y trazabilidad TDD.** Los archivos creados caen en `backend/src/api/**`, `backend/src/db/user-store-adapter.ts`, `tests/{unit,integration}/api/**` y `reports/implementation/F02/**`; sin `frontend/`, `infra/`, manifiestos raíz ni `STATE.md` propios (declaración del Developer + lectura de rutas). Evidencias `F02-T01-{red,green,refactor,authz,rate-limit,userstore,integration,typecheck,regression,docker-down}.txt` presentes con códigos de salida 0 tras GREEN; `F02-T01-regression.txt` 194/194. Según el Developer, Docker se apagó (`docker ps -a` vacío) y no hubo `terraform apply`, AWS real ni push: **declaración contrastada documentalmente, no verificada con Git/Docker por prohibición del encargo**. | `CORROBORATED` para archivos y evidencia; **`LIMITED`** para historial/estado de contenedor |

---

## 3. Conclusión y disposición

**`READY_WITH_CONCERNS` — 0 `CRITICAL`, 0 `HIGH`, 0 bloqueantes de auditoría para `F02-T01`.**

`CA-01` queda sustancialmente demostrado por inspección directa:

- **Aislamiento (PR-07, FR-21, §6):** las cuatro rutas `/jobs` obtienen el `userId` exclusivamente del JWT verificado; no hay parámetro de usuario controlable por el cliente; `GET /jobs` consulta por la clave de partición; el lote ajeno y el inexistente devuelven el mismo `404` con el mismo cuerpo. Tests unitarios y de integración con DynamoDB real lo corroboran.
- **Rate limit (T03-A-01):** la clave de `/jobs` es el `userId` autenticado y la de `/auth` ignora cabeceras suplantables, con fallback fail-closed a `auth:anonimo`. La evasión por cabeceras está cerrada; el matiz de disponibilidad se registra en `A-03`.
- **UserStore (T03-A-04):** transacción condicional atómica para la unicidad del correo, índice normalizado, validación con esquemas congelados y sin exposición de `passwordHash` en respuestas HTTP. Sin condición de carrera demostrada en registro duplicado.
- **Secretos y métricas:** sin secretos, credenciales ni rutas Windows absolutas en los artefactos de T01; errores genéricos sin stacks; `0/0/0` declarado como "sin medición", coherente con PR-12.

**Concerns (ninguno bloqueante; ninguno aceptado como riesgo):**

1. `A-01` (`MEDIUM`): `confirm` no es idempotente bajo concurrencia porque la transición no condiciona el estado previo → posible mensaje SQS duplicado.
2. `A-02` (`MEDIUM`): rollback best-effort puede dejar `PROCESSING` sin mensaje y el reintento responde `confirmed: true` sin publicar → lote atrapado hasta el TTL.
3. `A-03` (`MEDIUM`): `/auth` usa un cubo global `auth:anonimo`; no hay suplantación, pero hay riesgo de DoS compartido y dependencia del middleware `app.use('/auth/*')` (wiring de F05).
4. `A-04` (`LOW`, heredado): `409` vs. `201` permite enumerar correos; pre-existente de F01, no una regresión de F02.
5. `A-05` (`LOW`): ceros honestos pero sin persistencia de bytes declarados; T06 debe publicar métricas reales.
6. `A-06` (`INFO`, ajena): `lint` global en rojo por `tests/unit/frontend/core.test.ts` (F03); **clasificado como ajeno y no aceptado como riesgo de F02**; el alcance de T01 está limpio.

**Bloqueantes para cerrar `F02-T01`:** **ninguno por severidad de auditoría**. Condiciones de disposición, no aceptaciones de riesgo: (a) no exponer `POST /jobs/:id/confirm` en `F02-T04` sin resolver o decisionar `A-01`/`A-02`; (b) asignar `A-03` al wiring de F05 con principal de proxy de confianza; (c) registrar `A-04`/`A-05` como seguimientos con responsable. Todo ello sin G-10.

**Cobertura y límites:** `SUFFICIENT` para la revisión de riesgos de aislamiento, suplantación, transaccionalidad, UserStore, secretos y métricas mediante inspección estática de código, tests y evidencia; `LIMITED` para concurrencia real, cableado de producción (F05), ejecución funcional (competencia exclusiva del Tester, no repetida) e historial Git (prohibido). No se ejecutaron `vitest`, `typecheck` ni `lint` propios; no se usaron Docker/AWS/Git; no se emitió dictamen funcional; **no se concedió G-10**. V-1…V-9 son verificaciones de inspección y cotejo de evidencia existente, sin modificar archivos de producto.

**Registro:** append-only. Los addenda futuros se agregarán aquí sin borrar estos hallazgos ni las verificaciones.

---

# ADDENDUM — Loop 2/3 (verificación del cierre de `A-01` y `A-02`)

| Campo | Valor |
|---|---|
| **Versión / loop** | `v1 — Loop 2/3` (append-only; los hallazgos y verificaciones originales permanecen intactos) |
| **Fecha / encargo** | `2026-11-17` · verificar por inspección de código y evidencia la corrección de `A-01`/`A-02`, el estado de `A-03`/`A-04`/`A-05` y la conclusión actualizada |
| **Fuentes nuevas** | `backend/src/api/job-transition.ts`; `backend/src/api/{jobs,app,index,job-list-store}.ts`; `backend/src/db/job-store.ts` (re-inspeccionado); `tests/unit/api/{confirm,fixtures}.ts`; `tests/integration/api/routes.test.ts`; evidencia `F02-T01-{loop2-red,loop2-green,loop2-all,loop2-regression,loop2-typecheck,loop2-lint-scoped,concurrency,rollback,loop2-docker-down}.txt`; `F02-T01-developer.md` §ADDENDUM |
| **Método / frontera** | Inspección estática y cotejo de evidencia existente; **sin reejecutar** `vitest`/`typecheck`/`lint`, sin Docker/Git/AWS, sin emitir `PASSED`/`NO-PASSED` y sin aceptar riesgo por Lino (G-10) |
| **Resultado** | `A-01` **CERRADO** · `A-02` **CERRADO** (con seguimiento no bloqueante) · `A-03` derivado a F05 · `A-04`/`A-05` sin cambios · **0 `CRITICAL` / 0 `HIGH` / 0 bloqueantes** |

## A. Cierre de `A-01` — idempotencia de `confirm` bajo concurrencia

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID: `A-01` (cierre) · Tarea: `F02-T01` · Loop: `2/3` · Fecha: `2026-11-17` · Entorno: inspección estática + evidencia de RED/GREEN |
| **2. Problema** | **Síntoma original:** dos `confirm` concurrentes podían publicar dos mensajes porque `updateJob` solo condicionaba existencia. **Corrección observada:** `backend/src/api/job-transition.ts` ll. 61–93 usa `UpdateCommand` con `ConditionExpression: '#status = :from'` y `ReturnValues: 'ALL_NEW'`; `confirmPending` es `PENDING → PROCESSING` y traduce `ConditionalCheckFailedException` a `JobAlreadyConfirmedError` (ll. 42–48, 89–90). `jobs.ts` ll. 184–199 captura ese error, vuelve a leer el lote y responde `confirmed: true` **sin publicar**. **Esperado:** una sola publicación; **Observado:** RED con entrelazamiento forzado publicaba 2 mensajes (`F02-T01-loop2-red.txt` ll. 4–13); GREEN con dos peticiones `Promise.all` publica 1 (`tests/unit/api/confirm.test.ts` ll. 15–31) y lo mismo contra DynamoDB real (`tests/integration/api/routes.test.ts` ll. 66–81). **Impacto:** riesgo mitigado en el código actual. |
| **3. Causa** | **Estado:** `DEMOSTRADA` para la corrección. **Evidencia:** `job-transition.ts` ll. 74–83 + `jobs.ts` ll. 191–199 + `F02-T01-concurrency.txt` (unit 1/1 y integración real 1/1, exit 0) + `F02-T01-loop2-all.txt` 36/36. **Alternativas descartadas:** volver a `updateJob` (la ruta ya no lo invoca para la transición); doble sin entrelazamiento (el Developer documenta que daba falso verde y se añadió `delayNextUpdate`). |
| **4. Solución** | **Cambios aplicados:** puerto `JobTransitionStore` nuevo en `backend/src/api/**`, inyectable desde `createApiApp()` (`app.ts` ll. 63–68, 76–85) y exportado por `api/index.ts`. **Motivo técnico:** CAS sobre `#status` hace atómica la transición sin tocar módulos congelados. **Intentos fallidos relevantes:** RED 2 fallos por comportamiento, corregidos en GREEN. **Disposición:** hallazgo **CERRADO**; sin G-10. |
| **5. Verificación** | **Verificador:** `Auditor` · **Procedimiento:** lectura de `job-transition.ts`, `jobs.ts`, `app.ts`, `fixtures.ts` y tests; cotejo de `F02-T01-{loop2-red,loop2-green,concurrency,loop2-all}.txt` · **Resultado:** condición, mapeo de conflicto y una sola publicación confirmados por código y evidencia · **Regresión comprobada:** documentada por el Tester/Developer (`loop2-regression`: 197/198 con 1 fallo ajeno a F03, ver §C) · **Límites:** el Auditor no reejecutó pruebas; el doble unitario modela CAS sin `await` intermedio, la prueba **real** de condición es la integración en emulador. |
| **6. Pendientes** | **Riesgo residual:** ninguno para la carrera de dos confirms · **Cobertura ausente:** concurrencia con más de dos peticiones (no requerida) · **Responsable:** T04 debe conservar el puerto `JobTransitionStore` al cablear SQS y no reintroducir `updateJob` directo. |
| **7. Aprendizaje** | **Prevención propuesta:** la idempotencia defensiva por lectura no basta; requiere CAS condicional y un doble capaz de entrelazarse para detectar la carrera · **Ámbito:** `PROPUESTA_GLOBAL` · **Estado:** `PENDIENTE_DE_EVALUAR`. |

**Clasificación:** `CORROBORATED` · **Confianza:** `HIGH` · **Estado:** **`CERRADO` por corrección** · **Bloqueante:** `NO`.

## B. Cierre de `A-02` — rollback explícito y señalización de inconsistencia

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID: `A-02` (cierre) · Tarea: `F02-T01` · Loop: `2/3` · Fecha: `2026-11-17` · Entorno: inspección estática + evidencia |
| **2. Problema** | **Síntoma original:** rollback silenciado dejaba `PROCESSING` sin mensaje y el reintento respondía `confirmed: true`. **Corrección observada:** `revertToPending` es `PROCESSING → PENDING` condicional y lanza `JobStateConflictError` si falla (`job-transition.ts` ll. 91–92); `jobs.ts` ll. 203–228 distingue reversión correcta → `503 PUBLISH_FAILED` de reversión fallida → `503 CONFIRM_INCONSISTENT`, **sin** campo `confirmed`. **Esperado/Observado:** RED devolvió 500 donde se esperaba 503 (`F02-T01-loop2-red.txt` ll. 31–48); GREEN cubre ambos casos en unit (2/2) e integración (1/1) con `F02-T01-rollback.txt`, sin `confirmed` y lote en `PROCESSING` (`confirm.test.ts` ll. 49–64). **Impacto:** la inconsistencia queda **señalizada**, no reparada automáticamente. |
| **3. Causa** | **Estado:** `DEMOSTRADA`. **Evidencia:** código citado + `F02-T01-rollback.txt` exit 0 + `F02-T01-loop2-all.txt` 36/36. **Alternativas descartadas:** `PUBLISH_FAILED` para ambos casos (se descartó: no explicita la inconsistencia); `500` genérico de `authErrorResponse` (se descartó en RED). |
| **4. Solución** | **Cambios aplicados:** reversión condicional y código de error observable. **Motivo técnico:** separar "revertido" de "inconsistente" evita el falso éxito silencioso. **Intentos fallidos relevantes:** el `catch` vacío original. **Disposición:** hallazgo **CERRADO**; sin G-10. |
| **5. Verificación** | **Verificador:** `Auditor` · **Procedimiento:** lectura de la rama de fallo, del doble `FakeJobTransitionStore` (ll. 170–183) y de la evidencia de RED/GREEN · **Resultado:** 503 con `CONFIRM_INCONSISTENT` y ausencia de `confirmed` confirmados por código y test · **Regresión comprobada:** `F02-T01-loop2-all.txt` 36/36 · **Límites:** sin reejecución propia; no se audita el reconciliador futuro. |
| **6. Pendientes** | **Seguimiento no bloqueante:** tras `CONFIRM_INCONSISTENT`, un reintento encuentra `PROCESSING` y responde `confirmed: true` sin publicar (política **at-most-once**). T04/T06 deberán decidir un **marcador duradero de publicación** para recuperación automática. No es un riesgo aceptado (sin G-10); responsable: Architect/T04/T06. |
| **7. Aprendizaje** | **Prevención propuesta:** un rollback best-effort debe señalizar explícitamente el fallo; el código de error observable evita confundir fallo transitorio con éxito · **Ámbito:** `PROPUESTA_GLOBAL` · **Estado:** `PENDIENTE_DE_EVALUAR`. |

**Clasificación:** `CORROBORATED` · **Confianza:** `HIGH` · **Estado:** **`CERRADO` por corrección, con seguimiento no bloqueante** · **Bloqueante:** `NO`.

## C. Ámbito y estado de los hallazgos restantes

| Hallazgo | Estado tras el loop 2 | Detalle |
|---|---|---|
| **`A-03`** (`MEDIUM`, cubo global `auth:anonimo`) | **Sin cambios; derivado a F05** | Sigue vigente como seguimiento heredado (`T03-A-01`) con responsable de wiring en F05 (proxy de confianza). No es un defecto abierto de la corrección de `F02-T01` ni un bloqueante; **no se acepta como riesgo** (sin G-10). La no suplantación por cabeceras y el fail-closed se mantienen (`app.ts` ll. 72–74, `rate-limit.ts` sin cambios). |
| **`A-04`** (`LOW`, oracle de correo heredado de F01) | **Sin cambios** | `user-store-adapter.ts` no fue modificado en el loop 2; sigue siendo un seguimiento de F01, no una regresión de F02. |
| **`A-05`** (`LOW`, métricas `0/0/0`) | **Sin cambios** | `jobs.ts` ll. 138–141 mantiene ceros honestos; la medición real sigue pendiente de `F02-T06`. |
| **`A-06`** (`INFO`, ajena) | **Sin cambios** | El lint acotado al ámbito propio sigue en verde (`F02-T01-loop2-lint-scoped.txt`, exit 0); el hallazgo global de F03 sigue siendo ajeno. |

- **Confinamiento verificado por inspección:** `backend/src/db/job-store.ts` conserva sus condiciones originales de existencia (ll. 219, 252, 272, 300) y **no contiene** `#status = :from`; la transición condicional vive únicamente en `backend/src/api/job-transition.ts`. No se observaron cambios en módulos de F01 ni en `backend/src/index.ts`. Según el reporte del Developer, Docker se apagó (`F02-T01-loop2-docker-down.txt`); **historial Git no verificado** (prohibido por el encargo).
- **Observación ajena informativa:** `F02-T01-loop2-regression.txt` registra 1 fallo en `tests/unit/frontend/core.test.ts:79` (URL con barra final, propiedad de F03) sobre 197/198 unitarias. Se clasifica como **ajena a F02**, en la misma línea de `A-06`; **no se registra como hallazgo de F02** ni se acepta como riesgo.

## D. Conclusión final actualizada

**`READY_WITH_CONCERNS`** — se mantiene la conclusión de auditoría; **no se emite `PASSED`/`NO-PASSED`** y **no se concede G-10**.

- `A-01` y `A-02` quedan **CERRADOS por corrección** con evidencia de RED → GREEN y prueba de concurrencia real en emulador; el seguimiento residual de `A-02` (reintento tras `CONFIRM_INCONSISTENT`, at-most-once, marcador duradero a decidir en T04/T06) es **no bloqueante** y tiene responsable.
- **Sin hallazgos MEDIUM abiertos de la corrección de `F02-T01`**; `A-03` permanece como seguimiento derivado a F05 con responsable, y `A-04`/`A-05`/`A-06` siguen sin cambios (LOW/INFO, ajenos o con fase de destino).
- **0 `CRITICAL` / 0 `HIGH` / 0 bloqueantes de auditoría** para `F02-T01`.
- **Cobertura:** `SUFFICIENT` para la verificación estática del addendum (código, tests y evidencia); `LIMITED` para ejecución propia (no se reejecutó la suite), historial Git (prohibido) y cableado de producción (F05).

**Registro:** append-only. Este addendum se añade sin borrar los hallazgos `A-01`…`A-06` ni las verificaciones `V-1`…`V-9` originales.
