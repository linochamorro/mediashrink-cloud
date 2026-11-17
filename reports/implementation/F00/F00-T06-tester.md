# Dictamen de verificación independiente (Tester) — `F00-T06`

| Campo | Valor |
|---|---|
| **Tarea / fase / paquete** | `F00-T06` · Fase 0 · `docs/sdd/packages/P-00-foundation-and-emulator.md` |
| **Criterio asignado** | `CA-06` (P-00 §5): `install`, `typecheck`, `lint`, `test:unit` en verde en `main` |
| **Rol verificador / riesgo** | Tester independiente · riesgo 2 (con Auditor) |
| **Versión / Loop** | `v1 — Loop 1/3` (sin activación de loops) |
| **Fecha** | `2026-11-17` |
| **Método** | Inspección propia del workflow + consultas propias `gh` + reejecución local; sin Docker, sin AWS, sin commits ni pushes |
| **Evidencias propias** | `evidence/F00-T06-tester-{workflow,run,steps,secrets,debt}.txt` |
| **Veredicto global** | **`PASSED`** |

## 1. Verificación propia realizada

- Lectura íntegra de `.github/workflows/ci.yml` (48 líneas) y cotejo con los scripts verificados en `F00-T02` (`F00-T02-architect.md` §1) y la nota de reanudación `F00-T06-task.md` §5.
- Consultas `gh` ejecutadas por este rol: `gh auth status` (cuenta `linochamorro`, scope `workflow`), `gh run list --workflow ci.yml --limit 5`, `gh run view 44184037945`, `gh api repos/linochamorro/mediashrink-cloud/actions/runs/44184037945/jobs`, `gh run view 44184037945 --log`, y los recuentos de secretos del repositorio.
- Reejecución independiente de `npm run test:unit` en local para contrastar el log del runner.
- Auditoría de secretos/tokens/rutas Windows y revisión de la deuda residual documentada.
- Estado Git de solo lectura (`git status --short`, `git log -3 --oneline`).

No se presentó evidencia ajena como propia: el run se consultó directamente con `gh`; el reporte del Developer y las evidencias `F00-T06-*` se usaron solo como contraste documental.

## 2. Dictamen por criterio

| # | Criterio verificable | Fuente | Evidencia propia | Resultado |
|---|---|---|---|---|
| 1 | Trigger `push` y `pull_request` sobre `main` | `ci.yml` L8–12 | `tester-workflow.txt` | **CONFORME** |
| 2 | `permissions: contents: read` (mínimo) | `ci.yml` L15–16 | `tester-workflow.txt` | **CONFORME** |
| 3 | `actions/checkout@v4` + `actions/setup-node@v4` con `node-version: '26'` y `cache: 'npm'` | `ci.yml` L23–34 | `tester-workflow.txt` | **CONFORME** |
| 4 | Cuatro pasos en orden con comandos idénticos a T02: `npm ci --no-audit --no-fund`, `npm run typecheck`, `npm run lint`, `npm run test:unit`; sin `--ignore-scripts`, allowlists ni pasos saltados | `ci.yml` L36–48 · `task.md` §5 · `F00-T02-architect.md` | `tester-workflow.txt` + log del run en `tester-steps.txt` | **CONFORME** |
| 5 | Run real en `main`, conclusión `success`, más reciente tras el push del workflow (`03e6208`) | `gh run list` / `gh run view` | `tester-run.txt` | **CONFORME** |
| 6 | Job con los cuatro pasos exigidos en `conclusion=success` | `gh api .../jobs` | `tester-steps.txt` | **CONFORME** (4/4) |
| 7 | `test:unit` en verde ejecutando tests reales (sin `--passWithNoTests` ni omisión) | Log del paso + reejecución local | `tester-steps.txt` | **CONFORME** (40/40, ver observación O-01) |
| 8 | 0 secretos, 0 tokens, 0 rutas Windows absolutas en workflow y repo | `ci.yml` + `gh api .../secrets` | `tester-secrets.txt` | **CONFORME** |
| 9 | Deuda ESLint 8 / `postinstall` documentada sin aceptar G-10; verde sin relajar comandos | `F00-T06-developer.md` §5/§6 · `debt.txt` | `tester-debt.txt` | **CONFORME** |
| 10 | Auditor sin hallazgos bloqueantes | `reports/audits/F00/F00-T06-auditor.md` | Lectura directa (referencia) | **CONFORME** (`READY_WITH_CONCERNS`, 0 CRITICAL/HIGH) |

