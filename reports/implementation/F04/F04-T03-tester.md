# `F04-T03` — Reporte de Tester (verificación independiente)

| Campo | Valor |
|---|---|
| **Tarea / Fase** | `F04-T03` · Fase 4 — `docs/sdd/packages/P-04-terraform-and-ci.md` |
| **Criterio verificado** | **`CA-03`** (tabla `mediashrink-jobs`, PK/SK, TTL 30 días y cierre de `T02-A-01`) |
| **Versión / Loop** | `v1 — Loop 1/3` (primer dictamen de Tester; **no se activan loops**) |
| **Rol / verificador** | Tester independiente — ejecución propia; la evidencia del Developer se consultó solo como historial, nunca como prueba propia |
| **Fecha (UTC)** | `2026-11-18` · ejecución propia `12:21:38` → `12:24:57`; correcciones de arnés y cierre `12:25:54` → `12:27:57` |
| **Duración / procesos propios** | ~7 min · Docker Compose (`ps`, `config`, `up`, `inspect`, `cp`, `down`), `curl.exe`, Terraform (`fmt`, `init`, `validate`, `plan` ×2, `apply`, `output`), `node` (sonda DynamoDB/S3 propia), `Get-FileHash`, `git status`/`git diff` |
| **Veredicto global** | **`PASSED`** — `CA-03` satisfecho con evidencia propia; 0 hallazgos bloqueantes |

## 1. Fuentes consultadas y aislamiento

- Contrato de rol `.agents/roles/tester.md`; `AGENTS.md`; `STATE.md`; paquete `P-04-terraform-and-ci.md` (CA-03, DoD de Fase 4).
- SDD: `spec.md` **§4** (modelo de datos: `userId` PK, `jobId` SK, `ttl = createdAt + 30 días`) y **FR-20** (retención S3 + TTL DynamoDB).
- Arquitectura: `docs/architecture/03-data-model-and-storage-contract.md` **§2** (PK `userId` / SK `jobId`, sin GSI, prefijos `IMAGE#`) y **§3** (TTL = `floor(createdAt/1000) + 2.592.000`, `AttributeName: 'ttl'`, `ENABLED`).
- Fuente de verdad de la tarea: `reports/implementation/F04/F04-T03-task.md` (CA-03, ámbito, entregables, prohibiciones).
- Entrega bajo revisión: `F04-T03-developer.md` (`DONE_WITH_CONCERNS`, P1 resuelto/P2 heredado); cierres previos `F04-T01-architect.md` y `F04-T02-architect.md` (ambos `PASSED`).
- Artefactos inspeccionados: `infra/terraform/{dynamodb,s3,provider,variables,versions,data,outputs}.tf` y `README.md`; 17 evidencias `F04-T03-*` del Developer (historial append-only, no reutilizadas como propias).
- Decisión de tabla de usuarios contrastada con código en **solo lectura**: `backend/src/config/index.ts` (solo `DYNAMODB_TABLE_JOBS`), `backend/src/db/user-store-adapter.ts` (`USER#PROFILE` / `USER#EMAIL` en la misma tabla) y `backend/src/api/app.ts` (inyección de `config.resources.dynamodbTableJobs`). **No se modificó `backend/`.**
- Entorno: transporte único `https://127.0.0.1:9297`; credenciales por `AWS_SHARED_CREDENTIALS_FILE`/`AWS_CONFIG_FILE` generados en la sesión; CA autofirmado propio; **sin `:9324`, sin AWS real, sin secretos**. Binarios fuera de PATH: `<DOCKER_CLI_DIR>` y `<TF_BIN>` resueltos en tiempo de ejecución y redactados en toda evidencia.

## 2. Dictamen por criterio — `CA-03`

