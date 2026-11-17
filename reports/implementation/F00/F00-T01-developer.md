# Reporte Developer — `F00-T01`

| Campo | Valor |
|---|---|
| **Tarea** | `F00-T01` — `.env.example` y validación de configuración |
| **Fase / paquete** | Fase 0 — `P-00-foundation-and-emulator.md` |
| **Rol** | Developer (subagente delegado) |
| **Versión / Loop** | `v1 — Loop 1/3` |
| **Riesgo** | 1 (Ordinario) · Verificador: Tester (sin Auditor) |
| **Estado final** | `DONE_WITH_CONCERNS` (concerns no bloqueantes para CA-01; detallados en §6) |
| **Fecha** | 2026-11-17 |

> No se emite `PASSED` ni se cierra la tarea: corresponden al Tester y al Architect.

## 1. Fuentes leídas (obligatorias, todas reales)

- `AGENTS.md` (raíz) — reglas locales, gates G-3/G-6/G-6b/G-7, confinamiento.
- `STATE.md` — fase actual, tarea autorizada `F00-T01`..`F00-T06`.
- `.agents/roles/developer.md` — contrato del rol (TDD, evidencia, 7 campos, límites).
- `docs/sdd/packages/P-00-foundation-and-emulator.md` — ámbito, `CA-01`, DoR/DoD.
- `docs/sdd/constitution.md` — PR-08, IN-07, PR-05.
- `docs/sdd/spec.md` — NFR-06, D-08, A-06, modelo de datos y contratos.
- `docs/sdd/plan.md` — §2 estructura, §4 validación/privacidad, §5 pruebas.
- `reports/implementation/F00/F00-T01-task.md` — **fuente de verdad de alcance**.

Nota: `docs/sdd/tasks.md` no figuraba en la lista de lectura obligatoria del encargo y no se modificó (está expresamente prohibido).

## 2. Criterio `CA-01` y cobertura

**CA-01:** `.env.example` completo sin secretos reales; test unitario de carga/validación de configuración en `tests/unit/` en verde con evidencia RED→GREEN.

Inventario de 27 variables cubiertas en `.env.example` y en `ALL_ENV_KEYS` (el test exige coincidencia exacta de nombres, sin sobrantes ni ausentes):

| Grupo | Variables |
|---|---|
| App | `NODE_ENV`, `PORT`, `CORS_ORIGIN` |
| Límites (D-08, IN-07) | `MAX_FILE_SIZE_MB`, `MAX_IMAGES_PER_BATCH`, `MAX_PIXELS` |
| JWT (D-06, A-02) | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL` |
| Rate limit (A-06) | `RATE_LIMIT_AUTH_MAX`, `RATE_LIMIT_AUTH_WINDOW_MS` |
| Emulador (ADR-001) | `AWS_REGION`, `AWS_ENDPOINT_URL`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ACCOUNT_ID`, `USE_SSL`, `CA_BUNDLE_PATH` |
| Recursos | `S3_BUCKET_RAW`, `S3_BUCKET_OPTIMIZED`, `SQS_QUEUE_URL`, `SQS_DLQ_URL`, `DYNAMODB_TABLE_JOBS` |
| Retención / worker (D-09, D-10, D-15) | `RETENTION_DAYS=30`, `SQS_MAX_RETRIES=3`, `POLL_INTERVAL_MS=2000` |

Seguridad (G-3): secretos JWT como `REPLACE_WITH_LOCAL_DEV_SECRET_32_CHARS`; credenciales del emulador `test`/`test` y cuenta `000000000000`; sin `.env` real, sin tokens ni rutas absolutas.

Nota de diseño (no decisión de producto): los TTL se expresan en **segundos** y se exige `JWT_ACCESS_TTL < JWT_REFRESH_TTL`. Fase 1 podrá consumir estos valores sin cambiar nombres.

## 3. Cronología SDD + TDD

