# Tester — `F05-H01` (H-01 Opción A + hardening defensivo)

| Campo | Valor |
|---|---|
| **ID / Fase** | `F05-H01` · Fase Final — hallazgo `H-01` de `reports/verification/F05-qa-roadmap-architect.md` §4 |
| **Rol** | Tester independiente (harness OpenCode) |
| **Harness / Loop** | `v1 — Loop 1/3` |
| **Riesgo / Gates** | `3 (Sensible)` · **H-01 Opción A AUTORIZADA** · **G-6** push autorizado (no ejecutado: lo hace Architect) · **G-7** Docker 2g/2.0 (apagado al terminar) · **G-12 RETENIDO** (sin cierre) |
| **Dictamen global** | **`NO-PASSED` (Loop 1/3)** — `CA-H01.2` incumplido: el login demo devuelve 401 aunque el seed escribe en la tabla correcta (ver `P-01`) |
| **Fecha** | `2026-11-19` |

Toda la evidencia es de **ejecución propia** (ninguna corrida del Developer se presenta como propia). Evidencias: `evidence/F05-H01-tester-seed-live.txt`, `evidence/F05-H01-tester-hardening.txt`, `evidence/F05-H01-tester-suite.txt`, `evidence/F05-H01-tester-emulator-down.txt`.

## 1. Veredicto por criterio (`CA-H01`)

| Criterio | Veredicto | Evidencia propia |
|---|---|---|
| **CA-H01.1** — seed escribe en `DYNAMODB_TABLE_JOBS` (`mediashrink-jobs`); sin rastro de `SEED_TABLE_NAME` como destino | **PASSED** | `npm run seed` imprime `Tabla DynamoDB: mediashrink-jobs`; `grep` en `tools/scripts/seed/*` → 0 coincidencias de `SEED_TABLE_NAME`/`mediashrink-seed-demo` (consta en Developer §5; verificado en lectura propia de `cli.ts`/`store.ts`/`index.ts`) |
| **CA-H01.2** — `terraform apply` → `npm run seed` → `POST /auth/login` demo `200 OK` + lotes visibles; re-seed idempotente | **NO-PASSED** (bloqueante, ver `P-01`) | `terraform apply` → 11 recursos; seed → `mediashrink-jobs` 3/3/6; login demo → **`401 INVALID_CREDENTIALS`**; `findByEmail` → null (falta el índice `USER#EMAIL`). Idempotencia del seed: **PASSED** (2 pasadas, 0 creados, mismos IDs, conteos 12→12) |
| **CA-H01.3a** — cabeceras en 200/201/400/401/404/429/413 + tope body 1 MiB con `413 {error:{code:'PAYLOAD_TOO_LARGE'}}`; sin regresión (login válido 200, credenciales malas 401 sin oráculo) | **PASSED** | En vivo: 3 cabeceras en **7/7** clases (200/201/400/401/404/429/413); body 1150039 B → 413 + código exacto; body pequeño → 201 (pasa el tope); login válido (alta API) → 200; mala credencial → 401 idéntico por construcción (sin oráculo) |
| **CA-H01.3b** — suite en verde (typecheck, lint, build, `test:unit`, `tests/integration`) | **PASSED** | typecheck/lint/build EXIT 0; unit **310/310 (34 f.)**; integration **101/101 (24 f.)** — cifras y exit codes propios (con relanzamiento de emulador documentado tras caída de entorno) |

## 2. Sesión viva (resumen; detalle en `F05-H01-tester-seed-live.txt`)

1. `docker compose up -d` → `mediashrink-aws-emulator` `healthy` (límites 2147483648 B / 2000000000 nanoCpus, `1000:1000`); `docker cp` ×3 desde `/home/emulator/.aws/emulator/9297/`; healthcheck `ok` EXIT 0.
2. `terraform init` EXIT 0; `terraform apply -var=is_emulator=true` → **11 added** (encarnación 2; en la 1.ª: 0 added con 11 gestionados + 2 data sources ya en estado).
3. `npm run seed` → `Tabla DynamoDB: mediashrink-jobs`, 3/3/6 creados, total 0→12.
4. Backend con `.env` cargado → `F05_SERVER_READY {"port":3001}`; `GET /health` → 200. (Sin `.env` en el entorno falla con `ConfigError`: entorno, no producto.)
5. `POST /auth/login` demo → **401** (ver `P-01`).
6. Lecturas directas: perfil `demo-user-ana/USER#PROFILE` existe con `passwordHash`; `findByEmail` → null; el índice `USER#EMAIL` no existe. El lote `demo-job-ana` existe pero es inalcanzable por API sin login.
7. Segundo `npm run seed` → 0 creados, conteos 12→12: idempotente.
8. Mecánica login→lotes verificada con alta API: register → 201, login → 200, `GET /jobs` → 200 `{"jobs":[]}`.

