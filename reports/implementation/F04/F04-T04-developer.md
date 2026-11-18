# `F04-T04` — Reporte de Developer (entrega, sin dictamen)

| Campo | Valor |
|---|---|
| **Tarea / Fase** | `F04-T04` · Fase 4 — `docs/sdd/packages/P-04-terraform-and-ci.md` (`CA-04`) |
| **Rol / verificadores** | Developer · Tester + Auditor + Architect (pendientes) |
| **Versión / Loop** | `v1 — Loop 1/3` (una sesión de emulador; iteraciones internas de evidencia sin consumir loop de Tester) |
| **Harness / Fecha (UTC)** | OpenCode · `2026-11-18` |
| **Estado de entrega** | **`DONE_WITH_CONCERNS`** — CA-04 implementado y verificado en vivo; **no se emite `PASSED` ni se cierra la tarea** |
| **Riesgo** | `3 (Sensible)` — IAM, CORS, flags y exposición de secretos |
| **Ámbito tocado** | `infra/terraform/{provider,variables,s3,dynamodb,iam}.tf`, `infra/terraform/README.md`, `reports/implementation/F04/evidence/F04-T04-*`, este reporte; scripts efímeros en `temporary/` (ignorados por Git) |

## 1. Fuentes consultadas (lectura obligatoria)

- `AGENTS.md`, `STATE.md`, `.agents/roles/developer.md`.
- `reports/implementation/F04/F04-T04-task.md` (**fuente de verdad**: CA-04, ámbito, entregables y prohibiciones).
- `docs/sdd/packages/P-04-terraform-and-ci.md` (CA-04, DoD de Fase 4); `docs/sdd/constitution.md` **PR-08** (secretos fuera del repo) y **PR-09** (transparencia IA con G-6b); `docs/sdd/spec.md` **NFR-03** (CORS explícito, secretos/rutas internas no filtrados).
- `reports/implementation/F04/F04-T01-architect.md`, `F04-T02-architect.md`, `F04-T03-architect.md` (T01…T03 cerradas `PASSED`; `F04T01-A-01` → no heredar `skip_*`; `F04T03-A-04` → corregir comentario TTL de `USER#`).
- `reports/audits/F04/F04-T03-auditor.md` §3, hallazgo `F04T03-A-04` (LOW) y recomendación de `F04T03-A-05`.
- Estado actual de `infra/terraform/**`: `versions.tf`, `provider.tf`, `variables.tf`, `data.tf`, `outputs.tf`, `s3.tf`, `sqs.tf`, `dynamodb.tf`, `README.md`, `terraform.tfstate`.
- `.env.example` (`CORS_ORIGIN=http://localhost:5173`, `AWS_ENDPOINT_URL`, credenciales por archivo, `RETENTION_DAYS=30`).
- Solo lectura (para decidir el bucket CORS y el TTL de `USER#`): `backend/src/storage/presigner.ts`, `backend/src/storage/objects.ts` y `backend/src/db/user-store-adapter.ts`. **No se modificó `backend/`.**
- `docs/runbooks/development-workflow.md` §1.1–1.4 y §3 (G-7, `docker cp` en cada arranque, `:9297` como transporte único, sin `:9324`).

## 2. Criterio `CA-04` — cobertura

