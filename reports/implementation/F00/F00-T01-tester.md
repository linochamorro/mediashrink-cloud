# Reporte Tester (verificación independiente) — `F00-T01`

| Campo | Valor |
|---|---|
| **Tarea / Criterio** | `F00-T01` — `CA-01` (`.env.example` completo sin secretos reales; test unitario de carga/validación de configuración en verde con evidencia RED→GREEN) |
| **Fase / paquete** | Fase 0 — `P-00-foundation-and-emulator.md` |
| **Rol** | Tester independiente (riesgo 1, sin Auditor) |
| **Versión / Loop** | `v1 — Loop 1/3` (verificación inicial; no activo corrección) |
| **Fecha / ejecución** | 2026-11-17 · reejecución propia ~10:37 (Node 26.13.0 / npm 11.20.0, Vitest 2.1.9, win32) |
| **Dictamen global** | **`PASSED`** |

> No se presentan ejecuciones ajenas como propias: los tres comandos indicados abajo se reejecutaron y se guardaron en evidencias `F00-T01-tester-*`. Los archivos `F00-T01-red.txt` / `green.txt` del implementador se **revisan como registro cronológico**, no se atribuyen como corridas propias (el RED no es reproducible una vez existe el código final).

## 1. Dictamen por criterio

| Requisito / fuente | Comportamiento observable | Evidencia (propia del Tester) | Límite de cobertura | Estado |
|---|---|---|---|---|
| `CA-01` · `.env.example` completo — `task.md` §1, `spec.md` NFR-06/D-08/A-06, `plan.md` §4, `constitution.md` IN-07 | 27 variables presentes en 7 grupos: app (3), límites (3), JWT (4), rate limit (2), emulador (7), recursos (5), retención/worker (3). `RETENTION_DAYS=30`, `SQS_MAX_RETRIES=3`, `POLL_INTERVAL_MS=2000`, TTL en segundos con access < refresh. El test exige coincidencia exacta entre `ALL_ENV_KEYS` y las claves del archivo. | `evidence/F00-T01-tester-secrets.txt` (inventario y valores inspeccionados) + lectura directa de `.env.example` y `backend/src/config/index.ts` | Nombres de variables son propuesta del implementador derivada del SDD; `task.md` §2 no exige consumo real en Fase 1. No se valida conexión al emulador (CA-03/CA-04). | **PASSED** |
| `CA-01` · sin secretos reales (G-3 / PR-08 / NFR-06) | 0 hallazgos reales sobre 9 patrones (AKIA/ASIA, JWT `eyJ`, `ghp_`/`github_pat_`/`xox*`, hex ≥ 32, PRIVATE KEY, ruta Windows absoluta). Sin `.env` real. `AWS_ACCESS_KEY_ID=test`, `AWS_SECRET_ACCESS_KEY=test`; JWT con `REPLACE_WITH_LOCAL_DEV_SECRET_32_CHARS`. 6 coincidencias son fixtures sintéticas controladas del propio test. | `evidence/F00-T01-tester-secrets.txt` | Escaneo estático del contenido actual; sin historial Git que auditar (el directorio no es repo en este momento). Las fixtures del test se excluyen explícitamente por ser literales negativos deliberados. | **PASSED** |
| `CA-01` · test unitario en verde — `tests/unit/config.test.ts` | Reejecución propia: `npx vitest run tests/unit/config.test.ts` → **30/30 passed, EXITCODE=0**. Casos con expectativas sustantivas (conversiones, defaults, 13 valores inválidos, variable ausente/vacía, TTL incoherente, placeholders en producción, 4 patrones de secreto, parser `.env`, validación final del `.env.example`). Sin `it.skip`, `it.only`, `describe.skip`, `.todo` ni aserciones triviales (`expect(true)`). | `evidence/F00-T01-tester-vitest.txt` + inspección de `tests/unit/config.test.ts` | Cobertura **unitaria aislada**: acredita la lógica pura de carga/validación, no la integración HTTP/S3/SQS/DynamoDB (Fase 1/CA-03/CA-04). | **PASSED** |
| `CA-01` · evidencia RED→GREEN cronológica — `AGENTS.md` §4, `PR-05`, `tester.md` §2 | Registro revisado: `F00-T01-red.txt` (`Start at 10:31:24`, 30/30 failed, `EXITCODE=1`) muestra stubs `NOT_IMPLEMENTED` en `loadConfig`/`parseEnvFile`/`findRealSecretPattern`/`assertNoRealSecret` y fallos por **comportamiento** (`AssertionError: expected [Function] to throw ...`, excepción del stub), sin errores de sintaxis, compilación ni dependencias. `F00-T01-green.txt` (`10:32:32`, 30/30 passed, `EXITCODE=0`); `F00-T01-refactor.txt` (`10:32:56`, 30/30, sin cambios). Fechas de modificación: test `10:31:17` < RED `10:31:24` < loader final `10:32:25` < GREEN `10:32:32`: el test precede al código. | Revisión de `evidence/F00-T01-{red,green,refactor}.txt` + `Get-Item.LastWriteTime` (registrado en este reporte) | El RED **no puede reejecutarse** sin revertir el código (acción prohibida a Tester). El juicio se apoya en el registro cronológico y en la naturaleza de los fallos; no se inventa un RED no probado. | **PASSED** (registro íntegro) |
| `task.md` §4 · typecheck del alcance | Reejecución propia del comando exacto con flags CLI → **EXITCODE=0, 0 líneas de diagnóstico**. No se creó `tsconfig.json` (fuera de ámbito de `F00-T01`). | `evidence/F00-T01-tester-typecheck.txt` | Alcance limitado a `backend/src/config/index.ts` + `tests/unit/config.test.ts`; no cubre el resto del backend (aún no existe). | **PASSED** |
| `task.md` §3 · ámbito exclusivo y sin cambios laterales | Listado del raíz: no existen `frontend/`, `infra/`, `.github/`, `.gitignore`, `.env`, `package-lock.json` ni `tsconfig.json`. `STATE.md` (10:28:15) y `docs/sdd/tasks.md` (09:06:30) son anteriores al trabajo del implementador (10:31+): no fueron tocados. Únicos archivos nuevos/modificados: los permitidos más `temporary/F00-T01-secrets-audit.ps1`. Búsqueda de `F00-T01-secrets-audit`/`temporary/` en `*.ts,*.js,*.json,*.md`: **ninguna referencia en código de producto ni en tests**, solo documentación de roles/paquetes y el propio reporte del Developer. | Inspección de filesystem y `Get-Item.LastWriteTime`; búsqueda global por contenido (se detalla en este reporte) | Sin Git en el directorio, la verificación es por filesystem/mtimes y contenido, no por `git diff`. | **PASSED** |
| `F00-T01-P3` · aviso npm `postinstall` de `esbuild`, sin lockfile ni `tsconfig.json` | Vitest y `tsc` arrancan y pasan con exit 0; el aviso no impide ni degenera ningún gate de `CA-01`. | `evidence/F00-T01-tester-vitest.txt`, `evidence/F00-T01-tester-typecheck.txt` | No se aprueba el script ni se versiona lockfile: competencia de `F00-T02`/`F00-T06`. | **SEGUIMIENTO** (riesgo residual; **no bloqueante**, no cuenta como incumplimiento) |