| Requisito verificado | Resultado propio | Evidencia Tester | Estado |
|---|---|---|---|
| `fmt` / `validate` / `plan` / `apply` exit 0; plan posterior `No changes` | `fmt=0`, `init=0`, `validate=0` (`Success! The configuration is valid.`), `plan=0` (`Plan: 7 to add, 0 to change, **0 to destroy**`), `apply=0` (`Apply complete! Resources: 7 added, 0 changed, 0 destroyed`; `aws_dynamodb_table.jobs: Creation complete after 6s`), `plan-post-apply=0` → `No changes. Your infrastructure matches the configuration.` | `F04-T03-tester-{fmt,init,validate,plan,apply,plan-post-apply}.txt` | **CUMPLIDO** |
| `DescribeTable`: `mediashrink-jobs` `ACTIVE`, HASH `userId` / RANGE `jobId`, tipos `S` | `TP_TABLE_NAME: mediashrink-jobs`, `TP_TABLE_STATUS: ACTIVE`, `TP_KEY_SCHEMA: jobId:RANGE \| userId:HASH`, `TP_ATTRIBUTE_DEFINITIONS: jobId:S \| userId:S`, `TP_KEY_COUNT: 2`, `TP_HASH_KEY: userId`, `TP_RANGE_KEY: jobId`, `TP_USERID_TYPE: S`, `TP_JOBID_TYPE: S`, `TP_KEYS_MATCH_CONTRACT: true`. Capacidad `5/5` PROVISIONED, sin GSI (coherente con arquitectura §2) | `F04-T03-tester-probe.txt`, `dynamodb.tf` | **CUMPLIDO** |
| `DescribeTimeToLive`: `ENABLED` sobre `ttl`; 30 días = 2.592.000 s derivados de `retention_days` | `TP_TTL_ATTRIBUTE: ttl`, `TP_TTL_STATUS: ENABLED`, `TP_TTL_ATTRIBUTE_IS_TTL: true`, `TP_TTL_IS_ENABLED: true`; outputs `dynamodb_ttl_seconds = 2592000` (tipo number) y `dynamodb_ttl_attribute = "ttl"`. Derivación `local.ttl_seconds = var.retention_days * 86400` con `retention_days = 30` | `F04-T03-tester-{probe,output}.txt`, `dynamodb.tf`, `s3.tf` | **CUMPLIDO** |
| Cierre de `T02-A-01`: lifecycle 30 d en ambos buckets + TTL 30 d con fuente única; sin literales duplicados; outputs y `check` blocks | `TP_TF_TTL_SECONDS: 2592000`, `TP_TF_S3_DAYS: 30`, `TP_TF_DERIVED_FROM_DAYS: true`; `GetBucketLifecycleConfiguration` en `mediashrink-raw-local` y `mediashrink-optimized-local`: `Enabled`, `expiration.Days = 30`, `TP_RULE_EQ_30_ENABLED: true` en ambos; `TP_T02_A_01_CLOSED: true`. Estático: `TOTAL_CODE_RETENTION_LITERALS: 1` (solo `default = 30` en `s3.tf`), `CODE_RETENTION_LITERALS_dynamodb: 0`, `NO_DUPLICATED_RETENTION_LITERAL_IN_DYNAMODB_TF: true`. Presentes los 2 `check` blocks (`retention_alignment_s3_dynamodb`, `dynamodb_ttl_enabled`) y los 4 outputs de T03 | `F04-T03-tester-{probe,static-corrected-v3}.txt`, `dynamodb.tf`, `s3.tf` | **CUMPLIDO** |
| Decisión de tabla de usuarios: documentada y sin recurso huérfano | `TP_TABLE_NAMES: mediashrink-jobs`, `TP_USERS_TABLE_ABSENT: true`. Justificación declarada en `dynamodb.tf` (cabecera) y `README.md` §«Tabla de usuarios»: el config solo declara `DYNAMODB_TABLE_JOBS` (`config/index.ts`), el adaptador recibe `tableName` por inyección y convive en la misma tabla con SK `USER#PROFILE`/`USER#EMAIL` (`user-store-adapter.ts`), y `app.ts` inyecta esa misma tabla a todos los stores. Crear `mediashrink-users` daría un recurso sin consumidor | `F04-T03-tester-probe.txt`, `F04-T03-tester-static-corrected-v3.txt`, `dynamodb.tf`, `README.md`, código de `backend/` en lectura | **CUMPLIDO** |
| Transporte y G-7: `:9297`, CA propio, sin `:9324`, `skip_*` intactos; `down` y `ps -a` vacío | Healthcheck con CA → `BODY_WITH_CA: ok`, `EXIT_WITH_CA: 0`; sin CA → `EXIT_WITHOUT_CA: 60` (esperado). `provider.tf` conserva `shared_credentials_files`, `shared_config_files`, `custom_ca_bundle`, endpoint único y las tres `skip_*` sin modificar; `variables.tf` rechaza `:9324` y el output `emulator_endpoint = "https://127.0.0.1:9297"`. `up`: `memory=2147483648`, `nanoCpus=2000000000`, `user=1000:1000`, `HEALTHY: True`; `docker cp` de los 3 archivos en esta sesión; `down` + `ps -a` (solo cabecera) + red sin entradas, reverificado al cierre | `F04-T03-tester-{transport,up,cp,output,emulator-down,final-check}.txt`, `provider.tf` | **CUMPLIDO** |
| Ámbito: solo `infra/terraform/**` (lectura) y reportes/evidencias propios; sin tocar `frontend/`, `backend/`, manifiestos, `STATE.md`, `tasks.md`; sin push | `SOURCE_HASHES_COMPARED: 19`, `SOURCE_HASH_MISMATCHES: 0`, `HCL_FILES_UNCHANGED_BY_TESTER: true`, listas `git status`/`git diff` idénticas antes y después. Los únicos archivos mutados por mi ejecución son `terraform.tfstate`/`.backup` (estado runtime no versionado) y mis propias evidencias. Scripts efímeros alojados en `temporary/` (ignorado). Sin commit ni push | `F04-T03-tester-{scope-before,scope-after,scope-corrected-v3,final-check}.txt` | **CUMPLIDO** |

