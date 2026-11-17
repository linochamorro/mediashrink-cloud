# Cierre de tarea (Architect) — `F00-T02`

| Campo | Valor |
|---|---|
| **Tarea** | `F00-T02` — Workspaces Vite/React + Hono + sharp + Vitest/Playwright |
| **Fase / paquete** | Fase 0 — `docs/sdd/packages/P-00-foundation-and-emulator.md` |
| **Versión / Loop usado** | `v1 — Loop 1/3` |
| **Rol implementador / verificador** | Developer / Tester (riesgo 1, sin Auditor) |
| **Dictamen Tester** | `PASSED` (`F00-T02-tester.md`, reejecución propia ~10:49–10:52) |
| **Estado de la tarea** | `CERRADA — PASSED` |
| **Fecha de cierre** | `2026-11-17` |

## 1. Revisión de aceptación reforzada (METHODOLOGY.md §3.2)

Contraste con SDD/paquete aprobado. Architect no ejecutó pruebas ni emitió un tercer dictamen: revisó reportes y evidencias de Tester.

| Requisito / fuente superior | Comportamiento observable | Evidencia / versionado | Límite de cobertura | Estado |
|---|---|---|---|---|
| `CA-02` (P-00 §5) · typecheck/lint/test en verde — PR-05, NFR-04 | `npm run typecheck`, `npm run lint`, `npm run test:unit` con exit 0 antes y después de `npm ci`; 35/35 tests (30 T01 + 5 humo) | `F00-T02-tester.md` §1; `evidence/F00-T02-tester-{typecheck,lint,test-unit,ci}.txt` | Typecheck estático; lint según configuración embebida; tests de frontend leen archivos fuente, no montan DOM | **CUMPLIDO** (con límites declarados) |
| `CA-02` · estructura canónica — `AGENTS.md` §3, `plan.md` §2 | `frontend/`, `backend/`, `tests/unit/`, workspaces npm, lockfile y tsconfigs presentes; `/health` único endpoint; `App.tsx` marcador | `F00-T02-tester.md` §1 (inspección de árbol y fuentes) | `infra/terraform/` y compose pertenecen a T03/T04; no se auditan aquí | **CUMPLIDO** |
| `CA-02` · sin producto F01–F03 — `task.md` §1, `plan.md` §2/§3, `spec.md` §5 | Sin Zod de dominio, DynamoDB, JWT, pipeline `sharp` ni UI; búsqueda de patrones: 0 coincidencias en esqueleto | `F00-T02-tester.md` §1 | `sharp` declarado como dependencia (tooling permitido), no usado en código; sin `git diff` (aún no hay repo) | **CUMPLIDO** |
| PR-05 · RED→GREEN→REFACTOR | RED 10:43:49 (5/5 fallos por comportamiento) < código 10:43:57 < GREEN 10:44:03 < REFACTOR 10:44:29 | `evidence/F00-T02-{red,green,refactor}.txt` + mtimes en `F00-T02-tester.md` §1 | RED no reproducible sin revertir código; juicio por registro íntegro, no inventado | **CUMPLIDO** |
| `task.md` §3 · ámbito exclusive y sin cambios laterales | Archivos de T01 intactos (mtimes previos); `.env.example`, `.gitignore`, `STATE.md`, `tasks.md` no tocados; único cambio documental §1.1 de `00-overview.md` | `F00-T02-tester.md` §1 | Sin `git diff`: comparación por filesystem/mtimes, no byte a byte | **CUMPLIDO** (con límite declarado) |

**Conclusión:** no hay reducción silenciosa de aceptación, contradicción SDD/`task.md` ni criterios sin evidencia. Concern P1 queda cerrado operativamente (lockfile + `npm ci` + arranque verificado); P2 es deuda técnica declarada.

## 2. Problemas y disposición

| ID | Causa | Solución | Verificación | Disposición |
|---|---|---|---|---|
| `F00-T02-P1` (heredado `F00-T01-P3`) | **DEMOSTRADA** — npm 11 no aprueba `postinstall` de `esbuild`/`sharp`; sin lockfile en T01 | Versionar `package-lock.json`, validar `npm ci`, no aprobar scripts (binarios de plataforma funcionan) | `npm ci` exit 0, Vitest y `sharp` cargan, 35/35 post-ci | **CERRADO para esta tarea** · riesgo residual para `F00-T06` (CI en runner distinto) |
| `F00-T02-P2` | **DEMOSTRADA** — ESLint 8 deprecado; ESLint 9 exige `eslint.config.js` fuera del ámbito | Mantener ESLint 8 con configuración embebida en `package.json`; documentar deuda | `npm run lint` exit 0 | **SEGUIMIENTO** para `F00-T06` · no bloqueante · aprendizaje `PROPUESTA_GLOBAL` |

No se acepta riesgo G-10 en nombre de Lino: ambos puntos son deuda declarada, no excepción metodológica.

## 3. Cobertura y límites globales

- La evidencia acredita tooling y esqueletos, **no** integración con emulador (CA-03), IaC (CA-04), repo (CA-05) ni CI remota (CA-06). Esos límites se cubren en las tareas restantes.
- No se ejecutó `npm run build`: no forma parte de los gates de `task.md`/`CA-02`; queda para la verificación final de fase si aplica.
- Sin Auditor (riesgo 1). Sin Git/GitHub ni Docker; sin secretos en reportes.

## 4. Cierre y siguiente paso

`F00-T02` queda `CERRADA — PASSED` en Loop 1/3. Se actualizan `docs/sdd/tasks.md` y `STATE.md`. Habilita `F00-T05` (depende de T02) y contribuye a `F00-T06`. `F00-T03` sigue en verificación por recurso Docker ausente.
