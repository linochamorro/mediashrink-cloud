# `F05-T01` — Dictamen Tester independiente (CA-01, riesgo 3)

| Campo | Valor |
|---|---|
| **Tarea / Criterio** | `F05-T01` · `CA-01` (P-05, Fase Final) |
| **Rol / Loop** | Tester independiente · `Loop 1/3` (no se activan loops correctivos) |
| **Fuente de verdad** | `reports/implementation/F05/F05-T01-task.md` §1 y `docs/sdd/packages/P-05-final-integration-and-delivery.md` |
| **Reporte del implementador revisado** | `F05-T01-developer.md` (`DONE_WITH_CONCERNS`; E2E 1/1 en 10.1 s) |
| **Ejecución** | **Propia**, sin reutilizar corridas ajenas como evidencia. Stack real contra `aws/aws-emulator`, sin dobles de API. |
| **Fecha** | `2026-11-18` |
| **Veredicto global** | **`NO-PASSED`** — `CA-01` no se certifica: el E2E Playwright real no converge en tres ejecuciones independientes propias. El resto de subcriterios están verificados en verde con evidencia propia. |

---

## 1. Método y entorno propio

- **Tooling:** Node `v26.13.0`, npm `11.20.0`, Docker engine `29.9.3` / Compose `v5.7.0` (CLI antepuesto en `PATH`), Terraform `v1.17.2`, `gh` `2.101.0` autenticado como `linochamorro` (`repo`, `workflow`).
- **Sesión real ejecutada (3 veces):** `docker compose up -d` (límite efectivo `2147483648` bytes / `2000000000` nanoCpus, `user=1000:1000`) → `docker cp` de `ca.pem`, `config` y `emulator_credentials` en **cada arranque** → healthcheck HTTPS `ok` → `terraform init/validate/apply -var=is_emulator=true` (**11 recursos añadidos**) → arranque del servidor real `npx tsx backend/src/server.ts` → pruebas → apagado con `docker compose down`.
- **Aislamiento:** sin AWS real; sin secretos versionados; sin rutas Windows absolutas en reportes/evidencias (marcador `<PROJECT_ROOT>`); `temporary/` intacto; G-11 y G-12 **no ejecutados**.
- **Contenedor ajeno:** `dazzling_edison` (GitHub MCP del harness), preexistente y no propiedad del proyecto: **no se eliminó**. Al final de cada sesión, emulador y red `mediashrink-cloud_default` al 0.

## 2. Dictamen por subcriterio (evidencia propia)

| Subcriterio | Resultado | Cifras y exit codes propios | Evidencia |
|---|---|---|---|
| **Wiring real** (`/health` + API Hono + consumidor SQS conectado) | **PASSED** | `UP_EXIT=0`, `HEALTHCHECK_EXIT=0`, `TF_APPLY_EXIT=0` (11 recursos). Servidor real: `F05_SERVER_READY {"port":3001,"retentionDays":30}`; `GET /health → 200 {"status":"ok"}`; `GET /jobs` sin token → `401` (middleware de autenticación real). No se usaron dobles de API. | `F05-T01-tester-wiring.txt`, `F05-T01-tester-server-log.txt` |
| **Retención runtime (fuente única)** | **PASSED** | `backend/src/config/index.ts` importa `RETENTION_DAYS` del catálogo y deriva `RETENTION_TTL_SECONDS = RETENTION_DAYS * SECONDS_PER_DAY`; **sin literales `30`/`2592000` duplicados en el loader**. `config.test.ts` **37/37** (2 pruebas de regresión que fallan si divergen). Guardia de integración: `{"EXPECTED_DAYS":30,"EXPECTED_TTL_SECONDS":2592000,"ENV":30,"CATALOG":30,"TF_DEFAULT":30,"TF_APPLIED":30,"TF_APPLIED_TTL":2592000}`. | `F05-T01-tester-retention-runtime.txt`, `F05-T01-tester-integration.txt` |
| **Git (HEAD == origin/main, sin force push)** | **PASSED** | `HEAD = origin/main = git ls-remote = 8d25498…`; `git status --short` sin cambios propios antes de mis evidencias. Reflog de `origin/main` monótono (`8f65a7f → b191b3c → fca0252 → a0e9f66 → 8d25498`), cada commit ancestro del siguiente (`merge-base --is-ancestor` = 0 en los 4 pares): **sin force push**. | `F05-T01-tester-git-sync.txt` |
| **CI limpia** | **PASSED** (con observación menor) | `gh run view 44421156056` → `success` (CI, head `fca0252`); `gh run view 44421156368` → `success` (Infra integration, head `fca0252`). Cero coincidencias de `npm install --no-save` en `.github/workflows/*.yml`; único install es `npm ci --no-audit --no-fund`. La API de GitHub informa **17 pasos** en el run de infra (13 declarados en YAML + 4 de ciclo de vida de GitHub: `Set up job`, dos `Post …` y `Complete job`); la cifra «15» del reporte del Developer es un criterio de conteo distinto, **no un fallo funcional**. | `F05-T01-tester-ci.txt`, `F05-T01-tester-workflow-cleanup.txt` |
| **Suite: typecheck / lint / build / unit / integración** | **PASSED** | `typecheck` exit 0 · `lint` exit 0 · `build` exit 0 (Vite, 35 módulos, 1.38 s) · `test:unit` **31 archivos, 277/277** (8.92 s) · `vitest run tests/integration` **23 archivos, 97/97** (64.05 s). | `F05-T01-tester-{typecheck,lint,build,unit,integration}.txt` |
| **Suite: Playwright E2E real** | **`NO-PASSED`** | **3/3 corridas propias fallidas.** Detalle en §4. El Developer documentó 1/1 en 10.1 s; **no reproducido** en mi ejecución independiente. | `F05-T01-tester-playwright-real{,-retry,-relaxed-diag}.txt` |
| **Terraform apply** | **PASSED** | `Apply complete! Resources: 11 added, 0 changed, 0 destroyed.` | `F05-T01-tester-wiring.txt`, `F05-T01-tester-playwright-real-retry.txt` |
| **Ámbito / gobernanza** | **PASSED** | `temporary/` con 55 ítems intacto; `.env` ausente; sin `G-11`/`G-12`; sin secretos ni rutas absolutas nuevas; solo `dazzling_edison` ajeno tras el apagado. | `F05-T01-tester-workflow-cleanup.txt`, `F05-T01-tester-emulator-down*.txt` |