| Requisito de `CA-04` | Evidencia real |
|---|---|
| Políticas IAM de mínimo privilegio por recurso (S3 `raw`/`optimized`, SQS+DLQ, DynamoDB), sin comodiles amplios | `iam.tf`: rol `mediashrink-app-role` + política inline con 5 statements; acciones concretas y ARNs derivados de `aws_s3_bucket.*.arn`, `aws_sqs_queue.*.arn`, `aws_dynamodb_table.jobs.arn`. 0 `"Action": "*"` / `"Resource": "*"`. 3 `check`s (`iam_no_broad_wildcards`, `iam_arns_derived_from_resources`, `iam_trust_no_wildcard_principal`). `F04-T04-iam.txt` (outputs), `F04-T04-apply.txt` (creación en vivo) |
| CORS explícito para la SPA en `http://localhost:5173` con métodos `PUT`/`GET` y headers de presign | `s3.tf`: `aws_s3_bucket_cors_configuration` en `raw` y `optimized`; `allowed_origins=[var.cors_origin]`, `allowed_methods=["GET","PUT"]`, 8 headers explícitos sin `*`. `F04-T04-cors.txt`: `ORIGIN_EXACT: true`, `METHODS_EXACT: true`, `HEADERS_NO_WILDCARD: true` en ambos buckets (`GetBucketCors` vivo) |
| Separar/condicionar `skip_*` (`T04-A-03`): variable `is_emulator`, default `true`; `false` en real | `variables.tf` + `provider.tf`: `skip_credentials_validation`, `skip_requesting_account_id` y `skip_metadata_api_check` = `var.is_emulator`; además `endpoints` (bloque dinámico), credenciales por archivo y `custom_ca_bundle` condicionados. `F04-T04-skip-flags.txt`: 3 asignaciones condicionadas, 0 literales `true`, evaluación `true`→flags `true`/endpoint `:9297`, `false`→flags `false`/endpoint `null`/credenciales `[]`; `validate -var='is_emulator=false'` exit 0 |
| Documentar invocación en AWS real **sin ejecutarla ni usar AWS real** | `infra/terraform/README.md` §"AWS real (NO ejecutar en esta fase; documentación únicamente)": procedure con `TF_VAR_is_emulator=false`, sin `AWS_ENDPOINT_URL`/CA/credenciales por archivo; `apply` sujeto a G-12. **No se ejecutó** |
| Mantener endpoint/CA/credenciales por archivo para el emulador | `provider.tf` con `var.is_emulator=true`: `:9297`, `custom_ca_bundle`, `shared_credentials_files`/`shared_config_files`; sin `access_key`/`secret_key` fijos. `F04-T04-{up,cp,healthcheck}.txt` |
| Si el emulador no soporta IAM/CORS: documentar limitación con evidencia y representación declarativa segura, sin simular PASSED | IAM **sí soportado** por el proveedor (`F04-T04-iam-support.txt`, `F04-T04-iam.txt`); CORS **sí soportado** (`F04-T04-cors.txt`). Se conserva además representación declarativa (`jsonencode` en `locals` + outputs + `check`) y se documenta el matiz de la sonda SigV4 artesanal en `F04-T04-support-probe.txt`. **No se simula PASSED** |
| Corrección menor `F04T03-A-04` (comentario `USER#` + aseveración documental, sin cambiar comportamiento) | `dynamodb.tf`: comentario corregido, `check "user_profiles_not_expiring"`, output `dynamodb_ttl_item_policy`, `locals.ttl_item_policy`. `F04-T04-comment-fix.txt`: `ADAPTER_TTL_OCCURRENCES: 0`. Configuración TTL intacta (`ttl`, `2592000`, `ENABLED`) |
| Plan incremental, 0 destroy de buckets/colas/tabla; idempotencia | `F04-T04-plan.txt`: `4 to add, 0 to change, 0 to destroy` (solo 2 IAM + 2 CORS). `F04-T04-apply.txt`: `4 added, 0 changed, 0 destroyed`. `F04-T04-plan-post-apply.txt`: `No changes` |
| G-7 / ámbito / secretos | `F04-T04-up.txt`: `memory=2147483648`, `nanoCpus=2000000000`, `user=1000:1000`. `F04-T04-emulator-down.txt`: `CONTAINERS_REMAINING: 0`, `NETWORK_REMAINING: 0`. Grep: 0 secretos y 0 rutas Windows absolutas en HCL/evidencias; sin tocar `frontend/`, `backend/`, manifiestos raíz, `.env.example`, `STATE.md`, `tasks.md`; sin push |

## 3. Cambios implementados