| Paso | Acción | Resultado | Evidencia |
|---|---|---|---|
| 0. Andamiaje | `package.json` mínimo (Vitest + TypeScript; `@types/node` añadido después) + `npm install --no-package-lock` | 45 paquetes, exit 0 | — |
| 1. **RED** | Test de 30 casos escrito **antes** del loader; stub con `NOT_IMPLEMENTED` | exit 1, **30/30 fallan** por comportamiento no implementado (no por sintaxis ni dependencias) | `reports/implementation/F00/evidence/F00-T01-red.txt` |
| 2. **GREEN** | `.env.example` completo + loader real (`backend/src/config/index.ts`) | 1er intento 29/30 (ver problema P1); tras corrección exit 0, **30/30 pasan** | `reports/implementation/F00/evidence/F00-T01-green.txt` |
| 3. **REFACTOR** | Evaluación de simplificaciones: sin cambios (funciones puras, patrones centralizados, expectativas intactas); reejecución | exit 0, 30/30 | `reports/implementation/F00/evidence/F00-T01-refactor.txt` |
| 4. Typecheck | `tsc --noEmit` sobre el alcance con flags CLI (no se creó `tsconfig.json`: fuera de ámbito) | exit 0, sin salida | `reports/implementation/F00/evidence/F00-T01-typecheck.txt` |
| 5. Auditoría G-3 | Escaneo de patrones de credencial real sobre los 8 archivos creados/modificados | 0 hallazgos reales; 6 fixtures sintéticas controladas | `reports/implementation/F00/evidence/F00-T01-env-audit.txt` |

Cobertura del test (30 casos): carga válida y conversiones; defaults seguros para opcionales; `USE_SSL=false`/`NODE_ENV=test`; variable ausente y vacía; 13 valores inválidos (incluye `1e3`, `1.5`, `-1`, `70000`, `maybe`, `staging`); TTL incoherente; placeholders en producción; 4 patrones de secreto real; marcadores locales permitidos; 2 rechazos vía `loadConfig`; parser de `.env`; cobertura exacta, ausencia de secretos y validación final del propio `.env.example`.

## 4. Comandos ejecutados

| Comando | Resultado |
|---|---|
| `npm install --no-package-lock --no-audit --no-fund` | exit 0 · 45 paquetes |
| `npx vitest --version` | exit 0 · `vitest/2.1.9 win32-x64 node-v26.13.0` |
| `npx vitest run tests/unit/config.test.ts` (RED) | exit 1 · 30 failed |
| `npx vitest run tests/unit/config.test.ts` (GREEN) | exit 0 · 30 passed |
| `npx vitest run tests/unit/config.test.ts` (REFACTOR) | exit 0 · 30 passed |
| `npm install --save-dev @types/node --no-package-lock --no-audit --no-fund` | exit 0 · 2 paquetes |
| `npx tsc --noEmit --strict --target es2022 --module esnext --moduleResolution bundler --skipLibCheck --types node backend/src/config/index.ts tests/unit/config.test.ts` | exit 0 · sin diagnósticos |
| `& ./temporary/F00-T01-secrets-audit.ps1` (efímero; sin dependencias de producto) | 0 hallazgos reales · G-3 cumplido |

## 5. Archivos creados / modificados (todos dentro del ámbito)

- `.env.example` — reemplazado por el inventario completo alineado al SDD.
- `package.json` — versionamiento mínimo temporal (`devDependencies`: vitest, typescript, @types/node; scripts `test:unit`, `typecheck`). F00-T02 lo ampliará.
- `backend/src/config/index.ts` — loader con validación, defaults, conversiones y detección de secretos. Sin esquemas Zod de dominio (Fase 1).
- `tests/unit/config.test.ts` — 30 casos permanentes.
- `reports/implementation/F00/evidence/F00-T01-{red,green,refactor,typecheck,env-audit}.txt`.
- `reports/implementation/F00/F00-T01-developer.md` — este reporte.
- `temporary/F00-T01-secrets-audit.ps1` — script efímero de auditoría (no es dependencia de producto ni de tests; se conserva para reproducibilidad hasta el borrado de `temporary/` en Fase Final).

**No se tocó:** `.env`, `frontend/`, `infra/terraform/`, `.github/`, `.gitignore`, `STATE.md`, `docs/sdd/tasks.md`, reportes de otros roles. **No se usaron** Git/GitHub ni Docker. **No se crearon** `package-lock.json`, `tsconfig.json` ni `.env` real.

