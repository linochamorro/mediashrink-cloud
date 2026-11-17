# Reporte Developer — `F00-T02`

| Campo | Valor |
|---|---|
| **Tarea** | `F00-T02` — Workspaces Vite/React + Hono + sharp + Vitest/Playwright |
| **Fase / paquete** | Fase 0 — `docs/sdd/packages/P-00-foundation-and-emulator.md` |
| **Rol** | Developer (subagente delegado) |
| **Versión / Loop** | `v1 — Loop 1/3` |
| **Riesgo** | 1 (Ordinario) · Verificador: Tester (sin Auditor) |
| **Estado final** | `DONE_WITH_CONCERNS` (concerns no bloqueantes para `CA-02`; §6) |
| **Fecha** | 2026-11-17 |

> No se emite `PASSED` ni se cierra la tarea: corresponden al Tester y al Architect. Este agente no aprueba su propio trabajo.

## 1. Fuentes leídas (obligatorias, todas reales)

- `AGENTS.md` (raíz) — reglas locales, gates G-3/G-6/G-6b/G-7/G-8, confinamiento.
- `STATE.md` — fase actual, `F00-T01` cerrada `PASSED`, `F00-T02` autorizada en paralelo con `F00-T03`.
- `.agents/roles/developer.md` — contrato del rol (TDD, evidencia, 7 campos, límites).
- `docs/sdd/packages/P-00-foundation-and-emulator.md` — ámbito, `CA-02`, DoR/DoD.
- `docs/sdd/constitution.md` — PR-03, PR-05, PR-08, IN-14.
- `docs/sdd/spec.md` — NFR-01, NFR-04, NFR-06; contratos/API diferidos a F01–F03.
- `docs/sdd/plan.md` — §2 estructura canónica, §5 herramientas de prueba.
- `docs/architecture/00-overview.md`, `docs/architecture/01-stack.md` — mapa de código y stack.
- `reports/implementation/F00/F00-T02-task.md` — **fuente de verdad de alcance**.
- `reports/implementation/F00/F00-T01-{developer,architect}.md` — estado previo y concern `P3` heredado.

No se modificó `docs/sdd/tasks.md` (expresamente prohibido).

## 2. Criterio `CA-02` y cobertura

**CA-02 (P-00 §5):** `typecheck`, `lint` y test unitario de humo pasan con exit 0 en `frontend/` y `backend/`; estructura canónica creada; sin pantallas, esquemas Zod de dominio, DynamoDB, JWT ni worker `sharp` (excluidos a F01–F03).

| Requisito | Implementación | Evidencia |
|---|---|---|
| Workspaces TypeScript operativos | `workspaces: ["frontend","backend"]` en `package.json` raíz; `package-lock.json` versionado | `F00-T02-install.txt`, `F00-T02-lockfile.txt` |
| Typecheck de ambos workspaces + suite | `tsconfig.base.json` + `backend/tsconfig.json` (incluye `tests/`) + `frontend/tsconfig.json`; script `typecheck` encadena ambos | `F00-T02-typecheck.txt` (exit 0) |
| Lint | ESLint con configuración embebida en `package.json`; script `lint` | `F00-T02-lint.txt` (exit 0) |
| Test unitario de humo | `tests/unit/health.test.ts` (2 casos, `app.request('/health')`) + `tests/unit/frontend.test.ts` (3 casos, entrypoint) | `F00-T02-red/green/refactor.txt`, `F00-T02-test-unit.txt` |
| Sin código de producto F01–F03 | `backend/src/index.ts` solo expone `/health`; `frontend/src/App.tsx` es un marcador sin UI de producto; sin contratos Zod, DynamoDB, JWT ni pipeline `sharp` | Revisión de archivos; §5 |

`npm run test:unit` ejecuta **35/35 tests en verde**: 30 preexistentes de `config.test.ts` (T01, intactos) + 5 nuevos de humo.

## 3. Cronología SDD + TDD

