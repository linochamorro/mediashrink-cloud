# `F01-T03` — Desarrollo: autenticación JWT propia

| Campo | Valor |
|---|---|
| **Tarea / paquete** | `F01-T03` · Fase 1 · `docs/sdd/packages/P-01-critical-foundations.md` |
| **Versión / loop** | `v1 — Loop 1/3` |
| **Rol** | `Developer` (harness OpenCode) |
| **Riesgo** | `3 (Sensible)` — autenticación, secretos y aislamiento |
| **Criterio asignado** | `CA-03`: `register`/`login`/`refresh`, contraseñas hasheadas (nunca en claro), JWT verificado, middleware que extrae `userId`, aislamiento `401`/`404` y rate limiting configurable desde configuración, sin hallazgos críticos/altos |
| **Estado final** | **`DONE_WITH_CONCERNS`** — entregado a Tester y Auditor; **sin `PASSED` ni cierre de tarea por este rol** |
| **Fecha** | `2026-11-17` |

## 1. Fuentes leídas

`AGENTS.md`; `STATE.md`; `.agents/roles/developer.md`; `docs/sdd/packages/P-01-critical-foundations.md` (CA-03, §3–§5); `docs/sdd/spec.md` (FR-01/FR-02/FR-03/FR-21, NFR-03, §5–§6); `docs/sdd/plan.md` §3.1 y §5; `docs/sdd/constitution.md` (IN-05, IN-13, PR-07, PR-08); `reports/implementation/F01/F01-T01-architect.md` (contratos v1, hash `5d0082f8…68d626d` y decisión CTO de contraseña 8–128); `reports/implementation/F01/F01-T02-architect.md` (almacén por `userId`); `reports/implementation/F01/F01-T03-task.md` (**fuente de verdad de alcance**); `backend/src/contracts/**`; `backend/src/config/index.ts`; `backend/src/db/**`; `backend/src/index.ts`; `.env.example`; `backend/package.json`, `package.json` raíz, `backend/tsconfig.json`, `tsconfig.base.json`; `tests/unit/config.test.ts`, `tests/unit/health.test.ts` y `tests/integration/db/table-fixture.ts` (patrones de setup/teardown); `node_modules/hono/dist/types/middleware/jwt/*.d.ts` y `node_modules/hono/dist/utils/jwt/jwt.js` (API real de `hono/jwt` instalada); `reports/implementation/F01/F01-T05-developer.md` (formato de reporte y convención `<PROJECT_ROOT>`).

## 2. Resultado frente a CA-03

| Requisito | Comportamiento entregado | Ubicación |
|---|---|---|
| FR-01 · registro con hash | Contrato Zod congelado (`RegisterInput`, 8–128 caracteres por decisión CTO), sal aleatoria, hash `scrypt`, correo normalizado, duplicado → 409 con mensaje genérico | `backend/src/auth/{service,password,user-store,routes}.ts` |
| FR-02 · login access + refresh | Verificación en tiempo constante, credenciales inválidas → 401 indistinto para correo desconocido y contraseña errónea (verificación dummy) | `backend/src/auth/{service,password,jwt}.ts` |
| FR-03 · renovación | `RefreshInput` validado, token de refresh con `typ` propio, se comprueba que el usuario siga existiendo y se emite un par nuevo | `backend/src/auth/{jwt,service}.ts` |
| NFR-03 · JWT verificado | HS256 fijo, firma verificada por WebCrypto, `exp`/`iat`/`typ`/`sub` comprobados explícitamente; token manipulado, expirado o de otro tipo → 401 | `backend/src/auth/jwt.ts` |
| FR-21 · `401`/`404` | `requireAuth` sin token o token inválido → 401; `assertOwnership`/`requireOwnershipParam` para recurso ajeno → 404 con el mismo cuerpo que un recurso inexistente | `backend/src/auth/middleware.ts` |
| A-06 · rate limit configurable | `RATE_LIMIT_AUTH_MAX` y `RATE_LIMIT_AUTH_WINDOW_MS` desde `loadConfig()`; ventana fija por clave, 429 con cabecera `Retry-After` | `backend/src/auth/rate-limit.ts`, `backend/src/auth/routes.ts` |
| G-3 / PR-08 · secretos | Solo marcadores locales en tests; errores con `{error:{code,message}}` sin stacks, rutas internas ni valores de secretos | `backend/src/auth/{errors,middleware}.ts` |