- **`infra/terraform/variables.tf`:** variables `is_emulator` (bool, default `true`) y `cors_origin` (string, default `http://localhost:5173`, validación URL `http(s)://`).
- **`infra/terraform/provider.tf`:** reescrito alrededor de `var.is_emulator`. Tres `skip_*` condicionados; `shared_credentials_files`/`shared_config_files` con lista vacía en real; `dynamic "endpoints"` con `for_each = var.is_emulator ? [1] : []`; `custom_ca_bundle = var.is_emulator ? var.ca_bundle_path : null`.
- **`infra/terraform/iam.tf` (nuevo):** variable `iam_role_name`; `locals.iam_trust_policy` y `locals.iam_permissions` (5 statements: S3 objetos raw/optimized, `ListBucket`, SQS+DLQ, DynamoDB); `aws_iam_role.app`, `aws_iam_role_policy.app`, `data "aws_iam_role" "app"` (lectura viva); 3 `check` blocks; 4 outputs (`iam_role_name`, `iam_role_arn`, `iam_inline_policy`, `iam_trust_policy`).
- **`infra/terraform/s3.tf`:** `locals.s3_cors_rules` (origen, `GET`/`PUT`, 8 headers, 4 expose headers, `max_age_seconds=3000`), `aws_s3_bucket_cors_configuration` para `raw` y `optimized` (bloques `dynamic "cors_rule"`), `check "s3_cors_explicit_origin_and_methods"`, output `s3_cors_configuration`.
- **`infra/terraform/dynamodb.tf`:** corrección del comentario TTL (`F04T03-A-04`), `locals.ttl_item_policy`, `check "user_profiles_not_expiring"`, output `dynamodb_ttl_item_policy`. **Sin cambio de comportamiento**: `ttl { attribute_name = "ttl", enabled = true }` y `local.ttl_seconds = var.retention_days * 86400` intactos.
- **`infra/terraform/README.md`:** inventario actualizado, tabla de variables de T04, secciones `is_emulator`, "AWS real (no ejecutar)", IAM de mínimo privilegio, CORS explícito y aseveración documental `USER#`.
- **`temporary/F04-T04-*.ps1/.mjs` y `temporary/F04-T04-skip-eval/`:** helpers efímeros de captura, sondas `@aws-sdk/client-s3` y evaluación sin proveedor. Bajo `temporary/` (ignorado); **ningún artefacto de producto depende de ellos**.

Recursos **no** creados (pertenecen a otras tareas): CI (`F04-T05`), cambios en `.env.example` (fuera de ámbito) y nada en `frontend/`/`backend/`. Sin Git/push.

## 4. Comandos ejecutados y exit codes reales

Ejecutados desde la raíz con `<TF_BIN>` (Terraform 1.17.2) y `<DOCKER_CLI_DIR>\docker.exe` (Compose v5.7.0), ambos fuera de PATH; rutas resueltas en tiempo de ejecución y **no versionadas**.

| # | Comando | Exit | Evidencia |
|---|---|---|---|
| 1 | `docker compose config` | `0` | `F04-T04-compose-config.txt` |
| 2 | `docker compose up -d` + espera `healthy` + `docker inspect` | `0` / `healthy=True` | `F04-T04-up.txt` |
| 3 | `docker cp` de `ca.pem`, `config`, `emulator_credentials` | `0` | `F04-T04-cp.txt` |
| 4 | `curl.exe --cacert …/ca.pem https://127.0.0.1:9297/__admin/health` | `0` (`ok`) | `F04-T04-healthcheck.txt` |
| 5 | `terraform fmt` / `fmt -check` (inicial) | `0` / `0` | `F04-T04-fmt-correct.txt`, `F04-T04-fmt.txt` |
| 6 | `terraform init -input=false` | `0` | `F04-T04-init.txt` |
| 7 | `terraform validate` | `0` | `F04-T04-validate.txt` |
| 8 | `terraform plan -input=false` (pre-IAM/CORS, recrea T01…T03) | `0` (`7 to add, 0 destroy`) | `F04-T04-plan-pre.txt` |
| 9 | `terraform apply -auto-approve` (pre-IAM/CORS) | `0` (`7 added, 0 destroyed`) | `F04-T04-apply-pre.txt` |
| 10 | Sonda IAM/CORS (raw SigV4 + SDK S3) | `0` | `F04-T04-support-probe.txt` |
| 11 | Probe `aws_iam_role` + `aws_iam_role_policy` + `data.aws_iam_role` | `0` (creados) | `F04-T04-iam-support.txt` |
| 12 | Retirada del probe (solo 2 recursos efímeros destruidos) | `0` | `F04-T04-iam-support-{plan,apply}.txt` |
| 13 | `terraform fmt` / `fmt -check` / `validate` (final IAM/CORS) | `0` / `0` / `0` | `F04-T04-fmt*.txt`, `F04-T04-validate.txt` |
| 14 | `terraform plan -input=false` (final) | `0` (`4 to add, 0 change, 0 destroy`) | `F04-T04-plan.txt` |
| 15 | `terraform apply -auto-approve` (final) | `0` (`4 added, 0 changed, 0 destroyed`) | `F04-T04-apply.txt` |
| 16 | `terraform output -json` | `0` | `F04-T04-output.txt`, `F04-T04-iam.txt` |
| 17 | `GetBucketCors` en `raw` y `optimized` (vivo) | `0` | `F04-T04-cors.txt` |
| 18 | `grep provider.tf` + evaluación sin proveedor + `validate -var='is_emulator=false'` | `0` | `F04-T04-skip-flags.txt` |
| 19 | Aseveración estática `F04T03-A-04` | `0` | `F04-T04-comment-fix.txt` |
| 20 | `terraform plan -input=false` (idempotencia) | `0` (`No changes`) | `F04-T04-plan-post-apply.txt` |
| 21 | `docker compose down` + `docker ps -a` + `docker network ls` | `0` / `0` / `0` | `F04-T04-emulator-down.txt` |