## 6. Problemas registrados (7 campos obligatorios)

### `F00-T01-P1` — Placeholder JWT no rechazado en producción

1. **Identificación:** `F00-T01-P1` (detectado en el primer GREEN).
2. **Problema:** El caso `rechaza placeholders de JWT cuando NODE_ENV=production` falló con `AssertionError: expected [Function] to throw an error`; los otros 29 pasaron.
3. **Causa:** **DEMOSTRADA.** El regex `^(?:REPLACE_WITH_|CHANGE_ME|YOUR_|<.*>$|test|...|sample)$` anclaba `$` a toda la alternancia, así que `REPLACE_WITH_LOCAL_DEV_SECRET_32_CHARS` no calzaba como placeholder; y al ser todo mayúsculas, dígitos y `_`, tampoco coincidía con los patrones de secreto real (que exigen minúsculas o formato hex/JWT). Resultado: `loadConfig` no lanzaba en `production`.
4. **Solución e intentos fallidos:** Se sustituyó el regex único por `LOCAL_PLACEHOLDER_PREFIX_PATTERN = /^(?:REPLACE_WITH_|CHANGE_ME|YOUR_)/i` y `LOCAL_PLACEHOLDER_EXACT_PATTERN = /^(?:<.*>|test|dummy|local|example|dev|dev-only|replace-me|placeholder|fake|sample)$/i`, combinados en `isLocalPlaceholder`. No hubo intentos de parche a ciegas: se inspeccionó el regex y el mensaje de error antes de cambiar código.
5. **Verificación:** `npx vitest run tests/unit/config.test.ts` → exit 0, 30/30; `tsc --noEmit` → exit 0. Evidencia: `F00-T01-green.txt`, `F00-T01-typecheck.txt`.
6. **Pendientes:** Ninguno para `CA-01`.
7. **Aprendizaje candidato:** **PROPUESTA_GLOBAL** — en detectores de placeholders, tratar `REPLACE_WITH_` / `CHANGE_ME` / `YOUR_` como prefijo comodín (no token exacto); aplicar también cuando Fase 1 valide secretos JWT.

### `F00-T01-P2` — Falsos positivos en la auditoría de secretos

1. **Identificación:** `F00-T01-P2` (auditoría G-3).
2. **Problema:** El primer escaneo reportó 5 hallazgos y veredicto `REVISAR`: 4 literales sintéticos del test y 1 identifier camelCase (`jwtAccessSecret =`) del loader.
3. **Causa:** **DEMOSTRADA.** Patrones demasiado amplios (`[A-Fa-f0-9]{32,}` y `(PASSWORD|SECRET|...)\s*=\s*` sin anclaje a sintaxis `.env`), que capturaban fixtures negativas deliberadas y asignaciones de código.
4. **Solución e intentos fallidos:** Se acotó la asignación a `^\s*(export\s+)?CLAVE_MAYUSCULAS_CON_SECRETO\s*=\s*valor` con lookahead negativo de marcadores y se añadió lista blanca explícita de las 4 fixtures del test. **Intento fallido intermedio:** usar `[A-Z][A-Z0-9_]{3,}` como nombre generó 115 falsos positivos (cualquier constante mayúscula: `NODE_ENV=`, `EXITCODE=`, ...), descartado. El refinamiento quedó documentado en la evidencia sin borrar el escaneo inicial.
5. **Verificación:** 0 hallazgos reales, 6 fixtures controladas, veredicto final `SIN HALLAZGOS REALES — G-3 CUMPLIDO`. Evidencia: `F00-T01-env-audit.txt`.
6. **Pendientes:** Ninguno.
7. **Aprendizaje candidato:** **PROPUESTA_GLOBAL** — los escáneres de secretos en CI deben anclarse a sintaxis `.env` y mantener lista blanca de fixtures negativas; documentar los falsos positivos en lugar de ocultarlos.

### `F00-T01-P3` — Aviso de npm sobre script `postinstall` de `esbuild`