**Sin rutas `/jobs`, sin worker `sharp`, sin UI React, sin Cognito/OAuth, sin AWS real y sin contenedor Docker.** La persistencia de usuarios usa `UserStore` (interfaz + implementación en memoria) aislada por prueba; no se creó ninguna tabla DynamoDB ni se tocó `backend/src/db/**`.

## 3. Cronología TDD (RED → GREEN → REFACTOR)

| Fase | Hora | Acción y resultado | Evidencia |
|---|---|---|---|
| Preparación | 18:35 | Lectura de fuentes; verificación de entorno (`node v26.13.0`, `globalThis.crypto.subtle` disponible) y de la API real de `hono/jwt` instalada (4.13.19). | — |
| **RED** | 18:41:14 | Se escribieron primero 9 módulos con firmas exactas y errores `NOT_IMPLEMENTED` en `backend/src/auth/**` y 44 tests en `tests/unit/auth/**` + `tests/integration/auth/**`. Resultado: **43 fallos por comportamiento, 1 acierto**, 0 errores de resolución de módulo, exit 1. | `evidence/F01-T03-red.txt` |
| **GREEN (1er intento)** | 18:42:47 | Implementación completa de hash, JWT, store, limitador, servicio, middleware y rutas. 5 fallos (2 × 500/404, 3 × 429/401-400) y 5 errores de `typecheck`; exit 1. | (registro cronológico) |
| Corrección | 18:43–18:44 | El handler efímero de prueba pasó a capturar `AuthError` con `authErrorResponse`; el umbral del limitador quedó en 100 por defecto y en 2 solo en el test de rate limit; se tiparon `app.request` y `.json()`. | — |
| **GREEN (final)** | 18:44:01 | `npx vitest run tests/unit/auth tests/integration/auth`: **44/44**, exit 0. `npm run typecheck`: exit 0. | `evidence/F01-T03-green.txt` |
| **REFACTOR** | 18:45:05 → 18:46:09 | Extraída `normalizeEmail` a `backend/src/auth/identity.ts` (antes duplicada en servicio y store); unificado el patrón rate-limit/errores de las tres rutas en `guarded()`; corregidos 5 hallazgos de lint (`Context` sin usar y `prefer-const`). **44/44**, typecheck 0, lint 0, suite completa **150/150**. | `evidence/F01-T03-{refactor,hash,jwt,isolation,rate-limit,typecheck,lint,unit}.txt` |

El RED no es reproducible sin revertir la implementación (acción prohibida); se conserva el registro cronológico íntegro. Las 11 evidencias tienen la raíz del proyecto normalizada a `<PROJECT_ROOT>` (incluidas las formas con barra inclinada y el prefijo `file:///` de la línea `RUN` y de los stack traces), sin ampliar el seguimiento P4 (G-6b).

## 4. Tabla de comandos y exit codes

Todos ejecutados desde `<PROJECT_ROOT>`.

