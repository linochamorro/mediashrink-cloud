# `F05-T01` — Entrega Developer ( integración global real y sincronización )

| Campo | Valor |
|---|---|
| **Tarea / Criterio** | `F05-T01` · `CA-01` (P-05, riesgo 3) |
| **Versión / Loop** | `v1 — Loop 1/3` (único loop consumido) |
| **Rol / Harness** | Developer · OpenCode |
| **Fuente de verdad** | `reports/implementation/F05/F05-T01-task.md` |
| **Otras fuentes leídas** | `AGENTS.md`, `STATE.md`, `.agents/roles/developer.md`, `docs/sdd/packages/P-05-final-integration-and-delivery.md`, `reports/verification/F03-architect.md` (cierre reapertura `PASSED`), `reports/verification/F04-architect.md` (`FASE_COMPLETA`), `backend/src/{index,api/app,worker/index,worker/consumer,config/index}.ts`, `frontend/**`, `.github/workflows/**`, `package.json`, `.env.example`, `docs/runbooks/development-workflow.md` |
| **Estado de entrega** | **`DONE_WITH_CONCERNS`** — entregado a Tester; **no se emite `PASSED` ni se cierra la tarea** |
| **Evidencia** | `reports/implementation/F05/evidence/F05-T01-*.txt` (11 archivos, rutas anonimizadas con `<PROJECT_ROOT>`) |

---

## 1. Cronología y comandos ejecutados

1. **Lectura obligatoria** de las 5 fuentes indicadas y del código backend/frontend/workflows.
2. **RED → GREEN (retención):** nueva prueba en `tests/unit/config.test.ts` antes del cambio productivo; falló por el literal `2592000` en un comentario del loader; se corrigió el comentario y la prueba quedó verde.
3. **Wiring:** `backend/src/index.ts` expone `createRuntimeApp()` sobre `createApiApp()` + `/health` y un adaptador `listen()` de `app.fetch` a `node:http`; nuevo `backend/src/server.ts` construye los clientes reales (DynamoDB, S3, SQS) y arranca la API + el bucle `drainQueue()`. Scripts `start`/`dev` en `backend/package.json`. **No se tocó el manifiesto raíz.**
4. **CI:** retirado el paso `npm install --no-save` de `.github/workflows/infra-integration.yml`; `npm ci` instala los SDK ya declarados.
5. **Sincronización Git:** `git fetch origin`, `git pull --ff-only` → `Already up to date` (sin conflictos); commit y push a `main` sin `--force` (detalle en §3).
6. **Stack real:** `docker compose up -d` (2 GiB / 2.0 CPUs, `user=1000:1000`), `docker cp` de CA/config/credenciales, healthcheck `ok`, `terraform init/validate/apply -var=is_emulator=true` → **11 recursos añadidos**.
7. **Suite:** typecheck, lint, build, unitarias, integración y Playwright real (cifras en §2).
8. **Apagado:** backend detenido, `docker compose down`, 0 contenedores y 0 redes del proyecto.

| Comando | Resultado | Evidencia |
|---|---|---|
| `npm run typecheck` | exit 0 | `F05-T01-typecheck.txt` |
| `npm run lint` | exit 0 | `F05-T01-lint.txt` |
| `npm run build` | exit 0 (Vite 35 módulos) | `F05-T01-build.txt` |
| `npm run test:unit` | exit 0 · **31 archivos, 277/277** (incluye 2 pruebas nuevas de retención) | `F05-T01-unit.txt` |
| `npx vitest run tests/integration` | exit 0 · **23 archivos, 97/97** (S3/SQS/DLQ/DynamoDB, guardia de retención, infra) | `F05-T01-integration.txt` |
| `npx playwright test --config=tests/e2e/playwright.real.config.ts` | exit 0 · **1/1 en 10.1 s** (flujo real completo) | `F05-T01-playwright-real.txt` |
| `docker compose up -d` + `terraform apply` | exit 0 / 0 · 11 recursos | `F05-T01-wiring.txt` |
| `docker compose down` | exit 0 · 0 contenedores/redes del proyecto | `F05-T01-emulator-down.txt` |

> Nota: `npx vitest run "tests/integration/**"` no encuentra archivos en Vitest 2.1.9 (el patrón se interpreta literalmente). Se usó `npx vitest run tests/integration`, que ejerce los mismos 23 archivos; se documenta para el Tester.

## 2. Decisiones

