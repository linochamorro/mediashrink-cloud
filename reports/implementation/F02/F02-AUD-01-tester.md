# Dictamen Tester independiente — `F02-AUD-01` (Addendum de interoperabilidad F02↔F03)

| Campo | Valor |
|---|---|
| **ID completo** | `F02-AUD-01` — Contrato interoperable de `POST /jobs` con F03 (riesgo 3) |
| **Fase / paquete** | Fase 2 — `docs/sdd/packages/P-02-api-and-worker.md` (addendum) |
| **Rol / Loop** | Tester independiente · `v1 — Loop 1/3` (**no activo loops**; sin re-verificaciones) |
| **Harness** | OpenCode |
| **Fecha de verificación** | `2026-11-18` |
| **Veredicto global** | **`PASSED`** — contrato acordado e integración real verificados con ejecución propia |
| **Entrega** | Al Architect, para integración del dictamen y cierre del addendum |

## 1. Fuentes, alcance e independencia

Leídas: `.agents/roles/tester.md`, `AGENTS.md`, `STATE.md`, `reports/implementation/F02/F02-AUD-01-task.md`, `reports/implementation/F02/F02-AUD-01-developer.md`, `reports/audits/F03/F03-auditor.md` (`F03-AUD-01`, HIGH), `frontend/src/api/jobs.ts` (solo lectura, contrato de referencia), `backend/src/api/jobs.ts`, `backend/src/api/app.ts`, tests `tests/unit/api/jobs-contract.test.ts` y `tests/integration/api/jobs-contract.test.ts`, y las evidencias `F02-AUD-01-*.txt` del implementador.

No se editaron código de producto, tests, contratos congelados, frontend, reportes ajenos ni `STATE.md`/`tasks.md`. Únicos archivos escritos por este rol: este dictamen y las evidencias `reports/implementation/F02/evidence/F02-AUD-01-tester-*.txt`. La sonda diagnóstica se alojó en `temporary/` con alcance explícito y se **eliminó** tras ejecutarse (ver `F02-AUD-01-tester-scope.txt`).

## 2. Evidencia cronológica TDD (revisada, no re-creada)

| Hito | Evidencia del implementador | Hora | Resultado |
|---|---|---|---|
| RED | `F02-AUD-01-red.txt` | 05:31:25 | 1 archivo, **7 fallos por comportamiento** (`expected 400 to be 201`) / 2 pasan, EXIT 1 |
| GREEN | `F02-AUD-01-green.txt` | 05:33:51 | 13 archivos, **103/103**, EXIT 0 |
| REFACTOR | `F02-AUD-01-refactor.txt` | 05:34:29 | 13 archivos, **103/103**, EXIT 0 |

Cronología coherente con los mtimes de `backend/src/api/jobs.ts` (05:34:20), `app.ts` (05:32:17) y los tests (05:31:16 / 05:35:37). No se certifica que el RED ocurriera por re-ejecución propia: se informa como evidencia cronológica del implementador, contrastada con la secuencia de archivos.

## 3. Ejecución propia (independiente)

Todas las corridas se ejecutaron desde la raíz del proyecto, con PATH anteponiendo el directorio del CLI de Docker del harness (ruta concreta no versionada, G-6b).

| Verificación propia | Comando | Resultado | Evidencia |
|---|---|---|---|
| Suite unitaria | `npm run test:unit -- --reporter=basic` | **31 archivos, 275/275**, EXIT 0 | `F02-AUD-01-tester-unit.txt` |
| Tipado | `npm run typecheck` | EXIT 0, sin diagnósticos | `F02-AUD-01-tester-typecheck.txt` |
| Lint acotado a F02 | `npx eslint backend/src/api tests/unit/api tests/integration/api --ext .ts` | EXIT 0, sin hallazgos | `F02-AUD-01-tester-lint-scoped.txt` |
| Integración real | `npx vitest run tests/integration/api --reporter=basic` | **7 archivos, 29/29**, EXIT 0 | `F02-AUD-01-tester-integration.txt` |
| Sonda negra propia | `npx tsx temporary/F02-AUD-01-tester-probe.ts` (eliminada) | **34/34** comprobaciones propias, EXIT 0 | `F02-AUD-01-tester-probe.txt` |
| Docker / emulador | `docker compose config` + `up -d` + `inspect` | `memory=2147483648`, `nanoCpus=2000000000`, `user=1000:1000`, `host_ip=127.0.0.1`, `healthy` | `F02-AUD-01-tester-docker-config.txt` |
| CA / healthcheck | `docker cp` de `ca.pem`/`config`/`emulator_credentials` + `curl.exe --cacert` | con CA `body=ok` EXIT 0; sin CA EXIT 60 | `F02-AUD-01-tester-emulator-ca.txt` |
| Apagado G-7 | `docker compose down` + `docker ps -a` + sonda `:9297` | contenedor y red eliminados; `docker ps -a` vacío; puerto cerrado (EXIT 7) | `F02-AUD-01-tester-emulator-down.txt` |
| Alcance / gobernanza | `git rev-parse`, `git ls-remote`, `git diff 469888b`, mtimes | sin push; contratos y rutas prohibidas sin cambios | `F02-AUD-01-tester-scope.txt` |

## 4. Dictamen por criterio

### C1 — Forma del contrato `{ preset, files }` → 201 `{ job, uploads }` — **PASSED**

