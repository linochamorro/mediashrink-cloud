# `F04-T03` — Reporte de Developer (entrega, sin dictamen)

| Campo | Valor |
|---|---|
| **Tarea / Fase** | `F04-T03` · Fase 4 — `docs/sdd/packages/P-04-terraform-and-ci.md` |
| **Rol / verificadores** | Developer · Tester + Auditor + Architect (pendientes) |
| **Versión / Loop** | `v1 — Loop 1/3` (una iteración interna de formato dentro del mismo loop; no se consumió ningún loop de Tester) |
| **Harness** | OpenCode |
| **Fecha (UTC)** | `2026-11-18` |
| **Estado de entrega** | **`DONE_WITH_CONCERNS`** — CA-03 implementado y verificado en vivo; **no se emite `PASSED` ni se cierra la tarea** |
| **Ámbito tocado** | `infra/terraform/dynamodb.tf` (nuevo), `infra/terraform/README.md`, `reports/implementation/F04/evidence/F04-T03-*`, este reporte; scripts efímeros en `temporary/` (ignorados por Git) |

## 1. Fuentes consultadas (lectura obligatoria)

- `AGENTS.md`, `STATE.md`, `.agents/roles/developer.md`.
- `reports/implementation/F04/F04-T03-task.md` (**fuente de verdad**: CA-03, ámbito, entregables y prohibiciones).
- `docs/sdd/packages/P-04-terraform-and-ci.md` (CA-03, DoD de Fase 4), `docs/sdd/spec.md` **§4** (modelo de datos, `ttl = createdAt + 30 días`) y **FR-20** (retención S3 + TTL DynamoDB).
- `docs/architecture/03-data-model-and-storage-contract.md` **§2** (PK `userId` / SK `jobId`, sin GSI) y **§3** (TTL 30 días, `AttributeName: 'ttl'`, `Enabled: true`, `TimeToLiveStatus ENABLED`).
- `reports/implementation/F04/F04-T01-architect.md` (T01 cerrada `PASSED`; `F04T01-A-01` recomienda cerrar `T02-A-01` en T03) y `F04-T02-architect.md` (T02 cerrada `PASSED`).
- Estado actual de `infra/terraform/**`: `provider.tf`, `variables.tf`, `versions.tf`, `data.tf`, `outputs.tf`, `s3.tf` (variable `retention_days`), `sqs.tf`, `README.md`, `terraform.tfstate`.
- `.env.example` (`DYNAMODB_TABLE_JOBS=mediashrink-jobs`, `RETENTION_DAYS=30`, sin `DYNAMODB_TABLE_USERS`).
- Solo lectura (para la decisión de tabla de usuarios): `backend/src/config/index.ts`, `backend/src/db/user-store-adapter.ts` y `backend/src/api/app.ts`. **No se modificó `backend/`.**
- `docs/runbooks/development-workflow.md` §1.1–1.4 (G-7, `docker cp` en cada arranque, `:9297` como transporte único, sin `:9324`).

## 2. Criterio `CA-03` — cobertura

