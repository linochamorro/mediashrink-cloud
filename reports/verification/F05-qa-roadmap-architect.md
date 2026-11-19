# Retorno Architect — Roadmap QA integral (6 capas) + `F05-T05` (G-11) — MediaShrink Cloud

| Campo | Valor |
|---|---|
| **Fecha** | `2026-11-19` (America/Lima) |
| **Architect** | OpenCode — MediaShrink Cloud |
| **Alcance ejecutado** | `F05-T05` (G-11) + `F05-QA` (roadmap `docs/runbooks/qa-testing-roadmap.md`) |
| **Gates** | **G-11 AUTORIZADO** (ejecutado) · **G-7** Docker 2g/2.0 (apagado al terminar) · **G-12 RETENIDO — NO ejecutado** (0 add/commit/push/release) |
| **Veredicto global** | **`PASSED` — 7/7 capas (0–6)** · `temporary/` borrado y suite independiente · **12/12 PNG** verificados · 0 secretos, 0 rutas absolutas |
| **Dictámenes** | Tester `F05-T05`: `PASSED` (loop 1/3) · Tester `F05-QA`: `PASSED` (7/7 capas) |

---

## 1. `F05-T05` — Borrado verificado de `temporary/` (G-11)

Verificación propia + evidencia del Tester (`F05-T05-{tester,architect}.md`, 9 evidencias `F05-T05-*`):

| Requisito | Resultado |
|---|---|
| Ruta real dentro de la raíz | `<PROJECT_ROOT>\temporary` · `.gitignore:40` con `git check-ignore -v` · **0 archivos trackeados** (sin pérdida de historial) |
| Borrado físico | **73 ítems** eliminados · `REMOVE_EXIT=0` · `Test-Path temporary = False` |
| Reejecución sin `temporary/` | typecheck **0** · lint **0** · build **0** · `test:unit` **303/303 (32 archivos)** · `tests/integration` **100/100 (24 archivos)** — todo `EXIT_CODE=0` |
| Condiciones reales | Emulador `healthy`, 3× `docker cp`, `terraform apply` → **11 recursos**; `tests/integration/infra/**` contra emulador + Terraform reales |
| Cierre G-7 | `docker compose down` exit 0 · `compose ps -a` vacío · sin add/commit/push |

> La integración es **100/100** (no 97/97) por **+3 tests exactos** de `enriched-headobject.test.ts` (F05-T02, ya en el árbol): 97 + 3 = 100, sin pérdidas.

## 2. Matriz del roadmap — 6 capas (veredicto propio del Tester con ejecución propia)

| Capa | Veredicto | Cifras verificadas en evidencia |
|---|---|---|
| **0. Independencia tras G-11** | ✅ **PASSED** | `temporary/` ausente · typecheck/lint `exit 0` · unit **303/303 (32 f.)** · integración **100/100 (24 f.)** |
| **1. Infraestructura** | ✅ **PASSED** | `fmt/init/validate` exit 0 · `apply` **11 recursos** · **26/26** comprobaciones de estado (lifecycle 30 d sin bucles, `maxReceiveCount=3`, TTL `ENABLED`, CORS) · `tests/integration/infra/` **6/6 (3 f.)** `EXIT_CODE=0` |
| **2. Contratos/Auth/DB** | ✅ **PASSED** | seed idempotente: **12 IDs idénticos** entre ejecución 1 y 2 (`MISMOS_IDS=True`) · focal contracts/auth/db **101/101 (13 f.)** · suite unit completa **303/303 (32 f.)** |
| **3. API HTTP + Storage** | ✅ **PASSED** | `tests/integration/api/` **32/32 (8 f.)** `EXIT_CODE=0` (POST /jobs, presigned PUT/GET, confirm idempotente, ZIP+413, DELETE) · unit api **103/103 (13 f.)** |
| **4. Worker sharp** | ✅ **PASSED** | `tests/unit/worker` + `tests/integration/worker` **35/35 (8 f.)** — WebP+AVIF+miniatura, strip EXIF con control negativo, `HeadObject` real, corrupto → 3 reintentos → DLQ + `PARTIAL`/`FAILED` sin abortar lote |
| **5. SPA real sin mocks (Playwright CLI)** | ✅ **PASSED** (3er intento) | `1 passed (21.5 s)`, `EXIT_CODE=0` · stack real (backend + frontend + emulador + seed) · **12/12 PNG** emitidos · los 2 intentos previos quedan documentados como aserciones de QA (ZIP 9 entradas, localizador por fila) |
| **6. Higiene final** | ✅ **PASSED** | **TOTAL HALLAZGOS: 0** (0 secretos, 0 rutas Windows absolutas en artefactos nuevos) · `temporary/` ausente · `docker compose down` exit 0 · sin escucha en **3001 / 5173 / 9297** |

**Conteo exacto de tests:** unit **303/303 (32 archivos)** · integración **100/100 (24 archivos)** (incluye infra 6/6) · focales por capa: 101 + 32 + 103 + 35 (subconjuntos de las suites anteriores, sin solapes de fallo) · E2E Playwright real **1 passed** · Terraform **11 recursos**.

## 3. Listado verificado de los 12 PNG (Playwright CLI)