1. **Identificación:** `F00-T01-P3` (instalación de dependencias).
2. **Problema:** npm 11.20.0 advirtió: `1 package has install scripts not yet covered by allowScripts: esbuild@0.21.5 (postinstall: node install.js)`.
3. **Causa:** **HIPÓTESIS.** npm 11 incorpora un mecanismo de aprobación de scripts de instalación; el binario nativo de esbuild para win32-x64 ya era utilizable, por lo que Vitest arrancó sin ejecutar el `postinstall`.
4. **Solución e intentos fallidos:** No se requirió intervención. Se verificó `npx vitest --version` (exit 0) y la suite completa (30/30). No se aprobó el script porque no está autorizado explícitamente en el alcance de esta tarea.
5. **Verificación:** evidencia `F00-T01-green.txt` y `F00-T01-refactor.txt` (exit 0 en ambos).
6. **Pendientes:** No bloqueantes para `CA-01`. F00-T02/F00-T06 pueden decidir si aprueban `esbuild` y si versionan `package-lock.json` (aquí se omitió con `--no-package-lock` para no escribir fuera del ámbito exclusivo).
7. **Aprendizaje candidato:** **SOLO_LOCAL** — con npm 11, comprobar que Vitest arranca tras `install --no-package-lock` antes de dar por buena la instalación; dejar la aprobación de scripts a la tarea de tooling.

## 7. Estado final y handoff

- **Estado:** `DONE_WITH_CONCERNS`. `CA-01` está cubierto: RED → GREEN → REFACTOR con evidencia, 30/30 tests en verde, typecheck limpio y auditoría G-3 sin hallazgos reales.
- **Concerns (no bloqueantes):** P3 (aviso de `esbuild` / ausencia deliberada de lockfile y `tsconfig.json`, competencia de F00-T02 y F00-T06).
- **A continuación:** el **Tester** debe reejecutar de forma independiente y emitir `F00-T01-tester.md` con `PASSED`/`NO-PASSED`; el **Architect** revisará la evidencia y cerrará con `F00-T01-architect.md`. Este agente no aprueba su propio trabajo.

---

## ADDENDUM A-03 (append-only) — Alineación de `.env.example` con el emulador

| Campo | Valor |
|---|---|
| **Fecha** | `2026-11-17` |
| **Motivo** | Hallazgo `A-03` (MEDIUM) de `reports/audits/F00/F00-T03-auditor.md` §3/§5: `.env.example` declaraba SQS/DLQ en `:9324` y credenciales fijas `test`/`test`, incompatibles con `aws/aws-emulator` (único puerto `9297`, credenciales regeneradas en cada arranque). Autorizado por el CTO en `STATE.md` §1/§2. |
| **Tarea / paquete** | Addendum de `F00-T01` (tarea cerrada como `PASSED`; no se reabren otras decisiones) · Fase 0 · `P-00-foundation-and-emulator.md` |
| **Rol** | Developer (subagente delegado) |
| **Ámbito escrito** | `.env.example`, `backend/src/config/index.ts`, `tests/unit/config.test.ts`, `reports/implementation/F00/evidence/F00-T01-A03-*.txt` y este addendum. Nada más. |
| **Estado del addendum** | `DONE_WITH_CONCERNS` (concern no bloqueante: el `docker-compose.yml` de `F00-T03` no arranca en este harness por permisos del bind mount; fuera del alcance de este addendum y sin modificarlo). **No se emite `PASSED` ni se cierra la tarea**: corresponde al Tester re-verificar y al Architect decidir. |

### A.1 Cambios exactos en `.env.example` (antes → después)

| Variable | Antes | Después |
|---|---|---|
| `AWS_ACCESS_KEY_ID` | `test` | **eliminada** (las variables de entorno tienen prioridad sobre el archivo generado) |
| `AWS_SECRET_ACCESS_KEY` | `test` | **eliminada** (ídem) |
| `AWS_SHARED_CREDENTIALS_FILE` | — | `./.local/aws-emulator/emulator_credentials` |
| `AWS_CONFIG_FILE` | — | `./.local/aws-emulator/config` |
| `AWS_EC2_METADATA_DISABLED` | — | `true` |
| `AWS_ACCOUNT_ID` | `000000000000` | `000000000000` (sin cambio: account ID fijo del emulador, no secreto) |
| `AWS_ENDPOINT_URL` | `https://127.0.0.1:9297` | sin cambio (transporte al emulador) |
| `SQS_QUEUE_URL` | `http://127.0.0.1:9324/queue/mediashrink-jobs` | `https://sqs.us-east-1.amazonaws.com/000000000000/mediashrink-jobs` |
| `SQS_DLQ_URL` | `http://127.0.0.1:9324/queue/mediashrink-jobs-dlq` | `https://sqs.us-east-1.amazonaws.com/000000000000/mediashrink-jobs-dlq` |

