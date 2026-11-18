# Tarea `F04-T01` — Buckets S3 con ciclo de vida 30 días

| Campo | Valor |
|---|---|
| **ID / Fase** | `F04-T01` · Fase 4 — `docs/sdd/packages/P-04-terraform-and-ci.md` |
| **Rol / verificadores** | Developer / Tester + Auditor |
| **Harness / Loop** | OpenCode · `v1 — Loop 1/3` |
| **Riesgo / Estimación** | `2` · 35 min: (1) recursos, (2) plan, (3) apply emulador, (4) verificación. Revisión ≥5 min; diagnóstico a 10 min o >2×. |
| **Procesos** | `terraform fmt -check`, `validate`, `plan`, `apply` contra emulador. Timeout 240 s. |

## 1. Criterio (`CA-01`)
Declarar en `infra/terraform/**` los buckets `raw` y `optimized` (`mediashrink-raw-local`, `mediashrink-optimized-local`) con regla de ciclo de vida de expiración a `RETENTION_DAYS = 30` (alineado con DynamoDB TTL, cierra `T02-A-01`), **sin notificaciones/eventos que generen bucles S3→SQS→S3**. Sin AWS real.

## 2. Entradas y entorno
- Bootstrap F00 presente (`versions.tf`, `provider.tf`, `variables.tf`, `data.tf`, `outputs.tf`): proveedor apunta a `:9297`, credenciales `fromIni`, CA propio, `skip_*` condicionables.
- `RETENTION_DAYS=30` de `.env.example`; `TTL_SECONDS=2592000` del catálogo congelado (`docs/architecture/03-*.md`).
- Terraform `D:\Programs\DevApps\DevOps\Terraform\CLI\terraform.exe` (1.17.2) y Docker `D:\Programs\DevApps\Containers\Docker\Desktop\resources\bin\docker.exe` (fuera de PATH).
- Emulador: `docker compose up -d` (2 GiB/2.0), `docker cp` de `ca.pem`/`config`/`emulator_credentials` a `.local/aws-emulator/`, **apagar con `docker compose down`** al terminar.

## 3. Ámbito
`infra/terraform/**`, `reports/implementation/F04/evidence/F04-T01-*`, `reports/implementation/F04/F04-T01-developer.md`.
**Prohibido:** `frontend/`, `backend/`, manifiestos raíz, `STATE.md`, `tasks.md`, AWS real, push a `main`, secretos/rutas Windows absolutas (usa `<PROJECT_ROOT>`).

## 4. Método y entregables
- Verificación documental + comandos declarados: guardar evidencia real de `fmt`, `init`, `validate`, `plan`, `apply`, y sondeo `ListBuckets`/`GetBucketLifecycleConfiguration` contra el emulador. Sin TDD de producto.
- Evidencia: `F04-T01-{fmt,validate,plan,apply,buckets,lifecycle,no-event-loop,emulator-down}.txt`.
- Dictamen `F04-T01-tester.md`; auditoría `reports/audits/F04/F04-T01-auditor.md`; cierre `F04-T01-architect.md`.