| Comando | Exit | Resultado |
|---|---|---|
| `node -v` / `node -e "typeof globalThis.crypto?.subtle?.sign"` | 0 | `v26.13.0` / `function` |
| `npx vitest run tests/unit/auth tests/integration/auth` (**RED**) | 1 | 7 archivos, 43 failed / 1 passed (44) — comportamiento, sin `MODULE_NOT_FOUND` |
| `npx vitest run tests/unit/auth tests/integration/auth` (GREEN 1er intento) | 1 | 5 failed / 39 passed (44) |
| `npm run typecheck` (1er intento) | 2 | TS2322 en `fixtures.ts`, TS18046/TS2571 en tests |
| `npx vitest run tests/unit/auth tests/integration/auth` (**GREEN**) | 0 | 7 archivos, **44/44** |
| `npm run typecheck` (GREEN) | 0 | sin diagnósticos |
| `npx vitest run tests/unit/auth/password.test.ts` | 0 | **6/6** (hash scrypt) |
| `npx vitest run tests/unit/auth/jwt.test.ts` | 0 | **7/7** (firma, expiración, manipulación) |
| `npx vitest run tests/integration/auth/isolation.test.ts` | 0 | **4/4** (401/404, sin filtrar existencia) |
| `npx vitest run tests/unit/auth/rate-limit.test.ts` | 0 | **5/5** (umbral configurable) |
| `npm run lint` (1er intento) | 1 | 5 errores: `Context` sin usar y 4 × `prefer-const` |
| `npm run lint` (final) | 0 | sin hallazgos |
| `npm run typecheck` (final) | 0 | sin diagnósticos |
| `npx vitest run tests/unit/auth tests/integration/auth` (**REFACTOR**) | 0 | 7 archivos, **44/44** |
| `npm run test:unit` (final) | 0 | 15 archivos, **150/150** (119 preexistentes + 31 nuevos) |

No se ejecutaron `npm install`/`npm ci`: no se añadió ninguna dependencia (ver §5). No se usaron Docker, emulador AWS, Git de escritura ni GitHub.

## 5. Decisiones de seguridad

1. **Hash de contraseña — `scrypt` nativo (`node:crypto`), A-02.** Parámetros fijos en código: `N=16384`, `r=8`, `p=1`, `maxmem=64 MiB`, sal aleatoria de 16 bytes y digest de 64 bytes. Formato `scrypt$N$r$p$saltHex$digestHex`; la verificación exige que los parámetros del encoded sean exactamente los fijados (un digest manipulado para abaratar el coste se rechaza) y compara con `timingSafeEqual`. La contraseña nunca se persiste ni se registra; la política **8–128 caracteres** es la decisión CTO ya registrada y **no se modificó**.
2. **Librería JWT — `hono/jwt` (HS256), sin dependencia nueva.** Ya forma parte de la dependencia `hono` aprobada en F00; frente a una implementación HMAC propia, centraliza el manejo criptográfico en una librería auditada del stack. Las firmas se verifican con algoritmo fijo `HS256`; `exp` e `iat` se comprueban explícitamente en el código para distinguir "caducado" (`TOKEN_EXPIRED`) de "manipulado" (`INVALID_TOKEN`). Claims: `sub` (`userId`), `email`, `typ` (`access`/`refresh`), `iat`, `exp` y `jti` (`randomUUID()`). No se aceptan tokens tipo `access` en `/auth/refresh` ni viceversa.
3. **Secretos y TTLs — exclusivamente desde `loadConfig()`.** `JWT_ACCESS_SECRET` y `JWT_REFRESH_SECRET` son distintos; `JWT_ACCESS_TTL` y `JWT_REFRESH_TTL` se leen en segundos (en tests, marcadores `REPLACE_WITH_…` y 900/604800 para ilustrar la relación access < refresh que ya valida el loader). No hay valores reales en código, tests, reportes ni logs.
4. **Aislamiento — `401` antes que `404`.** `requireAuth` valida token y existencia del usuario; sin token → 401. `assertOwnership`/`requireOwnershipParam` comparan `userId` del token con el del recurso; distinto → 404. El cuerpo de 404 es idéntico para recurso ajeno e inexistente, y no incluye identificadores.
5. **Rate limiting — ventana fija en memoria, configurable.** Clave por `x-forwarded-for`/`x-real-ip` o `local`; `RATE_LIMIT_AUTH_MAX`/`RATE_LIMIT_AUTH_WINDOW_MS` desde config; respuesta 429 con `Retry-After`. Reloj inyectable para pruebas deterministas sin `setTimeout`.
6. **Anti-enumeración de login.** Cuando el correo no existe se ejecuta una verificación scrypt contra un hash dummy, de modo que correo desconocido y contraseña errónea producen exactamente el mismo error y coste similar.
7. **Errores sin filtrar información.** Respuesta homogénea `{ error: { code, message } }`, sin `stack`, sin rutas `backend/src/**`, sin nombres de variables de entorno ni valores de secretos. Un fallo inesperado en el middleware se trata como 401 (fail-closed) y en las rutas como 500 genérico.
8. **Persistencia.** `UserStore` con `InMemoryUserStore` por instancia y sin I/O: suficiente para acreditar CA-03 sin Docker ni AWS. La interfaz permite sustituirlo por un adaptador DynamoDB en F04 sin tocar la lógica de auth. No se creó tabla de usuarios ni se modificó `backend/src/db/**` (fuera de ámbito).
9. **G-8 / manifiestos.** No se requirieron dependencias nuevas: `scrypt` es nativo y `hono/jwt` ya estaba instalado. `backend/package.json` y `package-lock.json` permanecen sin cambios de esta tarea; esta tarea era propietaria del manifiesto backend, pero no hubo nada que añadir.