**Resultado: 7/7 requisitos CUMPLIDOS.**

## 3. Ejecución propia (registro cronológico)

Todas las corridas se hicieron desde la raíz del proyecto, en una sola sesión de emulador, con `AWS_ENDPOINT_URL`, `AWS_REGION`, archivos de credenciales/config, `AWS_CA_BUNDLE`, `NODE_EXTRA_CA_CERTS` y `AWS_EC2_METADATA_DISABLED=true` (sin `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`/`AWS_PROFILE`).

| # | Evidencia (`F04-T03-tester-…`) | Acción | Exit |
|---|---|---|---|
| 1 | `pre-docker-state.txt` | `docker ps -a` + red (baseline limpio) | 0 |
| 2 | `scope-before.txt` | SHA256 de HCL/docs/manifiestos + `git status`/`diff` | 0 |
| 3 | `static.txt` | Búsqueda de literales de retención y estructura HCL (ver §4: corregida después) | 0 |
| 4 | `compose-config.txt` | `docker compose config` (esquema y límites declarados) | 0 |
| 5 | `up.txt` | `compose up -d` → `healthy=True`; `inspect` de límites | 0 |
| 6 | `cp.txt` | `docker cp` de `ca.pem`, `config`, `emulator_credentials` | 0 |
| 7 | `transport.txt` | `curl` con CA (`ok`, exit 0) y sin CA (exit 60, esperado) | 60 (*) |
| 8 | `fmt.txt` / `init.txt` / `validate.txt` | Terraform format, init y validate | 0 / 0 / 0 |
| 9 | `plan.txt` | Plan incremental: `7 to add, 0 to change, 0 to destroy` | 0 |
| 10 | `apply.txt` | Apply: `7 added, 0 changed, 0 destroyed`; outputs T01/T02/T03 | 0 |
| 11 | `plan-post-apply.txt` | Idempotencia: `No changes` | 0 |
| 12 | `output.txt` | Outputs JSON (tabla, ARN, `ttl`, `2592000`, `30`, endpoint) | 0 |
| 13 | `probe.txt` | Sonda propia `DescribeTable` + `DescribeTimeToLive` + `ListTables` + lifecycle S3 | 0 |
| 14 | `scope-after.txt` | SHA256 y `git status`/`diff` tras la ejecución | 0 |
| 15 | `secrets.txt` | Escaneo de secretos/rutas absolutas en evidencias | 0 |
| 16 | `emulator-down.txt` | `compose down` + `ps -a` + red (ejecutado en `finally`) | 0 |
| 17–24 | `static-corrected{,-v2,-v3}.txt`, `scope-corrected{,-v2,-v3}.txt` | Corrección del arnés de verificación propio (§4), append-only | 0 cada uno |
| 25 | `final-check.txt` | `ps -a`/red vacíos + escaneo de 24 evidencias + veredictos corregidos | 0 |

(*) El `EXIT_CODE: 60` del archivo 7 corresponde al **último** comando del paso (el `curl` **sin** CA, que debe fallar para demostrar que el CA propio es obligatorio). El `curl` **con** CA devolvió `ok` con exit `0` (líneas 13–14). No es un fallo de la verificación.

## 4. Hallazgos y notas de integridad

### 4.1 Corrección de mi propio arnés de verificación (no es un defecto del producto)