| Paso | Acción | Resultado | Evidencia |
|---|---|---|---|
| 0. Andamiaje | Manifiestos de workspaces, `tsconfig.base.json`, tsconfigs de `frontend/` y `backend/`, stubs no implementados (`/health` → 501, entrypoints vacíos) y los 2 tests de humo escritos antes del código productivo; `npm install --no-audit --no-fund` (G-8) | exit 0 · lockfile generado | `evidence/F00-T02-install.txt` |
| 1. **RED** | `npx vitest run tests/unit/health.test.ts tests/unit/frontend.test.ts` | exit 1 · **5/5 fallan por comportamiento** (501 vs 200; `<div id="app">` vs `<div id="root">`; stubs sin `createRoot`/marcador). Sin errores de dependencias ni de sintaxis | `evidence/F00-T02-red.txt` |
| 2. **GREEN** | `/health` devuelve `{ status: 'ok' }` 200; `index.html` con `#root` + módulo; `main.tsx` con `createRoot`; `App.tsx` con el componente raíz | exit 0 · **5/5 pasan** | `evidence/F00-T02-green.txt` |
| 3. **REFACTOR** | Evaluación: código ya mínimo, sin duplicación real que extraer; aserciones intactas. Sin cambios; reejecución de los 5 tests | exit 0 · **5/5 pasan** | `evidence/F00-T02-refactor.txt` |
| 4. Verificación | `npm run typecheck`, `npm run lint`, `npm run test:unit` (tras `npm ci`) | exit 0 en los tres; 35/35 tests | `evidence/F00-T02-{typecheck,lint,test-unit}.txt` |

Nota de evidencia: la ruta absoluta del entorno que imprime el banner de Vitest se sustituyó por `<PROJECT_ROOT>` en los 4 archivos de salida afectados (`red`, `green`, `refactor`, `test-unit`) para no publicar rutas Windows; los resultados y códigos de salida están intactos.

## 4. Comandos ejecutados

| Comando | Resultado |
|---|---|
| `npm install --no-audit --no-fund` | exit 0 · manifiesto + lockfile generados |
| `npx vitest run tests/unit/health.test.ts tests/unit/frontend.test.ts` (RED) | exit 1 · 5 failed / 5 total |
| `npx vitest run tests/unit/health.test.ts tests/unit/frontend.test.ts` (GREEN) | exit 0 · 5 passed |
| `npx vitest run tests/unit/health.test.ts tests/unit/frontend.test.ts` (REFACTOR) | exit 0 · 5 passed |
| `npm run typecheck` | exit 0 · sin diagnósticos |
| `npm run lint` | exit 0 · sin hallazgos |
| `npm run test:unit` | exit 0 · 3 archivos, 35 passed |
| `npm ci --no-audit --no-fund` | exit 0 · instalación reproducible desde lockfile |
| `npx vitest --version` | exit 0 · `vitest/2.1.9 win32-x64 node-v26.13.0` |
| `node -e "import('sharp')..."` | exit 0 · `SHARP_OK function` |

Los tres comandos de verificación se reejecutaron **después** de `npm ci` para que la evidencia refleje el estado final bloqueado por lockfile.

## 5. Archivos creados / modificados (todos dentro del ámbito)

**Creados:**
- `package-lock.json` — lockfile versionado para CI reproducible (decisión documentada en §6, P1).
- `tsconfig.base.json` — opciones compartidas (`strict`, `moduleResolution: Bundler`, `noEmit`).
- `backend/package.json`, `backend/tsconfig.json`, `backend/src/index.ts` (solo `/health`).
- `frontend/package.json`, `frontend/tsconfig.json`, `frontend/vite.config.ts`, `frontend/index.html`, `frontend/src/main.tsx`, `frontend/src/App.tsx`.
- `tests/unit/health.test.ts`, `tests/unit/frontend.test.ts`.
- `reports/implementation/F00/evidence/F00-T02-{install,red,green,refactor,typecheck,lint,test-unit,lockfile,p3}.txt`.
- `reports/implementation/F00/F00-T02-developer.md` — este reporte.

**Modificados:** `package.json` (ampliado desde el mínimo de T01: workspaces, scripts, dependencias, `eslintConfig`); `docs/architecture/00-overview.md` (§1.1 mapa de workspaces/tooling, único cambio documental permitido).

**Intactos:** `backend/src/config/**`, `tests/unit/config.test.ts`, `.env.example`, `.gitignore`, `infra/terraform/**`, `.github/**`, `STATE.md`, `docs/sdd/tasks.md`, reportes de otros roles. **No se usaron** Git/GitHub ni Docker. **No se escribieron** secretos ni valores de `.env`.

## 6. Problemas registrados (7 campos obligatorios)

### `F00-T02-P1` — Cierre del concern `F00-T01-P3`: scripts de instalación no aprobados y lockfile