## 6. Archivos creados / modificados

**Creados (producto):** `backend/src/auth/{errors,identity,password,jwt,user-store,rate-limit,service,middleware,routes,index}.ts`.

**Creados (tests):** `tests/unit/auth/{fixtures,password,jwt,rate-limit,service,middleware}.test.ts` (más `fixtures.ts`); `tests/integration/auth/{fixtures,routes,isolation}.test.ts` (más `fixtures.ts`).

**Evidencias:** `reports/implementation/F01/evidence/F01-T03-{red,green,refactor,hash,jwt,isolation,rate-limit,typecheck,lint,unit}.txt`.

**Modificados por esta tarea:** ningún archivo fuera del ámbito exclusivo. En particular **no se escribió** `backend/package.json`, `package-lock.json`, `package.json` raíz, `.env.example`, `STATE.md`, `docs/sdd/tasks.md`, `backend/src/{contracts,db,domain,config}/**`, `backend/src/index.ts`, `frontend/**`, `infra/terraform/**`, `.github/**` ni reportes ajenos. Tampoco se implementaron rutas `/jobs`.

## 7. Problemas registrados (7 campos obligatorios)

### `F01-T03-P1` — RED greenfield sin módulo previo

1. **Identificación:** `F01-T03-P1`.
2. **Problema:** `backend/src/auth/**` no existía; un RED con imports directos habría fallado por resolución de módulo, no por comportamiento.
3. **Causa:** **DEMOSTRADA** — inspección inicial del árbol (`backend/src` solo contenía `config/`, `contracts/`, `db/`, `domain/` e `index.ts`).
4. **Solución e intentos fallidos:** diez módulos stub con firmas exactas y valores/error deliberadamente incorrectos, sustituidos en GREEN. Descartado el import directo por no ser RED conductual; sin intentos fallidos adicionales.
5. **Verificación:** 43 fallos de aserción/`NOT_IMPLEMENTED`, 0 `MODULE_NOT_FOUND` en `F01-T03-red.txt`.
6. **Pendientes:** ninguno.
7. **Aprendizaje candidato:** `PROPUESTA_GLOBAL` — en módulos nuevos, un stub conductual permite un RED por comportamiento sin depender de errores de resolución.

### `F01-T03-P2` — Handler efímero devolvía 500 donde se esperaba 404

1. **Identificación:** `F01-T03-P2`.
2. **Problema:** en el primer GREEN, el acceso de A al recurso de B devolvió 500: `assertOwnership` lanzaba `AuthError` dentro del handler de prueba y Hono lo trataba como excepción no controlada.
3. **Causa:** **DEMOSTRADA** — dos aserciones `expected 500 to be 404` y trazas `AuthError: Recurso no encontrado` en la salida.
4. **Solución e intentos fallidos:** envolver el handler de `tests/integration/auth/fixtures.ts` en `try/catch` y devolver `authErrorResponse(error)`. Intento fallido: dejar la excepción propagarse confiando en un `onError` global (no montado en la app de prueba).
5. **Verificación:** `F01-T03-isolation.txt` 4/4; 404 con cuerpo idéntico para ajeno e inexistente.
6. **Pendientes:** ninguno. El montaje real en F02 debe emplear el mismo manejo de errores.
7. **Aprendizaje candidato:** `PROPUESTA_GLOBAL` — los errores de dominio deben serializarse en el límite HTTP; un middleware que captura no cubre excepciones lanzadas por el handler posterior.