## 3. Hardening en vivo (resumen; detalle en `F05-H01-tester-hardening.txt`)

- `GET /health` 200, `POST /auth/register` 400/201, `POST /auth/login` 401, `GET /no-existe` 404, body >1 MiB → 413, 6.º intento auth → 429: **todas** con `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`.
- 413 con `{error:{code:'PAYLOAD_TOO_LARGE'}}` exacto; bajo el límite pasa (201).
- Sin regresión: register válido 201, login válido 200, límite auth 5/60s intacto (5×401 → 429 `RATE_LIMITED` + `retry-after`).

## 4. Suite (cifras propias; detalle en `F05-H01-tester-suite.txt`)

| Suite | Resultado |
|---|---|
| `npm run typecheck` | EXIT 0 |
| `npm run lint` | EXIT 0 |
| `npm run build` | EXIT 0 |
| `npm run test:unit` | EXIT 0 · **310/310 (34 archivos)** |
| `npx vitest run tests/integration` | EXIT 0 · **101/101 (24 archivos)** (tras relanzar el emulador: el primer intento dio EXIT 1 por `ECONNREFUSED` al haber desaparecido el contenedor; re-aplicado `11 added` + seed y re-ejecutado en verde) |

## 5. Registro de problemas (7 campos)

### P-01 — El seed no escribe el índice `USER#EMAIL`: login demo imposible (CA-H01.2 incumplido)
- **Identificación:** `P-01 / F05-H01 CA-H01.2` · Severidad **Alta / Bloqueante** (criterio central de H-01).
- **Problema:** `POST /auth/login` con la cuenta demo del seed devuelve `401 INVALID_CREDENTIALS` aunque el perfil existe en `mediashrink-jobs` con su `passwordHash`. El seed solo escribe `{userId, USER#PROFILE}` (+ lote e imágenes, correctos), pero `DynamoUserStore.findByEmail` (`backend/src/db/user-store-adapter.ts:135-152`) exige el ítem `{userId: emailNormalizado, jobId: USER#EMAIL}` con `ownerUserId`, que el seed nunca crea (`tools/scripts/seed/store.ts:putUserIfAbsent` hace un único `PutCommand` del perfil). Ningún usuario seed puede autenticarse; los lotes demo son inalcanzables por API.
- **Causa (demostrada):** ejecución propia: perfil `demo-user-ana/USER#PROFILE` → existe con hash; `findByEmail` vía adaptador real → null; login vivo → 401. El Developer solo verificó en vivo el ítem perfil, nunca el flujo `POST /auth/login` (su propio reporte lo deja "pendiente de Tester").
- **Solución e intentos fallidos:** sin competencia del Tester (prohibido editar producto). Vía propuesta al Developer: que el seed escriba el índice email (misma forma que `createDynamoUserStore.createUser`: perfil + índice, con condición de ausencia para idempotencia) bajo TDD, con test vivo `login 200 + GET lotes`.
- **Verificación:** pendiente de loop 2/3 (reproducir: `terraform apply` → `npm run seed` → login demo `200 OK` + `GET` de sus lotes con el token + re-seed idempotente).
- **Pendientes:** corrección en Developer + re-verificación Tester (loop 2/3). Sin `PASSED` global hasta entonces.
- **Aprendizaje:** verificar "el dato existe" (`GetCommand` del perfil) no acredita el flujo de aceptación (`login 200`); el criterio exigía el flujo.

### O-01 — Sesión Tester concurrente (observación de entorno, no hallazgo de producto)
- **Identificación:** `O-01 / entorno` · Severidad Nula (producto intacto).
- **Problema:** al redactar se hallaron artefactos `F05-H01-tester.*` de una sesión Tester concurrente (misma misión, Loop 1/3) con idéntico veredicto `NO-PASSED` y el mismo `P-01`; esa sesión registró mi actividad (usuario `tester.vivo@example.com`, scripts de diagnóstico en `temporary/`, consumo del cubo auth) como "ajena". Conforme a mi orden de misión, los ficheros se sustituyen por evidencia propia.
- **Causa (demostrada):** contenidos y marcas temporales de los ficheros hallados; coincidencia exacta del `createdAt` de mi alta API con su observación.
- **Solución e intentos fallidos:** ninguna; se documenta para explicar el intercalado (conteos, `429` observados por ambas partes) y la sustitución de ficheros.
- **Verificación / Pendientes / Aprendizaje:** dos verificaciones independientes convergen en `NO-PASSED` por `P-01` (refuerza el dictamen); —; ante concurrencia, contrastar por `createdAt`/contenidos antes de atribuir autoría.
- **Aprendizaje:** la convergencia de dos sesiones independientes en el mismo bloqueante reduce el riesgo de falso positivo del dictamen.