La sonda propia verificó sobre la app Hono real (con `PresignService` real contra el emulador): `POST /jobs` devuelve 201; las claves de la respuesta son exactamente `job` y `uploads`; cada entrada de `uploads` expone exactamente `imageId`, `uploadUrl` y `method`; `method === 'PUT'`; URL HTTPS; `job.userId` coincide con el JWT; job `PENDING` con `bytesBefore/bytesAfter/savingsPct = 0`; dos `fileName` idénticos producen dos `imageId` UUID v4 distintos. El campo opcional `headers?` no se emite porque el presign actual no exige cabeceras adicionales: el tipo local lo conserva como opcional y el cliente lo acepta por defecto. No se exponen `bucket`, `key`, `expiresIn` ni `expiresAt`. Coincide con `JobUploadRequest`/`JobUploadPlan` de `frontend/src/api/jobs.ts`.

### C2 — PUT real y `HeadObject` en `raw/<userId>/<jobId>/<imageId>` — **PASSED**

Dos PUT directos a las URLs devueltas por `POST /jobs` (el binario no pasa por la API) devolvieron 200. `HeadObject` sobre `rawImageKey({ userId, jobId, imageId })` devolvió `ContentLength` exactamente igual al payload enviado en ambos casos. La ruta de la URL firmada contiene la clave canónica `<userId-del-JWT>/<jobId>/raw/<imageId>`. La integración permanente (29/29, incluidos los 3/3 de `tests/integration/api/jobs-contract.test.ts`) reproduce el mismo comportamiento.

### C3 — Negativos y aislamiento — **PASSED**

La sonda propia rechazó con 400: preset inválido, lote vacío, lote excedido (`maxImagesPerBatch + 1`), `sizeBytes` 0/negativo/no entero/excedido, MIME SVG y GIF, `fileName` con traversal `/` y `\`, NUL y `%xx`, clave desconocida `userId` en el cuerpo y clave desconocida en el archivo. Sin token → 401. La suplantación por `x-forwarded-for`/`x-real-ip` no alteró la clave: la URL firmada sigue bajo el `userId` del JWT. Los dobles no acreditan integración, pero aquí se complementan con la sonda HTTP real y con la integración contra el emulador. Las nueve pruebas unitarias del contrato (incluidas en 275/275) cubren los mismos casos con aserciones de no-persistencia.

### C4 — Sin regresión — **PASSED**

275/275 unitarias (31 archivos), 29/29 integración (7 archivos), `typecheck` y lint acotado a F02, todo ejecutado por este rol con EXIT 0. Las rutas `/presign`, `/confirm`, descarga/ZIP/borrado y las E2E de T06 siguen verdes dentro de la suite de integración. La estrategia de P-3 (mantener la siembra de T06 por `/presign/upload` y añadir una prueba focal del nuevo flujo) preserva la cobertura previa sin reescribir aserciones auxiliares.

### C5 — Gobernanza, G-3, G-6b, G-7 y contratos congelados — **PASSED**

- `HEAD`, `origin/main` y `git ls-remote origin refs/heads/main` coinciden en `469888b…`: **no hubo push**.
- `git diff 469888b -- backend/src/contracts frontend/src/api/types.generated.ts infra .github` → **sin cambios**; el header conserva `hash SHA-256 del catálogo: 5d0082f8d97e0329862739123b7599c75ff7261834430039fa6e815bf68d626d`.
- No se regeneraron tipos ni se tocó `backend/src/contracts/**`: el contrato se implementó con tipos locales en `backend/src/api/**` validando con `schemas.*`.
- `STATE.md` (05:25) y `docs/sdd/tasks.md` (05:20) son anteriores al trabajo del addendum (05:31+); `frontend/`, manifiestos e `infra/` datan del 17/11. Aislamiento del addendum confirmado por mtimes (ver evidencia de alcance).
- G-7: contenedor levantado solo durante la verificación, con límites efectivos `2147483648` bytes / `2000000000` nanoCpus, `user=1000:1000`; `docker cp` repetido en este arranque; apagado al terminar con `docker ps -a` vacío y puerto 9297 cerrado.
- Sin secretos ni rutas Windows absolutas en los artefactos producidos por este rol.

## 5. Problemas registrados

**Ninguno.** No se encontraron incumplimientos de los criterios asignados; por tanto no proceden registros de 7 campos ni reapertura de loops. Se dejan como seguimientos no bloqueantes, fuera del alcance de este dictamen: la decisión de exposición de `headers?` (opcional, actualmente omitido) y la unificación futura de los flujos de siembra de T06 con el nuevo `uploads` (documentada como P-3 por el Developer). Ninguno afecta la interoperabilidad verificada.

## 6. Veredicto global

**`PASSED`** para `F02-AUD-01` en Loop 1/3, con ejecución propia independiente. El bloqueo `F03-AUD-01` (HIGH) queda cubierto en lo que respecta a la adopción del acuerdo por el servidor F02: la divergencia `images`/`{ job }` descripta en la auditoría F03 ya no está presente en el handler verificado. Este dictamen no cierra la tarea ni activa loops: corresponde al Architect integrarlo, addendar `reports/verification/F02-architect.md` y coordinar el cierre con F03.

## 7. Índice de evidencias propias

- `reports/implementation/F02/evidence/F02-AUD-01-tester-unit.txt`
- `reports/implementation/F02/evidence/F02-AUD-01-tester-typecheck.txt`
- `reports/implementation/F02/evidence/F02-AUD-01-tester-lint-scoped.txt`
- `reports/implementation/F02/evidence/F02-AUD-01-tester-integration.txt`
- `reports/implementation/F02/evidence/F02-AUD-01-tester-probe.txt`
- `reports/implementation/F02/evidence/F02-AUD-01-tester-docker-config.txt`
- `reports/implementation/F02/evidence/F02-AUD-01-tester-emulator-ca.txt`
- `reports/implementation/F02/evidence/F02-AUD-01-tester-emulator-down.txt`
- `reports/implementation/F02/evidence/F02-AUD-01-tester-scope.txt`