## 2. Veredicto global

**`PASSED`**.

`CA-01` está satisfecho con ejecución propia independiente: 30/30 tests en verde, typecheck limpio, `.env.example` completo y sin secretos reales, cronología RED→GREEN demostrada por comportamiento (no por sintaxis) y ámbito de escritura respetado. Los registros del implementador son íntegros y coherentes con los hallazgos propios. No hay hallazgos bloqueantes críticos ni altos, ni revisiones de Auditor pendientes para esta tarea (riesgo 1).

No se emite aprobación condicional: P3 se registra como riesgo residual para `F00-T02`/`F00-T06`, sin afectar este dictamen. Este Tester **no activa loops**; Architect decide el cierre con `F00-T01-architect.md`.

## 3. Riesgo residual / SEGUIMIENTO (no bloqueante)

- **P3 — `esbuild` `postinstall` / lockfile / `tsconfig.json`:** npm 11.20.0 avisó de un script de instalación no aprobado; el binario ya era utilizable y la suite pasó. Se recomienda a `F00-T02`/`F00-T06` decidir la aprobación explícita del script y el versionado de `package-lock.json`, y definir `tsconfig.json` en el momento oportuno. Aprendizaje **SOLO_LOCAL**: con npm 11, verificar que Vitest arranca tras `install --no-package-lock` antes de dar por buena la instalación.