### `F01-T03-P3` — Rate limit compartido bloqueaba tests no relacionados

1. **Identificación:** `F01-T03-P3`.
2. **Problema:** con `RATE_LIMIT_AUTH_MAX=2` global en el fixture, los tests de registro/login/refresh agotaban el cupo y recibían 429 en lugar de 400/401.
3. **Causa:** **DEMOSTRADA** — tres aserciones `expected 429 to be …` en el primer GREEN; todas las peticiones usaban la clave `local`.
4. **Solución e intentos fallidos:** umbral por defecto 100 en `authTestEnv()` y override explícito a 2 únicamente en el test de rate limit, con reloj inyectable para renovar la ventana. Intento fallido: `limiter.reset()` entre peticiones (ocultaba el comportamiento acumulado que se quería probar).
5. **Verificación:** `F01-T03-rate-limit.txt` 5/5; `F01-T03-refactor.txt` 44/44.
6. **Pendientes:** ninguno.
7. **Aprendizaje candidato:** `SOLO_LOCAL` — la configuración de prueba debe ser suficientemente permisiva por defecto y estricta solo en el test que verifica el límite.

### `F01-T03-P4` — Errores de tipado en fixtures y tests

1. **Identificación:** `F01-T03-P4`.
2. **Problema:** `npm run typecheck` devolvió exit 2: TS2322 (`app.request` devuelve `Response | Promise<Response>`) y TS18046/TS2571 (`.json()` tipado como `unknown`).
3. **Causa:** **DEMOSTRADA** — salida del compilador con 15 diagnósticos localizados en `tests/integration/auth/**`.
4. **Solución e intentos fallidos:** ampliar los tipos de retorno de `postJson`/`getWithToken` a `Promise<Response> | Response` y castear los cuerpos a `JsonObject`/`RegisteredBody` en los tests. Intento fallido: asumir que `app.request` devolvía siempre `Promise<Response>` (cambio de firma en la versión instalada de Hono).
5. **Verificación:** `npm run typecheck` exit 0 en GREEN final y en el cierre.
6. **Pendientes:** ninguno.
7. **Aprendizaje candidato:** `PROPUESTA_GLOBAL` — tipar los helpers HTTP de prueba contra la firma real de la librería instalada, no contra la documentación.

### `F01-T03-P5` — Cinco hallazgos de ESLint

1. **Identificación:** `F01-T03-P5`.
2. **Problema:** `npm run lint` devolvió exit 1 por `Context` importado pero sin usar en `middleware.ts` y cuatro `prefer-const` en `rate-limit.test.ts`.
3. **Causa:** **DEMOSTRADA** — salida de ESLint con rutas y números de línea.
4. **Solución e intentos fallidos:** retirar el import innecesario y cambiar a `const` los relojes de prueba que no se reasignan (se conservó `let` en el único test que sí avanza el reloj). Sin intentos fallidos.
5. **Verificación:** `npm run lint` exit 0; `F01-T03-lint.txt`.
6. **Pendientes:** ninguno.
7. **Aprendizaje candidato:** `SOLO_LOCAL` — ejecutar lint antes del handoff evita que el Tester reciba un artefacto con deuda de formato.

### `F01-T03-P6` — Persistencia de usuarios sin tabla DynamoDB

1. **Identificación:** `F01-T03-P6`.
2. **Problema:** no existe contrato ni tabla de usuarios en `backend/src/db/**` ni en Terraform; F01-T02 solo modela jobs por `userId`/`jobId`.
3. **Causa:** **DEMOSTRADA** — inspección de `backend/src/db/**`, `.env.example` e `infra/terraform/**`; el alcance de esta tarea prohíbe escribir en `db/**` e `infra/**`.
4. **Solución e intentos fallidos:** definir `UserStore` como interfaz con `InMemoryUserStore` por instancia; CA-03 se acredita sin crear recursos externos. Descartado crear una tabla efímera en el emulador: añadiría dependencia de Docker sin aportar evidencia a hash/JWT/aislamiento/rate limit y exigiría credenciales del emulador ajenas a esta tarea.
5. **Verificación:** 44/44 tests con store aislado por prueba; sin AWS real, sin Docker y sin tablas huérfanas.
6. **Pendientes:** F04 debe decidir el adaptador DynamoDB y su tabla; la interfaz pública de auth ya está preparada. No es un riesgo aceptado por Lino (no se concedió G-10): es una decisión de arquitectura dentro del alcance de F01-T03.
7. **Aprendizaje candidato:** `PROPUESTA_GLOBAL` — separar la interfaz de persistencia del almacenamiento permite verificar la lógica de auth antes de que exista la infraestructura definitiva.

