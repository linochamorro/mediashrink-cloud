# Tarea `F04-T03` — Tabla DynamoDB `mediashrink-jobs` con TTL

| Campo | Valor |
|---|---|
| **ID / Fase** | `F04-T03` · Fase 4 — `docs/sdd/packages/P-04-terraform-and-ci.md` |
| **Rol / verificadores** | Developer / Tester + Auditor |
| **Harness / Loop** | OpenCode · `v1 — Loop 1/3` |
| **Riesgo / Estimación** | `2` · 30 min. Revisión ≥5 min; diagnóstico a 10 min o >2×. |
| **Procesos** | `terraform validate`/`plan`/`apply` + DescribeTable/DescribeTimeToLive. Timeout 240 s. |

## 1. Criterio (`CA-03`)
Declarar tabla `mediashrink-jobs` con PK `userId` (HASH) y SK `jobId` (RANGE), `TimeToLiveSpecification` habilitada sobre el atributo `ttl` (30 días = 2.592.000 s), coherente con `docs/architecture/03-*.md` y con la retención S3 de T01 (`T02-A-01`). Evaluar tabla de usuarios: el config de backend solo declara `DYNAMODB_TABLE_JOBS`, por lo que crear `mediashrink-users` solo si se documenta su consumidor; en caso contrario justificar por qué no aplica.

## 2. Entradas y entorno
- Depende de `F04-T01` PASSED. Mismo procedimiento de emulador (up/down, `docker cp`).
- `TTL_SECONDS=2592000` del catálogo congelado (hash `5d0082f8…`), sin redefinirlo en HCL más que como valor literal documentado/variable.

## 3. Ámbito
`infra/terraform/**`, `reports/implementation/F04/evidence/F04-T03-*`, `reports/implementation/F04/F04-T03-developer.md`.
**Prohibido:** `frontend/`, `backend/`, manifiestos raíz, `STATE.md`, `tasks.md`, AWS real, push, secretos/rutas absolutas.

## 4. Método y entregables
- Evidencia: `F04-T03-{validate,plan,apply,table,ttl,keys,retention-alignment,emulator-down}.txt`.
- Dictamen `F04-T03-tester.md`; auditoría `reports/audits/F04/F04-T03-auditor.md`; cierre `F04-T03-architect.md`.
