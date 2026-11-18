# `F04-T02` — Reporte de Developer (entrega, sin dictamen)

| Campo | Valor |
|---|---|
| **Tarea / Fase** | `F04-T02` · Fase 4 — `docs/sdd/packages/P-04-terraform-and-ci.md` |
| **Rol / verificadores** | Developer · Tester + Auditor + Architect (pendientes) |
| **Versión / Loop** | `v1 — Loop 1/3` (dos iteraciones internas de `apply` dentro del mismo loop; no se consumió ningún loop de Tester) |
| **Harness** | OpenCode |
| **Fecha (UTC)** | `2026-11-18` |
| **Estado de entrega** | **`DONE_WITH_CONCERNS`** — CA-02 implementado y verificado en vivo; **no se emite `PASSED` ni se cierra la tarea** |
| **Ámbito tocado** | `infra/terraform/sqs.tf` (nuevo), `infra/terraform/README.md`, `reports/implementation/F04/evidence/F04-T02-*`, este reporte; scripts efímeros en `temporary/` (ignorados por Git) |

## 1. Fuentes consultadas (lectura obligatoria)

- `AGENTS.md`, `STATE.md`, `.agents/roles/developer.md`.
- `reports/implementation/F04/F04-T02-task.md` (**fuente de verdad**: CA-02, ámbito, entregables y prohibiciones).
- `docs/sdd/packages/P-04-terraform-and-ci.md` (CA-02, DoD de Fase 4), `docs/sdd/spec.md` **FR-10** (encolado con DLQ) y **FR-13** (3 reintentos → DLQ, el lote continúa), `docs/sdd/constitution.md` **IN-08**.
- `reports/implementation/F04/F04-T01-architect.md` (T01 cerrada `PASSED`; buckets en tfstate, advertencia de refresh conocida).
- Bootstrap y estado actual de `infra/terraform/**` (`provider.tf`, `variables.tf`, `versions.tf`, `data.tf`, `outputs.tf`, `s3.tf`, `README.md`, `terraform.tfstate`), `.env.example` (`SQS_QUEUE_URL`, `SQS_DLQ_URL`, `SQS_MAX_RETRIES=3`, `POLL_INTERVAL_MS=2000`).
- `docs/runbooks/development-workflow.md` §1.1–1.4 (G-7, `docker cp` en cada arranque, QueueUrls canónicas, sin `:9324`).
- Solo lectura (para fijar el visibility timeout): `backend/src/worker/consumer.ts` (reintento por imagen y envío explícito a DLQ) y `backend/src/config/index.ts` (`sqsMaxRetries`, `pollIntervalMs`). **No se modificó backend/.**

## 2. Criterio `CA-02` — cobertura

| Requisito de `CA-02` | Evidencia real |
|---|---|
| Cola principal `mediashrink-jobs` y DLQ `mediashrink-jobs-dlq` | `F04-T02-queues.txt`: `ListQueues` → `COUNT: 2`, `JOBS_PRESENT: true`, `DLQ_PRESENT: true` |
| `redrive_policy` apuntando a la DLQ con `maxReceiveCount = 3` (IN-08/FR-13) | `F04-T02-redrive.txt`: `REDRIVE_POLICY` con `deadLetterTargetArn = arn:aws:sqs:us-east-1:000000000000:mediashrink-jobs-dlq`, `maxReceiveCount: 3`, `DLQ_ARN_PRESENT_IN_POLICY: true`, `MAX_RECEIVE_COUNT_EQ_3: true` |
| Visibility timeout definido y coherente con el reintento del worker | `F04-T02-visibility.txt`: `120` s en ambas colas (`VISIBILITY_DEFINED: true`, `VISIBILITY_EQ_120: true`). 120 s > `POLL_INTERVAL_MS=2000` y cubre el lote de hasta 20 imágenes; 3 recepciones → hasta 360 s antes de DLQ |
| QueueUrls canónicas (host AWS como id lógico), `:9297` como transporte, nunca `:9324` | `F04-T02-queues.txt`: `CANONICAL_HOST_ONLY: true`, `NO_9324: true`; outputs `sqs_queue_url`/`sqs_dlq_url` con `https://sqs.us-east-1.amazonaws.com/000000000000/...`; `F04-T02-{up,healthcheck}.txt` |
| Recursos nativos soportados por el emulador | `aws_sqs_queue` + `redrive_policy` inline: `F04-T02-apply.txt` → `Apply complete`, `F04-T02-plan-post-apply.txt` → `No changes` |
| Bootstrap intacto; `skip_*` sin tocar; plan incremental | `provider.tf`/`variables.tf`/`versions.tf`/`data.tf`/`outputs.tf` sin modificaciones; variables y outputs SQS declares en `sqs.tf`. `F04-T02-plan-initial.txt`: `6 to add, 0 to change, 0 to destroy` (4 de ellos son los buckets de T01 recreados por el reinicio del emulador, ver P2) |
| Sin AWS real; G-7 cumplido | `F04-T02-{up,cp,healthcheck,emulator-down}.txt`: `memory=2147483648`, `nanoCpus=2000000000`, `user=1000:1000`; `CONTAINERS_REMAINING: 0`, `NETWORK_REMAINING: 0` |

