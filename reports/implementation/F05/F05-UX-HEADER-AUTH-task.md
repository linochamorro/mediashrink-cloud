# F05-UX-HEADER-AUTH — Acceso de cuenta en el `<header>` (encargo puntual de Lino)

| Campo | Valor |
|---|---|
| **ID / Fase** | `F05-UX-HEADER-AUTH` · Fase Final `P-05` · tras aprobación manual de Lino |
| **Versión / Loop** | v1 — 2026-11-20 · `Loop 1/3` |
| **Owner / roles** | Architect (coordinación) · **Designer** (UI/UX + TDD) · **Tester** (verificación independiente) |
| **Riesgo** | 2 (UI accesible, temas, capturas públicas) |
| **Gates** | `G-7` Docker autorizado (2 GiB / 2.0 CPUs, apagar al terminar) · `G-6` condicionado a `PASSED` + `P4=0` · `G-12` **RETENIDO** · `G-6b` permite `.agents/`/`reports/` en GitHub |
| **Dependencia** | `F05-QA-HUMAN` `PASSED` 31/31 (commit `206b5a8`, CI verde); sin deuda funcional pendiente |
| **Objetivo** | **Única** modificación visual: mover el acceso de login y la información de sesión al `<header className="topbar">`, junto al selector de tema, retirándolos de debajo de «Prepara un lote». Sin cambiar comportamiento de producto, contratos ni API. |

---

## 1. Requisitos de diseño e implementación

### 1.1 Estructura
- **Eliminar** de `<section className="workspace">` (bajo «Prepara un lote») el bloque `.auth-strip` (formulario) y `.session-bar` (Correo/«Cerrar sesión»). Retirar también sus reglas CSS muertas en `frontend/src/styles.css`.
- **Ubicar en `<div className="top-actions">` del `<header className="topbar">`, junto a `.theme-toggle`:**
  - **Sin sesión (`!session`):** botón visible **«Iniciar sesión»** que abre un **popover/panel accesible** (`role="dialog"`, `aria-modal` o patrón equivalente, `aria-expanded`/`aria-controls`/`aria-haspopup="dialog"` en el trigger) con el **formulario existente**: Correo electrónico, Contraseña, submit «Iniciar sesión»/«Crear cuenta», cambio de modo y `role="alert"` para errores. Cierre con **Escape**, botón cerrar explícito y **tras autenticar con éxito**. Gestionar foco: al abrir, foco al primer campo; al cerrar, foco de vuelta al trigger.
  - **Con sesión (`session`):** mostrar de forma compacta el correo (`session.user.email`) y el botón **«Cerrar sesión»**, alineados junto a Claro/Oscuro. Mantener el texto «Cerrar sesión» como nombre accesible del botón.
- **Decisión táctica del Architect (evita colisión de selectores):** el trigger del header tendrá **texto visible «Iniciar sesión»** pero **nombre accesible distinto** `aria-label="Abrir panel de acceso"`, para que `getByRole('button', { name: /Iniciar sesión/ })` siga identificando únicamente al **submit** del formulario. Los tests nuevos usarán `getByRole('button', { name: 'Abrir panel de acceso' })` para abrir el panel. La sesión se verificará con `getByRole('banner')` (el `<header>`) scoped al correo, ya que desaparece el texto «Sesión iniciada como».
- **Responsive y temas:** legibilidad/contraste/alineación en **Claro** y **Oscuro** y en escritorio + móvil (≤760 px y ≤430 px). Ajustar `.secure-label` si saturara el header. Solo variables CSS de tema (`--ink`, `--muted`, `--paper`, `--line`, `--green`…), sin colores fijos nuevos. El panel debe quedar dentro del viewport en móvil y no tapar el formulario.

### 1.2 Tests y capturas
- **TDD:** actualizar primero las specs E2E para esperar el nuevo flujo (RED contra la UI antigua), después implementar (GREEN).
- **Specs permanentes a actualizar** (el login/registro debe abrir antes el acceso desde el header):
  - `tests/e2e/f05-audit-full.spec.ts` (helper `login`, líneas ~114-120).
  - `tests/e2e/real-stack.spec.ts` (legacy, líneas ~44-52).
  - `tests/e2e/frontend-flow.spec.ts` (dobles por diseño, líneas ~65-78).
  - `tests/e2e/qa-roadmap.spec.ts` (capturas, `.auth-strip` y `.session-bar`, líneas ~239-291, 379, 515, 560).
  - `tests/e2e/screenshots.spec.ts` (capturas README: `.auth-strip` en §189, «Sesión iniciada como» en §199/229; `02-acceso-*.png` debe capturar el **panel del header**).
