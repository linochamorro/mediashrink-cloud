# `F05-QA` — Roadmap integral de pruebas (6 capas) + 12 screenshots Playwright CLI — Informe Tester

| Campo | Valor |
|---|---|
| **Tarea / Fase** | `F05-QA` · Fase Final (`F05`) · runbook `docs/runbooks/qa-testing-roadmap.md` |
| **Rol** | Tester (ejecución y evidencia propia) · Revisor: Architect (`F05-qa-roadmap-architect.md`) |
| **Fecha** | 2026-11-19 · Loop 1/3 · Riesgo 3 (Sensible) |
| **Gates** | **G-7** Docker 2g/2.0 (apagado al terminar ✓) · **G-12 RETENIDO** (0 commits/push) · **G-11** (`temporary/` ausente) · **G-3** (0 secretos) |
| **Evidencia** | `reports/implementation/F05/evidence/qa-roadmap/` (12 PNG + `cap1..cap6-*.txt`) |

## 1. Veredicto global

# ✅ PASSED — 7/7 capas (0 a 6), sin bloqueos

| Capa | Veredicto | Cifra clave | Evidencia |
|---|---|---|---|
| **0. Independencia (hereda `F05-T05`)** | ✅ **PASSED** | `temporary/` ausente · typecheck/lint `exit 0` · unit **303/303** · integración **100/100** | `F05-T05-*` + `cap6-01-higiene.txt` |
| **1. Infraestructura (Terraform + emulador)** | ✅ **PASSED** | `fmt/validate` `exit 0` · `apply` **11 recursos** · **26/26** checks de estado · infra int. **6/6** · integración completa **100/100** | `cap1-01..05` |
| **2. Contratos, Auth y Persistencia** | ✅ **PASSED** | seed idempotente **12 IDs idénticos** · contratos/auth/db **101/101 (13 f.)** · suite unit **303/303 (32 f.)** | `cap2-01..03` |
| **3. API HTTP y Storage** | ✅ **PASSED** | integración API **32/32 (8 f.)** · unit API **103/103 (13 f.)** | `cap3-01..02` |
| **4. Worker de imágenes (sharp)** | ✅ **PASSED** | worker **35/35 (8 f.)** (WebP+AVIF+thumb, strip EXIF, DLQ) | `cap4-01` |
| **5. Frontend SPA — navegador real (Playwright CLI)** | ✅ **PASSED** (3er intento) | **1 passed (21.5s)** · **12/12 PNG** verificados (magic+IHDR) | `cap5-00..02` + `01..12*.png` |
| **6. Seguridad e Higiene final** | ✅ **PASSED** | **0 secretos · 0 rutas absolutas** (`TOTAL HALLAZGOS: 0`) · Docker `down exit 0` · puertos 3001/5173/9297 libres | `cap6-01..02` |

## 2. Detalle por capa (comandos reales · EXIT_CODE)

### Capa 0 — Independencia tras G-11
- Hereda `F05-T05` **PASSED** (`temporary/` inexistente). Re-verificado hoy: `npm run typecheck` → `exit 0`; `npm run lint` → `exit 0` (ambos con el spec QA nuevo); `npm run test:unit` → **303/303**; `tests/integration` → **100/100**; `temporary/` → ausente (`cap6-01`).

### Capa 1 — Infraestructura (`infra/terraform/` + `aws/aws-emulator`)
| Evidencia | Comando | Resultado · EXIT_CODE |
|---|---|---|
| `cap1-01-fmt-validate.txt` | `terraform fmt -check` / `init` / `validate` | `exit 0` en los tres · **EXIT_CODE=0** |
| `cap1-02-apply.txt` | `terraform apply` (emulador) | `Apply complete! Resources: 11 added, 0 changed, 0 destroyed` · **EXIT_CODE=0** |
| `cap1-03-state-checks.txt` | 26 comprobaciones de estado (lifecycle 30 d sin bucles, CORS exacto `localhost:5173` GET/PUT sin comodín, SQS `maxReceiveCount=3`→DLQ `visibility=120`, DynamoDB `userId`/`jobId` + TTL `Enabled`) | **TOTAL_CHECKS=26 · 26 PASS / 0 FAIL** · **EXIT_CODE=0** |
| `cap1-04-integration-infra.txt` | `npx vitest run tests/integration/infra` | **6 passed (6) · 3 archivos** · **EXIT_CODE=0** |
| `cap1-05-suite-integracion-completa.txt` | `npx vitest run tests/integration` | **100 passed (100) · 24 archivos** · **EXIT_CODE=0** |