### `F01-T03-P7` — Un test del RED pasó falsamente por el stub

1. **Identificación:** `F01-T03-P7`.
2. **Problema:** en RED, `assertOwnership` lanzaba siempre `NOT_IMPLEMENTED`; el test «el mensaje de error no incluye los identificadores» inicializaba `message = ''` y por eso pasaba sin ejercitar el comportamiento.
3. **Causa:** **DEMOSTRADA** — 43 fallos / 1 acierto en `F01-T03-red.txt`; el acierto corresponde a ese test por la ruta de captura del stub.
4. **Solución e intentos fallidos:** no se debilitó la aserción; al implementar `assertOwnership → resourceNotFound()`, el mismo test pasó comprobando un mensaje real que no contiene los identificadores. Sin cambios posteriores.
5. **Verificación:** `F01-T03-isolation.txt` y `F01-T03-refactor.txt`: el mensaje 404 se compara entre recurso ajeno e inexistente.
6. **Pendientes:** ninguno. Se documenta para transparencia del registro RED.
7. **Aprendizaje candidato:** `SOLO_LOCAL` — revisar los aciertos del RED: un test que pasa con un stub puede estar midiendo el stub, no el comportamiento.

### `F01-T03-P8` — Manifiesto backend sin dependencias nuevas

1. **Identificación:** `F01-T03-P8`.
2. **Problema:** el contrato asignaba a esta tarea la propiedad de `backend/package.json` para dependencias JWT/bcrypt; no se añadió ninguna.
3. **Causa:** **DEMOSTRADA** — `scrypt` está en `node:crypto` y `hono/jwt` ya estaba disponible en la versión instalada de `hono` (4.13.19), verificada leyendo `package.json` y los tipos del módulo.
4. **Solución e intentos fallidos:** usar las primitivas ya presentes; no se ejecutó `npm install`/`npm ci` y no se modificaron `backend/package.json` ni `package-lock.json`. Descartado `bcryptjs`/`jose` por innecesarios y por ampliar la superficie de dependencias sin beneficio para CA-03.
5. **Verificación:** suite completa 150/150 y typecheck 0 sin instalación adicional; G-8 queda intacto.
6. **Pendientes:** ninguno. Si el Auditor prefiere una librería JWT externa, sería cambio de decisión con control de alcance, no corrección de este loop.
7. **Aprendizaje candidato:** `PROPUESTA_GLOBAL` — verificar la API instalada antes de declarar una dependencia evita lockfiles innecesarios en fases paralelas.

## 8. Estado final y handoff

- **Estado:** `DONE_WITH_CONCERNS`. Los concerns son `P6` (adaptador DynamoDB diferido a F04) y `P8` (sin dependencias nuevas); ninguno reduce CA-03 ni introduce un riesgo aceptado sin autoridad.
- **No se emite `PASSED` ni se cierra la tarea:** corresponden al Tester independiente y al Auditor de riesgo 3, con base en `evidence/F01-T03-*.txt` y este reporte.
- Sin secretos, sin `:9324`, sin rutas Windows absolutas y sin nombres de archivos temporales en los artefactos nuevos. Sin Docker, AWS real, Git de escritura ni GitHub.
- **Handoff:** Tester reejecuta `npx vitest run tests/unit/auth tests/integration/auth`, `npm run typecheck`, `npm run lint` y `npm run test:unit`; Auditor revisa algoritmo de hash, librería JWT y TTLs, distinción `401`/`404`, manejo de secretos y el rate limit configurable, además de los concerns `P6`/`P8`.