## 4. Evidencias propias generadas

- `reports/implementation/F00/evidence/F00-T01-tester-vitest.txt`
- `reports/implementation/F00/evidence/F00-T01-tester-typecheck.txt`
- `reports/implementation/F00/evidence/F00-T01-tester-secrets.txt`

## 5. Límites y prohibiciones observadas

No se editaron código de producto, tests, `.env.example`, `package.json`, documentación de implementación ni el reporte del Developer. No se usaron Git/GitHub ni Docker. No se escribieron secretos ni valores de `.env` reales en reportes o logs; los únicos valores impresos son marcadores públicos (`REPLACE_WITH_…`, `test`/`test`). Todo el trabajo se confinó a la raíz autorizada y a los dos destinos de escritura permitidos para este rol.

---

## ADDENDUM A-03 (append-only) — Re-verificación independiente del hallazgo A-03

| Campo | Valor |
|---|---|
| **Fecha / ejecución** | `2026-11-17` · reejecución propia ~16:06 (Node 26.13.0 / npm 11.20.0 / Vitest 2.1.9 / win32) |
| **Motivo** | Hallazgo `A-03` (MEDIUM) de `reports/audits/F00/F00-T03-auditor.md` §3/§5: `.env.example` declaraba SQS/DLQ en `:9324` y credenciales fijas `test`/`test`, incompatibles con `aws/aws-emulator`. Addendum autorizado por CTO en `STATE.md` §1/§2. |
| **Rol / alcance** | Tester independiente · alcance de verificación: `.env.example`, `backend/src/config/index.ts`, `tests/unit/config.test.ts`, evidencias del Developer y su addendum en `F00-T01-developer.md`. |
| **Conservación** | **Append-only:** el dictamen `PASSED` de v1 (§1–§5, líneas 1–46) se conserva íntegro. Se añade este addendum al final sin borrar ni reescribir nada. |
| **Estado del addendum** | **`PASSED`** (sin degradación de `CA-01`). **No se cierra la tarea ni se activan loops**: corresponde al Architect decidir. |

> Independencia: los tres comandos indicados se **reejecutaron por este Tester** y sus salidas se guardaron en `F00-T01-A03-tester-*.txt`. No se presentan corridas del Developer como propias; sus evidencias (`red`/`green`/`refactor`/`emulator-probe`) se revisan **como registro cronológico y justificación documental**, no se atribuyen como ejecuciones propias.

### A.1 Dictamen por criterio