| Requisito de `CA-03` | Evidencia real |
|---|---|
| Tabla `mediashrink-jobs` con PK `userId` (HASH) y SK `jobId` (RANGE) | `F04-T03-table.txt`: `TABLE_NAME: mediashrink-jobs`, `TABLE_STATUS: ACTIVE`; `F04-T03-keys.txt`: `HASH_KEY: userId`, `RANGE_KEY: jobId`, `KEY_SCHEMA_COUNT: 2`, `USERID_DEFINITION_TYPE: S`, `JOBID_DEFINITION_TYPE: S`, `KEYS_MATCH_CONTRACT: true` |
| `TimeToLiveSpecification` sobre `ttl`, habilitada | `F04-T03-ttl.txt`: `TTL_ATTRIBUTE_NAME: ttl`, `TTL_STATUS: ENABLED`, `TTL_ATTRIBUTE_IS_TTL: true`, `TTL_ENABLED: true` |
| TTL 30 días = 2.592.000 s coherente con el lifecycle S3 (`T02-A-01`) | `F04-T03-retention-alignment.txt`: `TF_DYNAMODB_TTL_SECONDS: 2592000`, `TF_S3_LIFECYCLE_EXPIRATION_DAYS: 30`, `TF_DERIVATION_CONSISTENT: true`, lifecycle `Enabled`/`Days: 30` en `raw` y `optimized`, `T02_A_01_CLOSED: true` |
| Única fuente de retencion (sin literales 30/2592000 duplicados en HCL) | `dynamodb.tf`: `local.ttl_seconds = var.retention_days * 86400`; output `dynamodb_ttl_seconds = 2592000`; dos `check` blocks. El `30` y `2592000` solo aparecen en comentarios documentales; `86400` es la constante de conversión días→segundos |
| Evaluar tabla de usuarios | **No se crea** `mediashrink-users`; justificación en §5 y `F04-T03-table.txt`: `USERS_TABLE_ABSENT: true` |
| Billing mode acorde al emulador | `billing_mode = "PROVISIONED"`, `read_capacity = 5`, `write_capacity = 5`. `DescribeTable` devuelve `PROVISIONED_READ_CAPACITY: 5` / `PROVISIONED_WRITE_CAPACITY: 5`; `plan-post-apply` → `No changes` (sin diffs perpetuos) |
| Plan incremental, 0 destroy de buckets/colas | `F04-T03-plan.txt`: `Plan: 7 to add, 0 to change, 0 to destroy`; `F04-T03-apply.txt`: `Apply complete! Resources: 7 added, 0 changed, 0 destroyed` |
| Idempotencia | `F04-T03-plan-post-apply.txt`: `No changes. Your infrastructure matches the configuration.` (exit `0`) |
| Sin AWS real; credenciales por archivo, CA propio, `:9297`, `skip_*` intactos | `provider.tf`/`variables.tf`/`versions.tf`/`data.tf` sin modificaciones; `:9324` ausente; `skip_*` sin tocar (competencia de `F04-T04`); `F04-T03-{up,cp,healthcheck}.txt` |
| G-7 / ámbito | `F04-T03-up.txt`: `memory=2147483648`, `nanoCpus=2000000000`, `user=1000:1000`; `F04-T03-emulator-down.txt`: `CONTAINERS_REMAINING: 0`, `NETWORK_REMAINING: 0`. Sin tocar `frontend/`, `backend/`, manifiestos raíz, `.env.example`, `STATE.md`, `docs/sdd/tasks.md`; sin push |

## 3. Cambios implementados

- **`infra/terraform/dynamodb.tf` (nuevo):**
  - `locals.ttl_seconds = var.retention_days * 86400` (fuente única de retención heredada de `s3.tf`).
  - Variable `dynamodb_table_jobs` (default `mediashrink-jobs`, validación de longitud 3–255).
  - `aws_dynamodb_table.jobs` con `hash_key = "userId"`, `range_key = "jobId"`, attribute definitions `userId`/`jobId` de tipo `S`, `billing_mode = "PROVISIONED"` (5/5) y bloque `ttl { attribute_name = "ttl", enabled = true }`.
  - Dos `check` blocks del core Terraform: `retention_alignment_s3_dynamodb` (el TTL derivado debe ser congruente con `retention_days`) y `dynamodb_ttl_enabled` (la tabla declara TTL sobre `ttl`).
  - Outputs: `dynamodb_table_jobs`, `dynamodb_table_jobs_arn`, `dynamodb_ttl_attribute`, `dynamodb_ttl_seconds`.
- **`infra/terraform/README.md`:** inventario con `dynamodb.tf`, tabla de variables de T03, sección «Única fuente de retención (cierra `T02-A-01`)» y justificación de la no-creación de `mediashrink-users`.
- **`temporary/F04-T03-{lib,up,fixfmt,tf-pre,tf-apply,probe,probe.ps1,down}.ps1` y `F04-T03-probe.mjs`:** helpers efímeros de captura y sondas `@aws-sdk/client-dynamodb` / `@aws-sdk/client-s3` v3 (`endpoint :9297`, credenciales por archivo, CA vía `NODE_EXTRA_CA_CERTS`). Bajo `temporary/` (ignorado); **ningún artefacto de producto depende de ellos**.

Recursos **no** creados (pertenecen a otras tareas, confines respetados): IAM/CORS/`skip_*` (`F04-T04`), CI (`F04-T05`), `mediashrink-users` (sin consumidor, ver §5). No se tocó `.env.example` ni Git (sin push).

## 4. Comandos ejecutados y exit codes reales

Ejecutados desde `<PROJECT_ROOT>` con `<TF_BIN>` (Terraform 1.17.2) y `<DOCKER_CLI_DIR>\docker.exe` (Compose v5.7.0), ambos fuera de PATH; rutas resueltas en tiempo de ejecución y **no versionadas**.

