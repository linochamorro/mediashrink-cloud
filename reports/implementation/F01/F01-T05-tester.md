# `F01-T05` — Verificación independiente: reglas puras bajo TDD

| Campo | Valor |
|---|---|
| **Tarea / paquete** | `F01-T05` · Fase 1 · `docs/sdd/packages/P-01-critical-foundations.md` |
| **Criterio verificado** | `CA-05`: reglas puras 100 % cubiertas bajo `RED → GREEN → REFACTOR` |
| **Rol** | `Tester` independiente (harness OpenCode) |
| **Riesgo** | `3 (Sensible)` — privacidad y seguridad de archivos |
| **Versión / loop** | `v1 — Loop 1/3` (no se activan loops) |
| **Fecha** | `2026-11-17` |
| **Veredicto global** | **`PASSED`** |

## 1. Fuentes leídas y alcance

`AGENTS.md`; `STATE.md`; `.agents/roles/tester.md`; `docs/sdd/packages/P-01-critical-foundations.md` (CA-05, §3–§5); `docs/sdd/spec.md` (FR-07, FR-11, FR-12, §6); `docs/sdd/plan.md` §4; `docs/sdd/constitution.md` (PR-01, PR-12, IN-07, IN-08, IN-10, IN-12); `reports/implementation/F01/F01-T05-task.md` (fuente de verdad de alcance); `reports/implementation/F01/F01-T05-developer.md` (concerns P3/P5); `backend/src/domain/**` (6 módulos); `tests/unit/domain/**` (6 pruebas + fixtures); `backend/src/contracts/catalog.ts` / `index.ts`; `backend/src/config/index.ts`; y la evidencia ajena `evidence/F01-T05-{red,green,refactor,coverage,privacy,states}.txt` como **registro cronológico**, no como evidencia propia.

Sin Git/GitHub, Docker, AWS real ni secretos. No se editó código, tests, manifiestos ni el reporte del Developer. Únicamente se crearon `evidence/F01-T05-tester-*.txt` y este reporte.

## 2. Tabla por criterio (ejecución propia)

| # | Criterio / gate | Comando o método propio | Resultado | Evidencia propia |
|---|---|---|---|---|
| 1 | Dominio: 47/47 y cobertura 100 % en 6 módulos | `npx vitest run tests/unit/domain --coverage` | **OK** · 6 archivos, 47/47; `backend/src/domain` 100 % en sentencias, ramas, funciones y líneas; exit 0 | `evidence/F01-T05-tester-coverage.txt` |
| 1b | Refuerzo: informe solo-dominio | `npx vitest run tests/unit/domain --coverage --coverage.include='backend/src/domain/**' --coverage.all --coverage.reporter=text` | **OK** · `All files 100/100/100/100`, 6/6 módulos; exit 0 | `evidence/F01-T05-tester-coverage-filtered.txt` |
| 2 | Suite permanente sin skip/only/todo | `npm run test:unit` | **OK** · 10 archivos, **119/119**; 0 marcadores de omisión; exit 0 | `evidence/F01-T05-tester-unit.txt` + `tester-scope.txt` §5 |
| 3 | Tipado | `npm run typecheck` | **OK** · sin diagnósticos, exit 0 | `evidence/F01-T05-tester-typecheck.txt` |
| 4 | Lint | `npm run lint` | **OK** · sin hallazgos, exit 0 | `evidence/F01-T05-tester-lint.txt` |
| 5 | Comportamiento CA-05 (5 familias) | Lectura de tests/código + corrida de suite | **OK** · cabeceras, SVG/GIF, anti-bomba desde config, ahorro 0/negativo y máquina de estados conformes | `evidence/F01-T05-tester-rules.txt` |
| 6 | Cronología `RED → GREEN → REFACTOR` | Registro cronológico ajeno (no reejecutado invirtiendo código) | **OK como registro** · RED 40 fallos por comportamiento (0 de resolución) → GREEN 47/47 → REFACTOR 47/47 + 100 % | `evidence/F01-T05-{red,green,refactor}.txt` (Developer) + `tester-rules.txt` §cronología |
| 7 | Ámbito, G-3 y manifiestos | Hashes/mtimes + búsquedas | **OK** · sin cambios propios fuera de evidencia/reporte; 0 rutas absolutas ni secretos; ver P5 para manifiestos concurrentes | `evidence/F01-T05-tester-scope.txt` |