## 3. Escrutinio del relay S3 (verificación 6) — **NO es un doble de API**

Inspección de `tests/e2e/real-stack.spec.ts` §47-106 y ejecución real:

- `context.route('https://127.0.0.1:9297/**')` intercepta únicamente el tráfico S3. Para `OPTIONS` devuelve un preflight sintético (`204` + cabeceras CORS) porque el emulador no implementa `OPTIONS` (`501`): **adaptación de transporte HTTP, no sustitución de S3**.
- Para `GET`/`PUT` construye una petición `https` real al **mismo host, misma ruta firmada y mismo cuerpo** (`postDataBuffer()`), con la CA del emulador, y devuelve el **status, cabeceras y cuerpo reales** del emulador, añadiendo solo `access-control-allow-origin` / `access-control-expose-headers`.
- **No hay lógica de bucket, objeto, worker, `sharp`, WebP/AVIF, EXIF ni ZIP en el relay.** Los bytes de la fixture llegan al bucket `raw`; el consumidor SQS real publica y procesa; el ZIP se lee de S3 y se valida byte a byte (`RIFF/WEBP`, `ftyp`, miniatura ≤256 px, ausencia de los cuatro marcadores privados). La integración 97/97 confirma todo eso sin el navegador.

**Dictamen del relay:** `PASSED` — es un adaptador de transporte/CORS, **no** un doble de API ni una simulación del procesamiento. No sustituye a S3 ni al worker. Por sí solo **no** motiva el `NO-PASSED`; el bloqueo es la no convergencia del E2E en mi ejecución.

## 4. Hallazgos (7 campos obligatorios)

### F05T01-T-01 — El E2E real no converge en ejecución independiente (**BLOQUEANTE**)

