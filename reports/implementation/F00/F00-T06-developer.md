# Entrega de implementación (Developer) — `F00-T06`

| Campo | Valor |
|---|---|
| **Tarea** | `F00-T06` — CI base y verificación de run verde |
| **Fase / paquete** | Fase 0 — `docs/sdd/packages/P-00-foundation-and-emulator.md` |
| **Versión / Loop** | `v1 — Loop 1/3` |
| **Rol implementador** | Developer |
| **Rol verificador** | Tester + Auditor (riesgo 2) — **no emitidos aquí** |
| **Fecha** | `2026-11-17` |
| **Criterio de aceptación** | `CA-06` (P-00 §5): `install`, `typecheck`, `lint`, `test:unit` en verde en `main`; cierre de Auditor sin hallazgos bloqueantes |
| **Estado final** | **`DONE_WITH_CONCERNS`** |

## 1. Fuentes consultadas (lectura obligatoria)
- `AGENTS.md` · `STATE.md` · `.agents/roles/developer.md`
- `docs/sdd/packages/P-00-foundation-and-emulator.md` (§3, §4, `CA-06` §5)
- `docs/sdd/constitution.md` (PR-05, PR-08, PR-11)
- `reports/implementation/F00/F00-T06-task.md` (incl. §5 nota de reanudación)
- `reports/implementation/F00/F00-T02-architect.md` (scripts verificados, deudas P1/P2)
- `reports/implementation/F00/F00-T05-architect.md` (repo público, rama `main`, HEAD previo `4d321a5`)
- `package.json` (scripts; sin campo `engines`), `package-lock.json` (v3), `.gitignore`

## 2. Implementación y decisión de versión
- **Archivo creado:** `.github/workflows/ci.yml` (commit `03e6208`, push a `main`).
- **Triggers:** `push` y `pull_request` sobre `main`.
- **Pasos:** `actions/checkout@v4` → `actions/setup-node@v4` (`node-version: '26'`, `cache: 'npm'`) → `npm ci --no-audit --no-fund` → `npm run typecheck` → `npm run lint` → `npm run test:unit`.
- **Decisión Node:** no existe campo `engines` en `package.json`; se fija la línea mayor **`26`**, coherente con el entorno local verificado en T02 (`v26.13.0`, npm `11.20.0`). `setup-node` resuelve al último `26.x`. Queda documentado en el propio workflow.
- **Sin secretos:** `permissions: contents: read`; sin `secrets.*`, sin release/deploy (G-12 no aplica).
- **Sin relajación:** no se añadió `--ignore-scripts`, allowlists ni omisión de pasos. Comandos idénticos a los verificados en T02 (35/35).

## 3. Tabla de comandos y exit codes

| Comando | Propósito | Exit | Resultado |
|---|---|---|---|
| `git add -- .github/workflows/ci.yml` | Stage del único archivo de producto | 0 | `A  .github/workflows/ci.yml` |
| `git commit -m "ci: anadir workflow base..." -- .github/workflows/ci.yml` | Commit del workflow | 0 | `03e6208`, 1 file changed, 48 insertions |
| `git push origin main` | Push autorizado del workflow | 0 | `4d321a5..03e6208  main -> main` |
| `gh run list --workflow ci.yml --limit 5` (1.º) | Localizar run | **1** | HTTP 404 transitorio (ver problema 01) |
| `gh api repos/linochamorro/mediashrink-cloud/actions/workflows` | Confirmar workflow activo | 0 | id `421913718`, path `.github/workflows/ci.yml`, `state=active` |
| `gh run list --workflow ci.yml --limit 5` (reintento) | Localizar run | 0 | run `44184037945`, `in_progress` |
| `gh run watch 44184037945 --interval 10 --exit-status` | Espera con timeout justificado 300 s | 0 | Job completado en 17 s, success |
| `gh run view 44184037945` | Veredicto final | 0 | `conclusion=success` |
| `gh run view 44184037945 --json ...` | Conclusiones estructuradas | 0 | 4/4 pasos `success` |
| `gh run view 44184037945 --log-failed` | Comprobar fallos | 0 | Sin salida → ningún paso fallido |

> Nota: el `task.md` cita 180 s de timeout; siguiendo la instrucción de despacho se usó **300 s** y el run terminó en ~21 s, sin agotar el plazo.

## 4. Run verificado (real)

