# Developer — `F05-H01` (H-01 Opción A + hardening defensivo)

| Campo | Valor |
|---|---|
| **ID / Fase** | `F05-H01` · Fase Final — hallazgo `H-01` de `reports/verification/F05-qa-roadmap-architect.md` §4 |
| **Rol** | Developer (harness OpenCode) |
| **Harness / Loop** | `v1 — Loop 1/3` |
| **Riesgo / Gates** | `3 (Sensible)` · **H-01 Opción A AUTORIZADA** · **G-6** push autorizado (no ejecutado: lo hace Architect) · **G-7** Docker 2g/2.0 (apagado al terminar) · **G-12 RETENIDO** (sin cierre) |
| **Estado de entrega** | **`DONE`** (no `PASSED`: lo emiten Tester/Auditor/Architect) |
| **Fecha** | `2026-11-19` |

## 1. Alcance ejecutado

**Bloque 1 — H-01 (TDD):** el seed escribe en `DYNAMODB_TABLE_JOBS` (`mediashrink-jobs`); retirada total de `SEED_TABLE_NAME = 'mediashrink-seed-demo'` como destino de escritura.

**Bloque 2 — Hardening defensivo (TDD):** auditoría propia de cabeceras/límite (ausentes) + middleware global de cabeceras y tope de body JSON 1 MiB con 413; `npm audit --omit=dev` clasificado sin aceptar riesgo.

**Prohibiciones respetadas:** sin tocar contratos Zod congelados, `infra/terraform/`, `frontend/`, `README.md`, `STATE.md`, `tasks.md` ni reportes de otros roles; sin declarar `F05-T06` ni G-12; sin secretos ni rutas absolutas en artefactos; sin `git add/commit/push` (lo hace Architect).

## 2. Cambios de producto

| Archivo | Cambio |
|---|---|
| `tools/scripts/seed/cli.ts` | `LOCAL_DEFAULTS.DYNAMODB_TABLE_JOBS = 'mediashrink-jobs'` (misma default que `.env.example` y Terraform); `main()` usa `resolveSeedTableName(config)` = `config.resources.dynamodbTableJobs`; nueva función exportada `resolveSeedTableName` (testeable) |
| `tools/scripts/seed/store.ts` | Retirada `SEED_TABLE_NAME`; `ensureSeedTable` documentada: si la tabla **existe** (Terraform: `PROVISIONED` + TTL en `ttl`) devuelve `false` **sin** tocar billing/claves/TTL — la respeta; solo crea (mismo esquema + TTL) si está ausente |
| `tools/scripts/seed/index.ts` | Retirado el re-export de `SEED_TABLE_NAME` |
| `backend/src/api/security.ts` | **Nuevo**: `securityHeaders` (mutación post-`next()` de `c.res`: los errores devuelven `new Response` directos y las cabeceras pre-`next()` no se fusionarían) + `jsonBodyLimit` (`hono/body-limit`, 1 MiB, `413 { error: { code: 'PAYLOAD_TOO_LARGE' } }`) |
| `backend/src/api/app.ts` | `app.use('*', securityHeaders)` + `app.use('*', jsonBodyLimit)` antes de todas las rutas |
| `backend/src/api/index.ts` | `export * from './security'` (sin colisiones) |

## 3. Cambios de tests (TDD)

| Archivo | Cambio |
|---|---|
| `tests/unit/seed-table.test.ts` | **Nuevo** (3 tests): `--dry-run` nombra `mediashrink-jobs` / no menciona la tabla legada (1 solo spawn en `beforeAll` tras REFACTOR) + `store` no exporta `SEED_TABLE_NAME` |
| `tests/unit/api/security-headers.test.ts` | **Nuevo** (4 tests): cabeceras en 200/201/400/401/404/429; 413 + `PAYLOAD_TOO_LARGE` sobre 1 MiB en `/auth/register`; no-413 bajo el límite |
| `tests/integration/seed/helpers.ts` | `DYNAMODB_TABLE_JOBS: 'mediashrink-jobs'` |
| `tests/integration/seed/idempotence.test.ts` | Tabla `${config.resources.dynamodbTableJobs}-idem` + test H-01 que exige `mediashrink-jobs` sin `seed-demo` |
| `tests/integration/seed/db-check.test.ts` | Tabla `${config.resources.dynamodbTableJobs}-dbcheck` (comentarios actualizados) |

## 4. Cronología RED → GREEN → REFACTOR