1. **Identificación:** `F05T01-T-01` · `CA-01` · riesgo 3.
2. **Problema:** El único caso de `tests/e2e/real-stack.spec.ts` no termina con éxito en ninguna de mis tres ejecuciones propias, todas contra stack real (emulador + `terraform apply` + servidor Hono real + SPA Vite + Edge). Con la configuración documentada (default `RATE_LIMIT_AUTH_MAX=5`) falla en la comparativa (`HTTP 429` al cargar las fuentes de las vistas); con el límite relajado a `1000` (diagnóstico) las imágenes `<img>` llegan a renderizarse pero la variante optimizada nunca alcanza `naturalWidth > 0` y dispara `onError` («La vista optimizada no está disponible»). En ningún caso se alcanzan la descarga WebP, el ZIP ni el borrado, que quedan **sin cubrir por mi evidencia**.
3. **Causa:** **HIPÓTESIS CONFIRMADA PARCIALMENTE POR EVIDENCIA.** (a) El `429` procede del limitador HTTP real: `JobsApiError` con `status=429` en `POST`/`GET` del endpoint `/jobs/:id/download/:imageId` (`downloadLimiter`, clave `userId`, `max=5`/60 s), que el frontend convierte en «La solicitud falló (HTTP 429)» y que deja el `<figure>` en `Vista no disponible` (DOM capturado). (b) Al relajar el límite desaparece el `429`, pero la variante optimizada sigue sin decodificar: el relay devuelve la respuesta real del emulador, por lo que el fallo está en la ruta de transporte/carga de la vista optimizada ejercitada por el navegador. No se ha podido aislar si es defecto del relay de pruebas, del emulador o del entorno Edge; **no se afirma causa raíz no demostrada**.
4. **Solución e intentos fallidos:** Sin cambios por este rol (prohibido editar código/tests). Intentos propios: (i) sesión completa con integración previa → `PLAYWRIGHT_REAL_EXIT=1`, 429 en `real-stack.spec.ts:145`; (ii) pila fresca, solo E2E → `PLAYWRIGHT_RETRY_EXIT=1`, mismo 429 en `:145`; (iii) pila fresca con `RATE_LIMIT_AUTH_MAX=1000` → `PLAYWRIGHT_RELAXED_EXIT=1`, avanza a `:153` y falla el `poll` de `naturalWidth`. En los tres casos `docker compose down` → exit 0 y contenedor ajeno único.
5. **Verificación:** `F05-T01-tester-playwright-real.txt`, `F05-T01-tester-playwright-real-retry.txt`, `F05-T01-tester-playwright-real-relaxed-diag.txt` y el `error-context.md` generado por Playwright (DOM con `Completado`, `✓ EXIF eliminado` y `status: La solicitud falló (HTTP 429)` / `La vista optimizada no está disponible`). Duraciones propias ~25-26 s por corrida, frente a los 10.1 s del reporte del Developer.
6. **Pendientes:** El Developer/Architect debe reproducir y corregir la no convergencia (p. ej., ajustar el presupuesto de peticiones del flujo E2E frente al `downloadLimiter` y/o la carga de la vista optimizada a través del relay) y aportar una corrida propia con resumen final y `EXIT_CODE=0`. Hasta entonces `CA-01` no se certifica.
7. **Aprendizaje candidato:** Un límite por `userId` de 5 peticiones/minuto en el endpoint de descarga es demasiado ajustado para un flujo de UI que necesita varias vistas + descarga individual + ZIP en la misma ventana; y un relay de transporte debe verificar también las respuestas `GET` que alimentan `<img>`, no solo la `PUT` de subida.

### F05T01-T-02 — La corrida verde documentada no es reproducible en el entorno del Tester (relacionado, no bloqueante independiente)

1. **Identificación:** `F05T01-T-02` · `CA-01` · riesgo 3.
2. **Problema:** El `F05-T01-developer.md` y `F05-T01-playwright-real.txt` informan `1 passed (10.1s)`, `EXIT_CODE=0`; mis tres repeticiones con el mismo comando, mismo navegador y mismo tooling devuelven `1 failed` y exit 1.
3. **Causa:** **NO DEMOSTRADA.** No hay cambios en el repositorio entre ambas corridas (`HEAD = origin/main = 8d25498…`, árbol limpio); la diferencia observable es únicamente la duración y el estado del limitador/transporte.
4. **Solución e intentos fallidos:** Tres repeticiones (§4/T-01) con pila fresca; ninguna reprodujo el resultado del Developer. No se modificó código ni configuración versionada.
5. **Verificación:** Evidencias `F05-T01-tester-playwright-real*.txt` cotejadas con `reports/implementation/F05/evidence/F05-T01-playwright-real.txt`.
6. **Pendientes:** Aportar una corrida independiente verde con resumen final y exit 0 natural sobre el snapshot actual.
7. **Aprendizaje candidato:** La evidencia E2E debe incluir el comando exacto, el valor de las variables de entorno que afectan al límite de peticiones y la versión del navegador, para que sea reproducible por otro rol.

## 5. Veredicto global

**`NO-PASSED` para `F05-T01` / `CA-01`.**

Se certifican con evidencia propia: wiring real (`/health` 200, API con middleware real, consumidor SQS contra emulador), retención con fuente única y guardas que fallan si divergen, sincronización Git sin force push, CI limpia y en verde, suite typecheck/lint/build/unit (277/277) e integración (97/97), `terraform apply` de 11 recursos, escrutinio del relay como adaptador de transporte y confinamiento/alcance.