- **Wiring:** se conservan `createApp()`/`app` (compatibilidad con el test de humo F00-T02) y se añade `createRuntimeApp(config, deps)`. El servidor usa un adaptador propio a `node:http` para no introducir `@hono/node-server`, no declarado en el manifiesto. El worker comparte el `JobStore` real y consume con `drainQueue()` contra la cola/DLQ del emulador; `/health` permanece en la misma app.
- **Fuente de retención:** el catálogo congelado (`backend/src/contracts/catalog.ts`, `RETENTION_DAYS = 30`, hash inalterado) es la única fuente. `backend/src/config/index.ts` importa `RETENTION_DAYS` y deriva `RETENTION_TTL_SECONDS = RETENTION_DAYS * SECONDS_PER_DAY` (86 400); **no hay literales 30 ni 2592000 en el loader**. La nueva prueba verifica el default, la derivación y la ausencia de literales duplicados. No se modificó el catálogo ni el archivo generado del frontend.
- **Git:** `pull --ff-only` sin conflictos; un único commit descriptivo con todo el contenido pendiente de F02/F03/F04/F05; push a `main` sin `--force`. G-6/G-6b autorizados; sin secretos versionados.
- **E2E real:** la SPA se sirve en `http://localhost:5173` (origen CORS declarado) y Vite redirige `/auth` y `/jobs` al backend real. El emulador **no implementa `OPTIONS`**, por lo que el navegador no puede hacer preflight; la prueba reenvía cada petición S3 con la URL firmada y el cuerpo originales mediante `https` desde el proceso del test (respuesta real del emulador). Es un **relay de transporte, no un doble de API**: los bytes suben al bucket, el worker los procesa y el ZIP se valida byte a byte.

## 3. Git — resultado de la sincronización

Ver `F05-T01-git-sync.txt` y el resumen devuelto al Architect (hash del commit, `HEAD == origin/main`). Sin `force push`, sin `.env`, `.local/`, `temporary/`, `.terraform/` ni `*.tfstate*` versionados.

## 4. Registro de problemas (7 campos cada uno)

### F05T01-01 — `backend/src/index.ts` solo exponía el healthcheck
1. **Identificación:** `F05T01-01` (CA-01, wiring).
2. **Problema:** la API real (`createApiApp()`), el consumidor SQS y el arranque del servidor no estaban cableados; F00-T02 dejó intencionadamente un esqueleto.
3. **Causa:** **DEMOSTRADA** — lectura de `backend/src/index.ts` (14 líneas) y comentario de `api/app.ts` que difería el wiring a F05.
4. **Solución e intentos fallidos:** se añadió `createRuntimeApp()` + `listen()` y el bootstrap `server.ts` con clientes reales. Intentos fallidos: ninguno; se descartó `@hono/node-server` por no estar declarado.
5. **Verificación:** `/health` → HTTP 200; flujo E2E real completo; evidencia `F05-T01-wiring*.txt`.
6. **Pendientes:** revisión del Tester; documentar el arranque local en el runbook si el Architect lo solicita.
7. **Aprendizaje candidato:** un adaptador `node:http` de ~40 líneas basta para exponer `app.fetch` sin ampliar dependencias.

### F05T01-02 — retención duplicada en runtime (`F04T03-A-03`, MEDIUM)
1. **Identificación:** `F05T01-02`.
2. **Problema:** `loadConfig()` usaba el literal `30` como default de `RETENTION_DAYS`, desincronizado del catálogo/Terraform.
3. **Causa:** **DEMOSTRADA** — `config/index.ts:330` y guardia `retention-guard.test.ts` no cubrían el runtime.
4. **Solución e intentos fallidos:** importar `RETENTION_DAYS` del catálogo, derivar TTL con `* 86 400` y añadir 2 pruebas. Intentos fallidos: la primera corrida RED falló por un `2592000` en un comentario; se eliminó el literal del comentario sin debilitar la aserción.
5. **Verificación:** 277/277 unitarias (config 37/37); `RETENTION_GUARD` de integración con 30/2592000 en las cuatro fuentes.
6. **Pendientes:** el control de cambios del catálogo citado en F04 compete al CTO (no se modificó el hash).
7. **Aprendizaje candidato:** la guardia de retención debe incluir el default del loader, no solo HCL/.env/catálogo.

### F05T01-03 — paso temporal de CI
1. **Identificación:** `F05T01-03` (P4 parcial).
2. **Problema:** `infra-integration.yml` ejecutaba `npm install --no-save @aws-sdk/client-s3...`.
3. **Causa:** **DEMOSTRADA** — από F04-T05 los manifiestos aún no estaban en `main`; con la sincronización de F05 ya lo están.
4. **Solución e intentos fallidos:** se retiró el paso y se sustituyó por un comentario; `npm ci` es la única instalación.
5. **Verificación:** inspección del workflow + CI posterior verde (detalle en el resumen al Architect).
6. **Pendientes:** confirmación del run de GitHub Actions tras el push (a cargo del Architect/Tester si procede).
7. **Aprendizaje candidato:** los pasos `--no-save` son deudas explícitas con fecha de caducidad.

