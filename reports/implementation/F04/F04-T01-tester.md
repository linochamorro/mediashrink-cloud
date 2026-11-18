# `F04-T01` — Reporte de Tester independiente (dictamen)

| Campo | Valor |
|---|---|
| **Tarea / Fase** | `F04-T01` · Fase 4 — `docs/sdd/packages/P-04-terraform-and-ci.md` |
| **Criterio** | `CA-01` — buckets S3 `raw`/`optimized` con ciclo de vida de 30 días alineado con TTL DynamoDB y sin bucles de eventos |
| **Rol / verificador** | Tester independiente (riesgo 2) |
| **Versión / Loop** | `v1 — Loop 1/3` (sin activación de loops posteriores) |
| **Harness** | OpenCode |
| **Fecha (UTC)** | `2026-11-18` |
| **Veredicto global** | **`PASSED`** (`CA-01` satisfecho con ejecución propia) |
| **Emulador** | Levantado con G-7 (`2 GiB` / `2.0` CPUs) y **apagado** al terminar (`docker ps -a` vacío, red eliminada) |

## 1. Entrada e independencia

Leídas como entrada: `.agents/roles/tester.md`, `AGENTS.md`, `STATE.md`, `docs/sdd/packages/P-04-terraform-and-ci.md` (§1, §3, §5), `docs/architecture/03-data-model-and-storage-contract.md` §3, `reports/implementation/F04/F04-T01-task.md`, `F04-T01-developer.md`, todo `infra/terraform/**`, `.env.example`, `docker-compose.yml`, `docs/runbooks/development-workflow.md` §1.1–1.4 y las evidencias `F04-T01-*` del implementador.

**No se presentan reportes ajenos como evidencia propia.** Cada comando y cada sonda de este dictamen se ejecutó de nuevo desde `<PROJECT_ROOT>`, con rutas a binarios resueltas en tiempo de ejecución (`<DOCKER_CLI_DIR>`, `<TF_BIN>`) y volcadas a evidencias con prefijo `F04-T01-tester-*`. No se recreó `RED`: `AGENTS.md` §4 y `F04-T01-task.md` §4 establecen que Terraform se verifica por criterios documentales y comandos declarados, no por TDD de producto.

## 2. Dictamen por verificación

| # | Verificación requerida | Resultado | Evidencia propia |
|---|---|---|---|
| 1 | `terraform fmt -check`, `validate`, `plan`, `apply` (exit 0, recursos esperados) | **PASSED** — `fmt`/`init`/`validate` exit 0; `plan` exit 0 (`4 to add`); `apply` exit 0 con **`4 added, 0 changed, 0 destroyed`**; `state list` = 4 recursos + sonda STS; plan final `-detailed-exitcode` exit 0 → `No changes. Your infrastructure matches the configuration.` | `F04-T01-tester-{fmt,init,validate,plan,apply,plan-final}.txt` |
| 2 | `ListBuckets`: `mediashrink-raw-local` y `mediashrink-optimized-local` presentes | **PASSED** — `COUNT: 2`, `RAW_PRESENT: true`, `OPTIMIZED_PRESENT: true` | `F04-T01-tester-buckets.txt` |
| 3 | `GetBucketLifecycleConfiguration` en ambos: `Status Enabled`, `Expiration.Days 30`, alineado con `RETENTION_DAYS=30` / `TTL_SECONDS=2592000` | **PASSED** — regla única por bucket: `Status: Enabled`, `Expiration.Days: 30`, `ID: expire-after-retention-days`, `Filter: {Prefix: ""}`; `LIFECYCLE_OK_30D_ENABLED: true` en ambos. `s3.tf` usa `days = var.retention_days` (default `30`); `.env.example` declara `RETENTION_DAYS=30` y el catálogo congelado `RETENTION_DAYS = 30` / `TTL_SECONDS = 2_592_000` (= 30 × 86400 s). `T02-A-01` cerrado. | `F04-T01-tester-lifecycle.txt` |
| 4 | Sin notificaciones/eventos; inspección estática sin `aws_s3_bucket_notification` ni reglas de bucle S3→SQS→S3 | **PASSED** — estático: 0 hits para `aws_s3_bucket_notification`, `notification`, `queue_arn`, `lambda_function_arn`, `topic_arn`, `eventbridge`, `aws_sqs_queue`, `aws_dynamodb_table`; 2 recursos de ciclo de vida y 2 reglas con `filter {}`. En vivo: HTTP 200, `CONFIG_KEYS: NONE`, `EVENT_CONFIG_KEYS: NONE`, `NOTIFICATION_EVENTS_PRESENT: false` en ambos buckets. | `F04-T01-tester-{static,no-event-loop,notifications}.txt` |
| 5 | Provider a `:9297`, credenciales por archivo, CA propio; sin `:9324` ni AWS real; `skip_*` intactos | **PASSED** — `endpoints {s3,sqs,dynamodb,sts} = var.aws_endpoint_url` con default `https://127.0.0.1:9297`; `shared_credentials_files`/`shared_config_files` por variable, `custom_ca_bundle = var.ca_bundle_path`, 0 declaraciones de `access_key`/`secret_key`; guarda que rechaza `:9324` en `variables.tf`; `skip_*` presentes y **bootstrap F00 sin diff** (5 archivos `.tf` intactos). STS en vivo devolvió `id=000000000000` y el output `emulator_endpoint = https://127.0.0.1:9297`. | `F04-T01-tester-{provider,plan,apply}.txt` |
| 6 | Ámbito: solo `infra/terraform/**` y reportes propios; sin tocar `frontend/`, `backend/`, manifiestos, `STATE.md`, `tasks.md`; sin push | **PASSED** — en `infra/terraform/` solo `README.md` (documentación de la tarea) y `s3.tf` (nuevo), ambos del implementador; mis escrituras se limitan a `F04-T01-tester.md` y `F04-T01-tester-*.txt`. Sin `git push`, sin edición de HCL, tests, manifiestos ni documentos de estado. Escaneo de secretos/rutas absolutas sobre mis evidencias: **0 hits**. | `F04-T01-tester-scope.txt` |

