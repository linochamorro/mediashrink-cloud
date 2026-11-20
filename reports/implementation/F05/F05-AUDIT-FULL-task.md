# F05-AUDIT-FULL — Tarea correctiva (encargo del CTO)

| Campo | Valor |
|---|---|
| **ID** | `F05-AUDIT-FULL` (addendum correctivo de `F05-T01`/`F05-T02`/`F05-H01`) |
| **Versión** | v1 — 2026-11-19 |
| **Fase** | Fase Final (`P-05`) — cierre real antes de `G-12` |
| **Owner** | Architect (OpenCode) |
| **Roles participantes** | Developer/Designer (implementación), Tester (verificación independiente), Auditor (dictamen de seguridad), Architect (consolidación) |
| **Riesgo** | 3 (privacidad, secretos, red local) |
| **Gates** | `G-7` Docker autorizado (límites `2g`/`2.0`, apagado al terminar) · `G-6` Git/GitHub autorizado · `G-12` **RETENIDO** (no se marca) |

## 1. Fuentes y motivo

- Rechazo del CTO del commit `6804f28`: `UX-02` descartaba `name` al leer/listar/actualizar DynamoDB; 0 tests TDD nuevos; 0 integración real con Claim Check; 0 E2E real sin muletas; 0 reportes de Tester/Auditor/Architect.
- Encargo correctivo literal del CTO (2026-11-19) reproducido en `STATE.md` y en el informe de retorno.

## 2. Criterios de aceptación (CA-F05-AUDIT)

| CA | Criterio verificable |
|---|---|
| `CA-01` | `name` se persiste y se devuelve en `POST /jobs`, `POST /jobs/:id/confirm`, `GET /jobs` y `GET /jobs/:id`; 100 % retrocompatible con lotes sin `name` (seed/antiguos) |
| `CA-02` | `UX-01` fecha+hora (dd/mm/aaaa, hh:mm) y orden descendente; `UX-02` input opcional «Nombre del lote» (máx. 80, saneado) visible como título con fallback `jobId`; `UX-03` «Descargar ZIP» deshabilitado fuera de `COMPLETED`/`PARTIAL`; legible en Claro y Oscuro |
| `CA-03` | Suite unitaria > 310 tests (RED→GREEN→REFACTOR) con regresiones M-01, M-02, M-04, M-05, M-06 y UX-01..03 |
| `CA-04` | Integración REAL contra `aws/aws-emulator`: imagen > 400 KiB, Claim Check (sobre SQS < 200 000 B sin `contentBase64`), `COMPLETED`, `name` conservado, `bytesBefore > 400000`, `exifStripped: true`, WebP/AVIF/miniatura en `optimized` |
| `CA-05` | E2E REAL con Playwright CLI: `npm run dev:backend` + `npm run dev:frontend`, configuración por defecto (sin inflar `RATE_LIMIT_AUTH_MAX`, sin relay de Playwright), login seed, 3 imágenes reales > 300 KiB, `COMPLETED` sin 429, nombre+fecha visibles, previews con `naturalWidth > 0`, descargas WebP/AVIF, ZIP válido, borrado, aislamiento entre usuarios, 0 errores de consola y 0 4xx/5xx inesperados |
| `CA-06` | Auditoría de seguridad: relay local sin SSRF y restringido a dev/emulador, `assertNoRealSecret` sin falsos positivos pero con detección de cloud/JWT/GitHub, saneado de `name`, `/auth` limitado a 5/min, higiene de secretos y rutas (P4) |
| `CA-07` | 3 reportes oficiales presentes (`tester`, `auditor`, `architect`) + `STATE.md` actualizado sin cerrar `G-12`; push condicionado a todo en verde y CI (`ci.yml`, `infra-integration.yml`) en `success` |

## 3. Ámbito exclusivo de archivos

`backend/src/**` (persistencia y saneado de `name`, configuración, arranque), `frontend/src/**` (UX + relay de desarrollo), `frontend/vite.config.ts`, `tests/unit/**`, `tests/integration/**`, `tests/e2e/**`, `reports/implementation/F05/**`, `reports/audits/F05/**`, `reports/verification/**`, `STATE.md`, `docs/sdd/tasks.md`.

Fuera de raíz `<PROJECT_ROOT>`: prohibido (confinamiento). AWS real: prohibido.

## 4. Hitos y evidencia esperada

| Hito | Responsable | Evidencia |
|---|---|---|
| H1 — fix `name` + endurecimiento M-01..M-06/UX-01..03 | Developer/Designer | diff + tests nuevos (`tests/unit/f05-audit-full.test.ts`) |
| H2 — integración real > 400 KiB | Developer | `tests/integration/api/f05-name-large.test.ts` + salida de consola de `vitest` |
| H3 — verificación independiente (typecheck/lint/build/unit/integración/E2E) | Tester | `reports/implementation/F05/F05-audit-full-tester.md` + `reports/implementation/F05/evidence/F05-AUDIT-FULL/` |
| H4 — dictamen de seguridad | Auditor | `reports/audits/F05/F05-audit-full-auditor.md` |
| H5 — consolidación, `STATE.md`, push condicionado y CI | Architect | `reports/verification/F05-full-review-architect.md` + hash de commit + runs de GitHub Actions |