| Criterio verificado | Comportamiento observable (evidencia propia salvo indicado) | Evidencia | Estado |
|---|---|---|---|
| `A-03` · **0 apariciones de `:9324`** en la config consumible | 0 valores activos de `.env.example` contienen `:9324`. El loader conserva `:9324` ×2 como patrón de detección/mensaje y el test ×7 en casos negativos: ambos son esperados (la prohibición aplica al valor consumido, no al detector). | `F00-T01-A03-tester-config.txt` C2 | **PASSED** |
| `A-03` · **sin credenciales AWS fijas** | `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_PROFILE` no aparecen como variables activas. `AWS_SHARED_CREDENTIALS_FILE=./.local/aws-emulator/emulator_credentials`, `AWS_CONFIG_FILE=./.local/aws-emulator/config` (rutas relativas `./.local/aws-emulator/…`) y `AWS_EC2_METADATA_DISABLED=true`. `AWS_ACCOUNT_ID=000000000000` se conserva (ID fijo, no secreto). El loader expone `sharedCredentialsFile`/`configFile`/`ec2MetadataDisabled` y **no** expone `accessKeyId`/`secretAccessKey`. | `F00-T01-A03-tester-config.txt` C3/C4; lectura de `index.ts` y `config.test.ts` | **PASSED** |
| `A-03` · **SQS/DLQ HTTPS y formato real del emulador**, coherente con `AWS_ENDPOINT_URL` | `SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/000000000000/mediashrink-jobs` y `SQS_DLQ_URL=…/mediashrink-jobs-dlq`, ambas HTTPS y con el formato canónico; `AWS_ENDPOINT_URL=https://127.0.0.1:9297` como transporte. Se **acepta el formato sin `:9297` literal en la QueueUrl**: el Developer lo justifica con documentación del mantenedor + sonda SigV4 real (`CreateQueue` HTTP 200 devolviendo esa QueueUrl; `SendMessage` HTTP 200 contra `https://127.0.0.1:9297`) en `F00-T01-A03-emulator-probe.txt`. No se exige el literal `:9297` en la QueueUrl. | `F00-T01-A03-tester-config.txt` C5; revisión de `F00-T01-A03-emulator-probe.txt` (justificación, no corrida propia) | **PASSED** |
| `CA-01` (no degradado) · **28 variables** | 28 variables activas en `.env.example` (27 originales − 2 credenciales fijas + 3 de archivos/metadatos). Inventario exacto entre `ALL_ENV_KEYS` y el archivo, sin sobrantes ni ausentes. | `F00-T01-A03-tester-config.txt` C1; test `los nombres del archivo coinciden exactamente con el inventario` | **PASSED** |
| `CA-01` · **35/35 tests en verde, sin skip/only** | Reejecución propia: `npx vitest run tests/unit/config.test.ts` → **35 passed (35), EXITCODE=0** (30 originales + 5 de regresión). 0 marcadores `it/describe/test.(skip|only|todo)`. | `F00-T01-A03-tester-vitest.txt`; `F00-T01-A03-tester-config.txt` C8 | **PASSED** |
| `task.md` §4 · **typecheck limpio** | Reejecución propia del comando exacto con flags CLI → **EXITCODE=0, sin diagnósticos**. | `F00-T01-A03-tester-typecheck.txt` | **PASSED** |
| G-3 · **sin secretos reales ni rutas Windows absolutas** | 0 patrones de secreto real (AKIA/ASIA, JWT `eyJ`, `ghp_`/GitHub, hex≥32, PRIVATE KEY) en valores activos; 0 rutas `[A-Za-z]:\\` en los 3 archivos. Los literales `AKIA…`/`eyJ…`/`ghp_…` del test son fixtures negativas deliberadas. | `F00-T01-A03-tester-config.txt` C6/C7 | **PASSED** |
| Addendum del Developer · **7 campos en P1/P2** | `F00-T01-A03-P1` y `F00-T01-A03-P2` contienen cada uno los 7 campos obligatorios (Identificación, Problema, Causa, Solución e intentos fallidos, Verificación, Pendientes, Aprendizaje candidato). | Lectura de `F00-T01-developer.md` §A.5 | **PASSED** |
| Addendum del Developer · **cronología RED → GREEN → REFACTOR** | `F00-T01-A03-red.txt`: **7 failed / 28 passed (35)**, todos por comportamiento (`expected undefined to be…`, `expected [Function] to throw…`, `not.toContain(':9324')`, comparación de QueueUrl), sin errores de sintaxis/compilación/dependencias; `Start at 16:01:14`, `EXITCODE=1`. `green.txt`: **35/35**, `Start at 16:02:03`, `EXITCODE=0`. `refactor.txt`: **35/35**, `Start at 16:03:30`, `EXITCODE=0`. Cronología interna coherente; el RED no es reproducible sin revertir código (acción prohibida). | Revisión de `F00-T01-A03-{red,green,refactor}.txt` (registro, no corrida propia) | **PASSED** (registro íntegro) |
| Addendum del Developer · **no reescritura del contenido previo** | `F00-T01-developer.md` conserva íntegro el reporte v1 (líneas 1–123) y añade el addendum tras `---` (línea 125+). `F00-T01-tester.md` conserva íntegro el `PASSED` de v1 (líneas 1–46). El addendum del Developer modifica solo los cinco archivos de su ámbito declarado. | Lectura directa de ambos reportes | **PASSED** |

