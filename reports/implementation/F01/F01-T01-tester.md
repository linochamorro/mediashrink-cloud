# `F01-T01` — Verificación independiente (Tester)

| Campo | Valor |
|---|---|
| **Tarea / paquete** | `F01-T01` · Fase 1 · `P-01-critical-foundations.md` |
| **Criterio asignado** | `CA-01`: contratos Zod validan entradas/salidas; el frontend consume `types.generated.ts` sin duplicar tipos; `typecheck`/`lint`/tests en verde |
| **Riesgo / loop** | 2 (Relevante) · Loop 1/3 (no activado) |
| **Rol verificador** | `Tester` independiente (harness OpenCode) |
| **Fecha** | `2026-11-17` |
| **Veredicto global** | **`PASSED`** |

## 1. Entrada e independencia

Leídas: `.agents/roles/tester.md`, `AGENTS.md`, `STATE.md`, `docs/sdd/packages/P-01-critical-foundations.md` (CA-01, §3), `docs/sdd/{constitution,spec,plan}.md`, `reports/implementation/F01/F01-T01-{task,developer}.md`, `docs/architecture/04-api-and-component-contract.md`, `backend/src/contracts/**`, `frontend/src/api/types.generated.ts`, `frontend/src/{App,main}.tsx`, `tests/unit/contracts.test.ts`, `backend/package.json`, `package.json` raíz y la evidencia del Developer.

**Evidencia propia** (ejecutada por este rol; rutas relativas a la raíz del proyecto):
`reports/implementation/F01/evidence/F01-T01-tester-{contracts,typecheck,lint,unit,freeze,sdd,scope}.txt`.

**No presentada como propia:** la cronología RED/GREEN/REFACTOR/FREEZE del Developer (`F01-T01-{red,green,refactor,freeze}.txt`) se revisó únicamente como registro histórico (§3), sin reejecutarla invirtiendo código ni atribuyéndomela.

**Restricciones cumplidas:** no se editó código, tests, contratos, documentación ni el reporte del Developer; no se usaron Git/GitHub ni Docker; sin secretos ni rutas Windows absolutas en las salidas (verificación con búsqueda de `[A-Za-z]:\\` → 0 coincidencias).

## 2. Dictamen por criterio