| # | Comando | Exit | Evidencia |
|---|---|---|---|
| 1 | `docker compose config` | `0` | `F04-T03-compose-config.txt` |
| 2 | `docker compose up -d` + espera `healthy` + `docker inspect` | `0` / `healthy=True` | `F04-T03-up.txt` |
| 3 | `docker cp` de `ca.pem`, `config`, `emulator_credentials` | `0` | `F04-T03-cp.txt` |
| 4 | `curl.exe --cacert ./.local/aws-emulator/ca.pem https://127.0.0.1:9297/__admin/health` | `0` (`ok`) | `F04-T03-healthcheck.txt` |
| 5 | `terraform -chdir=infra/terraform fmt -check` (inicial) | **`3`** (`dynamodb.tf`) | `F04-T03-fmt-initial.txt` (historial, ver P1) |
| 6 | `terraform -chdir=infra/terraform fmt` | `0` | (corrector, ver P1) |
| 7 | `terraform -chdir=infra/terraform fmt -check` | `0` | `F04-T03-fmt.txt` |
| 8 | `terraform -chdir=infra/terraform init -input=false` | `0` | `F04-T03-init.txt` |
| 9 | `terraform -chdir=infra/terraform validate` | `0` | `F04-T03-validate.txt` |
| 10 | `terraform -chdir=infra/terraform plan -input=false` | `0` (`7 to add, 0 to change, 0 to destroy`) | `F04-T03-plan.txt` |
| 11 | `terraform -chdir=infra/terraform apply -input=false -auto-approve` | `0` (`7 added, 0 changed, 0 destroyed`) | `F04-T03-apply.txt` |
| 12 | `terraform -chdir=infra/terraform plan -input=false` (idempotencia) | `0` (`No changes`) | `F04-T03-plan-post-apply.txt` |
| 13 | `terraform -chdir=infra/terraform output -json` | `0` | `F04-T03-output.txt` |
| 14 | `node temporary/F04-T03-probe.mjs table` | `0` | `F04-T03-table.txt` |
| 15 | `node temporary/F04-T03-probe.mjs ttl` | `0` | `F04-T03-ttl.txt` |
| 16 | `node temporary/F04-T03-probe.mjs keys` | `0` | `F04-T03-keys.txt` |
| 17 | `node temporary/F04-T03-probe.mjs retention-alignment` | `0` | `F04-T03-retention-alignment.txt` |
| 18 | `docker compose down` + `docker ps -a` + `docker network ls` | `0` / `0` / `0` | `F04-T03-emulator-down.txt` |

Límites G-7 confirmados en `F04-T03-up.txt` (`memory=2147483648`, `nanoCpus=2000000000`, `user=1000:1000`). Apagado: `CONTAINERS_REMAINING: 0`, `NETWORK_REMAINING: 0`.

## 5. Decisiones técnicas y cierre de `T02-A-01`

