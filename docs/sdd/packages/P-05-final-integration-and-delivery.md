# P-05 — Fase Final: Integración global, Auditoría, Pruebas de Lino, `README.md` y Entrega

- **Estado:** EN EJECUCIÓN (`G-2` autorizado por Lino el 2026-11-18; etapa `F05-T01`/`F05-T02`/`F05-T04` previa a pausa `F05-T03`)
- **Fase del roadmap:** Fase Final (`docs/sdd/tasks.md`)
- **Prioridad:** P0
- **Harness asignado:** OpenCode (coordinación única tras cierre de F02/F03/F04)
- **Coordinación:** Architect de fase (retorna a CTO) · Roles: Developer, Designer, Tester, Auditor (obligatorio por Riesgo 3)

## 1. Objetivo y resultado verificable
Integrar `frontend/`, `backend/` (`createApiApp()` + servidor/worker local en `backend/src/index.ts`) e `infra/terraform/` contra `aws/aws-emulator` sin mocks; cerrar seguimientos abiertos (`F03-AUD-03`, `P4` anonimización de rutas absolutas en reportes/evidencias, limpieza de `npm install --no-save` en CI); superar la auditoría final de seguridad/privacidad (`0` `CRITICAL`/`HIGH`); entregar versión para **pruebas exploratorias de Lino**; alinear `README.md` con capturas reales Playwright; ejecutar el **borrado verificado de `temporary/` (`G-11`)** y realizar la **publicación final en GitHub (`G-12`)**.

## 2. Dependencias y gates de entrada (Checklist DoR)
- **Fases previas cerradas:** `F00`, `F01`, `F02` (+ addendum `F02-AUD-01`), `F03` (addendum final `PASSED`) y `F04` (`FASE_COMPLETA`).
- **G-2 Apertura de fase:** pendiente de autorización expresa de Lino.
- **G-7 Docker:** autorizado con `--memory=2g --cpus="2.0"`, apagar al terminar.
- **G-11 (Borrado físico de `temporary/`) y G-12 (Publicación final):** **PENDIENTES** de autorización expresa de Lino tras `F05-T03`/`F05-T04`.

## 3. Ámbito de archivos
Único harness activo en `F05`: acceso controlado a todo el repositorio `mediashrink-cloud` (`frontend/`, `backend/`, `infra/terraform/`, `.github/workflows/`, `tests/`, `docs/`, `README.md`, `reports/`, `STATE.md`, `docs/sdd/tasks.md`). Prohibido tocar archivos fuera de `D:\Projects\Bluemind_Lab\projects\portfolio\mediashrink-cloud`.

## 4. Tareas de la fase
| ID | Tarea | Depende de | Rol | Riesgo | Criterios |
|---|---|---|---|---|---|
| `F05-T01` | Wiring `backend/src/index.ts`, sincronización CI (retirar `npm install --no-save` temporal) e integración E2E real (`frontend` + `backend` + `terraform` + `aws/aws-emulator` sin mocks) | `F02`, `F03`, `F04` | Developer + Tester | 3 | `CA-01` |
| `F05-T02` | Cierre de seguimientos (`F03-AUD-03` validación URL presignada, `P4` anonimización de rutas en `reports/`/`evidence/`, `HeadObject` `raw`) + Auditoría final de seguridad/privacidad | `F05-T01` | Developer + Auditor | 3 | `CA-02` |
| `F05-T03` | **Pausa de pruebas exploratorias de Lino:** entregar guía de arranque local + cuentas seed y aplicar correcciones TDD si hay hallazgos | `F05-T02` | Architect / Developer + Tester | 2 | `CA-03` |
| `F05-T04` | Capturas reales Playwright (Claro/Dark) en `docs/images/` y `README.md` público según `docs/templates/readme-github.md` + `PROJECT_STRUCTURE.md §5.3` | `F05-T02` | Designer + Tester | 1 | `CA-04` |
| `F05-T05` | Borrado físico verificado de `temporary/` (`Gate G-11`) + reejecución de `build` y `tests/` completos | `F05-T03`, `F05-T04`, `G-11` | Architect + Tester | 2 | `CA-05` |
| `F05-T06` | Push final autorizado (`Gate G-12`), verificación CI en GitHub Actions y cierre (`STATE.md`, `F05-architect.md`) | `F05-T05`, `G-12` | Architect / CTO | 2 | `CA-06` |

## 5. Puntos de retorno obligatorios al CTO / Lino
1. **Tras `F05-T02` (antes de `F05-T05`/`F05-T06`):** retornar al CTO/Lino para **pruebas exploratorias humanas (`F05-T03`)** y solicitar autorización expresa de **`G-11` (borrado de `temporary/`)** y **`G-12` (publicación final)**.
2. **Al completar `F05-T06`:** entregar `reports/verification/F05-architect.md` con `FASE_COMPLETA`.