### Capa 2 — Contratos, Auth y Persistencia
| Evidencia | Comando | Resultado · EXIT_CODE |
|---|---|---|
| `cap2-01-seed-idempotente.txt` | `npm run seed` ×2 + conteo en emulador | 12 IDs idénticos entre corridas (`demo-user-ana..carla`, `demo-job-ana..carla`, `img-*`); usuarios=3, jobs=3, imágenes=6 en ambas · **EXIT_CODE=0** |
| `cap2-02-vitest-contracts-auth-db.txt` | `npx vitest run` (contracts/auth/db + seed) | **101 passed (101) · 13 archivos** (Zod v1 congelado, JWT HS256+scrypt, 401/404 sin oracle, 429, aislamiento `userId`) · **EXIT_CODE=0** |
| `cap2-03-suite-unit-completa.txt` | `npm run test:unit` | **303 passed (303) · 32 archivos** · **EXIT_CODE=0** |

### Capa 3 — API HTTP y Storage
| Evidencia | Comando | Resultado · EXIT_CODE |
|---|---|---|
| `cap3-01-vitest-api.txt` | `npx vitest run tests/integration/api` | **32 passed (32) · 8 archivos** (`POST /jobs`→`{job,uploads}`, presigned PUT/GET, confirm idempotente, ZIP+413, DELETE) · **EXIT_CODE=0** |
| `cap3-02-vitest-api-unit.txt` | `npx vitest run tests/unit/api` | **103 passed (103) · 13 archivos** · **EXIT_CODE=0** |

### Capa 4 — Worker de imágenes (`sharp`)
| Evidencia | Comando | Resultado · EXIT_CODE |
|---|---|---|
| `cap4-01-vitest-worker.txt` | `npx vitest run tests/unit/worker tests/integration/worker` | **35 passed (35) · 8 archivos**: WebP+AVIF+miniatura WebP, strip total EXIF/XMP/IPTC con control negativo (`exifStripped: true`), `HeadObject` real para `bytesBefore/After`, corrupto → 3 reintentos → DLQ + `PARTIAL` · **EXIT_CODE=0** |

### Capa 5 — SPA en navegador real sin mocks (Playwright CLI)
| Evidencia | Comando | Resultado · EXIT_CODE |
|---|---|---|
| `cap5-00-stack.txt` | Arranque pila (12 comandos reales) | emulador `healthy` + 3 `docker cp` (CA/config/credenciales) + health `ok` · backend `F05_SERVER_READY {"port":3001}` · frontend `5173→proxy 3001` · **EXIT_CODE=0** |
| `cap5-01-playwright.txt` | `npx playwright test -c tests/e2e/playwright.qa-roadmap.config.ts` | **1 passed (21.5s)** · logs `F05_QA 01..12` + `F05_QA RESULTADO: 12/12 PNG emitidos` · **EXIT_CODE=0** |
| `cap5-02-png-check.txt` | Test-Path + Length + magic `89 50 4E 47` + IHDR | **RESUMEN: 12/12 PASS · 0 FAIL** · **EXIT_CODE=0** |

**Escenarios ejecutados en la corrida exitosa (sin mocks, datos reales):**
- **01–03** login claro (tema por defecto) → error de credenciales acotado → registro público (idempotente ante 409).
- **04** dashboard en tema Oscuro persistido tras recarga.
- **05** rechazo en cliente de archivo no permitido (SVG).
- **06** drag & drop con 3 presets + barra de progreso en polling → lote `6440f48f-6f13-4cc5-a0fa-1f99e353ab86`.
- **07** lote `COMPLETED`: comparativa antes/después, bytes reales, `% ahorro`, badge `EXIF eliminado`.
- **08** descarga individual **WEBP 8690 B (RIFF/WEBP)** + **ZIP 48448 B con 9 entradas** (3 fotos × 3 variantes: WebP/AVIF/thumb).
- **09** archivo corrupto real (120 B, `FF D8 FF` + ceros) → 3 reintentos `DIMENSIONS_UNAVAILABLE` → DLQ → UI **`PARTIAL`** en lote `3cd15bca-845d-4e45-93e4-b24650ed7905` (1 válida + 1 corrupta).
- **10** `DELETE` del lote `PARTIAL` confirmado en UI y lista actualizada.
- **11** sesión de `bruno.demo@example.com` → su lote `0944408c-f05e-4883-8227-c2f0c3f5bc44`, sin lotes de `ana.demo` (aislamiento `userId`).
- **12** logout limpio, sin datos ni previews residuales.

