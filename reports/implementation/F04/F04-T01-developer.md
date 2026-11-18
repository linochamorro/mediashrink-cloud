# `F04-T01` — Reporte de Developer (entrega, sin dictamen)

| Campo | Valor |
|---|---|
| **Tarea / Fase** | `F04-T01` · Fase 4 — `docs/sdd/packages/P-04-terraform-and-ci.md` |
| **Rol / verificadores** | Developer · Tester + Auditor + Architect (pendientes) |
| **Versión / Loop** | `v1 — Loop 1/3` |
| **Harness** | OpenCode |
| **Fecha (UTC)** | `2026-11-18` |
| **Estado de entrega** | **`DONE`** — implementación completa y verificada; **no se emite `PASSED` ni se cierra la tarea** |
| **Ámbito tocado** | `infra/terraform/**`, `reports/implementation/F04/evidence/F04-T01-*`, este reporte; scripts efímeros en `temporary/` (ignorados por Git) |

## 1. Fuentes consultadas (lectura obligatoria)

- `AGENTS.md`, `STATE.md`, `.agents/roles/developer.md`.
- `docs/sdd/packages/P-04-terraform-and-ci.md` (CA-01, alcance y DoD) y `docs/sdd/constitution.md` **PR-04** (emulación sin coste) y **PR-08** (secretos fuera del repo).
- `docs/architecture/03-data-model-and-storage-contract.md` §3 (TTL `2.592.000` s = 30 días, alineación `T02-A-01`).
- `reports/implementation/F04/F04-T01-task.md` (**fuente de verdad**), `F04-coordination.md` y contratos `F04-T02`…`F04-T04` (para no invadir sus recursos).
- Bootstrap F00 en `infra/terraform/{versions,provider,variables,data,outputs}.tf`, `README.md`, `.env.example` (`RETENTION_DAYS=30`, nombres de bucket), `docker-compose.yml` y `docs/runbooks/development-workflow.md` §1.1–1.4.

## 2. Criterio `CA-01` — cobertura

| Requisito de `CA-01` | Evidencia real |
|---|---|
| Buckets `mediashrink-raw-local` y `mediashrink-optimized-local` | `F04-T01-buckets.txt`: `ListBuckets` → `COUNT: 2`, ambos `PRESENT: true` |
| Expiración a `RETENTION_DAYS = 30` alineada con TTL | `F04-T01-lifecycle.txt`: `GetBucketLifecycleConfiguration` en ambos → `Status: Enabled`, `Expiration.Days: 30` |
| Sin notificaciones/eventos (sin bucle S3→SQS→S3) | `F04-T01-no-event-loop.txt`: chequeo estático sin declaraciones de evento + `GetBucketNotificationConfiguration` con configuración vacía en ambos buckets |
| Sin AWS real; `:9297`; credenciales por archivo; CA propio | `F04-T01-{compose-config,up,cp,healthcheck}.txt` y `F04-T01-{plan,apply}.txt` (sonda STS `000000000000`) |
| Backend local y provider sin cambios | `versions.tf`/`provider.tf` intactos; `skip_*` sin tocar (competencia de `F04-T04`) |

## 3. Cambios implementados

- **`infra/terraform/s3.tf` (nuevo):** variables `retention_days` (default `30`, validada como entero positivo), `s3_bucket_raw` y `s3_bucket_optimized`; recursos `aws_s3_bucket.raw` / `.optimized`; recursos `aws_s3_bucket_lifecycle_configuration.raw` / `.optimized` con una única regla `expire-after-retention-days`, `status = "Enabled"`, `filter {}` (aplica a todos los objetos) y `expiration { days = var.retention_days }`; outputs de nombres y días de expiración. **No se declara** `aws_s3_bucket_notification` ni bloque `notification`/`queue_arn`/`lambda_function_arn`/`topic_arn`.
- **`infra/terraform/README.md`:** documenta el nuevo archivo, las tres variables y la ausencia deliberada de notificaciones.
- **`temporary/F04-T01-{lib,up,tf,probe,down}.ps1` y `F04-T01-probe.mjs`:** helpers efímeros para capturar comandos, salidas y exit codes; están bajo `temporary/` (ignorado) y **ningún artefacto de producto depende de ellos**.