1. **Tabla de usuarios: NO se crea `mediashrink-users`.** Decisión basada en evidencia de código (solo lectura): (a) `.env.example` solo declara `DYNAMODB_TABLE_JOBS=mediashrink-jobs`, sin `DYNAMODB_TABLE_USERS`; (b) `backend/src/config/index.ts` lee únicamente `DYNAMODB_TABLE_JOBS` (`loadConfig` → `resources.dynamodbTableJobs`); (c) `backend/src/db/user-store-adapter.ts` (cierra `T03-A-04`) recibe `tableName` por **inyección** y **convive en la misma tabla** con SK `USER#PROFILE` (PK = `userId`) y `USER#EMAIL` (PK = correo normalizado), garantizando unicidad con `TransactWrite`; (d) `backend/src/api/app.ts` inyecta `config.resources.dynamodbTableJobs` a todos los stores. Crear una tabla separada produciría un recurso **huérfano** (ningún consumidor lo leería), añadiría superficie y contradeciría el contrato congelado. La sonda `ListTables` confirma `TABLE_NAMES: mediashrink-jobs` y `USERS_TABLE_ABSENT: true`. Los IDs opacos no contienen `#`, así que `USER#` no colisiona con `IMAGE#` ni con `jobId`s.
2. **Única fuente de retención (cierra `T02-A-01`).** `var.retention_days` (declarada en `s3.tf`, default `30`) gobierna el ciclo de vida S3 y, derivado, el TTL DynamoDB: `local.ttl_seconds = var.retention_days * 86400`. No se duplica el literal `30` ni `2592000` en HCL (solo en comentarios documentales); `86400` es la constante de conversión de unidades. El output `dynamodb_ttl_seconds` expone el valor derivado (`2592000`). Dos `check` blocks del **core Terraform 1.17** (feature ≥ 1.5, **no depende del proveedor AWS**, acorde a la instrucción «si el proveedor lo soporta; si no, documentar») validan la derivación y que el TTL está habilitado sobre `ttl`. `F04-T03-retention-alignment.txt` cierra formalmente el seguimiento: lifecycle `Enabled`/`Days: 30` en ambos buckets + `DescribeTimeToLive` `ENABLED`/`ttl` + `T02_A_01_CLOSED: true`.
3. **Billing mode `PROVISIONED` (5/5).** Elegido por compatibilidad con `aws-emulator` y para evitar el diff perpetuo que ciertos emuladores muestran con `PAY_PER_REQUEST`. `DescribeTable` confirma 5/5 y el `plan-post-apply` da `No changes`, de modo que no hay deriva de estado.
4. **Sin GSI.** Coherente con `architecture/03-*.md` §2: todo acceso empieza por `userId` y el listado de hijos usa `begins_with(jobId, 'IMAGE#...')`. No se añade índice que no consume ningún adaptador.
5. **Transporte y secretos.** Único endpoint `https://127.0.0.1:9297`; credenciales por `AWS_SHARED_CREDENTIALS_FILE`/`AWS_CONFIG_FILE` generados y exportados con `docker cp`; CA propio vía `custom_ca_bundle` / `NODE_EXTRA_CA_CERTS`; `skip_*` intactos (competencia de `F04-T04`). Ningún secreto ni ruta Windows absoluta aparece en artefactos versionados; se usan marcadores `<PROJECT_ROOT>`, `<TF_BIN>`, `<DOCKER_CLI_DIR>`.
6. **Estado local.** `infra/terraform/terraform.tfstate` queda con los recursos del emulador y excluido de Git. Es estado de desarrollo, no de AWS real. No se ejecutó `terraform apply` contra AWS real.

## 6. Problemas registrados (7 campos cada uno)

### P1 — `terraform fmt -check` devolvió exit `3` por la alineación de `dynamodb.tf`

1. **Identificación:** `F04-T03-P1` (HCL `infra/terraform/dynamodb.tf`, revisión de formato previa al `apply`).
2. **Problema:** La primera ejecución de `terraform -chdir=infra/terraform fmt -check` terminó con exit `3` y listó `dynamodb.tf` como archivo a reformatear (`F04-T03-fmt-initial.txt`). No afectó a `validate` ni al `plan`, que terminaron exit `0`.
3. **Causa:** **Demostrada.** El bloque `resource "aws_dynamodb_table" "jobs"` tenía los signos `=` de `name`, `billing_mode`, `read_capacity` y `write_capacity` alineados a una columna distinta de la que exige `terraform fmt` (el alineador agrupa `name`/`billing_mode` y `read_capacity`/`write_capacity` por longitud de clave). Era un defecto de formato del archivo recién escrito, no un error semántico.
4. **Solución e intentos fallidos:** No hubo intentos fallidos de corrección a ciegas: se conservó la salida original como `F04-T03-fmt-initial.txt`, se ejecutó `terraform fmt` (exit `0`, reformateó `dynamodb.tf`) y se re-ejecutó la secuencia completa `fmt -check`/`init`/`validate`/`plan` dentro del mismo loop, con exit `0` en los cuatro. El `apply` posterior fue exit `0` a la primera.
5. **Verificación:** `F04-T03-fmt-initial.txt` (exit `3`, historial íntegro), `F04-T03-fmt.txt` (exit `0`), `F04-T03-validate.txt` (`Success! The configuration is valid.`, exit `0`), `F04-T03-plan.txt` (`7 to add, 0 to change, 0 to destroy`, exit `0`) y `F04-T03-apply.txt` (`7 added, 0 changed, 0 destroyed`, exit `0`).
6. **Pendientes:** Ninguno bloqueante. El Tester debe repetir `fmt`/`validate`/`plan` con evidencia propia. No es G-9 ni G-10.
7. **Aprendizaje candidato:** en este harness, ejecutar `terraform fmt` (no solo `-check`) inmediatamente después de crear un archivo HCL con bloques de atributos de longitudes mixtas, y conservar la salida del primer `-check` como historial antes de corregir.