## 3. Cambios implementados

- **`infra/terraform/sqs.tf` (nuevo):**
  - Variables `sqs_queue_name` (`mediashrink-jobs`), `sqs_dlq_name` (`mediashrink-jobs-dlq`), `sqs_visibility_timeout_seconds` (`120`, validada 0..43200) y `sqs_max_receive_count` (`3`, validada 1..1000).
  - `aws_sqs_queue.dlq` y `aws_sqs_queue.jobs`, ambas con `visibility_timeout_seconds = var.sqs_visibility_timeout_seconds`.
  - `redrive_policy` **inline** en `aws_sqs_queue.jobs` con `jsonencode({ deadLetterTargetArn = aws_sqs_queue.dlq.arn, maxReceiveCount = var.sqs_max_receive_count })`. El ARN de la DLQ se toma del recurso, no se escribe a mano.
  - Outputs: `sqs_queue_url`, `sqs_dlq_url`, `sqs_queue_arn`, `sqs_dlq_arn`, `sqs_visibility_timeout_seconds`, `sqs_max_receive_count`.
- **`infra/terraform/README.md`:** añade `sqs.tf` al inventario, la tabla de variables de T02, la nota de QueueUrls canónicas y la particularidad de serialización del emulador (P1).
- **`temporary/F04-T02-{lib,up,tf,probe,down,plan-post}.ps1` y `F04-T02-probe.mjs`:** helpers efímeros de captura y sondas `ListQueues` / `GetQueueAttributes` con `@aws-sdk/client-sqs` v3 (`useQueueUrlAsEndpoint: false`, endpoint `https://127.0.0.1:9297`, credenciales por archivo y CA exportados). Bajo `temporary/` (ignorado); **ningún artefacto de producto depende de ellos**.

Recursos **no** creados (pertenecen a otras tareas, confines respetados): DynamoDB (`F04-T03`), IAM/CORS/`skip_*` (`F04-T04`), CI (`F04-T05`). No se tocó `frontend/`, `backend/`, manifiestos raíz, `.env.example`, `STATE.md`, `docs/sdd/tasks.md` ni Git (sin push).

## 4. Comandos ejecutados y exit codes reales

Ejecutados desde `<PROJECT_ROOT>` con `<TF_BIN>` (Terraform 1.17.2) y `<DOCKER_CLI_DIR>\docker.exe` (Compose v5.7.0), ambos fuera de PATH en este harness; rutas resueltas en tiempo de ejecución y **no versionadas**.