### A.2 Veredicto global del addendum

**`PASSED`.** El hallazgo `A-03` (MEDIUM) queda corregido sin degradar `CA-01`: 0 usos de `:9324` en la configuración consumible, sin credenciales AWS fijas, mecanismo de archivos generados del emulador presente, SQS/DLQ HTTPS con el formato real devuelto por el emulador y `AWS_ENDPOINT_URL=:9297` como transporte, 28 variables, 35/35 tests en verde con ejecución propia, typecheck limpio y G-3 sin secretos ni rutas Windows absolutas. Cronología RED→GREEN→REFACTOR y campos de problemas del Developer íntegros; contenido previo de ambos reportes conservado.

No se emite aprobación condicional ni se activan loops. El cierre de `F00-T01` y la decisión sobre el addendum corresponden al **Architect**.

### A.3 Observación para `F00-T03` (NO es `NO-PASSED` de este addendum)

El Developer documentó (`F00-T01-developer.md` §A.5 P1 y `F00-T01-A03-emulator-probe.txt` §2) que `docker compose up -d` falló en este harness con `emulator serve failed: server I/O error: Operation not permitted (os error 1)`, presuntamente por permisos del bind mount `./.local/aws-emulator` con `user: 1000:1000`; verificó el emulador con un `docker run` aislado (límites G-7 2g/2.0, volumen named, `health=healthy`) y limpió el contenedor/volumen. **Este Tester no levantó Docker** (no era obligatorio: ya existe la sonda del Developer) y **no lo registra como incumplimiento de `A-03`**: se traslada como **observación para `F00-T03`**, donde corresponde decidir sobre el montaje/`user` del compose. Tampoco se reabre aquí `CA-03`.

### A.4 Evidencias propias generadas por este Tester

- `reports/implementation/F00/evidence/F00-T01-A03-tester-vitest.txt` (35/35, EXITCODE=0; secuencias ANSI y ruta absoluta redactadas, resultados intactos)
- `reports/implementation/F00/evidence/F00-T01-A03-tester-typecheck.txt` (EXITCODE=0, sin diagnósticos)
- `reports/implementation/F00/evidence/F00-T01-A03-tester-config.txt` (auditoría G-3/A-03 propia, C1–C8)

### A.5 Límites y prohibiciones observadas en el addendum

No se editaron código, tests, `.env.example`, `package.json`, documentación ni el reporte del Developer. Solo se escribió este addendum append-only en `F00-T01-tester.md` y las tres evidencias `F00-T01-A03-tester-*` listadas. No se usaron Git/GitHub ni Docker. No se escribieron secretos ni rutas Windows absolutas en reportes o logs (la ruta del proyecto se redactó como `<PROJECT_ROOT>` en la evidencia de Vitest). Todo el trabajo se confinó a la raíz autorizada.