1. **RED semilla (unit, sin emulador):** 3/3 fallos conductuales (`Tabla DynamoDB: mediashrink-seed-demo`) — `F05-H01-seed-red.txt` (EXIT=1).
2. **RED semilla (integración, emulador `healthy`):** 1 fallo H-01 (`expected 'mediashrink-seed-demo' to be 'mediashrink-jobs'`), 6 pasan — anexado a `F05-H01-seed-red.txt`.
3. **GREEN semilla:** cambios §2 + §3 → 10/10 (`seed-table` 3 + `seed` integración 7) — `F05-H01-seed-green.txt` (EXIT=0).
4. **Vivo:** `terraform apply` → **11 added**; `seed --dry-run` (0 escrituras) → `seed` (tabla **no** creada, 3/3/6 creados) → `seed` (0 creados, idempotente); `GetCommand mediashrink-jobs {demo-user-ana, USER#PROFILE}` → `found:true ana.demo@example.com` — `F05-H01-seed-live.txt`.
5. **Auditoría propia:** `backend/src/api/*.ts` y `backend/src/auth/*.ts`: **0** coincidencias de cabeceras/`bodyLimit`; `c.req.json()` sin tope en `jobs.ts:196`, `presign.ts:148,173`, `auth/routes.ts:42`.
6. **RED hardening:** 3 fallos (sin cabeceras; 400 en vez de 413) + 1 no-regresión que pasa — `F05-H01-headers-red.txt` (EXIT=1).
7. **GREEN hardening:** `security.ts` + wiring → 4/4 — `F05-H01-headers-green.txt` (EXIT=0). Un fallo intermedio fue del propio test (`jobsMax=1`; ver P-04).
8. **REFACTOR:** `seed-table.test.ts` 2 spawns → 1 (`beforeAll`, 5,4 s → 2,2 s); re-verificado 3/3.
9. **Suite + audit:** typecheck/lint/build EXIT=0; unit **310/310 (34 f.)** = 303 + 7 nuevos; integración **101/101 (24 f.)** = 100 + 1 nueva; `npm audit --omit=dev` → **0 CRITICAL, 2 HIGH** (ver P-03) — `F05-H01-{suite-full,audit-npm}.txt`.
10. **G-7:** `docker compose down` EXIT=0, red eliminada, solo queda `dazzling_edison` (ajeno preexistente) — `F05-H01-emulator-down.txt`.

## 5. Cifras finales

| Suite | Resultado |
|---|---|
| `npm run typecheck` | EXIT 0 |
| `npm run lint` | EXIT 0 |
| `npm run build` | EXIT 0 |
| `npm run test:unit` | **310/310 (34 archivos)** |
| `npx vitest run tests/integration` | **101/101 (24 archivos)** |
| `npm audit --omit=dev` | 0 CRITICAL · **2 HIGH** (sharp transitivo, zod; clasificados en P-03, sin fix ni aceptación de riesgo) |
| `grep mediashrink-seed-demo\|SEED_TABLE_NAME tools/scripts/seed/*` | **0 coincidencias** (retirada total; no queda ni comentario histórico) |
| Docker | **APAGADO** (`down` EXIT 0, red `mediashrink-cloud_default` eliminada) |

## 6. Registro de problemas (7 campos)

### P-01 — El seed y la app usaban tablas DynamoDB distintas (H-01)
- **Identificación:** `P-01 / F05-H01 Bloque 1` · Severidad Media (hereda H-01).
- **Problema:** `cli.ts:100` fijaba `tableName: SEED_TABLE_NAME ('mediashrink-seed-demo')` ignorando `config.resources.dynamodbTableJobs`; el login con cuentas seed devolvía 401 (la app lee `mediashrink-jobs`).
- **Causa (demostrada):** RED unitario (`--dry-run` imprimía la tabla legada) + RED integración (`loadConfig(seedTestEnv()).resources.dynamodbTableJobs === 'mediashrink-seed-demo'`).
- **Solución e intentos fallidos:** GREEN §2 (un solo intento; sin fallidos salvo la edición que truncó la firma de `formatReport`, reparada de inmediato re-añadiendo la firma — verificado por `typecheck` EXIT 0).
- **Verificación:** GREEN 10/10 + vivo (`mediashrink-jobs` con `USER#PROFILE` de `ana.demo@example.com`, 2.ª ejecución 0 creados) + grep 0.
- **Pendientes:** Tester debe verificar `POST /auth/login` `200 OK` con `ana.demo@example.com` y re-seed idempotente (CA-H01.2, fuera del ámbito Developer).
- **Aprendizaje:** un `--dry-run` que imprima la tabla destino es el test conductual más barato del wiring CLI (sin emulador).

