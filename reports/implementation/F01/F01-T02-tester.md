# Dictamen Tester — `F01-T02` (cliente DynamoDB y modelo de datos)

| Campo | Valor |
|---|---|
| **Tarea / fase / paquete** | `F01-T02` — Fase 1 — `docs/sdd/packages/P-01-critical-foundations.md` |
| **Criterio asignado** | `CA-02`: CRUD DynamoDB en `aws/aws-emulator` con TTL 30 días y aislamiento estricto por `userId`, con ítems hijos por imagen |
| **Rol / riesgo** | Tester independiente · riesgo 3 (persistencia y aislamiento) |
| **Versión / Loop** | `v1 — Loop 1/3` (sin reverificación, sin activación de loops) |
| **Fecha de verificación** | `2026-11-17` (aprox. 18:28–18:33, hora local) |
| **Dictamen global** | **`PASSED`** |

## 1. Entrada e independencia

Leídos: `.agents/roles/tester.md`, `AGENTS.md`, `STATE.md`, `P-01-critical-foundations.md` (CA-02),
`spec.md` §4, `constitution.md` (PR-07, IN-06, IN-09), `F01-T01-architect.md`,
`F01-T02-task.md`, `F01-T02-developer.md` (+ addendum), `backend/src/db/**`,
`tests/integration/db/**`, `backend/src/contracts/catalog.ts`,
`docs/architecture/03-data-model-and-storage-contract.md` y `backend/package.json`.

Ejecución **propia**: arranqué y apagué el emulador, exporté CA/credenciales efímeras, corrí la
suite de integración completa, busqué `skip/only/todo`, enumeré tablas con `ListTables`, corrí
`npm run typecheck`, `npm ci` y dos corridas de cobertura, y verifiqué el ámbito. La evidencia del
Developer (`F01-T02-{red,green,refactor,...}.txt`) se usó **solo como registro cronológico** del
TDD; no se presentó como evidencia propia ni se reejecutó el `RED` invirtiendo código
(`.agents/roles/tester.md` §7).

## 2. Dictamen por criterio

| Criterio | Fuente | Comportamiento esperado / observado | Evidencia propia | Estado |
|---|---|---|---|---|
| CRUD de jobs (8 casos) | CA-02, `spec.md` §4 | create/get/update/delete con PK `userId` y SK `jobId`; duplicado → `JobAlreadyExistsError`; actualización conserva claves y TTL; borrado final coherente. 8/8 verdes | `F01-T02-tester-integration.txt` (job-store.test.ts) | **CUMPLIDO** |
| Ítems hijos por imagen | CA-02, `spec.md` §4 (D-09) | SK `IMAGE#<jobId>#<imageId>`, `parentJobId`, `imageId`, estado, bytes y `failureReason`; get/list/update/delete sin afectar al job; borrado conjunto. Cubierto en los 8 CRUD | `F01-T02-tester-integration.txt`; `F01-T02-tester-model.txt` §4 | **CUMPLIDO** |
| TTL 30 días (5 casos) | CA-02, IN-09, `spec.md` §4 | `RETENTION_DAYS=30`, `TTL_SECONDS=2_592_000`, `computeTtl = floor(createdAt/1000)+30d` en Unix seconds; tabla con `ttl` `ENABLED`; job con `ttl` entero; hijos heredan el TTL del padre; TTL incoherente rechazado. 5/5 verdes | `F01-T02-tester-integration.txt`; `F01-T02-tester-model.txt` §2–3 | **CUMPLIDO** |
| Aislamiento estricto (6 casos) | CA-02, PR-07, IN-06, `spec.md` §6 | B no lee (null/404 lógico), no modifica, no borra el job de A ni ve/modifica sus imágenes; `imageId` ajeno no direccionable; mismo `jobId` en A y B sin fuga. 6/6 verdes, datos de A intactos tras los intentos de B | `F01-T02-tester-integration.txt`; `F01-T02-tester-model.txt` §5–9 | **CUMPLIDO** |
| Sin `skip`/`only`/`todo` | METHODOLOGY, contrato de rol | Búsqueda en `tests/integration/db/**` → 0 coincidencias; 19 pruebas ejecutadas | `F01-T02-tester-integration.txt` §2 | **CUMPLIDO** |
| Registro TDD `RED→GREEN→REFACTOR` | PR-05, `task.md` §4 | Cronología íntegra: RED 19 omitidos por `NOT_IMPLEMENTED` (18:14:24) → GREEN 19/19 (18:17:38) → REFACTOR 19/19 (18:20:12); `imageItem()` extraída y orden de comprobación de `updateImage` coherentes con el código actual. **Revisado como registro**; no reejecutado invirtiendo código | `F01-T02-tester-integration.txt` §3 (registro del Developer) | **CUMPLIDO (como registro)** |
| Typecheck global | `task.md` §4 | `npm run typecheck` exit 0, sin diagnósticos en backend (incluye `tests/unit/domain/**` de T05) ni frontend; cierra el concern P-01 del Developer | `F01-T02-tester-typecheck.txt` | **CUMPLIDO** |
| Cobertura reproducible | Addendum A.1 (concern P3 de T05) | `@vitest/coverage-v8@^2.1.9` en `backend/package.json` (devDependencies) y `package-lock.json` (2.1.9, `dev:true`, integrity); `npm ls` → 2.1.9; `npm ci` exit 0 (324 paquetes); `npx vitest run tests/unit/domain --coverage` → 47/47 y `backend/src/domain/**` al 100 % en stmts/branch/funcs/lines; corrida filtrada → `All files 100 %` | `F01-T02-tester-coverage-dep.txt` | **CUMPLIDO** |
| Coherencia SDD y documentación | `spec.md` §4, PR-07/IN-06/IN-09, doc 03 | Modelo implementado = SDD en los 10 puntos contrastados; `docs/architecture/03-data-model-and-storage-contract.md` coherente en claves, TTL, operaciones, transporte y cifra de 19 pruebas | `F01-T02-tester-model.txt` (tabla + § documento) | **CUMPLIDO** |
| Entorno aislado y sin AWS real | G-4, `task.md` §2 | Endpoint exclusivo `https://127.0.0.1:9297`; tablas efímeras `mediashrink-dbtest-*`; `ListTables` paginado → `ALL_TABLES=[]`, `ORPHAN_COUNT=0`; credenciales efímeras por `fromIni`, sin secretos fijos ni `:9324` | `F01-T02-tester-down.txt` §4 | **CUMPLIDO** |
| G-7 (Docker con límites y apagado) | G-7, `task.md` §2 | `up -d` exit 0, `healthy`, `memory=2147483648`, `nanoCpus=2000000000`, `user=1000:1000`; `docker cp` ×3 y healthcheck `ok`; `down` exit 0; `docker ps -a` y `docker compose ps` vacíos | `F01-T02-tester-down.txt` §§1–5 | **CUMPLIDO** |
| Ámbito, secretos y G-6/G-6b | G-3, contrato de rol, `task.md` §3 | Solo reporte y evidencias propias (más un script de diagnóstico en `temporary/`, ya eliminado); ningún archivo de producto, test, manifiesto, docs ni ajeno modificado; sin `.env`, sin rutas Windows absolutas ni patrones de secretos en artefactos; sin Git/GitHub | `F01-T02-tester-scope.txt` | **CUMPLIDO** |