- **Unitarios:** añadir/actualizar solo si aplica (p. ej. helper de estado del panel); el conteo no debe bajar de **355/355** y debe quedar en 0 fallos.
- **Regenerar capturas** `docs/images/*.png` (18 archivos) con la UI real tras el cambio: el header nuevo debe verse en `01-portada-*`, `02-acceso-*` debe mostrar el panel de acceso, y las capturas con sesión deben mostrar el correo compacto en el header. Comprobar que `README.md` no reference texto eliminado; actualizar solo lo estrictamente necesario.
- **Runbook:** actualizar `docs/runbooks/manual-qa-guide-lino.md` para indicar que el acceso se abre desde el header (pruebas 2, 3 y 8), de modo que la guía de Lino siga siendo fiel.

---

## 2. Verificación independiente (Tester)
- `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:unit` → 0 fallos, **≥355 tests**.
- Re-ejecutar **`F05-QA-HUMAN` completo (31/31, Etapas 0–7)** en Playwright CLI contra el stack real (`dev:backend` + `dev:frontend` + emulador), **sin muletas**: 0×404, 0 errores de consola, **capturas del nuevo header en Claro y Oscuro**.
- Impases tácticos menores de selectores/UI: resolver directamente con Designer/Developer y re-verificar (regla del rol 2026-11-20), registrándolo append-only.
- Cierre **`G-7`** (`docker compose down`, puertos 3001/5173/9297 cerrados) y escaneo **P4/G-3 = 0** sobre reportes/evidencia.

---

## 3. Ámbito y entregables
- **Permitido:** `frontend/src/App.tsx`, `frontend/src/styles.css`, `tests/unit/**` (si aplica), `tests/e2e/**`, `docs/images/**`, `README.md`, `docs/runbooks/manual-qa-guide-lino.md`, `reports/implementation/F05/**`, `reports/verification/F05-ux-header-architect.md`, `STATE.md`.
- **Prohibido:** `backend/`, `infra/`, contratos Zod, gates, `git push` salvo el condicionado del §4, `G-12`, AWS real.
- **Reportes:** `reports/implementation/F05/F05-ux-header-auth-designer.md`, `...-tester.md` y `reports/verification/F05-ux-header-architect.md`.
- **Retorno al CTO:** veredicto 31/31, cifra de unit, confirmación de capturas regeneradas, cierre G-7, hash en `main` y runs de CI (solo si `PASSED` y `P4=0`).

---

## 4. Registro de acciones (append-only)
| Fecha | Actor | Acción | Resultado |
|---|---|---|---|
| 2026-11-20 | CTO / Lino | Encargo puntual de UX: mover login/sesión al header | Autorizado; G-12 retenido |
| 2026-11-20 | Architect | Lectura obligatoria y revisión de selectores/specs/capturas; emisión de esta tarea | En curso |
| 2026-11-20 | Designer | Implementación UI + TDD + 18 capturas regeneradas + runbook | `DONE_WITH_CONCERNS`: alcance visual completo, typecheck/lint/build 0, 355/355 unit, 5 specs E2E actualizadas, G-7 cerrado |
| 2026-11-20 | Architect | Revisión crítica del diff `App.tsx`/CSS y decisión sobre el concern `qa-roadmap.spec.ts` paso 08 | Aceptado el diff. Decisión táctica (regla 2026-11-20): la aserción `waitForURL(/^https:\/\//)` es preexistente y ajena al UI, en un **spec de capturas con dobles/relays** (no evidencia de aceptación); **no se relaja ni bloquea** — se documenta como observación heredada. El gate es el `F05-QA-HUMAN` 31/31 sobre el stack real |
| 2026-11-20 | Architect | Reanudar Tester para verificación 31/31 con los selectores nuevos del header | `PASSED` 31/31, 0 hallazgos, G-7 cerrado, P4=0 |
| 2026-11-20 | Architect | Higiene pre-push: corrección P4 de 1 ruta de host en `F05-UX-HEADER-AUTH-test-unit.txt` (banner Vitest) → `<PROJECT_ROOT>` | Re-escaneo: 0 rutas de host reales en artefactos nuevos; PNG/`AKIA…` son falsos positivos ya clasificados |