## 6. Notas de ámbito y cierre

- Sin cambios de código/tests/manifiestos/`STATE.md`/`tasks.md`; sin `git add/commit/push` (lo hace Architect); sin secretos ni rutas absolutas en artefactos (la credencial demo no se reproduce).
- G-7: `docker compose down` EXIT 0, red eliminada; solo queda el contenedor ajeno preexistente; puertos 3001/9297 cerrados; `temporary/` ausente.
- `npm audit` no se re-ejecuta (proporcionalidad: sin cambios de manifiestos; consta en `F05-H01-developer.md` §5/P-03 para el Auditor).
- **Dictamen: `NO-PASSED` (Loop 1/3)** por `P-01`. Re-verificación (loop 2/3) tras corrección: login demo `200 OK` + lotes visibles + re-seed idempotente.

---

## 7. Addendum — Loop 2/3 (append-only; no modifica el dictamen v1)

| Campo | Valor |
|---|---|
| **Harness / Loop** | `v1-addendum — Loop 2/3` (re-verifica SOLO `P-01`; veredicto global abajo) |
| **Riesgo / Gates** | `3 (Sensible)` · **G-7** Docker 2g/2.0 (apagado al terminar, verificado) · sin push (lo hace Architect) |
| **Dictamen global** | **`PASSED` (Loop 2/3)** — `CA-H01.2` certificado con evidencia propia; `P-01` corregido |
| **Fecha** | `2026-11-19` |

Evidencia propia de este loop (ninguna corrida del Developer se presenta como propia):
`evidence/F05-H01-tester-loop2-live.txt`, `evidence/F05-H01-tester-loop2-suite.txt`,
`evidence/F05-H01-tester-loop2-down.txt`. No hubo interferencia de la otra sesión
concurrente (emulador propio `healthy` durante toda la sesión; sin locks de Terraform).

### 7.1. Veredicto por criterio (`CA-H01`) — loop 2/3

| Criterio | Veredicto | Evidencia propia |
|---|---|---|
| **CA-H01.1** — seed en `DYNAMODB_TABLE_JOBS` | **PASSED** (sin cambios; se mantiene v1) | `npm run seed` imprime `Tabla DynamoDB: mediashrink-jobs` (pasadas 1 y 2) |
| **CA-H01.2** — `apply` → `seed` → login demo `200 OK` + lotes; re-seed idempotente | **PASSED** (`P-01` corregido) | `terraform apply` → **11 added**; seed 3/3/6 (0→12); login Ana/Bruno/Carla → **200** + `GET /jobs` 200 con su `demo-job-*` visible; 2.º seed 0 creados (12→12, mismos IDs); logins 200 de nuevo |
| **CA-H01.3a** — cabeceras + tope body, sin regresión | **PASSED** (evidencia v1 §3; superficie API intacta en loop 2, no re-ejecutado por alcance) | v1: 7/7 clases con cabeceras, 413 exacto, login válido 200 |
| **CA-H01.3b** — suite en verde | **PASSED** | typecheck/lint/build EXIT 0; **unit 310/310 (34 f.)**; **integration 102/102 (24 f.)** — incl. `F05-H01-loop2 — tras runSeed, findByEmail resuelve cada cuenta demo (índice USER#EMAIL)` |

### 7.2. Cierre de `P-01`

- **Estado:** CORREGIDO y verificado en vivo. `putUserIfAbsent` escribe perfil + índice
  `{userId: emailNormalizado, jobId: USER#EMAIL}` con `TransactWrite` condicional y
  asegura el índice en re-seed/legado (`putEmailIndexIfAbsent`).
- **Verificación propia:** las 3 cuentas demo hacen `POST /auth/login` → 200 y
  `GET /jobs` → 200 con exactamente su lote (`demo-job-ana/bruno/carla`), antes y
  después del re-seed. La mecánica coincide con el test TDD del Developer
  (`findByEmail` ×3, mayúsculas, `Get` directo sin `ttl`), que además pasa en la
  suite propia (102/102).
- **G-7:** `docker compose down` EXIT 0, red eliminada, puertos 3001/9297 cerrados
  (curl exit 7); contenedor ajeno preexistente intacto.
- **Sin cambios** de código/tests/manifiestos/`STATE.md`/`tasks.md`; sin `git add/commit/push`; sin secretos ni rutas absolutas en artefactos.

**Dictamen: `PASSED` (Loop 2/3).** No se activan más loops.
