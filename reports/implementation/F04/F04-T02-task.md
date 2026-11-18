# Tarea `F04-T02` — Cola SQS + DLQ

| Campo | Valor |
|---|---|
| **ID / Fase** | `F04-T02` · Fase 4 — `docs/sdd/packages/P-04-terraform-and-ci.md` |
| **Rol / verificadores** | Developer / Tester + Auditor |
| **Harness / Loop** | OpenCode · `v1 — Loop 1/3` |
| **Riesgo / Estimación** | `2` · 30 min. Revisión ≥5 min; diagnóstico a 10 min o >2×. |
| **Procesos** | `terraform validate`/`plan`/`apply` + sondeo SQS. Timeout 240 s. |

## 1. Criterio (`CA-02`)
Declarar cola principal `mediashrink-jobs` y DLQ `mediashrink-jobs-dlq`, con `redrive_policy` apuntando a la DLQ y `maxReceiveCount = 3` (IN-08, FR-13), y visibility timeout definido y coherente con el reintento del worker. QueueUrls canónicas con host AWS como identificador lógico; `AWS_ENDPOINT_URL=:9297` como transporte; **nunca `:9324`**.

## 2. Entradas y entorno
- Depende de `F04-T01` PASSED; mismos binarios y procedimiento de emulador (up con límites, `docker cp`, down obligatorio).
- `SQS_MAX_RETRIES=3` de `.env.example`; `SQS_QUEUE_URL`/`SQS_DLQ_URL` canónicas.

## 3. Ámbito
`infra/terraform/**`, `reports/implementation/F04/evidence/F04-T02-*`, `reports/implementation/F04/F04-T02-developer.md`.
**Prohibido:** `frontend/`, `backend/`, manifiestos raíz, `STATE.md`, `tasks.md`, AWS real, push a `main`, secretos/rutas absolutas.

## 4. Método y entregables
- Evidencia: `F04-T02-{validate,plan,apply,queues,redrive,visibility,emulator-down}.txt`; verificar con GetQueueAttributes de la cola y de la DLQ.
- Dictamen `F04-T02-tester.md`; auditoría `reports/audits/F04/F04-T02-auditor.md`; cierre `F04-T02-architect.md`.