| # | Criterio verificado | Método (ejecución propia) | Resultado | Veredicto |
|---|---|---|---|---|
| 1 | Esquemas Zod validan entradas/salidas; casos negativos y round-trips sustantivos | `npx vitest run tests/unit/contracts.test.ts` → `tester-contracts.txt` | **32/32**, exit 0. Negativos: preset `ULTRA`, estado `QUEUED`, formato `gif`, job sin `userId`, métrica incoherente (`savingsPct: 99`), transporte `:9324`/`:9297`, TTL erróneo, claves desconocidas. Positivos: round-trip de los 14 esquemas y ahorro `0 %`/negativo. Sin `.skip/.only/.todo` (0 coincidencias). | **PASSED** |
| 2 | Frontend consume el generado sin duplicar tipos | Escaneo de `frontend/src/**` + test de congelación → `tester-freeze.txt` | 0 redefiniciones de los 14 nombres fuera de `api/types.generated.ts`; 0 imports desde `backend/`/`contracts`; 14 `export type` únicamente en el generado. La UI es esqueleto de F00 (F03 la implementa); el contrato tipado es consumido por el test permanente, sin duplicación. | **PASSED** |
| 3 | `typecheck` en verde | `npm run typecheck` → `tester-typecheck.txt` | exit 0, sin diagnósticos (backend + frontend). | **PASSED** |
| 4 | `lint` en verde | `npm run lint` → `tester-lint.txt` | exit 0, sin hallazgos. | **PASSED** |
| 5 | Regresión unitaria completa | `npm run test:unit` → `tester-unit.txt` | **72/72** (4 archivos): 3 `frontend` + 2 `health` + 35 `config` (40 base F00) + 32 `contracts` (nuevos). | **PASSED** |
| 6 | Determinismo / congelación del archivo generado | Regeneración propia + SHA-256 antes/después → `tester-freeze.txt` | `npm run generate:types --workspace=@mediashrink/backend` exit 0; SHA-256 `CEB6A184…D36B` idéntico antes y después; cabecera con versión `1.0.0`, hash de catálogo `5d0082f8d97e0329862739123b7599c75ff7261834430039fa6e815bf68d626d` y marcador `<PROJECT_ROOT>`. 32 `it()`, 14 `export type`. | **PASSED** |
| 7 | Coherencia con SDD / documento de contratos | Revisión documental y de fuente → `tester-sdd.txt` | 14 contratos cubren auth, presets `HIGH`/`BALANCED`/`MAX_COMPRESSION`, 5 estados, `webp`/`avif`, `userId` obligatorio, ahorro `0 %`/negativo permitido, TTL 30 d (`2592000`), límites desde `loadConfig()`, QueueUrls canónicas (`:9324` solo en lógica de rechazo, nunca como valor). `exifStripped` obligatorio. | **PASSED** |
| 8 | Ámbito de escritura del Developer | Inspección de árbol, contenido y fechas → `tester-scope.txt` | Solo rutas permitidas en la ventana T01 (~17:15–17:27). Prohibidas con fechas previas: `package.json` raíz (10:42, sin script `seed`), `.env.example` (16:03), `STATE.md` (17:14), `tasks.md` (17:11), `infra/` (16:25–16:27), `.github/` (16:50), `frontend/src/{App,main}.tsx` (10:43). `backend/src/{db,auth,domain}/**` y `tools/scripts/**` no existen. Sin reportes ajenos. | **PASSED** |
| 9 | Registro cronológico RED → GREEN → REFACTOR | Revisión de registro (no reejecución) → §3 | RED `17:17:16` exit 1, 19 fallos **por comportamiento** (`expected true to be false`) y 8 aciertos, sin errores de módulo/sintaxis; GREEN `17:19:06` 27/27; REFACTOR `17:19:55` 27/27; FREEZE `17:23:27` 32/32. Secuencia temporal íntegra. | **PASSED** |

## 3. Notas de verificación

- **RED conductual:** los 19 fallos del registro RED son aserciones de `expectReject` (`expected true to be false`), no `MODULE_NOT_FOUND`, `TS####` ni errores de importación. Se acepta el scaffold permisivo temporal documentado en `F01-T01-P1` (esquemas permisivos para que el RED fallara por comportamiento y no por resolución de módulo, sustituido íntegramente en GREEN) como mecanismo válido en código greenfield. No se recreó ni se certifica su ejecución propia: solo se revisa el registro.
- **Sin secretos:** el único valor semilla del test es el marcador `REPLACE_WITH_LOCAL_DEV_SECRET`, no un secreto real (G-3).
- **Sin Git:** el repositorio no expone metadatos Git en este harness y su uso está prohibido; el ámbito se verificó por inspección de árbol, contenido y fechas, con la limitación declarada en `tester-scope.txt`.
- **Regeneración propia:** en cumplimiento del punto 4 se ejecutó el generador, que reescribió `frontend/src/api/types.generated.ts` con bytes idénticos; no se modificó ningún otro archivo de producto.

## 4. Hallazgos y cierre

**Sin hallazgos.** No proceden los 7 campos obligatorios de problema-solución al no existir incumplimiento. No se activan loops (1/3 sin consumir). No se emite `NEEDS_CONTEXT`: toda la evidencia requerida estaba disponible y fue producida por este rol.

**Veredicto global: `PASSED`.** `CA-01` se cumple con evidencia propia: los 14 contratos Zod validan entradas/salidas con casos negativos y round-trips sustantivos, el frontend no duplica tipos y consume el archivo generado como única fuente tipada, la congelación es reproducible, y `typecheck`, `lint` y los 72 tests están en verde. Corresponde al **Auditor** (riesgo 2) y al **Architect** continuar el flujo; este rol no actualiza `STATE.md` ni `tasks.md`.