Recursos **no** creados (pertenecen a otras tareas, confines respetados): SQS+DLQ (`F04-T02`), DynamoDB (`F04-T03`), IAM/CORS/`skip_*` (`F04-T04`), CI (`F04-T05`). Tampoco se tocó `frontend/`, `backend/`, manifiestos raíz, `STATE.md`, `docs/sdd/tasks.md` ni Git.

## 4. Comandos ejecutados y exit codes reales

Ejecutados desde `<PROJECT_ROOT>` con `<TF_BIN>` (Terraform 1.17.2) y `<DOCKER_CLI_DIR>\docker.exe` (Compose v5.7.0), rutas resueltas en tiempo de ejecución y **no versionadas**.

| # | Comando | Exit | Evidencia |
|---|---|---|---|
| 1 | `docker compose config` | `0` | `F04-T01-compose-config.txt` |
| 2 | `docker compose up -d` + espera `healthy` + `docker inspect` | `0` / `healthy=True` | `F04-T01-up.txt` |
| 3 | `docker cp` de `ca.pem`, `config`, `emulator_credentials` | `0` | `F04-T01-cp.txt` |
| 4 | `curl.exe --cacert ./.local/aws-emulator/ca.pem https://127.0.0.1:9297/__admin/health` | `0` (`ok`) | `F04-T01-healthcheck.txt` |
| 5 | `terraform -chdir=infra/terraform fmt -check` | `0` | `F04-T01-fmt.txt` |
| 6 | `terraform -chdir=infra/terraform init -input=false` | `0` | `F04-T01-init.txt` |
| 7 | `terraform -chdir=infra/terraform validate` | `0` | `F04-T01-validate.txt` |
| 8 | `terraform -chdir=infra/terraform plan -input=false` | `0` (`4 to add`) | `F04-T01-plan.txt` |
| 9 | `terraform -chdir=infra/terraform apply -input=false -auto-approve` (creación) | `0` (`4 added`) | `F04-T01-apply-initial.txt` |
| 10 | `fmt`/`init`/`validate`/`plan`/`apply` tras refactor `filter {}` | `0`/`0`/`0`/`0`/`0` (`0 added, 2 changed`) | `F04-T01-{fmt,init,validate,plan,apply}.txt` |
| 11 | SDK JS v3 `ListBuckets` | `0` | `F04-T01-buckets.txt` |
| 12 | SDK JS v3 `GetBucketLifecycleConfiguration` (×2) | `0` | `F04-T01-lifecycle.txt` |
| 13 | Chequeo estático + SDK `GetBucketNotificationConfiguration` (×2) | `0` | `F04-T01-no-event-loop.txt` |
| 14 | `docker compose down` + `docker ps -a` + `docker network ls` | `0` / `0` / `0` | `F04-T01-emulator-down.txt` |

Límites G-7 confirmados en `F04-T01-up.txt` (`memory=2147483648`, `nanoCpus=2000000000`, `user=1000:1000`). Apagado: `CONTAINERS_REMAINING: 0`, `NETWORK_REMAINING: 0`.

## 5. Recursos creados (en el emulador, sesión verificada)

| Recurso Terraform | Identificador | Estado |
|---|---|---|
| `aws_s3_bucket.raw` | `mediashrink-raw-local` | creado (`apply inicial`) |
| `aws_s3_bucket.optimized` | `mediashrink-optimized-local` | creado (`apply inicial`) |
| `aws_s3_bucket_lifecycle_configuration.raw` | `mediashrink-raw-local` | creado y luego actualizado con `filter {}` |
| `aws_s3_bucket_lifecycle_configuration.optimized` | `mediashrink-optimized-local` | creado y luego actualizado con `filter {}` |