| # | Comando | Exit | Evidencia |
|---|---|---|---|
| 1 | `docker compose config` | `0` | `F04-T02-compose-config.txt` |
| 2 | `docker compose up -d` + espera `healthy` + `docker inspect` | `0` / `healthy=True` | `F04-T02-up.txt` |
| 3 | `docker cp` de `ca.pem`, `config`, `emulator_credentials` | `0` | `F04-T02-cp.txt` |
| 4 | `curl.exe --cacert ./.local/aws-emulator/ca.pem https://127.0.0.1:9297/__admin/health` | `0` (`ok`) | `F04-T02-healthcheck.txt` |
| 5 | `terraform -chdir=infra/terraform fmt -check` | `0` | `F04-T02-fmt.txt` |
| 6 | `terraform -chdir=infra/terraform init -input=false` | `0` | `F04-T02-init.txt` |
| 7 | `terraform -chdir=infra/terraform validate` | `0` | `F04-T02-validate.txt` |
| 8 | `terraform -chdir=infra/terraform plan -input=false` (inicial) | `0` (`6 to add`) | `F04-T02-plan-initial.txt` |
| 9 | `terraform -chdir=infra/terraform apply -input=false -auto-approve` (1.er intento, `tostring`) | **`1`** (waiter timeout 2m59s) | `F04-T02-apply-inline-string-timeout.txt` |
| 10 | Sondas `ListQueues` / `GetQueueAttributes` tras el fallo (diagnóstico) | `0` / `0` / `0` | `F04-T02-{queues,redrive,visibility}.txt` (UTC 11:55) |
| 11 | `fmt`/`init`/`validate`/`plan`/`apply` tras el fix numérico | `0`/`0`/`0`/`0`/`0` (`1 added, 0 changed, 1 destroyed`) | `F04-T02-{fmt,init,validate,plan,apply}.txt` |
| 12 | Sondas finales `queues`/`redrive`/`visibility` | `0` / `0` / `0` | `F04-T02-{queues,redrive,visibility}.txt` (UTC 11:57) |
| 13 | `terraform -chdir=infra/terraform plan -input=false` (idempotencia) | `0` (`No changes`) | `F04-T02-plan-post-apply.txt` |
| 14 | `docker compose down` + `docker ps -a` + `docker network ls` | `0` / `0` / `0` | `F04-T02-emulator-down.txt` |

Límites G-7 confirmados en `F04-T02-up.txt` (`memory=2147483648`, `nanoCpus=2000000000`, `user=1000:1000`). Apagado: `CONTAINERS_REMAINING: 0`, `NETWORK_REMAINING: 0`.

## 5. Recursos creados (en el emulador, sesión verificada)

| Recurso Terraform | Identificador | Estado |
|---|---|---|
| `aws_sqs_queue.dlq` | `https://sqs.us-east-1.amazonaws.com/000000000000/mediashrink-jobs-dlq` | creado (`apply` del 1.er intento, conservado) |
| `aws_sqs_queue.jobs` | `https://sqs.us-east-1.amazonaws.com/000000000000/mediashrink-jobs` | recreado en el 2.º `apply` (el 1.º quedó *tainted* por el timeout del waiter) |
| `aws_s3_bucket.raw` / `.optimized` y sus lifecycle | `mediashrink-*-local` | recreados por el reinicio del emulador (ver P2); sin cambios de configuración respecto a T01 |

Atributos vigentes confirmados por `GetQueueAttributes`: ambas colas con `VisibilityTimeout = 120`; `RedrivePolicy` de la cola principal = `{"deadLetterTargetArn":"arn:aws:sqs:us-east-1:000000000000:mediashrink-jobs-dlq","maxReceiveCount":3}`.

## 6. Decisiones técnicas y comportamiento de la API del emulador

1. **`redrive_policy` inline sobre `aws_sqs_queue_redrive_policy`:** se eligió el atributo nativo porque es un único recurso declarativo, mantiene la dependencia `aws_sqs_queue.dlq.arn` explícita y **está soportado por el emulador**: el primer `apply` falló solo por el waiter, pero `GetQueueAttributes` ya devolvía la política correctamente aplicada (`F04-T02-redrive.txt`, UTC 11:55). No hubo que proponer una alternativa declarativa distinta: bastó corregir el tipo del valor (P1).
2. **`maxReceiveCount` numérico, no string:** el emulador normaliza el documento a `"maxReceiveCount":3`. Declarar `tostring(3)` → `"3"` provoca que el waiter compare representaciones distintas y agote el timeout. Con el número, la configuración coincide byte a byte con la respuesta real y `plan-post-apply` da `No changes`.
3. **Visibility timeout 120 s:** no hay valor previo en `.env.example` ni en la spec, por lo que se define aquí con justificación documentada: > 2 s de polling, holgura para un lote de 20 imágenes con `sharp`, y 3 recepciones → 6 min hasta DLQ por redrive. Se aplica a ambas colas con una sola variable.
4. **Colas estándar (no FIFO):** los nombres no terminan en `.fifo`; el worker usa `SendMessage`/`ReceiveMessage` sin `MessageGroupId`, coherente con FIFO=false.
5. **Aislamiento y secretos:** único transporte `https://127.0.0.1:9297`; credenciales por `AWS_SHARED_CREDENTIALS_FILE`/`AWS_CONFIG_FILE` generados y exportados con `docker cp`; CA propio vía `custom_ca_bundle` / `NODE_EXTRA_CA_CERTS`; `skip_*` intactos (competencia de F04-T04). Ningún secreto ni ruta Windows absoluta aparece en artefactos versionados; se usan marcadores `<PROJECT_ROOT>`, `<TF_BIN>`, `<DOCKER_CLI_DIR>`.
6. **Estado local:** `infra/terraform/terraform.tfstate` queda con los recursos del emulador y excluido de Git. Es estado de desarrollo, no de AWS real. No se ejecutó `terraform apply` contra AWS real.