## 3. Problemas y seguimientos

**No hay incumplimientos de CA-02 ni hallazgos bloqueantes**, por lo que no se abren los 7 campos
de problema ni se activan loops. Los cierres P-01 (typecheck global) y P-06 (tablas huérfanas) del
Developer quedan confirmados por ejecución propia. Quedan como **seguimientos no bloqueantes y
ajenos a este criterio**:

| Id | Naturaleza | Disposición |
|---|---|---|
| `P-05` | Avisos `install-scripts` de `sharp`/`esbuild` en `npm ci` | Deuda heredada de F00, documentada por el Developer; instalación exit 0 y suites cargadas; no aceptada en nombre de Lino |
| `A-04` | Etiqueta `[PROPUESTA]` en presets de `spec.md` §4 | Trasladada al CTO en F01-T01; no afecta a claves, TTL ni aislamiento |
| Volumen `aws-emulator-data` | Persiste tras `docker compose down` | Diseño del runbook §1.4; no es contenedor ni red, no rompe G-7; no se ejecutó `down -v` |

El informe de cobertura sin filtrar muestra `All files 34.4 %` porque incluye módulos no
ejercitados por la selección `tests/unit/domain`; el objeto de CA-05, `backend/src/domain/**`, está
al 100 % en las cuatro métricas, corroborado con el filtro explícito. No es un defecto.

## 4. Duración y procesos propios

Procesos ejecutados por este rol: `docker ps -a`, `docker compose up -d`, `inspect` (health y
límites), `docker cp` ×3, `curl` healthcheck, `npx vitest run tests/integration/db`, búsqueda de
`skip/only/todo`, script transitorio `ListTables`, `docker compose down` + verificación final,
`npm run typecheck`, `npm ci --no-audit --no-fund`, `npm ls @vitest/coverage-v8` y dos corridas de
cobertura. Ventana: 18:28–18:33 (≈5 min de ejecución activa), con un único ciclo de integración
(19/19 a la primera) y sin repeticiones innecesarias según METHODOLOGY §3.1.

## 5. Veredicto global

**`PASSED`**. `CA-02` se cumple íntegramente con evidencia de ejecución propia: 19/19 pruebas de
integración contra `aws/aws-emulator` (8 CRUD/hijos, 5 TTL, 6 aislamiento), claves `userId`/`jobId`,
TTL de 30 días en Unix seconds con herencia en los hijos, `imageId` con estado/bytes/motivo de
fallo, aislamiento estricto verificado en sus seis casos negativos, documentación coherente y
contenedor apagado sin tablas huérfanas. Gates G-3/G-4/G-6/G-6b/G-7 respetados.

Este dictamen cubre **únicamente los criterios asignados al Tester**. No cierro la tarea, no
actualizo `STATE.md`/`tasks.md` y no activo loops: el cierre compete a Architect tras integrar la
auditoría de riesgo 3 (`reports/audits/F01/F01-T02-auditor.md`), que es rol distinto y continúa
pendiente en el flujo normal de la fase.