**No se certifica** la suite E2E Playwright real: 3/3 ejecuciones propias terminaron en fallo antes de completar comparativa → WebP → ZIP → borrado. En consecuencia `CA-01` no queda satisfecho en su totalidad y se devuelve el dictamen sin activar loops correctivos, según el encargo.

## 6. Observaciones no bloqueantes

- El run de infra informa 17 pasos vía API de GitHub (13 declarados + 4 de ciclo de vida); la cifra «15» del reporte del Developer responde a otro criterio de conteo. No afecta a la limpieza de CI ni a su conclusión `success`.
- El warning de Terraform «AWS resource not found during refresh» aparece al reaprovisionar sobre un emulador efímero; `apply` terminó con 11 recursos añadidos y exit 0 en todas las sesiones propias.
- No se encontraron secretos ni rutas Windows absolutas en los artefactos nuevos de este rol.

## 7. Evidencias propias

`reports/implementation/F05/evidence/F05-T01-tester-{wiring,server-log,server-stderr,typecheck,lint,build,unit,retention-runtime,integration,playwright-real,playwright-real-retry,playwright-real-relaxed-diag,server-log-retry,server-log-relaxed,emulator-down,emulator-down-retry,git-sync,ci,workflow-cleanup}.txt` y el `error-context.md` generado por Playwright bajo `playwright-real-results/`.

**Registro de procesos propios:** tres sesiones `up → cp → apply → servidor → pruebas → down`, con duraciones de suite unitaria 8.92 s, integración 64.05 s y E2E ~25-26 s por intento. Esperas de herramienta/harness no cuantificadas; no reconstruidas solo desde fechas de archivo.

---

## Addendum — Loop 2/3 (re-verificación acotada, 2026-11-18)

> **Append-only.** El dictamen `NO-PASSED` de v1 y sus hallazgos `F05T01-T-01`/`T-02` permanecen íntegros arriba. Este addendum solo re-verifica los criterios afectados por la corrección del Developer y emite un dictamen nuevo sobre el snapshot corregido. No se activan loops adicionales.

| Campo | Valor |
|---|---|
| **Snapshot verificado** | `HEAD = origin/main = f43d903…` (commit `fix(F05-T01 loop2): E2E real reproducible con presupuesto de rate limit controlado y aserciones explicitas`). El commit toca **solo** `tests/e2e/playwright.real.config.ts`, `tests/e2e/real-stack.spec.ts` y evidencias del Developer; `backend/**`, `.env.example`, manifiestos y reportes del Tester sin cambios. |
| **Alcance re-verificado** | E2E real (criterio 1), default de producto y alcance de la variable E2E (criterio 2), naturaleza del relay (criterio 2) y cobertura de las nuevas aserciones (criterio 3). El resto de gates de v1 no se repiten sin cambio que lo justifique. |
| **Dictamen del addendum** | **`PASSED` — `CA-01` queda certificado** con tres corridas propias consecutivas en verde. |

### A. Tres corridas propias consecutivas con pila fresca (criterio 1)

Cada corrida ejecutó, de forma independiente y en este orden: `docker compose down` → `up -d` (límite efectivo `2147483648` bytes / `2000000000` nanoCpus, `user=1000:1000`) → `docker cp` de `ca.pem`, `config` y `emulator_credentials` → healthcheck `ok` → `terraform apply -var=is_emulator=true` (**11 recursos añadidos**) → `npx playwright test --config=tests/e2e/playwright.real.config.ts` con `F05_E2E_RATE_LIMIT_MAX=1000` → `docker compose down`. El backend real y la SPA son dos `webServer` gestionados por Playwright (`reuseExistingServer: false`), con puerto 3001 libre antes de cada corrida (`PRE_PORT_3001=000`).

| Corrida | Resumen final | Exit code natural | Relay GET (3 respuestas reales) | Apagado |
|---|---|---|---|---|
| 1 | `1 passed (12.9s)` (test 6.2 s) | `PLAYWRIGHT_RUN1_EXIT=0` | 3× `status:200`: original `binary/octet-stream` 766 B (`ffd8ff`), 2× `image/webp` 114 B (`RIFF…WEBP`) | `DOWN_EXIT=0`, `PORT_3001_AFTER=000`, solo `dazzling_edison` |
| 2 | `1 passed (13.9s)` (test 6.6 s) | `PLAYWRIGHT_RUN2_EXIT=0` | mismos 3 GET reales, 200 y magic correcto | `DOWN_EXIT=0`, `PORT_3001_AFTER=000`, solo `dazzling_edison` |
| 3 | `1 passed (12.8s)` (test 6.0 s) | `PLAYWRIGHT_RUN3_EXIT=0` | mismos 3 GET reales, 200 y magic correcto | `DOWN_EXIT=0`, `PORT_3001_AFTER=000`, solo `dazzling_edison` |