La primera pasada estática (`F04-T03-tester-static.txt`) y la primera comparación de alcance (`scope-after.txt` / `scope-corrected.txt`) contenían **errores de mis scripts efímeros**, no del HCL:

1. Pase un patrón regex escapado a `Select-String -SimpleMatch`, por lo que los ocho chequeos estructurales de `dynamodb.tf` salieron `False` aunque el archivo los contiene.
2. El filtro de comentarios no excluía bloques heredoc (`<<-EOT`), de modo que una frase documental con `30` se contó como literal de código.
3. La comparación de hashes incluía `terraform.tfstate`/`.backup` (mutados legítimamente por mi propio `apply`) y los bloques de `git diff` incluían líneas `warning:` de Git intercaladas por stderr.

**Corrección:** se conservaron todos los originales (append-only) y se emitieron `static-corrected-v3.txt` y `scope-corrected-v3.txt` con coincidencia literal ordinal, exclusión de heredocs/comentarios y filtrado de estado runtime y avisos de Git. Resultado final: `TOTAL_CODE_RETENTION_LITERALS: 1` (único `default = 30` en `s3.tf`), `STATIC_CHECKS_CONSISTENT: true`, `SOURCE_HASH_MISMATCHES: 0`, `GIT_STATUS_LISTS_IDENTICAL: true`, `GIT_DIFF_LISTS_IDENTICAL: true`. No hubo que corregir ningún artefacto de `infra/terraform/**`.

### 4.2 P2 — Estado efímero del emulador entre sesiones (heredado de T01/T02, INFO)

Mi `plan` pre-apply advirtió «has been deleted» para la tabla, buckets y colas (el emulador guarda el estado en memoria y el volumen named solo conserva CA/config/credenciales). No modifiqué `s3.tf`/`sqs.tf`, no hice `state rm`/`import` y el plan sigue siendo `0 to destroy`; el `apply` recreó la misma configuración con `0 destroyed` y el plan posterior dio `No changes`. Es comportamiento esperado del entorno, no regresión de CA-03. Recomendación vigente para `F04-T05`: ejecutar `up → apply → sondas → down` en una sola sesión de CI.

### 4.3 Nota INFO para el Auditor (no bloqueante, fuera del alcance de T03)

El comentario de `dynamodb.tf` (líneas 65–66) afirma que «cada item (job, imagen hija y perfil de usuario) lleva el atributo `ttl`». La lectura de `backend/src/db/user-store-adapter.ts` muestra que los ítems `USER#PROFILE`/`USER#EMAIL` **no** escriben `ttl`. Esto no afecta a `CA-03` (el TTL está habilitado a nivel de tabla sobre `ttl` y los ítems de job/hijo sí lo gestionan en la capa congelada), pero la redacción del comentario es más amplia que el comportamiento real y merece registrarse como INFO. No se modificó código de `backend/` ni HCL.

**Historial append-only conservado:** las 17 evidencias del Developer mantienen sus timestamps originales (11:51–12:17 UTC), anteriores a mis evidencias (12:21–12:28 UTC). No se sobrescribió, editó ni eliminó ninguna.

## 5. Conclusión

Con ejecución propia e independiente se verifican, contra emulador en vivo, la declaración y el comportamiento de `mediashrink-jobs`: tabla `ACTIVE`, PK `userId` (HASH) / SK `jobId` (RANGE) con tipos `S`, `DescribeTimeToLive` `ENABLED` sobre `ttl`, retención de 30 días derivada de la única variable `retention_days` y alineada con el lifecycle de ambos buckets (`T02_A_01_CLOSED: true`), sin literales duplicados en HCL, con `check` blocks y outputs presentes, y sin tabla de usuarios huérfana. El ciclo `fmt`/`validate`/`plan`/`apply`/`plan-post-apply` fue limpio, incremental (`0 to destroy`) e idempotente. Transporte `:9297` con CA propio, credenciales por archivo, `skip_*` intactos y emulador apagado con `docker ps -a` vacío. Ámbito y secretos verificados.

**Veredicto: `PASSED` (Loop 1/3, primer dictamen).** Sin hallazgos CRITICAL/HIGH ni bloqueantes; sin activación de loops; sin cambios fuera de mis propios reportes/evidencias y scripts efímeros en `temporary/`. Architect puede integrar este dictamen y proceder con la auditoría y el cierre de la tarea.