Regla vigente en ambos: `{"Status":"Enabled","Expiration":{"Days":30},"ID":"expire-after-retention-days","Filter":{"Prefix":""}}`.

## 6. Decisiones técnicas y comportamiento de la API del emulador

1. **`PutBucketLifecycleConfiguration` / `GetBucketLifecycleConfiguration`: soportadas.** No hubo que documentar limitación ni proponer alternativa declarativa: `apply` devolvió `4 added` y las sondas devolvieron `Days: 30` en ambos buckets. El emulador tardó ~55 s en aplicar cada configuración de ciclo de vida (espera del provider, no error).
2. **`GetBucketNotificationConfiguration`: soportada.** Devuelve HTTP 200 con configuración vacía (solo metadatos de la petición, sin `QueueConfigurations`/`LambdaConfigurations`/`TopicConfigurations`). Combinada con el chequeo estático, acredita que no existe configuración de eventos que genere el bucle S3→SQS→S3.
3. **`filter {}`:** el provider `hashicorp/aws ~> 5.0` avisaba (`Invalid Attribute Combination`) de que en futuras versiones sería obligatorio `filter` o `prefix`. Se añadió `filter {}` (filtro vacío = todos los objetos) y se repitieron los cinco comandos: las advertencias desaparecieron y no hay cambio semántico (misma regla de expiración).
4. **Aislamiento y secretos:** único transporte `https://127.0.0.1:9297` (nunca `:9324`), credenciales leídas de los archivos generados por `docker cp`, CA propio vía `custom_ca_bundle`, `skip_*` sin modificar. Ningún valor de credencial aparece en evidencias ni en este reporte; no se usaron rutas Windows absolutas en artefactos versionados (se emplean `<PROJECT_ROOT>` / `<TF_BIN>`).
5. **Estado local:** `infra/terraform/terraform.tfstate` queda con los 4 recursos y está excluido de Git; es estado de desarrollo contra emulador, no contra AWS real.

## 7. Problemas registrados (7 campos cada uno)

### P1 — Advertencia del provider sobre `filter`/`prefix` en la regla de ciclo de vida

1. **Identificación:** `F04-T01-P1` (HCL `s3.tf`, reglas de ciclo de vida).
2. **Problema:** `plan`/`apply` emitían `Warning: Invalid Attribute Combination` — «No attribute specified when one (and only one) of [rule[0].filter,rule[0].prefix] is required. This will be an error in a future version of the provider» — en ambas reglas (6 avisos en total).
3. **Causa:** **Demostrada.** El provider AWS v5 exige declarar `filter` o `prefix` incluso para una regla que aplica a todo el bucket; la primera versión de `s3.tf` no declaraba ninguno.
4. **Solución e intentos fallidos:** No hubo intentos fallidos de apply: la creación funcionó (`4 added`). Se añadió `filter {}` a las dos reglas (filtro vacío = todos los objetos), se conservó `F04-T01-apply-initial.txt` como historial y se repitieron `fmt`/`init`/`validate`/`plan`/`apply`.
5. **Verificación:** `F04-T01-{fmt,init,validate,plan,apply}.txt` finales con exit `0` y sin la advertencia; `F04-T01-apply.txt` → `0 added, 2 changed, 0 destroyed`; `F04-T01-lifecycle.txt` → misma regla, ahora con `Filter: {"Prefix":""}`.
6. **Pendientes:** Ninguno para esta tarea; el Tester puede verificar con la evidencia final.
7. **Aprendizaje candidato:** en futuras reglas de ciclo de vida declarar siempre `filter {}` (o `prefix`) para evitar la advertencia de compatibilidad del provider v5; documentarlo en el README de IaC.

### P2 — Fallo de dot-source por codificación en Windows PowerShell 5.1