| Campo | Valor |
|---|---|
| **ID del run** | `44184037945` |
| **URL** | `https://github.com/linochamorro/mediashrink-cloud/actions/runs/44184037945` |
| **Job** | `install / typecheck / lint / test:unit` (ID `134395645994`) |
| **Evento / rama / HEAD** | `push` / `main` / `03e6208bcc353ec9f8557fbefc5d6520eb2e91be` |
| **Conclusión** | **`success`** (completado en 21 s; job en 17 s) |
| **Log fallido** | Vacío (sin pasos fallidos) |

### Los 4 pasos exigidos por CA-06

| Paso | Comando | Conclusión |
|---|---|---|
| Install | `npm ci --no-audit --no-fund` | `success` |
| Typecheck | `npm run typecheck` | `success` |
| Lint | `npm run lint` | `success` |
| Test unit | `npm run test:unit` | `success` |

Evidencia completa: `evidence/F00-T06-{workflow,run-list,run-view,ci-steps,debt}.txt`.

## 5. Evaluación de deuda residual (sin aceptar G-10)
- **`F00-T02-P2` (ESLint 8.57.1 deprecado):** el paso `Lint` pasó; deuda no bloqueante, migración fuera de alcance. Declarada, no aceptada.
- **`F00-T02-P1` (postinstall `esbuild`/`sharp`):** `npm ci` pasó sin aprobación de scripts ni `--ignore-scripts`; lockfile v3 + binarios de plataforma funcionan también en Linux. Cubierto solo para `ubuntu-latest` / Node 26. Declarada, no aceptada.
- **Anotaciones INFO del runner:** deprecación de Node 20 en las acciones `@v4` (forzadas a Node 24) y migración de `ubuntu-latest` a Ubuntu 26. No bloqueantes; las acciones se mantienen en `@v4` porque el `task.md` lo exige.
- **Sin G-12:** no se hizo release, deploy ni publicación final.

Detalle en `evidence/F00-T06-debt.txt`.

## 6. Problemas registrados (7 campos cada uno)

### Problema 01 — 404 transitorio de `gh run list` tras el push
1. **Identificación:** `F00-T06-01` (loop 1/3).
2. **Problema:** `gh run list --workflow ci.yml --limit 5` devolvió `HTTP 404: workflow ci.yml not found on the default branch`, exit 1, inmediatamente después del push.
3. **Causa:** **HIPÓTESIS confirmada por reintento** — retraso de propagación/indexado de GitHub Actions al registrar un workflow recién creado en la rama por defecto.
4. **Solución e intentos fallidos:** no se modificó el workflow. Intento fallido: el primer `gh run list`. Se verificó con `gh api repos/.../actions/workflows` (workflow `active`) y se reintentó `gh run list`, que devolvió el run en `in_progress`.
5. **Verificación:** workflow id `421913718`, path correcto, `state=active`; run `44184037945` localizado y completado en `success`.
6. **Pendientes:** ninguno. Recomendación de relevo: tras el primer push de un workflow, esperar propagación y reintentar antes de concluir fallo.
7. **Aprendizaje candidato:** `PROPUESTA_LOCAL` — verificar un workflow recién pushado con `gh api repos/<owner>/<repo>/actions/workflows` y reintentar `gh run list` ante un 404 inmediato.

### Problema 02 — Deuda heredada `F00-T02-P2` (ESLint 8 deprecado)
1. **Identificación:** `F00-T06-02` (deuda heredada, no bloqueante).
2. **Problema:** `eslint@^8.57.1` con configuración embebida está deprecado; ESLint 9 exige configuración plana fuera de alcance.
3. **Causa:** **DEMOSTRADA** — decisión de tooling de F00-T02 documentada en `F00-T02-architect.md` §2.
4. **Solución e intentos fallidos:** mantener la versión y ejecutar `npm run lint` tal cual. No se rebajaron reglas ni se omitió el paso para forzar verde; no se tocó `package.json`.
5. **Verificación:** paso `Lint` del run `44184037945` con `conclusion=success`.
6. **Pendientes:** migración a ESLint 9 / `eslint.config.js` en fase posterior o por decisión expresa de Lino. Sin G-10.
7. **Aprendizaje candidato:** `PROPUESTA_GLOBAL` — planificar la migración de ESLint con su propio task y gates, no como parche de CI.