### Cobertura por familia (CA-05)

| Familia | Evidencia de comportamiento leída | Veredicto |
|---|---|---|
| (a) Magic bytes JPEG/PNG/WebP/AVIF + MIME extensión coherente | `imageHeader.test.ts:25-44,107-148,184-193`; `imageHeader.ts:42-61,119-152,205-242` | **OK** |
| (b) Rechazo SVG (con XML/BOM), GIF animado/estático, ZIP y polimorfismo | `imageHeader.test.ts:62-76,150-158`; `fixtures.ts:97-118`; `imageHeader.ts:44,106-117,142-146` | **OK** |
| (c) Anti-bomba `MAX_PIXELS`/`MAX_FILE_SIZE_MB` desde `loadConfig()` | `antiBomb.test.ts:28-91`; `antiBomb.ts:32-70`; `config/index.ts:293-297` | **OK** |
| (d) Ahorro real 0 %/negativo sin recorte (PR-12) | `savings.test.ts:6-73`; `savings.ts:28-40` | **OK** |
| (e) Estados válidos/inválidos, `PARTIAL` con imagen `FAILED`, vacío fail-closed | `stateMachine.test.ts:14-129`; `stateMachine.ts:29-84`; `JobStatus` del contrato congelado (`contracts/index.ts:20`, `catalog.ts:202-206`) | **OK** |
| Composición sin I/O | `index.test.ts:37-64`; `domain/index.ts:1-5` | **OK** |

## 3. Integralidad del registro TDD

El RED ajeno contiene **40 fallos por aserción de comportamiento** y 6 aciertos (46 tests), **sin errores de resolución de módulo ni de sintaxis** (`evidence/F01-T05-red.txt`); el GREEN final 47/47 y el REFACTOR 47/47 con cobertura 100 %. Este Tester **no reejecutó el RED invirtiendo el código**, conforme a la regla de independencia; lo acepta como registro cronológico íntegro y lo contrasta con la corrida propia en verde. Se observa que el RED registró 46 tests y el GREEN 47 (un caso añadido durante GREEN), coherente con la refinación documentada por el Developer; no constituye incumplimiento.

## 4. Seguimientos no bloqueantes (no abren loop)

- **P3 — `@vitest/coverage-v8` instalado con `--no-save --package-lock=false`.** Verificado en este entorno: `require.resolve('@vitest/coverage-v8')` resuelve y la cobertura ejecutada es **real** (47/47, 100 % en los 6 módulos; evidencias propias §2.1 y §2.1b). Sin embargo, el paquete **no está declarado** en `package.json` raíz ni en `backend/package.json`; un `npm ci` limpio en CI no lo instalaría y `--coverage` fallaría allí. Se registra como **seguimiento no bloqueante para CA-05** (la evidencia de cobertura existe y es reproducible en este entorno), con recomendación de declararlo como `devDependency` en el manifiesto propio por **T02 / Architect**. Sin aceptación de riesgo G-10 por este rol.
- **P5 — cambios concurrentes de manifiestos.** Observado sin intervenir: `package-lock.json` y `backend/package.json` tienen mtime `18:22:53`, dentro de la ventana de verificación de este Tester, y hashes (`6716E924`, `7F7D339F`) distintos a los del handoff del Developer (`FBC9E5D0`, `6056015E`); `package.json` permanece `A2729881`. Coherente con la actividad paralela de `F01-T02` documentada en el reporte del Developer. Este rol no escribió manifiestos y no emite acusación de autoría: se recomienda al **Architect** confirmar procedencia. Afecta a gobernanza de alcance, **no a CA-05** (código y tests del dominio intactos, mtimes 18:12–18:17).

## 5. Dictamen

**`PASSED`**. CA-05 se cumple con evidencia propia: cobertura 100 % en los seis módulos de `backend/src/domain/**`, 47/47 en el dominio y 119/119 en la suite, `typecheck` y `lint` en verde, las cinco familias de reglas contrastadas contra tests permanentes y registro TDD cronológico íntegro. Sin hallazgos bloqueantes CRITICAL/HIGH. P3 y P5 quedan como seguimientos no bloqueantes con responsable. La auditoría de riesgo 3 (`reports/audits/F01/F01-T05-auditor.md`) es un artefacto separado coordinado por Architect; este dictamen se limita a la verificación independiente asignada.

**Handoff:** Architect integra este dictamen para el cierre de `F01-T05`; no se activan loops.