1. **Identificación:** `F04-T01-P2` (scripts efímeros de evidencia en `temporary/`, no producto).
2. **Problema:** Los scripts auxiliares no cargaban: `$DK`/`$EV` quedaban nulos y `Write-F04Evidence` no existía, de modo que no se generaba evidencia y Docker no arrancaba en el primer intento.
3. **Causa:** **Demostrada.** `powershell.exe` (5.1) leyó los `.ps1` escritos en UTF-8 sin BOM como ANSI; el carácter `—` dentro de un literal entre comillas se interpretó como comilla tipográfica y provocó `ParserError`, por lo que el dot-source del helper se descartó por completo. Se aisló con un script mínimo que imprimía el error de parseo.
4. **Solución e intentos fallidos:** Intento fallido 1: cambiar `$script:` por variables normales (no bastó). Intento fallido 2: dot-source con ruta relativa (seguía sin cargar). Solución: reescribir todos los `.ps1` en **ASCII puro** (sin acentos ni rayas tipográficas); desde entonces los cinco pasos de arranque/evidencia devolvieron exit `0`.
5. **Verificación:** `F04-T01-{compose-config,up,cp,healthcheck}.txt` y el resto de evidencias generadas con exit codes reales; ninguna contiene rutas Windows absolutas ni secretos.
6. **Pendientes:** Ninguno. Los scripts quedan en `temporary/` (ignorado) y no son dependencia de producto.
7. **Aprendizaje candidato:** en este harness, todo `.ps1` efímero debe ser ASCII puro o escribirse con BOM UTF-8; verificar el dot-source con un script mínimo antes de encadenar comandos costosos.

### P3 — Ubicación real del SDK de AWS (distinta de la indicada en el enunciado)

1. **Identificación:** `F04-T01-P3` (entorno de verificación).
2. **Problema:** El encargo indicaba que el AWS SDK estaba en `backend/node_modules`; en el estado actual del repositorio esa carpeta no existe y `@aws-sdk/client-s3` está en `node_modules` de la raíz (hoisting de workspaces).
3. **Causa:** **Demostrada.** `Get-ChildItem backend/node_modules` → «folder does not exist»; `node_modules/@aws-sdk/client-*` sí está presente y `node temporary/F04-T01-probe.mjs …` lo resolvió sin instalar nada.
4. **Solución e intentos fallidos:** No se instalaron dependencias ni se modificó manifiesto raíz (prohibido): se ejecutaron las sondas con Node desde `<PROJECT_ROOT>`, donde el paquete ya está disponible.
5. **Verificación:** `F04-T01-{buckets,lifecycle,no-event-loop}.txt` con exit `0` y respuestas HTTP 200 del emulador.
6. **Pendientes:** Avisar al Tester de que las sondas se ejecutan desde la raíz, no desde `backend/`.
7. **Aprendizaje candidato:** en este monorepo las dependencias se resuelven desde la raíz; comprobar la ubicación real del SDK antes de dar por buena una ruta documentada en un encargo.

## 8. Estado final y entrega

- **Implementación:** terminada (`DONE`). Sin `PASSED`, sin cierre de tarea, sin actualización de `STATE.md` ni `docs/sdd/tasks.md`.
- **Emulador:** apagado (`docker compose down`, exit `0`); `docker ps -a` vacío y red `mediashrink-cloud_default` eliminada (G-7 cumplido).
- **Evidencias:** 12 archivos `F04-T01-*` en `reports/implementation/F04/evidence/` (incluye `apply-initial`, `compose-config`, `up`, `cp`, `healthcheck` como complementarias) con salidas y exit codes reales.
- **Siguiente paso (Architect):** derivar a Tester independiente para que emita `F04-T01-tester.md` y a Auditor para `reports/audits/F04/F04-T01-auditor.md`; solo después corresponde el cierre `F04-T01-architect.md`.
