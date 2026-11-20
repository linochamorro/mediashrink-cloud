# F05-UX-HEADER-AUTH — Informe del Designer

| Campo | Valor |
|---|---|
| **Tarea** | `F05-UX-HEADER-AUTH` (encargo puntual de Lino; Architect coordina, Tester verifica) |
| **Versión / Loop** | v1 · 2026-11-20 · Loop 1/3 |
| **Estado** | **`DONE_WITH_CONCERNS`** — alcance visual completo y verificado; una observación ajena al alcance en `qa-roadmap.spec.ts` paso 08 (ver §6) |
| **Raíz autorizada** | `<PROJECT_ROOT>` (confinamiento P4) |
| **Gates** | `G-7` usado y **cerrado** · `G-12` retenido · sin `G-10` · G-3 sin secretos |

---

## 1. Alcance ejecutado

**Única modificación visual solicitada:** mover el acceso de login y la sesión al `<header className="topbar">`, junto al selector de tema, retirándolos de debajo de «Prepara un lote».

- `frontend/src/App.tsx`:
  - Eliminados `.auth-strip` y `.session-bar` de `<section className="workspace">`, junto con el texto «Sesión iniciada como».
  - En `<div className="top-actions">`, nuevo `.auth-control`:
    - **Sin sesión:** trigger con texto visible «Iniciar sesión» y `aria-label="Abrir panel de acceso"`, `aria-expanded`, `aria-controls="auth-panel"`, `aria-haspopup="dialog"`. Abre un `role="dialog"` / `aria-modal="true"` con el **formulario existente** (Correo electrónico, Contraseña, submit «Iniciar sesión»/«Crear cuenta», cambio de modo y `role="alert"` para errores).
    - **Con sesión:** correo compacto (`session.user.email`) + botón «Cerrar sesión», alineados con Claro/Oscuro.
    - Cierre del panel: **Escape**, botón explícito `aria-label="Cerrar panel de acceso"` y **tras autenticar con éxito**. Foco al primer campo al abrir y de vuelta al trigger al cerrar (el cierre por éxito no restaura foco porque el trigger desaparece).
- `frontend/src/styles.css`: reglas muertas `.auth-strip` / `.session-bar` eliminadas; `.auth-form` adaptado al panel (una columna); nuevos estilos tematizados con variables CSS existentes (`--paper`, `--ink`, `--muted`, `--line`, `--green`), sin colores fijos nuevos. El panel se ancla a `.top-actions` (no al trigger) para garantizar que permanece dentro del viewport en móvil; verificado a 390 px y 320 px (`F05-UX-HEADER-AUTH-mobile-*.png`). Este ajuste de posicionamiento no altera ninguno de los 18 fotogramas ya regenerados (panel cerrado en portada/flujo; `02-acceso` es captura del propio elemento).
- Specs E2E permanentes actualizadas **solo en la forma de acceder al formulario** (sin relajar ninguna aserción de producto): `f05-audit-full`, `real-stack`, `frontend-flow`, `qa-roadmap`, `screenshots`.
- `docs/runbooks/manual-qa-guide-lino.md`: pruebas 2, 3 y 8 y aviso general indican que el acceso se abre desde el header.
- `README.md`: revisado; **no contenía texto eliminado**, por lo que no se modificó.
- **No tocados:** `backend/`, `infra/`, contratos Zod, gates, `STATE.md`, `tasks.md`, memoria de Bluemind. **Sin commit ni push.**

### Selectores nuevos exactos

| Elemento | Selector |
|---|---|
| Trigger del header | `getByRole('button', { name: 'Abrir panel de acceso' })` (texto visible «Iniciar sesión») |
| Panel | `getByRole('dialog')` / `#auth-panel` / `.auth-panel` (`role="dialog"`, `aria-modal="true"`) |
| Submit del formulario | `getByRole('button', { name: /Iniciar sesión/ })` o `page.locator('form.auth-form button[type="submit"]')` (sigue siendo único: el trigger tiene `aria-label` distinto) |
| Cierre explícito | `getByRole('button', { name: 'Cerrar panel de acceso' })` |
| Logout | `getByRole('button', { name: 'Cerrar sesión' })` (en `getByRole('banner')`) |
| Sesión (correo) | `getByRole('banner').getByText('<email>')` / `.session-email` |

