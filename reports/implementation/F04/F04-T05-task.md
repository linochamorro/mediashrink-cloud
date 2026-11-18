# Tarea `F04-T05` — CI de integración contra emulador + `terraform apply`

| Campo | Valor |
|---|---|
| **ID / Fase** | `F04-T05` · Fase 4 — `docs/sdd/packages/P-04-terraform-and-ci.md` |
| **Rol / verificadores** | Developer / Tester + Auditor |
| **Harness / Loop** | OpenCode · `v1 — Loop 1/3` |
| **Riesgo / Estimación** | `2` · 45 min. Revisión ≥5 min; diagnóstico a 10 min o >2×. |
| **Procesos** | job CI real + `terraform apply` local + `npx vitest run tests/integration/infra`. Timeout 300 s. |

## 1. Criterio (`CA-05`)
Ampliar `.github/workflows/**` con un job de integración que: levante `aws/aws-emulator` con límites 2 GiB/2.0, exporte CA/credenciales (`docker cp`), instale Terraform, ejecute `terraform fmt -check`/`init`/`validate`/`apply` contra el emulador, corra `tests/integration/infra/**` y apague el contenedor (`if: always()`). Sin AWS real, sin secretos en el workflow, sin releases/deploy (G-12 no aplica).

## 2. Entradas y entorno
- Depende de `F00-T06` (CI base verde), `F04-T02` y `F04-T03` PASSED.
- `tests/integration/infra/**` debe verificar recursos reales en el emulador (buckets + lifecycle, colas + redrive, tabla + TTL) usando los SDKs ya instalados, sin modificar `backend/**` ni manifiestos.
- Para el run real en GitHub: verificar con `gh run list`/`gh run view`. **Si el push a `main` entra en conflicto con el harness paralelo F03, detener y reportar `NEEDS_CONTEXT`** en lugar de forzar (`--force`) o reescribir historia.

## 3. Ámbito
`.github/workflows/**`, `tests/integration/infra/**`, `reports/implementation/F04/evidence/F04-T05-*`, `reports/implementation/F04/F04-T05-developer.md`.
**Prohibido:** `frontend/`, `backend/`, manifiestos raíz, `STATE.md`, `tasks.md`, AWS real, push forzado, secretos/rutas absolutas.

## 4. Método y entregables
- Evidencia: `F04-T05-{workflow,apply,infra-tests,run-list,run-view,steps,emulator-down}.txt`.
- Dictamen `F04-T05-tester.md`; auditoría `reports/audits/F04/F04-T05-auditor.md`; cierre `F04-T05-architect.md`.