Directorio: `reports/implementation/F05/evidence/qa-roadmap/`. **Verificación propia:** 12 archivos, magic PNG (`89 50 4E 47`) válido en los 12 (`BAD_COUNT=0`), tamaños cotejados uno a uno con el informe del Tester:

| # | Archivo | Bytes | # | Archivo | Bytes |
|---|---|---|---|---|---|
| 01 | `01-auth-login-claro.png` | 140 924 | 07 | `07-resultados-comparativa-metricas.png` | 110 242 |
| 02 | `02-auth-error-credenciales.png` | 6 702 | 08 | `08-descarga-individual-y-zip.png` | 255 230 |
| 03 | `03-auth-registro.png` | 5 919 | 09 | `09-lote-parcial-o-error.png` | 29 044 |
| 04 | `04-dashboard-tema-oscuro.png` | 129 110 | 10 | `10-borrado-manual-lote.png` | 94 204 |
| 05 | `05-upload-validacion-error.png` | 83 343 | 11 | `11-aislamiento-usuario-b.png` | 158 744 |
| 06 | `06-upload-lote-preset-progreso.png` | 159 449 | 12 | `12-logout-limpio.png` | 130 698 |

**Total: 12/12 · 1 403 714 bytes · 0 ausentes · 0 inválidos.** Nombres exactos del catálogo del runbook §2.

## 4. Hallazgos y desviaciones (para análisis del CTO)

| ID | Sev. | Descripción | Disposición propuesta (sin ejecutar) |
|---|---|---|---|
| **H-01** | **Media** | **El seed y la app usan tablas DynamoDB distintas.** `tools/scripts/seed/cli.ts:100` ejecuta `runSeed` con la constante `SEED_TABLE_NAME = 'mediashrink-seed-demo'` (diseñada en F01 como «tabla efímera propia… no interfiere con la de F04», `store.ts:23-24`), mientras la app lee `DYNAMODB_TABLE_JOBS=mediashrink-jobs` (`.env` + Terraform). Evidencia directa: `cap2-01-seed-idempotente.txt` imprime `Tabla DynamoDB: mediashrink-seed-demo`; el login con cuentas seed devuelve **401**. El esquema es compatible (`USER#PROFILE`, `itemType`), solo difiere el nombre. **Impacto:** la guía de arranque y el README («cuentas… generados por el seed local») no permiten iniciar sesión con las cuentas seed; el QA lo mitigó registrando por la API real. | **Opción recomendada (A):** corregir el seed para que use `DYNAMODB_TABLE_JOBS` (esquema ya compatible; `ensureSeedTable` respetaría la tabla de Terraform) bajo TDD, en una tarea autorizada por el CTO. **Opción B:** documentar el registro por UI/API como vía de acceso y dejar el seed solo como datos de demostración. Requiere decisión del CTO/Lino — **no ejecutado en esta etapa** (alcance exacto: sin Developer porque ninguna prueba falló). |
| **H-02** | Baja | Visor de imágenes del harness sirve contenido rezagado durante la QA visual; verificado por aserciones previas + IHDR/tamaño. | Sin acción de producto; observación de entorno. |
| **D-1…D-5** | Info | Desviaciones documentadas: backend vía `npx tsx` desde raíz; frontend vía `vite-webserver.mjs` (5173→3001); cuentas creadas por API/UI (derivado de H-01); `RATE_LIMIT_AUTH_MAX=1000` **solo** en el entorno QA (default de producto 5 intacto); ZIP real con **9 entradas** (3 fotos × 3 variantes). | Ninguna debilita el producto; todas quedan en la evidencia. |

Ninguna prueba falló: **no se despachó Developer** (condición del dispatch). Ningún riesgo aceptado sin Lino (**G-10 no invocado**).

## 5. Higiene y confinamiento (capa 6, verificación propia)

- `temporary/` **inexistente** (`Test-Path = False`).
- Docker: `docker ps -a` solo muestra **`dazzling_edison`** (contenedor ajeno preexistente del harness); contenedor y red del proyecto eliminados; **3001 / 5173 / 9297 sin escucha**.
- **G-12 retenido:** 0 `git add`, 0 commit, 0 push, 0 release. El árbol conserva los entregables de F02–F05 sin publicar.
- 0 secretos y 0 rutas Windows absolutas en los artefactos nuevos (escaneo `TOTAL HALLAZGOS: 0`); rutas anonimizadas con `<PROJECT_ROOT>`.
- Specs de QA visual añadidos sin commitear: `tests/e2e/qa-roadmap.spec.ts`, `tests/e2e/playwright.qa-roadmap.config.ts`.

## 6. Inventario de evidencia entregado

- `reports/implementation/F05/F05-T05-{task,tester,architect}.md` + 9 evidencias `F05-T05-*`.
- `reports/implementation/F05/F05-QA-roadmap-task.md` + `F05-QA-roadmap-tester.md` (veredicto por capa).
- `reports/implementation/F05/evidence/qa-roadmap/`: **12 PNG** + `cap1-*`…`cap6-*` (18 archivos) + `playwright-results/`.

---

**Estado del retorno:** etapa `F05-T05` + roadmap QA **`PASSED`** y entregada al CTO para análisis. **Detenido en el punto obligatorio:** sin `git push` (G-12 retenido), pendiente de autorización expresa de Lino para `F05-T06`. Decisión requerida del CTO sobre **H-01** (tabla del seed) antes de la publicación final.