---

## 2. RED → GREEN (TDD)

| Fase | Acción | Resultado |
|---|---|---|
| **RED** | Specs actualizadas al nuevo flujo y ejecución de `screenshots.spec.ts` **contra la UI antigua** | `EXIT_CODE=1` · 2 tests fallidos en `getByRole('button', { name: 'Abrir panel de acceso' })` (trigger inexistente) y `getByRole('dialog')`. Evidencia: `evidence/F05-UX-HEADER-AUTH-RED-screenshots.txt` |
| **GREEN** | Implementación en `App.tsx` + `styles.css` y nueva ejecución de `screenshots.spec.ts` sobre el stack real (emulador + backend + Vite) | `EXIT_CODE=0` · **2/2 passed** (Claro 14,4 s · Oscuro 7,4 s). Evidencia: `evidence/F05-UX-HEADER-AUTH-GREEN-screenshots.txt` |
| **GREEN (regresión)** | `frontend-flow.spec.ts` (dobles) | `EXIT_CODE=0` · 3/3 |
| **GREEN (regresión)** | `real-stack.spec.ts` (pila real) | `EXIT_CODE=0` · 1/1 |
| **GREEN (regresión)** | `f05-audit-full.spec.ts` (pila real, usa el helper `login` modificado) | `EXIT_CODE=0` · 1/1 |
| **GREEN (accesibilidad)** | Spec efímera de teclado/foco (semántica, foco al primer campo, Escape, botón cerrar, unicidad del submit) | `EXIT_CODE=0` · 1/1. Evidencia: `evidence/F05-UX-HEADER-AUTH-GREEN-a11y.txt`. Config/spec efímeras eliminadas después. |
| **GREEN (responsive)** | Spec efímera de caja del panel a 390 px y 320 px | `EXIT_CODE=0` · 2/2. Evidencia: `evidence/F05-UX-HEADER-AUTH-GREEN-mobile.txt` + `F05-UX-HEADER-AUTH-mobile-{390,320}.png`. Config/spec efímeras eliminadas después. |

---

## 3. Tabla de comandos (evidencia con `EXIT_CODE=` real)

| Comando | EXIT_CODE | Resultado | Evidencia |
|---|---|---|---|
| `npm run typecheck` | **0** | sin diagnósticos | `F05-UX-HEADER-AUTH-typecheck.txt` |
| `npm run lint` | **0** | sin hallazgos | `F05-UX-HEADER-AUTH-lint.txt` |
| `npm run build` | **0** | frontend + backend OK | `F05-UX-HEADER-AUTH-build.txt` |
| `npm run test:unit` | **0** | **355/355 tests, 37 archivos, 0 fallos** | `F05-UX-HEADER-AUTH-test-unit.txt` |
| `npx playwright test --config=tests/e2e/playwright.screenshots.config.ts` (RED) | 1 | 2 fallos esperados | `F05-UX-HEADER-AUTH-RED-screenshots.txt` |
| `npx playwright test --config=tests/e2e/playwright.screenshots.config.ts` (GREEN) | 0 | 2/2 | `F05-UX-HEADER-AUTH-GREEN-screenshots.txt` |
| `docker compose down` | 0 | contenedor y red eliminados | `F05-UX-HEADER-AUTH-docker-compose-down.txt` |

Todos los archivos de evidencia están en `reports/implementation/F05/evidence/`. Las rutas de host y las URL presignadas del emulador fueron **redactadas** a `<PROJECT_ROOT>` / `<PRESIGNED_S3_URL_REDACTED>` (P4/G-3).

---