### G-7 / higiene del contenedor

Arranque `healthy` con `memory=2147483648`, `nanoCpus=2000000000` y `user=1000:1000`; `docker cp` de `ca.pem`, `config` y `emulator_credentials` repetido en esta sesión (nota N-01) y healthcheck `ok`. Cierre con `docker compose down` (exit 0), `docker ps -a` sin contenedores y red `mediashrink-cloud_default` eliminada. Evidencias: `F04-T01-tester-{up,cp,emulator-down}.txt`.

## 3. Observaciones (no bloqueantes para `CA-01`)

1. **Refresh del state entre sesiones del emulador.** Mi `plan` inicial informó `Objects have changed outside of Terraform` y la advertencia `AWS resource not found during refresh`: el `terraform.tfstate` heredado referenciaba buckets creados en la sesión anterior del emulador, que no sobreviven al reinicio. Ante eso, mi `apply` **recreó los 4 recursos desde cero** (`4 added`) y el plan posterior con `-detailed-exitcode` certificó convergencia (`No changes`, exit 0). Es comportamiento esperado del emulador con volumen named + estado local, no incumplimiento de `CA-01`. Recomendación operativa: ejecutar `apply` dentro de la misma sesión en que se levanta el emulador (ya indicado en `infra/terraform/README.md` y en el runbook §1.3).
2. **Plantillas referenciadas ausentes.** `.agents/roles/tester.md` cita `docs/METHODOLOGY.md` y `docs/templates/problema-solucion.md`, que no existen en el árbol actual. Para este dictamen se usaron los 7 campos del formato ya empleado en `F04-T01-developer.md` §7. No hubo hallazgos que registrasen esa plantilla. Seguimiento documental no bloqueante para el CTO.

## 4. Conclusión

**CA-01: `PASSED`.** Con ejecución propia queda acreditado que el HCL de `infra/terraform/**` aprovisiona en el emulador local los dos buckets requeridos, aplica a ambos una regla de expiración `Enabled` a 30 días coherente con `RETENTION_DAYS=30` y `TTL_SECONDS=2592000`, y no introduce ninguna configuración de notificaciones que pueda generar un bucle S3→SQS→S3. El proveedor permanece aislado en `https://127.0.0.1:9297` con credenciales efímeras por archivo y CA propio; el bootstrap F00 no fue alterado. Sin hallazgos `CRITICAL`/`HIGH`, sin problemas con los 7 campos, sin activación de loops y con el contenedor apagado.

Emitido por: **Tester independiente — `F04-T01`** · `2026-11-18 (UTC)`.