## 7. Problemas registrados (7 campos cada uno)

### P1 — Timeout del waiter de `redrive_policy` por serialización `string` vs `number`

1. **Identificación:** `F04-T02-P1` (HCL `sqs.tf`, atributo `redrive_policy` de `aws_sqs_queue.jobs`).
2. **Problema:** El primer `apply` terminó con exit `1`:
   `waiting for SQS Queue (https://sqs.us-east-1.amazonaws.com/000000000000/mediashrink-jobs) attributes create: timeout while waiting for state to become 'equal' (last state: 'notequal', timeout: 2m59.9632133s)`.
3. **Causa:** **Demostrada.** La primera versión usaba `maxReceiveCount = tostring(var.sqs_max_receive_count)`, que `jsonencode` serializa como `"3"`. El emulador devuelve el documento con `maxReceiveCount: 3` (número), según `F04-T02-redrive.txt` (UTC 11:55). El waiter del provider compara el JSON solicitado con el devuelto y nunca alcanza `'equal'`. La política, no obstante, **sí estaba aplicada**: `DLQ_ARN_PRESENT_IN_POLICY: true` y `MAX_RECEIVE_COUNT_EQ_3: true` antes de cualquier corrección. No es una API no soportada.
4. **Solución e intentos fallidos:** Intentos fallidos: (a) declarar `tostring(...)` — agotó 3 min de timeout; no se reintentó a ciegas. Diagnóstico: sondas `GetQueueAttributes` en vivo para comprobar si la API funcionaba (sí) y ver el formato exacto devuelto. Solución: declarar `maxReceiveCount = var.sqs_max_receive_count` (número), documentar la particularidad en `sqs.tf` y en el README. El recurso quedó *tainted* por el fallo, así que el segundo `apply` lo destroy+create (`1 added, 0 changed, 1 destroyed`) y terminó con exit `0` en ~25 s.
5. **Verificación:** `F04-T02-apply-inline-string-timeout.txt` (fallo real conservado), `F04-T02-redrive.txt` (política correcta antes y después), `F04-T02-apply.txt` (exit `0`), `F04-T02-queues.txt`/`F04-T02-visibility.txt` finales (exit `0`), y `F04-T02-plan-post-apply.txt` → `No changes. Your infrastructure matches the configuration.`
6. **Pendientes:** Ninguno bloqueante. El Tester debe repetir `fmt`/`validate`/`plan`/`apply` y las sondas con evidencia propia; el Auditor puede revisar el hallazgo como INFO (no es G-9/G-10).
7. **Aprendizaje candidato:** en `aws-emulator`, declarar atributos JSON de SQS con los tipos exactos que devuelve `GetQueueAttributes` (`maxReceiveCount` numérico). Si un waiter de creación agota el timeout, sondear la API antes de cambiar de recurso: puede ser solo un desajuste de serialización.

### P2 — Re-creación de los buckets de T01 por reinicio del emulador (heredado, no bloqueante)