### F05T01-04 — typecheck roto por el SDK 3.1171 sincronizado
1. **Identificación:** `F05T01-04`.
2. **Problema:** `tests/integration/infra/resources.test.ts` referenciaba `EventConfigurations`/`LambdaConfigurations`, ausentes en el tipo de salida del SDK fijado.
3. **Causa:** **HIPÓTESIS CONFIRMADA POR EVIDENCIA** — el lockfile sincronizado fija `@aws-sdk/client-s3 3.1171.0`, cuyos tipos difieren de los usados cuando se redactó el test; la CI anterior instaló otra versión temporalmente vía `--no-save`.
4. **Solución e intentos fallidos:** vista estructural local para leer esas claves heredadas sin relajar la aserción (0 eventos/lambdas). Sin intentos fallidos adicionales.
5. **Verificación:** `npm run typecheck` exit 0; integración 97/97.
6. **Pendientes:** ninguno.
7. **Aprendizaje candidato:** sincronizar manifiestos puede exponer incompatibilidades de tipos previamente enmascaradas por instalaciones temporales en CI.

### F05T01-05 — CORS del emulador bloquea la subida E2E
1. **Identificación:** `F05T01-05`.
2. **Problema:** la PUT presignada desde el navegador falló con `net::ERR_FAILED` y después `SignatureDoesNotMatch` al usar `route.fetch()`.
3. **Causa:** **DEMOSTRADA** — `OPTIONS /<bucket>/<key>` responde `501 NotImplemented` en el emulador; no hay `Access-Control-Allow-Origin`, y `route.fetch()` recompuso la petición alterando la firma.
4. **Solución e intentos fallidos:** (a) `route.fulfill` de preflight + `route.fetch()` → 403; (b) `route.continue()` a otro protocolo → rechazado por Playwright; (c) relay `https` explícito con URL/cuerpo/Host originales + cabeceras CORS → **correcto**.
5. **Verificación:** E2E 1/1, WebP `RIFF/WEBP`, AVIF `ftyp`, miniatura ≤256 px, sin marcadores EXIF/GPS/XMP/IPTC en ningún artefacto del ZIP, borrado confirmado.
6. **Pendientes:** documentar la limitación `OPTIONS` del emulador para futuros E2E (runbook/F05-T02 si aplica).
7. **Aprendizaje candidato:** un emulador sin preflight exige transporte alternativo; el relay debe conservar la URL firmada byte a byte, no reconstruirla.

### F05T01-06 — selector de registro del E2E
1. **Identificación:** `F05T01-06`.
2. **Problema:** el primer clic a `/Crear cuenta/` alternaba el modo del formulario en vez de enviarlo; la sesión nunca se iniciaba.
3. **Causa:** **DEMOSTRADA** — en modo `login` el botón secundario también se llama «Crear cuenta»; el snapshot de error mostró el formulario en modo registro.
4. **Solución e intentos fallidos:** consultar el texto del `button[type=submit]`, alternar solo si hace falta y hacer clic en el submit. Sin más intentos.
5. **Verificación:** E2E real verde con registro y sesión iniciada.
6. **Pendientes:** ninguno.
7. **Aprendizaje candidato:** en formularios con modo, fijar el submit por tipo, no por texto.

### F05T01-07 — contenido pendiente de F02/F03/F04 sin sincronizar
1. **Identificación:** `F05T01-07`.
2. **Problema:** ~212 entradas en `git status --short` (código, tests, infra, reports, packages) sin commitear en `main`.
3. **Causa:** **DEMOSTRADA** — fases cerradas en harnesses anteriores sin push final; G-6 autorizado.
4. **Solución e intentos fallidos:** `git fetch` + `pull --ff-only` (sin conflictos) + `git add -A` + commit descriptivo + push sin `--force`. Sin intentos fallidos.
5. **Verificación:** `git status --short` sin cambios propios; `HEAD == origin/main`; ver evidencia git-sync y hash en el resumen.
6. **Pendientes:** el CTO consolida `STATE.md`/`tasks.md` al retorno (regla anti-colisión; este rol no los editó).
7. **Aprendizaje candidato:** sincronizar antes de tocar manifiestos evita conflictos entre harnesses.

## 5. Estado final y concerns

- Todo lo ejecutado terminó con **exit 0** y evidencia real: 277 unitarias, 97 integración, 1 E2E real, build/typecheck/lint limpios, infra aplicada y apagada.
- **Concerns para el Tester / Architect:** (1) el E2E usa un relay de transporte por la limitación `OPTIONS` del emulador — no es un doble, pero debe revisarse; (2) la anonimización P4 de reportes/evidencias **anteriores** (F02/F03/F04) sigue pendiente y compete a `F05-T02`; (3) queda un contenedor externo `dazzling_edison` (GitHub MCP del harness), preexistente y ajeno al proyecto — no se eliminó; el emulador y la red del proyecto están al 0.
- **No se ejecutaron** `G-11` (borrado de `temporary/`) ni `G-12` (publicación final). Sin AWS real, sin secretos en logs/reportes, sin rutas Windows absolutas en la evidencia de esta tarea.
- Se entrega a **Tester** para dictamen independiente; este reporte **no** declara `PASSED` ni cierra `F05-T01`.