## 5. Criterios de STOP (no continuar)

- Tester emite `NO-PASSED` → loop correctivo (máximo 3) antes de consolidar.
- Auditor finds `CRITICAL`/`HIGH` propios o fuga P4 → NO push; devolver al CTO.
- Falta de contexto material (decisión de producto/diseño no escrita) → `NEEDS_CONTEXT`.

## 6. Registro de acciones (append-only)

| Fecha | Actor | Acción | Resultado |
|---|---|---|---|
| 2026-11-19 | Architect | Lectura obligatoria (`AGENTS.md`, `STATE.md`, SDD, `P-05`, contrato de rol) y revisión del commit `6804f28` | DoR vigente; `G-6`/`G-7` autorizados, `G-12` retenido |
| 2026-11-19 | Architect | Revisión crítica del diff de trabajo (persistencia `name`, saneado, config, relay) | Detectado que `UX-01..03` ya estaban en `6804f28`; faltaban persistencia, tests, integración real, E2E real y reportes |
| 2026-11-19 | Architect | Emisión de esta tarea correctiva y despacho de Developer/Designer para el cierre de CSS + E2E real | En curso |
| 2026-11-19 | Developer/Designer | Cierre de CSS (`.batch-name-field`, `.job-id-secondary` con variables de tema), E2E real nuevo (`tests/e2e/f05-audit-full.spec.ts` + `playwright.f05-full.config.ts` con `npm run dev:backend`/`dev:frontend` y defaults de producto) y eliminación de muletas del E2E legacy (retirados `F05_E2E_RATE_LIMIT_MAX ?? '1000'` y el relay `context.route` a `:9297`); favicon añadido para evitar el 404 de `/favicon.ico` | E2E nuevo **1/1** y legacy **1/1**; typecheck/build/unit 322/322; **`lint` en rojo** por variable sin usar en `tests/unit/f05-audit-full.test.ts:39` (archivo fuera del ámbito del subagente) |
| 2026-11-19 | Architect | Revisión crítica del entregable del Developer/Designer (lectura de los 4 ficheros E2E/CSS + `git diff`) | Aceptado; única incidencia el error de lint. Documentada la adaptación `NODE_OPTIONS=--dns-result-order=ipv4first` como ajuste **de harness en Windows** (Vite enlazaba solo `::1`), sin efecto sobre API, rate limit ni respuestas |
| 2026-11-19 | Developer/Designer (follow-up) | Corrección autorizada del error de lint usando la variable `backend` ya existente (sin cambiar la semántica del test) y ampliación del comentario del ajuste de harness | `lint` **exit 0**, unit **322/322**, typecheck exit 0 |
| 2026-11-19 | Auditor (loop 1/3) | Auditoría estática de los 8 puntos de ámbito + higiene P4/secretos | **`NOT_READY`**: 0 `CRITICAL`/`HIGH` propios, 6 hallazgos (2 `MEDIUM`, 3 `LOW`, 1 `INFO`); matriz **7 PASS / 1 FAIL** (`M-05`); **fuga P4 bloqueante** (11 ubicaciones en 8 archivos versionados); 0 secretos reales |
| 2026-11-19 | Architect | Redacción mecánica P4 (sustitución por los marcadores ya usados en la anonimización `F05-T02`: `<PROJECT_ROOT>`, `<DOCKER_CLI_DIR>`, `<TF_CLI_DIR>`) en los 8 archivos señalados | Diff mínimo (**11 líneas** en 8 archivos); escaneo propio del árbol versionado → **0** rutas de host con ambos separadores; quedan solo rutas deterministas de contenedor (`/home/emulator/...`), clasificadas como no-fuga por el Auditor |
| 2026-11-19 | Developer (loop 2/3) | Implementación de AUD-02 (Claim Check con `rawImageKey` + error genérico, `tests/unit/worker/consumer-claim-check.test.ts`), AUD-03 (contrato `v1.1.0`, hash `ab548c7f...bc52`, tipos regenerados byte-idénticos), AUD-05 (`RATE_LIMIT_API_WINDOW_MS`, ventana API propia), AUD-06 (`canonicalizeStorageEndpoint` localhost→127.0.0.1) + verificación obligatoria | typecheck/lint/build exit 0; unit **338/338** (37 archivos); integración `f05-name-large` 1/1; E2E `f05-full` 1/1 (32.9 s); emulador sigue arriba; sin commit/push |
| 2026-11-19 | Architect | Actualización de docs: `STATE.md`, `docs/sdd/tasks.md`, `reports/verification/F05-full-review-architect.md` (hash contrato, 338/338, estado loop 2) | Producto cerrado a nivel código; informe Tester pendiente |
| 2026-11-19 | Tester (subagente `ses_e094fae7cffeT6fiXfNcL4nBTv`) | Ejecución V1..V6 con 19 evidencias en disco (`F05-AUDIT-FULL-tester-*.txt`) pero sin informe consolidado | **Interrumpido** (HTTP 429). **Relanzamiento en otra sesión** requerido para redactar `reports/implementation/F05/F05-audit-full-tester.md`, ejecutar `docker compose down` y confirmar puertos 3001/5173/9297 cerrados |