Se añadieron comentarios explicativos: (1) no definir `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`/`AWS_PROFILE`; (2) las QueueUrl conservan el host AWS estándar y el tráfico se enruta con `AWS_ENDPOINT_URL`; el SDK JS v3 debe usar `useQueueUrlAsEndpoint:false`; (3) no existe el puerto `9324`. Inventario: 27 → **28 variables activas** (sin secretos reales, sin rutas absolutas).

### A.2 Formato de SQS elegido y justificación

**Elegido:** `https://sqs.us-east-1.amazonaws.com/000000000000/<nombre-de-cola>` (con `AWS_ENDPOINT_URL=https://127.0.0.1:9297` para el transporte).

**Fuentes (sin formato inventado):** documentación del mantenedor de la imagen usada en el compose (`xsavikx.github.io/aws-emulator-docker`: "the emulator returns queue URLs with the real AWS host"; cuenta `000000000000`; `useQueueUrlAsEndpoint:false` en SDK JS v3), artículo de DevelopersIO con la salida literal de `aws sqs create-queue`, el compose (L12–14) y el runbook (§1.3). Además se **verificó empíricamente** contra el emulador 1.0.491.1 en ejecución: `CreateQueue` devolvió exactamente esas dos URLs y `SendMessage` con esa QueueUrl respondió HTTP 200 enviando la petición a `https://127.0.0.1:9297`. Detalle completo en `evidence/F00-T01-A03-emulator-probe.txt`.

**Matiz documentado:** la recomendación literal del auditor decía "apuntar SQS/DLQ a `https://127.0.0.1:9297`"; la evidencia demuestra que `9297` es el **endpoint de transporte** (`AWS_ENDPOINT_URL`) y no el host de la QueueUrl. Escribir `:9297` en `SQS_QUEUE_URL` fabricaría una QueueUrl que el emulador no devuelve y contradiría el valor que consume Terraform/Fase 1. Se elige el formato verificado y se documenta la diferencia para evitar una corrección inversa posterior.

### A.3 Cronología SDD + TDD (RED → GREEN → REFACTOR)

| Paso | Acción | Resultado | Evidencia |
|---|---|---|---|
| 0. Investigación | Lectura de fuentes + arranque aislado del emulador con límites G-7 y sonda SigV4; apagado y borrado del volumen | Formato y credenciales confirmados; sin secretos impresos | `F00-T01-A03-emulator-probe.txt` |
| 1. **RED** | Se ajustaron los 30 tests existentes a los nuevos nombres/valores y se añadieron 5 tests de regresión (35 total) **antes** de tocar `.env.example` ni el loader | exit 1 · **7 fallan por comportamiento**, 28 pasan (ningún fallo por sintaxis ni dependencias) | `F00-T01-A03-red.txt` |
| 2. **GREEN** | `.env.example` corregido; loader con `assertNoRetiredEmulatorPort` y `assertHttpsUrl`; nuevos campos `sharedCredentialsFile`/`configFile`/`ec2MetadataDisabled` y retirada de `accessKeyId`/`secretAccessKey` | exit 0 · **35/35 pasan** | `F00-T01-A03-green.txt` |
| 3. **REFACTOR** | Evaluación: sin cambios (validadores puros y centralizados; literales de configuración deliberadamente explícitos en plantilla y tests para no debilitar la comparación documental). Reejecución | exit 0 · **35/35 pasan** | `F00-T01-A03-refactor.txt` |
| 4. Typecheck | `npx tsc --noEmit --strict ...` sobre `backend/src/config/index.ts` y `tests/unit/config.test.ts` | exit 0 · sin diagnósticos | `F00-T01-A03-typecheck.txt` |
| 5. Coherencia G-3 | Conteo de variables activas, búsqueda de `:9324`, credenciales fijas, patrones de secreto y rutas Windows absolutas | 28 variables · 0 valores con `:9324` · 0 credenciales fijas activas · 0 rutas absolutas | `F00-T01-A03-g3-audit.txt` |