### Capa 6 — Seguridad e higiene final
| Evidencia | Comando | Resultado · EXIT_CODE |
|---|---|---|
| `cap6-01-higiene.txt` | Escaneo de patrones (rutas Windows, JWT, `AKIA`, PEM, `Bearer`) en artefactos nuevos + ambos specs | **TOTAL HALLAZGOS: 0** · `temporary/` ausente · `.env` fuera de git · **EXIT_CODE=0** |
| `cap6-02-cierre.txt` | `taskkill /T /F` (propios) → `docker compose down` → `docker ps -a` → puertos | backend/frontend detenidos · `COMPOSE_DOWN_EXIT=0` (contenedor y red eliminados) · solo queda el contenedor ajeno preexistente · `SIN_ESCUCHA_3001_5173_9297` · **EXIT_CODE=0** |

## 3. Los 12 PNG obligatorios (runbook §2) — tamaño y dimensión

Todos en `reports/implementation/F05/evidence/qa-roadmap/`, magic PNG + IHDR válidos:

| # | Archivo PNG | Bytes | Dimensión |
|---|---|---|---|
| 01 | `01-auth-login-claro.png` | 140 924 | 1440×1246 |
| 02 | `02-auth-error-credenciales.png` | 6 702 | 938×105 |
| 03 | `03-auth-registro.png` | 5 919 | 938×83 |
| 04 | `04-dashboard-tema-oscuro.png` | 129 110 | 1440×1207 |
| 05 | `05-upload-validacion-error.png` | 83 343 | 1014×706 |
| 06 | `06-upload-lote-preset-progreso.png` | 159 449 | 1440×1729 |
| 07 | `07-resultados-comparativa-metricas.png` | 110 242 | 938×487 |
| 08 | `08-descarga-individual-y-zip.png` | 255 230 | 1440×1889 |
| 09 | `09-lote-parcial-o-error.png` | 29 044 | 938×487 |
| 10 | `10-borrado-manual-lote.png` | 94 204 | 1014×888 |
| 11 | `11-aislamiento-usuario-b.png` | 158 744 | 1440×1774 |
| 12 | `12-logout-limpio.png` | 130 698 | 1440×1246 |

**Total: 1 403 714 bytes · 12/12 PASS · 0 FAIL** (`cap5-02-png-check.txt`, EXIT_CODE=0).

## 4. Cronología de la ejecución (2026-11-19)

1. **Lectura obligatoria** (AGENTS/STATE/runbook/paquete `P-05`) y entorno: `docker compose up` + 3× `docker cp` + health `ok`.
2. **Capa 1** → `cap1-01..05` (Terraform fmt/init/validate/apply + 26 checks + suites): todo `EXIT_CODE=0`.
3. **Capa 2** → `cap2-01..03` (seed idempotente, 101/101, 303/303): `EXIT_CODE=0`.
4. **Capa 3** → `cap3-01..02` (32/32 + 103/103): `EXIT_CODE=0`.
5. **Capa 4** → `cap4-01` (35/35 worker): `EXIT_CODE=0`.
6. **Capa 5 — 3 intentos:**
   - **Intento 1** (`cap5-01-playwright-intento1-fallido.txt`, `EXIT_CODE=1`): aserción del ZIP esperaba 3 entradas; el ZIP real tiene **9** (3 fotos × 3 variantes). Aserción corregida con magic RIFF/WEBP ó `ftyp`.
   - **Intento 2** (`cap5-01-playwright-intento2-fallido.txt`, `EXIT_CODE=1`): `strict mode violation` con 2 elementos `Descargar ZIP` (historial acumulado); localizador corregido por fila `li` filtrada por `jobId`.
   - **Intento 3** (`cap5-01-playwright.txt`, `EXIT_CODE=0`): **1 passed (21.5s) · 12/12 PNG**.
7. **Capa 6** → higiene `TOTAL HALLAZGOS: 0` (`cap6-01`) y cierre de pila (`cap6-02`): `docker compose down exit 0`, puertos libres.

## 5. Hallazgos (formato de 7 campos)