Evidencia: `F05-T01-tester-loop2-e2e-{1,2,3}.txt` y `F05-T01-tester-loop2-down-{1,2,3}.txt`. **No se reprodujo** ni `HTTP 429` ni `La vista optimizada no está disponible` en ninguna corrida (0 coincidencias en la evidencia nueva), por lo que **no procede `NEEDS_CONTEXT`**.

### B. Aislamiento del ajuste y naturaleza del relay (criterio 2)

- **Default de producto intacto:** `backend/src/config/index.ts` mantiene `authMax: readPositiveInt(env, 'RATE_LIMIT_AUTH_MAX', 5)`. `.env.example` conserva `RATE_LIMIT_AUTH_MAX=5` y `git diff 8d25498..f43d903 -- .env.example` está vacío.
- **Variable solo E2E:** `F05_E2E_RATE_LIMIT_MAX` (default `1000` en el runner) se inyecta como `RATE_LIMIT_AUTH_MAX` exclusivamente en el `webServer` del backend que crea Playwright (`playwright.real.config.ts:25,45,80-93`). No hay cambios en la configuración de producción ni en el arranque normal (`npm start`).
- **Relay sigue siendo transporte real:** conserva la URL firmada, el cuerpo y la CA del emulador; elimina solo cabeceras hop-by-hop (`content-length`, `transfer-encoding`, `connection`) para que Playwright recalcule el buffer y preserva el `content-type` real. El debug `F05_E2E_RELAY_DEBUG=1` imprime únicamente metadatos (`status`, `contentType`, longitudes, magic, nombres de cabecera) — **sin URL firmada ni credenciales**. Los `F05_RELAY_GET` de mis tres corridas confirman bytes reales del emulador (JPEG original y WebP optimizado). Sigue sin haber lógica de bucket, worker, `sharp`, EXIF ni ZIP en el relay: **no es doble de API**.

### C. Cobertura real de las nuevas aserciones (criterio 3)

Revisión del código ejecutado (`real-stack.spec.ts`), no solo del resultado verde:

- **Comparativa (§167-199):** exige exactamente 1 `<img>` original y 1 optimizada, ausencia del mensaje de error, `naturalWidth > 0` para ambas, `src` HTTPS, y verifica los bytes de ese mismo `src` — `ffd8ff` para el original y `RIFF/WEBP` + sin marcadores privados para la optimizada.
- **WebP individual (§201-214):** botón visible, magic `RIFF/WEBP` y `assertNoPrivateMetadata`.
- **ZIP (§216-245):** exactamente 3 entradas `.avif`/`.webp`/`_thumb.webp`, sin marcadores privados, magic `ftyp` y WebP, y miniatura ≤256 px en ambos ejes.
- **Borrado (§247-255):** acepta el diálogo, exige desaparición del `jobId` del historial, pulsa «Actualizar historial» y comprueba el estado vacío «Aún no hay lotes.».

Todas estas líneas se ejecutaron en cada una de las tres corridas (el test es un único caso que no omite bloques), y el registro/login, la subida PUT real y el procesamiento del consumidor SQS real preceden a esas secciones.

### D. Confinamiento y gobernanza (criterio 5)

`temporary/` con 55 ítems intacto; sin `G-11`/`G-12`; sin secretos ni rutas Windows absolutas en los artefactos nuevos (0 coincidencias); CI `44428490212` verificado `success` en `f43d903`; Docker apagado tras cada corrida y puerto 3001 al 0; único contenedor presente `dazzling_edison`, ajeno y preexistente.

### E. Veredicto del addendum

**`PASSED` para `F05-T01` / `CA-01` sobre el snapshot `f43d903`.** Los hallazgos `F05T01-T-01` y `F05T01-T-02` que motivaron el `NO-PASSED` de v1 quedan cerrados por evidencia propia: causa del 429 aislada al entorno del servidor E2E (ahora gobernado por el runner), relay normalizado y verificado como transporte real, y 3/3 corridas propias consecutivas con resumen final y `EXIT_CODE=0` natural. Este addendum no modifica el historial v1 ni activa un tercer loop.