## 4. Capturas regeneradas (`docs/images/`, 18/18)

`01-portada-claro.png`, `01-portada-oscuro.png`, `02-acceso-claro.png`, `02-acceso-oscuro.png`, `03-subida-claro.png`, `03-subida-oscuro.png`, `04-progreso-claro.png`, `04-progreso-oscuro.png`, `05-comparativa-claro.png`, `05-comparativa-oscuro.png`, `06-metricas-claro.png`, `06-metricas-oscuro.png`, `07-descarga-individual-claro.png`, `07-descarga-individual-oscuro.png`, `08-zip-claro.png`, `08-zip-oscuro.png`, `09-borrado-claro.png`, `09-borrado-oscuro.png`.

Verificación visual realizada:
- `01-portada-*.png`: header nuevo con **Iniciar sesión** junto a Claro/Oscuro; **ya no hay** formulario ni barra de sesión bajo «Prepara un lote».
- `02-acceso-*.png`: captura del **panel del header** con Correo electrónico, Contraseña, submit y «Crear cuenta» (incluye la × de cierre), legible en Claro y Oscuro.

---

## 5. Cierre G-7 y P4/G-3

- `docker compose down` → `EXIT_CODE=0`; contenedor `mediashrink-aws-emulator` y red `mediashrink-cloud_default` eliminados.
- Puertos **3001 / 5173 / 9297 sin listeners**; servidores de Playwright detenidos por su teardown. (Queda `gracious_hypatia`, contenedor ajeno preexistente, sin relación con el proyecto.)
- `temporary/ux-header-auth/` eliminado; sin dependencias hacia `temporary/`.
- Escaneo P4/G-3 sobre los evidencia propios: 0 rutas de host, 0 secretos, 0 URL presignadas (`<PROJECT_ROOT>` y `<PRESIGNED_S3_URL_REDACTED>`).

---

## 6. Observación fuera de alcance (no corregida)

Al ejecutar `qa-roadmap.spec.ts` con un config efímero sobre el stack real, los pasos **01→07 pasaron** con los selectores nuevos (incluidas las verificaciones de sesión en `getByRole('banner')`). El paso **08** falló en una aserción **preexistente y ajena al cambio de UI**:

```
await popup.waitForURL(/^https:\/\//, { timeout: 30_000 });
```

El popup navega al relay same-origin del producto (`http://localhost:5173/__s3_local/...`), no a `https://`. Mi diff en ese archivo se limitó a selectores de autenticación (verificado con `git diff`); **no toqué esa aserción ni ningún criterio de QA**.

**Propuesta concreta:** que el Tester ejecute el roadmap con el mismo config/entorno con el que se emitió el `31/31` original, o, si el Architect lo autoriza en encargo separado, ajustar esa aserción para aceptar el relay same-origin del producto. Yo no la modifico por no relajar una aserción de producto fuera de mi alcance.

Evidencia: `evidence/F05-UX-HEADER-AUTH-GREEN-qa-roadmap.txt` (`EXIT_CODE=1`).

**Nota para el relevo:** el spec/config del roadmap `qa-human` (31/31) era transitorio (`temporary/qa-human/`) y **no está en el árbol** tras el cierre anterior (G-11). Quien lo reencarne debe aplicar los mismos cambios de forma de acceso (trigger del header + verificación por `getByRole('banner')`); las 5 specs permanentes ya están actualizadas.

---

## 7. Declaración final

- **No modifiqué** `backend/`, `infra/`, contratos Zod, gates ni `STATE.md` (los cambios preexistentes en `STATE.md` y en el `task.md` son del Architect y se preservaron).
- **No hice commit ni push.** `G-12` sigue retenido.
- Todo el trabajo se limitó a `<PROJECT_ROOT>`, sin secretos en código, reportes ni logs (G-3).
- Retorno al Architect: selectores exactos en §1, códigos y conteo de unit en §3, 18 capturas en §4, G-7 cerrado en §5 y la observación de §6 para su decisión.