### H-01 — El seed de demostración no autentica contra la tabla de la app
| Campo | Valor |
|---|---|
| **1. ID / Título** | `H-01` — Seed `npm run seed` escribe en `mediashrink-seed-demo` y la app lee `mediashrink-jobs` |
| **2. Capa / Ubicación** | Capa 2 (seed) · `tools/scripts/seed/store.ts` (línea de tabla) vs `backend/src/` (tabla `mediashrink-jobs` de `.env`) |
| **3. Severidad** | **Media** (bloquea login con cuentas seed; no afecta a producto: el flujo real de registro funciona) |
| **4. Pasos de reproducción** | 1) `npm run seed` en el emulador · 2) abrir la SPA · 3) entrar `ana.demo@example.com` / `DemoAna2026!` |
| **5. Resultado esperado** | Login OK con las 3 cuentas seed |
| **6. Resultado obtenido** | **401** en `POST /auth/login`: el seed crea usuarios en otra tabla que la API no consulta |
| **7. Evidencia / Mitigación** | `cap2-01` (conteos del seed OK en su tabla) + registro real por API/UI en la corrida QA (D-3). Mitigación aplicada en la tarea: registrar las cuentas por el endpoint real. **Producto sin tocar (G-12/ámbito).** |

### H-02 — Limitación de verificación del visor de imágenes del harness
| Campo | Valor |
|---|---|
| **1. ID / Título** | `H-02` — El visor de imágenes del agente sirve contenido rezagado |
| **2. Capa / Ubicación** | Capa 5 (verificación visual fuera de la pila; no es defecto del producto) |
| **3. Severidad** | **Baja** (herramienta) |
| **4. Pasos de reproducción** | Leer dos PNG consecutivos con el visor del harness |
| **5. Resultado esperado** | El contenido mostrado coincide con el archivo leído |
| **6. Resultado obtenido** | Muestra la imagen anterior (p. ej. leyó el 07 y mostró el 09) |
| **7. Evidencia / Mitigación** | Verificación por **aserciones previas a cada shot** en el spec + magic/IHDR/tamaño/`fullPage` por archivo (`cap5-02`). El veredicto NO depende de la inspección visual del visor. |

## 6. Desviaciones documentadas

| ID | Desviación | Motivo |
|---|---|---|
| **D-1** | Backend con `npx tsx backend/src/server.ts` desde la raíz (no `npm run dev:backend`) | `npm --workspace` cambia el cwd → `.env` relativo no se carga (`F05_SERVER_READY` garantizado) |
| **D-2** | Frontend con `node ./tests/e2e/vite-webserver.mjs` (5173 → proxy 3001) | `backend/src` no monta middleware CORS (existe la config `corsOrigin`, sin `hono/cors`); el servidor de QA del repo sí añade el proxy. Verificado por grep |
| **D-3** | Cuentas seed registradas por API/UI real (no por `npm run seed`) | `H-01`: distinta tabla entre seed y app |
| **D-4** | `RATE_LIMIT_AUTH_MAX=1000` solo en el proceso QA | Evita 429 en el registro múltiple del QA; el default `.env` (5) queda intacto |
| **D-5** | ZIP del escenario 08 = **9 entradas** (no 3) | 3 fotos × 3 variantes (WebP, AVIF, miniatura) |

## 7. Cierre y estado final (G-7 / G-12)

- **Pila apagada:** backend (3001) y frontend (5173) detenidos · `docker compose down` → **exit 0** (contenedor `mediashrink-aws-emulator` y red `mediashrink-cloud_default` eliminados) · `docker ps -a` solo muestra el contenedor ajeno preexistente (intocado) · **sin escucha en 3001/5173/9297** (`cap6-02-cierre.txt`, EXIT_CODE=0).
- **G-12:** 0 `git add`/`commit`/`push`/`release` durante toda la tarea.
- **Ámbito:** no se tocó `frontend/src`, `backend/src`, `infra/`, `README`, `STATE.md`, `tasks.md` ni reportes ajenos; código nuevo limitado a `tests/e2e/qa-roadmap.spec.ts` + `tests/e2e/playwright.qa-roadmap.config.ts` (documentado); nada borrado.
- **Cuentas ficticias usadas:** `ana.demo@example.com` (lotes `690a1ca5…`, `c7fee4f7…`, `6440f48f…`), `bruno.demo@example.com` (lote `0944408c…`), `carla.demo@example.com` (sin usar) — no son secretos (G-3).

---
**Tester → veredicto: PASSED (capas 0–6) · 12/12 PNG · 0 secretos · 0 rutas absolutas · pila apagada.**