**24 artefactos** `F04-T04-*.txt`. Los nueve exigidos por `F04-T04-task.md §4` están presentes: `fmt`, `validate`, `plan`, `apply`, `iam`, `cors`, `skip-flags`, `comment-fix`, `emulator-down`.

## 5. Decisiones técnicas

1. **Soporte del emulador (requisito 3).** Se ensayó primero con una sonda real: `PutBucketCors`/`GetBucketCors`/`DeleteBucketCors` funcionan (HTTP 200) y el proveedor de Terraform crea y lee `aws_iam_role`/`aws_iam_role_policy` contra `:9297`. Por tanto **no fue necesario** degradar IAM/CORS a una representación `jsonencode`-solo. Aun así se mantiene esa representación declarativa (`locals` + outputs + `check`) como fuente única de verdad y para inspección sin llamadas a la API, tal como pide CA-04. La sonda **artesanal** con SigV4/service `iam` devolvió `SignatureDoesNotMatch` (matiz documentado, no un fallo del provedor oficial); no se simula un `PASSED` de esa sonda.
2. **CORS en ambos buckets.** El código (solo lectura) confirma `PUT` presignado a `raw` (`presigner.ts:106`), `GET` a `raw` para variantes (`objects.ts:185`) y `GET` a `optimized` para descargas (`presigner.ts:119`). Declarar CORS solo en `raw` habría dejado al navegador bloqueado al descargar; se aplica la misma regla a los dos.
3. **Cabeceros, sin `*`.** La lista de `allowed_headers` es explícita y cubre lo que firma el SDK (`authorization`, `content-type`, `x-amz-*`, `etag`, `content-md5`); se evita el comodín incluso en CORS, aunque CA-04 solo lo prohíbe en IAM.
4. **`skip_*` con interruptor único.** `is_emulator` gobierna también endpoint, CA y credenciales por archivo, de modo que la documentación de AWS real es ejecutable y no contradice el código. Se validó la configuración con `is_emulator=false` (`validate`, sin red), pero **no se ejecutó** `plan`/`apply` en modo real (prohibido).
5. **`/*` en ARNs de objeto.** No es un comodín amplio: está confinado a un bucket nombrado y es indispensable para `PutObject`/`GetObject`/`DeleteObject`. `s3:ListBucket` usa el ARN del bucket sin sufijo. Documentado en `iam.tf` y README.
6. **Sin herencia de `skip_*` a producción.** Cerrado `T04-A-03` y la recomendación `F04T01-A-01` en su parte de flags; la guardia CI de retención sigue siendo competencia de `F04-T05`.
7. **`F04T03-A-04` sin cambio de comportamiento.** El adaptador no escribe `ttl` en `USER#` (`ADAPTER_TTL_OCCURRENCES: 0`); solo se corrigió el texto y se añadió una aseveración documental (`check` + output). No se tocó `TimeToLiveSpecification`.
8. **Estado local.** `terraform.tfstate` sigue siendo el del emulador, excluido de Git. No se usó AWS real ni G-12.

## 6. Problemas registrados (7 campos cada uno)

### P1 — Sonda IAM artesanal con SigV4 devuelve `SignatureDoesNotMatch`