1. **Identificación:** `F04-T02-P2` (tfstate heredado de `F04-T01`, advertencia `AWS resource not found during refresh`).
2. **Problema:** `plan`/`apply` iniciales avisaron de que `aws_s3_bucket.raw`, `.optimized` y sus lifecycle configurations «has been deleted» fuera de Terraform y planificaron su recreación (`6 to add`), aunque T01 los dejó aplicados.
3. **Causa:** **Demostrada.** El emulador mantiene el estado de los recursos en memoria y el volumen named solo conserva `ca.pem`, `config` y `emulator_credentials`; tras el `docker compose down` de T01 y el `up` de esta sesión los buckets ya no existían. El refresh del provider los quitó del estado con advertencia. Ya estaba documentado en `F04-T01-architect.md` («tfstate heredado con advertencia de refresh, recreado por apply»).
4. **Solución e intentos fallidos:** No se modificó `s3.tf` ni se hizo `terraform state rm`/`import` (fuera de ámbito y peligroso para el tfstate heredado). Se dejó que el propio `apply` incremental recreara los cuatro recursos con la **misma configuración** (`0 to destroy` en el plan para S3), conservando el tfstate como fuente de verdad. No hubo intentos fallidos adicionales.
5. **Verificación:** `F04-T02-plan-initial.txt` (`6 to add, 0 to change, 0 to destroy`), `F04-T02-apply.txt` (`Apply complete`, sin `destroy` de S3), `F04-T02-plan-post-apply.txt` (`No changes`) y outputs `s3_bucket_raw`/`s3_bucket_optimized` intactos.
6. **Pendientes:** Informar al Tester y al Architect de que, entre sesiones del emulador, el primer `plan` mostrará recreación de los recursos de T01…T03: es comportamiento esperado del entorno, no regresión. `F04-T05` debe ejecutar `up` → `apply` → sondas → `down` en una sola sesión de CI.
7. **Aprendizaje candidato:** tratar el tfstate local como evidencia declarativa, no como inventario persistente del emulador; documentar en el runbook que cada arranque exige `apply` completo en la misma sesión.

### P3 — Script efímero de plan posterior con error de escape en PowerShell

1. **Identificación:** `F04-T02-P3` (script de evidencia en `temporary/`, no producto).
2. **Problema:** La primera invocación inline de `powershell.exe -Command` para el plan de idempotencia falló en tiempo de parseo (`No se permite usar el carácter de Y comercial (&)`, exit `1`) y no generó evidencia.
3. **Causa:** **Demostrada.** El escape de `$TF` y del operador `&` en una cadena pasada desde `pwsh` a `powershell.exe` (5.1) se resolvió antes de tiempo, dejando un `&` desnudo en el script. No afectó a Terraform ni al emulador.
4. **Solución e intentos fallidos:** Intento fallido: una sola línea `powershell.exe -Command "..."` con escapes. Solución: crear `temporary/F04-T02-plan-post.ps1` ASCII puro que dot-sourcea el helper y ejecuta el plan; se ejecutó con `-File` y devolvió exit `0`.
5. **Verificación:** `F04-T02-plan-post-apply.txt` con `EXIT_CODE: 0` y `No changes. Your infrastructure matches the configuration.`
6. **Pendientes:** Ninguno; el script queda en `temporary/` (ignorado) y no es dependencia de producto.
7. **Aprendizaje candidato:** en este harness, los comandos PowerShell con `&`, `$` y comillas deben ir siempre en un `.ps1` ASCII invocado con `-File`, nunca como `-Command` multilínea escapado.

## 8. Estado final y entrega

- **Implementación:** terminada (`DONE_WITH_CONCERNS`). Concerns: P1 (particularidad de serialización del emulador, resuelta y documentada) y P2 (estado efímero entre sesiones, heredado de T01). Ninguno bloquea CA-02. **Sin `PASSED`, sin cierre de tarea, sin actualización de `STATE.md` ni `docs/sdd/tasks.md`.**
- **Emulador:** apagado (`docker compose down`, exit `0`); `docker ps -a` vacío y red `mediashrink-cloud_default` eliminada (G-7 cumplido).
- **Evidencias:** 16 archivos `F04-T02-*` en `reports/implementation/F04/evidence/`. Los ocho exigidos (`fmt`, `validate`, `plan`, `apply`, `queues`, `redrive`, `visibility`, `emulator-down`) están presentes con salidas y exit codes reales; el resto (`compose-config`, `up`, `cp`, `healthcheck`, `init`, `plan-initial`, `apply-inline-string-timeout`, `plan-post-apply`) son complementarios e historial íntegro del fallo y su corrección.
- **Siguiente paso (Architect):** derivar a Tester independiente para que emita `F04-T02-tester.md` y a Auditor para `reports/audits/F04/F04-T02-auditor.md`; solo después corresponde el cierre `F04-T02-architect.md`.