### Problema 03 — Deuda heredada `F00-T02-P1` (postinstall no aprobados)
1. **Identificación:** `F00-T06-03` (deuda heredada, no bloqueante).
2. **Problema:** npm 11 no aprueba por defecto los scripts `postinstall` de `esbuild`/`sharp`; riesgo de fallo de `npm ci` en un runner distinto al local.
3. **Causa:** **DEMOSTRADA** en local (T01/T02); **no reproducida en CI** — el lockfile v3 y las dependencias opcionales de plataforma resuelven los binarios.
4. **Solución e intentos fallidos:** ejecutar `npm ci --no-audit --no-fund` sin banderas de aprobación. No se usó `--ignore-scripts`, `--foreground-scripts` ni allowlist; no hubo fallo que parchear.
5. **Verificación:** paso `Install` con `conclusion=success` en `ubuntu-latest` / Node 26.
6. **Pendientes:** cobertura solo en `ubuntu-latest` / Node 26; validar otros runners si se amplía la matriz. Sin aprobación de scripts, sin G-10.
7. **Aprendizaje candidato:** `PROPUESTA_GLOBAL` — si se amplía la matriz de CI, documentar el comportamiento de postinstall por plataforma antes de aprobar nada.

### Problema 04 — Anotaciones informativas del runner
1. **Identificación:** `F00-T06-04` (INFO, no bloqueante).
2. **Problema:** el run emitió dos avisos: Node 20 deprecado en `actions/checkout@v4`/`actions/setup-node@v4` (forzadas a Node 24) y migración de `ubuntu-latest` a Ubuntu 26 desde el 19-oct-2026.
3. **Causa:** **DEMOSTRADA** — políticas del entorno GitHub Actions, ajenas al contenido del workflow.
4. **Solución e intentos fallidos:** sin cambios. Cambiar las acciones a `@v5` o fijar imagen de runner se consideró y se descartó por desviarse de los pasos exigidos en el `task.md`.
5. **Verificación:** run `conclusion=success` pese a las anotaciones; `--log-failed` vacío.
6. **Pendientes:** reevaluar versiones de acciones y de imagen del runner en una tarea futura, con decisiones de Lino si aplica.
7. **Aprendizaje candidato:** `PROPUESTA_LOCAL` — distinguir anotaciones INFO del runner de fallos reales antes de escalar.

### Problema 05 — Árbol de trabajo con cambios preexistentes de otro rol
1. **Identificación:** `F00-T06-05` (hallazgo de alcance, no bloqueante para CA-06).
2. **Problema:** al iniciar, `git status --short` mostraba `M STATE.md`, `M docs/sdd/tasks.md` y archivos `??` de reportes/evidencias de `F00-T05` (cierre del Architect), además del workflow propio.
3. **Causa:** **DEMOSTRADA** — artefactos del cierre de `F00-T05` que el Architect aún no había versionado; ajenos a este despacho.
4. **Solución e intentos fallidos:** no se tocaron esos archivos (prohibido por `task.md` §3). Se hicieron commits **solo** del workflow (`git add -- .github/workflows/ci.yml` y `git commit -- <archivo>`), Evitando `git add -A`.
5. **Verificación:** el commit `03e6208` contiene exclusivamente `.github/workflows/ci.yml`; el push a `main` fue limpio (`4d321a5..03e6208`).
6. **Pendientes:** `git status --short` no puede quedar totalmente limpio mientras esos archivos de otro rol sigan sin versionar. Corresponde al Architect incluirlos en su consolidación. Los archivos de `F00-T06` (evidencias y este reporte) quedan **versionados localmente en commits separados y no pushados**, porque el ámbito de push autorizado es únicamente el workflow (evitando además runs adicionales).
7. **Aprendizaje candidato:** `PROPUESTA_LOCAL` — en despachos con árbol sucio, usar siempre `git add -- <rutas exactas>` y `git commit -- <rutas>` para preservar el trabajo ajeno.

## 7. Estado final y handoff
- **Estado: `DONE_WITH_CONCERNS`.**
- **Logrado:** workflow pushado a `main` y **run real verde** (`44184037945`) con los cuatro pasos exigidos por `CA-06` en `success`; sin secretos, sin releases ni deploy.
- **Concerns (no bloqueantes):** deuda P1/P2 declarada y no aceptada (G-10), anotaciones INFO del runner, árbol con archivos ajenos sin versionar y evidencias/reporte de T06 comprometidos solo en local.
- **No se emite `PASSED` ni se cierra la tarea:** corresponden al Tester y al Auditor, con cierre del Architect. Sin `NEEDS_CONTEXT` ni `BLOCKED`: no hay gate pendiente ni falta de contexto.