## 3. Hechos verificados (resumen)

- **Run:** `44184037945`, evento `push`, rama `main`, HEAD `03e6208bcc353ec9f8557fbefc5d6520eb2e91be` (el commit del workflow), conclusión `success`, 21 s; job `install / typecheck / lint / test:unit` en 17 s. Es el único y más reciente de `ci.yml`.
- **Pasos:** Install, Typecheck, Lint y Test unit, los cuatro `completed/success`. Sin pasos `skipped`/`failure`/`cancelled`.
- **Log de Test unit:** `Test Files 3 passed (3)` · `Tests 40 passed (40)`. Reejecución local del Tester: mismo resultado (40/40, exit 0).
- **Secretos:** 0 referencias `secrets.*` en el workflow; 0 secretos en el almacén de Actions; 0 en Dependabot; 0 credenciales/tokens/rutas Windows en artefactos y salidas propias.
- **Deuda:** ESLint 8.57.1 deprecado (`P2`) y `postinstall` no aprobados de `esbuild`/`sharp` (`P1`) quedan **declarados y no aceptados**, sin G-10. El `npm ci` mostró el aviso de scripts no aprobados y terminó en success; no se usaron banderas de aprobación.

## 4. Observaciones (no bloqueantes; no consumen loop)

- **O-01 — Cifra de tests documentada desactualizada.** `F00-T06-task.md` §5 y el reporte del Developer citan `35/35` heredado de `F00-T02`. La comprobación propia (log del run y reejecución local) da **40/40**. La suite creció en tareas posteriores con pruebas A-03 (p. ej. `rechaza el puerto retirado :9324`, `apunta SQS/DLQ a las QueueUrls reales`, `no contiene secretos reales en .env.example`): `config.test.ts` pasó de 30 a 35 casos; total 35 → 40. Es un **superconjunto**: el comando `npm run test:unit` es idéntico al de T02, no se relajó ni se saltó; hay más cobertura, no menos. Por ello **no incumple CA-06**. Se recomienda al Architect corregir `35/35` → `40/40` en el cierre de fase (documentación, no código).
- **O-02 — Estado Git / push parcial.** `git status --short` muestra `M STATE.md`, `M docs/sdd/tasks.md` y archivos `??` de `F00-T05` (cierre del Architect) más las evidencias de este Tester: trabajo de otros roles, no tocado por este rol. `git log -3 --oneline` confirma `ab5ef7c` (reportes/evidencias de T06, **commit local sin push**) sobre `03e6208` (workflow, **único pushado** a `main`, HEAD del run verde). Se registra como observación de consolidación, **no como fallo de CA-06**; coincide con `T06-A-04` del Auditor.
- **O-03 — Anotaciones INFO del runner.** Deprecación de Node 20 en `@v4` y migración de `ubuntu-latest` a Ubuntu 26: no bloqueantes, documentadas por el Developer y por el Auditor (`T06-A-02`).
- **O-04 — Alcance del dictamen.** CA-06 incluye el cierre del Auditor; este rol no emite auditoría, solo la referencia: `F00-T06-auditor.md` = `READY_WITH_CONCERNS` sin hallazgos `CRITICAL`/`HIGH` ni bloqueantes, por lo que no existe revisión obligatoria pendiente que impida el `PASSED`.

## 5. Problemas registrados

**Ninguno con los 7 campos obligatorios.** No hay incumplimiento de `CA-06`, ni hallazgo crítico/alto, ni revisión de Auditor pendiente. Las desviaciones detectadas se documentan como observaciones O-01…O-04 (sección 4), no como problemas bloqueantes. No se activa ningún loop (1/3 sin consumir).

## 6. Veredicto global

**`PASSED`** para `CA-06`: el workflow en la rama principal ejecuta `install`, `typecheck`, `lint` y `test:unit` con los comandos verificados en T02, sin relajaciones, y el run real `44184037945` terminó en `success` con los cuatro pasos en verde, 0 secretos y deuda declarada sin aceptar G-10. Corresponde al Architect consolidar el cierre de `F00` e integrar las observaciones O-01 y O-02.