### P2 — Recreación de buckets S3 y colas SQS por reinicio del emulador (heredado de T01/T02)

1. **Identificación:** `F04-T03-P2` (tfstate heredado de `F04-T02`, advertencia `AWS resource not found during refresh`).
2. **Problema:** El `plan` pre-apply avisó de que `aws_s3_bucket.raw`, `.optimized`, sus lifecycle configurations y `aws_sqs_queue.dlq`/`.jobs` «has been deleted» fuera de Terraform y planificó su recreación (`7 to add`, de los cuales 6 son recursos de T01/T02 y 1 la tabla nueva de T03).
3. **Causa:** **Demostrada.** El emulador mantiene el estado de los recursos en memoria y el volumen named solo conserva `ca.pem`, `config` y `emulator_credentials`; tras el `docker compose down` de T02 y el `up` de esta sesión los buckets/colas ya no existían. El refresh del provider los quitó del estado con advertencia. Ya estaba documentado en `F04-T01-architect.md`, `F04-T02-developer.md` (P2) y `F04-T02-architect.md`: es comportamiento esperado del entorno, no regresión.
4. **Solución e intentos fallidos:** No se modificó `s3.tf`/`sqs.tf`, no se hizo `terraform state rm`/`import` y no se cambió el orden de recursos (fuera de ámbito y peligroso para el tfstate heredado). Se dejó que el propio `apply` incremental recreara los seis recursos con la **misma configuración** y creara la tabla nueva: `0 to destroy` en el plan y `Apply complete! Resources: 7 added, 0 changed, 0 destroyed`. El `plan-post-apply` posterior dio `No changes`. No hubo intentos fallidos.
5. **Verificación:** `F04-T03-plan.txt` (`7 to add, 0 to change, 0 to destroy` + advertencia de refresh), `F04-T03-apply.txt` (`7 added, 0 changed, 0 destroyed`; `aws_dynamodb_table.jobs: Creation complete after 7s`), `F04-T03-plan-post-apply.txt` (`No changes`) y outputs `s3_*`/`sqs_*` intactos.
6. **Pendientes:** Informar al Tester y al Architect de que, entre sesiones del emulador, el primer `plan` mostrará recreación de los recursos de T01…T03: es esperado. `F04-T05` debe ejecutar `up → apply → sondas → down` en una sola sesión de CI (recomendación `F04T02-A-01`). Ningún concern bloquea CA-03.
7. **Aprendizaje candidato:** tratar el tfstate local como evidencia declarativa, no como inventario persistente del emulador; documentar en el runbook que cada arranque exige `apply` completo en la misma sesión.

## 7. Estado final y entrega

- **Implementación:** terminada (`DONE_WITH_CONCERNS`). Concerns: P1 (formato, resuelto y documentado en el mismo loop) y P2 (estado efímero entre sesiones, heredado de T01/T02 y no bloqueante). **Sin `PASSED`, sin cierre de tarea, sin actualización de `STATE.md` ni `docs/sdd/tasks.md`.**
- **Emulador:** apagado (`docker compose down`, exit `0`); `docker ps -a` y `docker network ls --filter name=mediashrink-cloud_default` sin entradas, `CONTAINERS_REMAINING: 0` y `NETWORK_REMAINING: 0` (G-7 cumplido).
- **Evidencias:** 17 archivos `F04-T03-*` en `reports/implementation/F04/evidence/`. Los nueve exigidos (`fmt`, `validate`, `plan`, `apply`, `table`, `ttl`, `keys`, `retention-alignment`, `emulator-down`) están presentes con salidas y exit codes reales; el resto (`compose-config`, `up`, `cp`, `healthcheck`, `fmt-initial`, `init`, `plan-post-apply`, `output`) son complementarios e historial íntegro del problema de formato.
- **Siguiente paso (Architect):** derivar a Tester independiente para que emita `F04-T03-tester.md` y a Auditor para `reports/audits/F04/F04-T03-auditor.md`; solo después corresponde el cierre `F04-T03-architect.md`. `T02-A-01` queda **cerrado formalmente** por la evidencia `F04-T03-retention-alignment.txt` (`T02_A_01_CLOSED: true`), pendiente de revisión independiente.