Los 30 tests originales se conservan; sus expectativas se actualizaron a los nuevos nombres/valores (no se eliminó ni debilitó ninguna aserción) y se añadieron 5 casos: default de archivos de credenciales, exposición en `AppConfig`, rechazo de `:9324`, rechazo de SQS sin HTTPS y coherencia de `.env.example` con `:9297`/QueueUrls.

### A.4 Tabla de comandos

| Comando (ruta del Docker CLI provista por el harness) | Resultado |
|---|---|
| `docker compose up -d` | exit 1 · `emulator serve failed: server I/O error: Operation not permitted` (permisos del bind mount con `user: 1000:1000` en este harness) |
| `docker compose down --volumes` | contenedor y red eliminados; sin cambios en `docker-compose.yml` |
| `docker run -d --name a03-verify --memory=2g --memory-swap=2g --cpus=2.0 -p 127.0.0.1:9297:9297 -e EMULATOR_TELEMETRY=off -e EMULATOR_HEALTHCHECK_PORT=9297 -v a03-verify-data:/home/emulator/.aws/emulator ghcr.io/xsavikx/aws-emulator:1.0.491.1 -p 9297` | container id · `health=healthy` |
| Sonda SigV4 efímera (fuera del repositorio, sin secretos impresos) | `CreateQueue`/`CreateQueueDLQ` HTTP 200 con las QueueUrls elegidas; `SendMessage` HTTP 200 en `https://127.0.0.1:9297` |
| `docker rm -f a03-verify` + `docker volume rm a03-verify-data` | limpieza; `docker ps -a` y `docker volume ls` sin rastro |
| `npx vitest run tests/unit/config.test.ts` (RED) | exit 1 · 7 failed / 28 passed (35) |
| `npx vitest run tests/unit/config.test.ts` (GREEN) | exit 0 · 35 passed |
| `npx vitest run tests/unit/config.test.ts` (REFACTOR) | exit 0 · 35 passed |
| `npx tsc --noEmit --strict --target es2022 --module esnext --moduleResolution bundler --skipLibCheck --types node backend/src/config/index.ts tests/unit/config.test.ts` | exit 0 · sin diagnósticos |
| Escaneo de coherencia G-3 (PowerShell sobre los 3 archivos de alcance) | 28 vars · 0 `:9324` · 0 credenciales fijas · 0 rutas absolutas |

### A.5 Problemas registrados (7 campos obligatorios)

#### `F00-T01-A03-P1` — El compose no arranca en este harness por permisos del bind mount

1. **Identificación:** `F00-T01-A03-P1` · addendum A-03 · fecha `2026-11-17` · entorno Windows, Docker Desktop 29.9.3 · fuente: salida de `docker compose up -d` y `docker logs mediashrink-aws-emulator`.
2. **Problema:** `docker compose up -d` creó el contenedor pero el proceso terminó con `emulator serve failed: server I/O error: Operation not permitted (os error 1)`; el healthcheck quedó `unhealthy` y `docker compose ps` no mostró el servicio en ejecución.
3. **Causa:** **HIPÓTESIS (alta).** El compose fija `user: "${UID_GID:-1000:1000}"` con un bind mount `./.local/aws-emulator:/home/emulator/.aws/emulator/9297`; en este harness la carpeta creada en Windows no es escribible por ese UID, reproduciendo el caso documentado "Permission denied on rootless Docker" de la documentación del mantenedor. No se modificó el compose: es propiedad de `F00-T03` y está fuera del alcance del addendum.
4. **Solución e intentos fallidos:** para la investigación se sustituyó el bind mount por un **volumen named** y se omitió `--user` en un `docker run` aislado con los mismos límites G-7; arrancó `healthy` en ~3 s. Intentos fallidos: el `up` del compose (único); no se reintentó con permisos cambiados para no salir del alcance. El `up` fallido creó `.local/aws-emulator/` vacío en el árbol del proyecto; se eliminó junto con `.local/` (ambos vacíos) para no dejar artefactos fuera del ámbito.
5. **Verificación:** `CreateQueue`, `CreateQueueDLQ` y `SendMessage` respondieron HTTP 200; evidencia `F00-T01-A03-emulator-probe.txt`. Limpieza: `docker rm -f` + `docker volume rm`.
6. **Pendientes:** `F00-T03`/Tester deben decidir si ajustan el montaje o el `user` del compose en su propia tarea; **no** se abre aquí. Concern no bloqueante para el addendum.
7. **Aprendizaje candidato:** **PROPUESTA_GLOBAL** — en Windows, verificar la escribibilidad del directorio montado por el UID del contenedor antes de dar por bueno un healthcheck; considerar volumen named cuando el bind mount no sea imprescindible.