1. **Identificación:** `F00-T02-P1` (heredado como `F00-T01-P3`; resuelto en esta tarea).
2. **Problema:** npm 11.20.0 advierte: `2 packages have install scripts not yet covered by allowScripts: esbuild@0.21.5 (postinstall: node install.js)` y `sharp@0.33.5 (install: node install/check)`. T01 había dejado sin decidir la aprobación y sin versionar lockfile.
3. **Causa:** **DEMOSTRADA.** npm 11 omite por defecto los scripts de instalación no aprobados y lo notifica; la operación no falla. Los binarios nativos se resuelven mediante paquetes opcionales de plataforma, por lo que Vitest y `sharp` arrancan sin esos scripts (comprobado con `npm ci` limpio).
4. **Solución e intentos fallidos:** Decisión: **no aprobar** los scripts (no se añade `allowScripts`, no se ejecuta `npm install-scripts approve`) porque el arranque está verificado y así se evita depender de scripts externos en CI. Sí se versiona `package-lock.json` y se valida con `npm ci`. No hubo intentos fallidos; se descartó aprobar `esbuild` como innecesario.
5. **Verificación:** `npm install` exit 0; `npm ci` exit 0 (243 paquetes); `npx vitest --version` exit 0; importación de `sharp` exit 0 (`SHARP_OK function`); `npm run test:unit` exit 0, 35/35 tras `npm ci`. Evidencia: `F00-T02-{install,lockfile,p3,test-unit}.txt`.
6. **Pendientes:** No bloqueantes para `CA-02`. `F00-T06` (CI) puede reevaluar en un entorno sin binarios precompilados. La no aprobación queda registrada como riesgo residual declarado, **sin aceptar riesgo G-10** en nombre de Lino.
7. **Aprendizaje:** **SOLO_LOCAL** — con npm 11, tras instalar, verificar siempre que Vitest arranca y que `sharp` carga antes de dar por buena la instalación; fijar el lockfile para que CI reproduzca el mismo resultado.

### `F00-T02-P2` — ESLint 8 en fin de soporte

1. **Identificación:** `F00-T02-P2` (aviso de deprecación durante `npm install`/`npm ci`).
2. **Problema:** npm avisa `eslint@8.57.1: This version is no longer supported` (junto a dependencias transitivas deprecadas: `inflight`, `rimraf@3`, `glob@7`, `@humanwhocodes/config-array`).
3. **Causa:** **DEMOSTRADA.** ESLint 8 está fuera de soporte. Se eligió deliberadamente esa rama porque admite `eslintConfig` embebido en `package.json` (archivo expresamente dentro del ámbito de F00-T02); ESLint 9 exige un archivo `eslint.config.js` en raíz, que no figura en la lista de escritura permitida de esta tarea.
4. **Solución e intentos fallidos:** Mantener ESLint 8.57.1 con configuración en el manifiesto; `npm run lint` cubre `.ts`/`.tsx` de `frontend/`, `backend/` y `tests/`. No se intentó ESLint 9 para no escribir fuera de alcance ni ampliar el ámbito sin autorización.
5. **Verificación:** `npm run lint` → exit 0, sin hallazgos (`evidence/F00-T02-lint.txt`), reejecutado tras `npm ci`.
6. **Pendientes:** Migración a ESLint 9 + configuración plana en `F00-T06` si el ámbito de CI lo autoriza; no bloquea `CA-02` ni introduce riesgo de seguridad para esta fase.
7. **Aprendizaje:** **PROPUESTA_GLOBAL** — cuando el ámbito de archivos es restrictivo, preferir la configuración embebida en un manifiesto permitido y registrar la deuda técnica explícitamente en lugar de escribir fuera de alcance.

## 7. Estado final y handoff

- **Estado:** `DONE_WITH_CONCERNS`. `CA-02` está cubierto en su totalidad: RED → GREEN → REFACTOR con evidencia cronológica, typecheck y lint limpios, 35/35 tests en verde e instalación reproducible desde lockfile.
- **Concerns (no bloqueantes):** P1 (scripts de instalación no aprobados, verificado funcional; riesgo residual para CI) y P2 (ESLint 8 deprecado, deuda técnica para F06). Ninguno reduce el criterio de aceptación ni requiere excepción metodológica.
- **A continuación:** el **Tester** debe reejecutar de forma independiente `npm run typecheck`, `npm run lint` y `npm run test:unit`, comprobar la ausencia de código de F01–F03 y emitir `F00-T02-tester.md` con `PASSED`/`NO-PASSED`; el **Architect** revisará la evidencia y cerrará con `F00-T02-architect.md`.