1. **Identificación:** `F04-T04-P1` (sonda `temporary/F04-T04-{probe,iamread}.mjs`, API IAM Query contra `:9297`).
2. **Problema:** Las solicitudes firmadas a mano con `@smithy/signature-v4` y servicio `iam` obtuvieron HTTP 403 `SignatureDoesNotMatch`, mientras que el mismo par de credenciales funciona con `@aws-sdk/client-s3`. No bloqueó la implementación porque el proveedor oficial de Terraform sí crea/lee IAM.
3. **Causa:** **Demostrada** para el comportamiento observado; **hipótesis** para la causa última. El emulador ignora los parámetros en la query (variantes B/C/F → `InvalidAction: missing Action`), acepta la firma cuando el scope dice `sts` (variante G → enrutada al handler STS, `unknown action: GetRole`) y rechaza el scope `iam` de la sonda artesanal. El proveedor Go de Terraform, en cambio, firma correctamente y completa `CreateRole`/`PutRolePolicy`/`GetRole`. No se logró replicar byte a byte su conjunto de cabeceros firmados; se descartó que fueran credenciales, CA, endpoint o codificación de parámetros.
4. **Solución e intentos fallidos:** Se probaron 12 variantes (service `iam`/`sts`/`s3`, body vs query, con/sin `x-amz-content-sha256`, `uriEscapePath`, `host` con/sin puerto, cabeceros `amz-sdk-*`). Todas las de servicio `iam` fallaron en firma. No se encadenaron parches ciegos: se detuvo la sonda y se usó la vía declarada (Terraform) para crear y verificar IAM, conservando la representación `jsonencode` + `check` como respaldo, tal como autoriza CA-04.
5. **Verificación:** `F04-T04-support-probe.txt` (respuestas reales y las 12 variantes), `F04-T04-iam-support.txt` (`Creation complete` de role + inline policy + `data.aws_iam_role Read complete`), `F04-T04-apply.txt` (`aws_iam_role.app` y `aws_iam_role_policy.app` creados), `F04-T04-iam.txt` (política declarativa en outputs).
6. **Pendientes:** Ninguno bloqueante para CA-04. El Tester puede repetir la lectura viva con el proveedor; si necesita un `GetRolePolicy` crudo, debe usar un SDK oficial de IAM (no disponible en este entorno sin tocar manifiestos). **No se invoca G-10.**
7. **Aprendizaje candidato:** ante un emulador con verificación SigV4 propia, usar el proveedor oficial como árbitro de soporte de API y reservar las sondas artesanales para documentar el matiz, sin convertirlas en criterio de aceptación.

### P2 — Recreación de recursos de T01…T03 al reiniciar el emulador (heredado)

1. **Identificación:** `F04-T04-P2` (tfstate heredado, advertencia `AWS resource not found during refresh`).
2. **Problema:** El `plan` pre-IAM/CORS avisó de que buckets, lifecycle, colas y tabla «han sido eliminados» fuera de Terraform y planificó su recreación (`7 to add, 0 to change, 0 to destroy`).
3. **Causa:** **Demostrada.** El emulador mantiene los recursos en memoria; el volumen named solo conserva `ca.pem`, `config` y `emulator_credentials`. Tras el `down` de la sesión anterior de T03, los recursos ya no existían. Es comportamiento esperado y ya documentado en `F04-T01-architect.md`, `F04-T02-developer.md` y `F04-T03-developer.md`.
4. **Solución e intentos fallidos:** No se modificaron `s3.tf`/`sqs.tf`/`dynamodb.tf`, no se hizo `state rm`/`import`. Se ejecutó `apply` en la **misma sesión** (`up → cp → apply → sondas → down`), recreando los 7 recursos con idéntica configuración y después los 4 de IAM/CORS. Sin intentos fallidos.
5. **Verificación:** `F04-T04-plan-pre.txt` (`7 to add…` + warning), `F04-T04-apply-pre.txt` (`7 added, 0 changed, 0 destroyed`), `F04-T04-plan.txt` (`4 to add, 0 destroy`) y `F04-T04-plan-post-apply.txt` (`No changes`).
6. **Pendientes:** Informar al Tester y al Architect de que el primer `plan` de cada sesión mostrará recreación: es esperado. `F04-T05` debe ejecutar `up → apply → sondas → down` en una sola sesión de CI (recomendación `F04T02-A-01`).
7. **Aprendizaje candidato:** tratar el tfstate local como evidencia declarativa, no como inventario persistente; fijar en la plantilla de CI una única sesión de contenedor.

### P3 — `terraform console` sin salida en PowerShell no interactivo