### P-02 — API sin cabeceras de seguridad ni tope de body (auditoría propia)
- **Identificación:** `P-02 / F05-H01 Bloque 2` · Severidad Baja-Media (defensa en profundidad).
- **Problema:** ninguna ruta emitía `X-Content-Type-Options`/`X-Frame-Options`/`Referrer-Policy`; `c.req.json()` aceptaba bodies sin tope (DoS de memoria en 4 endpoints).
- **Causa (demostrada):** grep 0 en `api/` y `auth/`; RED: 400 en vez de 413 ante 1,1 MB.
- **Solución e intentos fallidos:** `security.ts` + wiring global (sin fallidos; se eligió mutación post-`next()` tras comprobar en `node_modules/hono` que las cabeceras pre-`next()` no se fusionan en `new Response` directos).
- **Verificación:** 4/4 GREEN incl. 404/429/413 con cabeceras; suite completa sin regresiones.
- **Pendientes:** ninguno de producto; el Auditor puede valorar `Content-Security-Policy` para el frontend (fuera de ámbito `backend/src/api`).
- **Aprendizaje:** en Hono 4, con handlers que devuelven `Response` crudos, las cabeceras globales deben fijarse tras `next()`.

### P-03 — `npm audit --omit=dev`: 2 HIGH, 0 CRITICAL (sin G-10)
- **Identificación:** `P-03 / auditoría defensiva` · Severidad a clasificar por Auditor.
- **Problema:** `sharp <=0.35.5-rc.1` (HIGH: libvips CVE-2026-33327/33328/35590/35591, libheif GHSA-g89c/2jg2, librsvg CVE-2026-96889) y `zod <4.6.6` (HIGH: agotamiento de memoria con colecciones sobredimensionadas GHSA-mrhx-c7xc-m3w5). Fix exige `audit fix --force` con **breaking changes** (sharp@0.35.5, zod@4.6.7).
- **Causa (demostrada):** salida exacta en `F05-H01-audit-npm.txt` (EXIT=1 de npm por hallazgos; 0 CRITICAL).
- **Solución e intentos fallidos:** **NO ejecutado** `audit fix --force` (rompería contratos congelados vía zod y el worker vía sharp sin tarea autorizada; G-10 no invocado). Mitigación parcial ya aplicada: tope de body 1 MiB (P-02) acota el vector del GHSA de zod en la API.
- **Verificación:** pendiente de Auditor; disposición propuesta: tarea autorizada de bump (sharp con suite `worker` + `antiBomb`; zod mayor con control de cambios del CTO por hash congelado).
- **Pendientes:** transferir a Auditor/Architect como seguimiento con responsable y fase.
- **Aprendizaje:** `npm audit` con EXIT=1 por hallazgos debe guardarse como evidencia igualmente (el exit code es el dato).

### P-04 — Test 429 consumía el token con la petición 400 previa (fallo del test, no del producto)
- **Identificación:** `P-04 / test propio` · Severidad Nula (producto intacto).
- **Problema:** con `jobsMax=1`, la petición 400 previa agotaba el cubo y `first` daba 429 en vez de 201.
- **Causa (demostrada):** el limitador de `/jobs` corre antes de validar el body (diseño correcto: fail-cheap).
- **Solución:** `jobsMax=2` + comentario; 4/4 GREEN.
- **Verificación / Pendientes / Aprendizaje:** re-run GREEN; —; los limitadores fail-cheap consumen tokens incluso en 400 (a documentar en tests, no en producto).

### P-05 — `spawn npm` en Windows: `ENOENT` → `EINVAL` (entorno, no producto)
- **Identificación:** `P-05 / harness Windows` · Severidad Nula.
- **Problema:** `execFileSync('npm', …)` falla en Windows (`ENOENT`; con `npm.cmd` sin shell, `EINVAL`).
- **Causa (hipótesis confirmada por el fix):** resolución de `.cmd` exige `shell: true` en win32.
- **Solución:** `npm.cmd` + `shell: process.platform === 'win32'` (portable a CI Linux).
- **Verificación / Pendientes / Aprendizaje:** RED genuino obtenido; —; en CI (Linux) corre sin shell (verificar en el run verde del Architect).