#### `F00-T01-A03-P2` — Discrepancia entre la recomendación del auditor y el formato real de QueueUrl

1. **Identificación:** `F00-T01-A03-P2` · addendum A-03 · fecha `2026-11-17` · fuentes: auditoría `F00-T03-auditor.md` A-03 §4, documentación del mantenedor, DevelopersIO y sonda real.
2. **Problema:** la recomendación del auditor proponía "apuntar SQS/DLQ al endpoint HTTPS real del emulador (`9297`)"; una lectura literal habría llevado a escribir `https://127.0.0.1:9297/...` en `SQS_QUEUE_URL`/`SQS_DLQ_URL`.
3. **Causa:** **DEMOSTRADA.** El emulador devuelve QueueUrls con host `sqs.<región>.amazonaws.com` y cuenta `000000000000`; el SDK JS v3 enruta por el host de la QueueUrl salvo `useQueueUrlAsEndpoint:false`. El auditor no pudo comprobarlo en vivo (su hallazgo A-04).
4. **Solución e intentos fallidos:** se eligió la QueueUrl canonical devuelta por el emulador y se mantuvo `AWS_ENDPOINT_URL=https://127.0.0.1:9297` como transporte; se documentó el matiz en el propio `.env.example`, en la evidencia y en este reporte. No hubo intentos fallidos: la sonda confirmó el formato antes de fijarlo.
5. **Verificación:** `CreateQueue` devolvió `https://sqs.us-east-1.amazonaws.com/000000000000/mediashrink-jobs` (y `-dlq`); `SendMessage` con esa URL contra `https://127.0.0.1:9297` → HTTP 200. Tests de `.env.example` y del loader en verde (35/35).
6. **Pendientes:** el Tester de `F00-T04` debe verificar que Terraform no herede `:9324` y consuma `AWS_ENDPOINT_URL` para el proveedor; recomendación del auditor, no competencia de este addendum.
7. **Aprendizaje candidato:** **PROPUESTA_GLOBAL** — distinguir explícitamente "endpoint de transporte" de "identificador de recurso devuelto por la API" en plantillas y runbooks de emuladores; verificarlo en vivo antes de corregir una plantilla cerrada.

### A.6 Handoff del addendum

- Archivos modificados: solo los cinco del ámbito indicado. **No se tocó** `docker-compose.yml`, `docs/runbooks/`, `STATE.md`, `docs/sdd/tasks.md`, `package.json`, `frontend/`, `backend/src/index.ts` ni los reportes de Tester/Architect de `F00-T01`. **No se usaron** Git/GitHub. **No se escribieron** secretos reales ni rutas Windows absolutas en artefactos públicos (el script de sonda efímero quedó fuera del repositorio). Las salidas de Vitest se redactaron únicamente para sustituir la ruta absoluta del proyecto por `<PROJECT_ROOT>` (G-6b); los resultados y códigos de salida están intactos.
- Estado: `DONE_WITH_CONCERNS`. El addendum queda a la espera de **re-verificación independiente del Tester** y de la decisión del Architect; este agente no emite `PASSED` ni cierra `F00-T01`.
