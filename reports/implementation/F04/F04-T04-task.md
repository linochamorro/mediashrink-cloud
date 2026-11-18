# Tarea `F04-T04` — IAM mínimo privilegio, CORS y flags `skip_*`

| Campo | Valor |
|---|---|
| **ID / Fase** | `F04-T04` · Fase 4 — `docs/sdd/packages/P-04-terraform-and-ci.md` |
| **Rol / verificadores** | Developer / Tester + Auditor |
| **Harness / Loop** | OpenCode · `v1 — Loop 1/3` |
| **Riesgo / Estimación** | `3 (Sensible)` · 40 min. Revisión ≥5 min; diagnóstico a 10 min o >2×. |
| **Procesos** | `terraform validate`/`plan`/`apply` + sondeo de políticas/CORS. Timeout 240 s. |

## 1. Criterio (`CA-04`)
- Políticas IAM de **mínimo privilegio** por recurso (S3 `raw`/`optimized`, SQS+DLQ, DynamoDB), sin `-` comodines amplios.
- CORS explícito para la SPA en `http://localhost:5173` (CORS_ORIGIN de `.env.example`).
- **Separar/condicionar los flags `skip_*` del bootstrap** (`T04-A-03`): introducir variable `is_emulator` (default `true`) de modo que `skip_credentials_validation`, `skip_requesting_account_id` y `skip_metadata_api_check` solo sean `true` contra el emulador y no se hereden a un entorno real. Documentar el procedimiento para real AWS sin ejecutarlo.
- Si el emulador no soporta una API IAM/CORS de Terraform, documentar la limitación con evidencia y proponer representación declarativa segura (p. ej. política como `jsonencode` en locals/outputs), **sin simular PASSED** ni usar AWS real.

## 2. Entradas y entorno
- Depende de `F04-T01` PASSED. Mismo procedimiento de emulador.
- Auditoría obligatoria por riesgo 3: IAM, CORS, flags y exposición de secretos.

## 3. Ámbito
`infra/terraform/**`, `reports/implementation/F04/evidence/F04-T04-*`, `reports/implementation/F04/F04-T04-developer.md`.
**Prohibido:** `frontend/`, `backend/`, manifiestos raíz, `STATE.md`, `tasks.md`, AWS real, push, secretos/rutas absolutas.

## 4. Método y entregables
- Evidencia: `F04-T04-{validate,plan,apply,iam,cors,skip-flags,emulator-down}.txt`.
- Dictamen `F04-T04-tester.md`; auditoría `reports/audits/F04/F04-T04-auditor.md`; cierre `F04-T04-architect.md`.