1. **Identificación:** `F04-T04-P3` (captura de evidencia de los flags `skip_*`).
2. **Problema:** Al canalizar expresiones a `terraform -chdir=infra/terraform console` desde PowerShell 5.1 no interactivo, la salida quedó vacía aunque el exit code era 0; la primera versión de `F04-T04-skip-flags.txt` no demostraba los valores condicionales.
3. **Causa:** **Demostrada.** `terraform console` requiere TTY; en este harness el buffer no se captura. No era un error de HCL (`validate` exit 0).
4. **Solución e intentos fallidos:** Se conservó el historial y se sustituyó la técnica por (a) grep estático de `provider.tf` (3 asignaciones a `var.is_emulator`, 0 literales `true`), (b) un mini-módulo **sin proveedor** en `temporary/F04-T04-skip-eval/` cuyos outputs evalúan las mismas expresiones con `is_emulator=true` y `false` mediante `plan`/`show -json`, y (c) `validate -var='is_emulator=false'` sobre la configuración real, sin contactar AWS. Se corrigió además el paso de argumentos (`-out 'archivo'` en lugar de `-out=archivo`) que causaba `Too many command line arguments`.
5. **Verificación:** `F04-T04-skip-flags.txt`: `skip_*_EQUAL_VAR_IS_EMULATOR: 3`, `skip_*_EQUAL_LITERAL_TRUE: 0`, `true`→flags `true`/endpoint `:9297`, `false`→flags `false`/endpoint `null`/credenciales `[]`, `Success! The configuration is valid.` con `is_emulator=false`.
6. **Pendientes:** Ninguno. Evidencia regenerada; no se borró la historia del problema. **No se invoca G-10.**
7. **Aprendizaje candidato:** en harness Windows no interactivo, preferir `plan` + `show -json` de un mini-módulo sin proveedor sobre `terraform console` para evaluar expresiones HCL.

### P4 — Retirada del probe IAM (2 recursos efímeros destruidos)

1. **Identificación:** `F04-T04-P4` (higiene de `infra/terraform/_probe_iam.tf`).
2. **Problema:** Para detectar soporte IAM se crearon `aws_iam_role.probe` y `aws_iam_role_policy.probe`; al eliminar el archivo, el plan siguiente mostró `2 to destroy`. Era destruction en el histórico de evidencia, aunque no afectara a buckets/colas/tabla.
3. **Causa:** **Demostrada.** Son recursos temporales de detección, no de producto; Terraform los retira al desaparecer su declaración.
4. **Solución e intentos fallidos:** Se retiró el archivo y se aplicó la destrucción de **solo** esos 2 recursos antes de escribir el `iam.tf` definitivo, de modo que el plan final quedara `0 to destroy`. No se usó `state rm` para ocultarlos.
5. **Verificación:** `F04-T04-iam-support-plan.txt` / `-apply.txt` (contenido actual): `0 to add, 0 to change, 2 to destroy` → `0 added, 0 changed, 2 destroyed`, ambos exit 0. `F04-T04-iam-support.txt` conserva la salida original de creación. `F04-T04-plan.txt` final: `4 to add, 0 to change, 0 to destroy`.
6. **Pendientes:** Ninguno; se informa al Tester para que no interprete esos 2 destroys como regresión.
7. **Aprendizaje candidato:** aislar los probes de soporte en un archivo HCL propio y retirarlos con `apply` explícito antes de la evidencia final, dejando rastro documental de creación y destrucción.

## 7. Estado final y entrega

- **Implementación:** terminada (`DONE_WITH_CONCERNS`). Concern único no resuelto en este rol: P1 (matiz de la sonda SigV4 artesanal, documentado y sin efecto en CA-04 porque el proveedor oficial verifica IAM en vivo); P2/P3/P4 quedan explicados y con evidencia. **Sin `PASSED`, sin cierre de tarea, sin actualización de `STATE.md` ni `docs/sdd/tasks.md`.**
- **Emulador:** apagado (`docker compose down`, exit 0); `docker ps -a` y `docker network ls --filter name=mediashrink-cloud_default` sin entradas (`CONTAINERS_REMAINING: 0`, `NETWORK_REMAINING: 0`). G-7 cumplido.
- **Evidencias:** 24 archivos `F04-T04-*` en `reports/implementation/F04/evidence/`, con salidas y exit codes reales. Los nueve exigidos están presentes. Grep de secretos/rutas Windows absolutas: 0 coincidencias en HCL y evidencias.
- **Siguiente paso (Architect):** derivar a Tester independiente para `F04-T04-tester.md` y a Auditor para `reports/audits/F04/F04-T04-auditor.md` (riesgo 3: IAM, CORS, flags y secretos); solo después corresponde `F04-T04-architect.md`. El Tester debe repetir `fmt`/`validate`/`apply` con evidencia propia y comprobar `GetBucketCors` + el rol/política en una sola sesión `up → apply → sondas → down`.
