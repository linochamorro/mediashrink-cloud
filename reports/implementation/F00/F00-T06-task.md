# Tarea `F00-T06` — CI base y cierre de higiene de F00

| Campo | Valor |
|---|---|
| **ID completo** | `F00-T06` |
| **Fase y paquete** | Fase 0 — `docs/sdd/packages/P-00-foundation-and-emulator.md` |
| **Prioridad** | `P0` |
| **Rol implementador** | `Developer` |
| **Rol verificador** | `Tester` + `Auditor` |
| **Harness** | OpenCode |
| **Versión / Loop actual** | `v1 — Loop 1/3` |
| **Nivel de riesgo** | `2 (Relevante)` |
| **Excepción metodológica** | `Ninguna` |
| **Estimación / hitos / seguimiento** | Estimación 25 min. Hitos: (1) `ci.yml`, (2) push a rama principal, (3) run verde, (4) cierre de higiene. Revisión ≥5 min; diagnóstico a 10 min sin progreso o >2× estimación. |
| **Procesos y verificación proporcional** | `gh run list --workflow ci.yml`, `gh run view`. Timeout 180 s. Tester verifica el run real y que los cuatro pasos existen; Auditor cierra F00 sin hallazgos bloqueantes. |

## 1. Fuentes aprobadas y criterios de aceptación
- **Requisitos:** `P-00` §5 `CA-06`, `plan.md` §5, `constitution.md` PR-05/PR-08.
- **Criterios asignados:**
  - `CA-06`: `.github/workflows/ci.yml` ejecuta `install`, `typecheck`, `lint` y `test:unit` en verde en la rama principal; Auditor cierra F00 sin hallazgos bloqueantes.

## 2. Entradas, contratos y entorno
- **Revisión previa:** `F00-T02` y `F00-T05` deben estar `PASSED`. El workflow debe usar los mismos scripts que Tester ejecutó en local; no redefinir comandos distintos.
- **Gates:** G-6/G-6b autorizados; G-8 autorizado; G-12 no aplica (publicación final en Fase Final).

## 3. Ámbito exclusivo de archivos y límites
- **Escritura permitida:** `.github/workflows/ci.yml`, `reports/implementation/F00/evidence/F00-T06-*`.
- **Prohibido tocar:** `frontend/**`, `backend/**`, `infra/terraform/**`, `.env`, `STATE.md`, `tasks.md`. No exponer secretos en el workflow.

## 4. Método exigido y entregables
- **Método:** comandos declarados + verificación de CI; sin TDD de producto.
- **Reporte:** `F00-T06-developer.md`. **Evidencia:** `evidence/F00-T06-ci-run.txt`, `F00-T06-ci-steps.txt`.
- **Dictamen:** `F00-T06-tester.md`. **Auditoría:** `reports/audits/F00/F00-T06-auditor.md`. **Cierre:** `F00-T06-architect.md`.

## 5. Nota de reanudación (CTO, Opción A)
El workflow debe usar los mismos scripts verificados en `F00-T02`: `npm ci`, `npm run typecheck`, `npm run lint`, `npm run test:unit` (35/35). Deuda residual declarada a documentar/evaluar: ESLint 8 deprecado (`F00-T02-P2`, migración a ESLint 9/config plana fuera de alcance) y `postinstall` no aprobados de `esbuild`/`sharp` (`F00-T02-P1`): con lockfile versionado, `npm ci` y las dependencias nativas funcionan en local; decidir en CI sin aprobar nada por defecto ni aceptar riesgo G-10. `gh` autenticado con scope `workflow`: verificar run real en la rama principal con `gh run list`/`gh run view`. Sin secretos en el workflow.