## 7. Notas para Tester / Auditor / Architect

- **Login viable:** `ana.demo@example.com` (contraseña demo ficticia definida en `tools/scripts/seed/demo-data.ts`, no reproducida aquí) existe en `mediashrink-jobs` del emulador **ahora mismo**; tras `down`, Tester debe repetir `terraform apply` → `npm run seed` (idempotente) antes del login.
- **`ensureSeedTable` ante tabla Terraform existente:** `DescribeTable` OK → retorna `false`, sin `CreateTable` ni `UpdateTimeToLive` (billing `PROVISIONED` 5/5 y TTL de Terraform intactos; evidenciado: `(creada en esta ejecución: no)` en vivo).
- **Tablas de prueba `mediashrink-jobs-idem/-dbcheck`:** creadas y **eliminadas** (`dropSeedTable` en `afterAll`); no queda residuo en el emulador salvo `mediashrink-jobs` con los datos del seed vivo (los necesita el Tester).
- **Sin push:** cambios en el árbol a la espera de Tester/Auditor; el commit/run CI corresponde al cierre del Architect (G-6 autorizado, G-12 retenido).
- **No se emite `PASSED` ni cierre** (competencia de Tester/Auditor/Architect).

---

## Addendum loop 2/3 — Corrección del bloqueante P-01 del Tester (`NO-PASSED`): índice `USER#EMAIL` del seed

| Campo | Valor |
|---|---|
| **Fecha** | `2026-11-19` |
| **Loop** | `v1 — Loop 2/3` (no se borra el historial v1: todo lo anterior queda intacto) |
| **Disparador** | `F05-H01-tester.md`: dictamen `NO-PASSED` por `P-01` — `putUserIfAbsent` solo escribía el perfil; `findByEmail` exige el índice y el login demo devolvía 401 |
| **Estado de entrega** | **`DONE`** (no se emite `PASSED`; re-verificación por Tester/Auditor/Architect) |

### Cambios de producto (loop 2)

| Archivo | Cambio |
|---|---|
| `tools/scripts/seed/store.ts` | `putUserIfAbsent` escribe perfil + índice en `TransactWrite` condicional (misma forma que `createDynamoUserStore`, `adapter.ts:111-123`); si la transacción se cancela por condición (re-seed o perfil legado del loop 1 sin índice), asegura el índice con `Put` condicional y devuelve `false`. Nuevos exportados `USER_EMAIL_SORT_KEY = 'USER#EMAIL'`, `USER_EMAIL_ITEM_TYPE = 'USER_EMAIL'`; `normalizeEmail` importado del backend (misma normalización que `findByEmail`). El índice **no** lleva `ttl` (réplica exacta del adaptador; las cuentas no expiran). El `email` del perfil también se normaliza, como el adaptador |

### Cambios de tests (loop 2, TDD)

| Archivo | Cambio |
|---|---|
| `tests/integration/seed/idempotence.test.ts` | Nuevo test `F05-H01-loop2`: tras `runSeed`, `createDynamoUserStore(...).findByEmail` resuelve las 3 cuentas (incl. `ANA.DEMO@EXAMPLE.COM` en mayúsculas), `Get` directo del índice con `ownerUserId` correcto y **sin** `ttl` |

### Cronología RED → GREEN (loop 2)

1. **RED:** el test loop2 falla con `findByEmail → undefined` (el índice no existe) — `F05-H01-loop2-red.txt` (EXIT=1, emulador `healthy` de la sesión concurrente).
2. **GREEN:** cambio §anterior → 8/8 en `tests/integration/seed` (incl. el test loop2) — `F05-H01-loop2-green.txt` (EXIT=0). El primer intento GREEN dio `ECONNREFUSED` porque la otra sesión había hecho `down` entre medias; se re-arrancó el emulador (`up -d`, `healthy`, `docker cp` ×3) y el reintento pasó. Ambas corridas constan en el mismo archivo de evidencia.
3. **Vivo:** `terraform apply` → **11 added** (al primer intento, sin lock esta vez) → `npm run seed` (3/3/6 creados) → backend `node --env-file=.env --import tsx backend/src/server.ts` (`F05_SERVER_READY`, `/health` 200) → `POST /auth/login` cuenta Ana → **`200 OK`** (`userId: demo-user-ana`, sin `error`) → `GET /jobs` con el token → **200 con 1 lote (`demo-job-ana`)** → re-`seed` (0 creados, idempotente) → login de nuevo **200**. Resúmenes redactados (estados e IDs; sin tokens ni contraseñas) en `F05-H01-loop2-live.txt`.
4. **Suite:** typecheck/lint/build EXIT 0; unit **310/310 (34 f.)**; integración **102/102 (24 f.)** = 101 + test loop2 — `F05-H01-loop2-suite.txt`.
5. **G-7:** backend detenido (puerto 3001 cerrado), `docker compose down` EXIT 0, red eliminada — `F05-H01-loop2-down.txt` (archivo adicional al cuarteto exigido, como en el loop 1).

### Cifras finales (loop 2)

| Suite | Resultado |
|---|---|
| `npm run typecheck` / `lint` / `build` | EXIT 0 / 0 / 0 |
| `npm run test:unit` | **310/310 (34 archivos)** |
| `npx vitest run tests/integration` | **102/102 (24 archivos)** |
| Login vivo Ana + lotes + re-seed | **200 / 1 lote / 0 creados / 200** |
| Docker | **APAGADO** (`down` EXIT 0) |

### Problemas del loop 2 (7 campos)

#### P-06 — El seed no escribía el índice `USER#EMAIL`: login demo 401 (bloqueante del Tester)
- **Identificación:** `P-06 / F05-H01 loop 2 (P-01 del Tester)` · Severidad Alta / Bloqueante de CA-H01.2.
- **Problema:** `putUserIfAbsent` hacía un único `Put` del perfil; `DynamoUserStore.findByEmail` (`adapter.ts:135-152`) lee el índice `{correo normalizado, USER#EMAIL}` con `ownerUserId`, que nunca se creaba → `401 INVALID_CREDENTIALS` en las 3 cuentas seed aunque perfil, hash y tabla eran correctos.
- **Causa (demostrada):** RED loop2 (`findByEmail → undefined`); Tester: `Get ana.demo@example.com/USER#EMAIL → MISSING`.
- **Solución e intentos fallidos:** `TransactWrite` condicional perfil+índice (réplica exacta del adaptador, sin `ttl` en el índice) + reparación del índice cuando la transacción se cancela (cubre re-seed y perfiles legados del loop 1). Sin fallidos de producto; una edición intermedia truncó la firma de `delay` y se reparó de inmediato (typecheck EXIT 0). No se tocó `backend/src/db` (fuera de ámbito): solo lectura + importación de `normalizeEmail` y de la forma del adaptador.
- **Verificación:** GREEN 8/8; vivo login **200** + 1 lote + re-seed 0 + login 200; suite 310+102 en verde.
- **Pendientes:** re-verificación Tester loop 2/3 (login `200 OK` + lotes + idempotencia) y Auditor; el índice de datos legados del loop 1 en el emulador del Tester se repara solo con re-`seed` (verificado: el vivo partía de emulador fresco, y la rama de reparación cubre el caso perfil-sin-índice).
- **Aprendizaje:** verificar "el dato existe" (`Get` del perfil) no acredita el flujo de aceptación; el criterio exigía `login 200` y debió probarse en el desarrollo (mea culpa registrada; P-01 del Tester tenía razón).

#### O-03 — Contención con sesión concurrente (observación de entorno, no hallazgo de producto)
- **Identificación:** `O-03 / entorno G-7` · Severidad Nula (producto intacto).
- **Problema:** durante el loop 2 el emulador pasó de `Up (healthy)` a inexistente entre dos comandos (`ECONNREFUSED 127.0.0.1:9297` en el primer intento GREEN): la otra sesión hizo `down`. `temporary/` sigue existiendo con `ms-check.mts` y `ms-verify.mts` ajenos (01:27 local); no tocados.
- **Causa (demostrada):** `docker ps -a` mostró solo `dazzling_edison` y `compose ps` vacío tras el fallo; `temporary/` listado sin modificar.
- **Solución e intentos fallidos:** re-arranque propio (`up -d` → `healthy`, `docker cp` ×3, healthcheck `ok`) y reintento con éxito; ninguna acción sobre archivos ajenos; `terraform apply` posterior sin lock (un solo intento, 11 added).
- **Verificación / Pendientes / Aprendizaje:** ambas corridas (fallida + verde) constan en `F05-H01-loop2-green.txt`; —; en ventanas con concurrencia, tolerar `down` ajenos con re-arranque y documentar la ventana (hecho). `temporary/` ajeno queda al Architect (ámbito G-11).
