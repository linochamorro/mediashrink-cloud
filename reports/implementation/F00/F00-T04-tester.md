# Tester — `F00-T04` (Bootstrap Terraform contra el emulador local)

| Campo | Valor |
|---|---|
| **Tarea / fase / paquete** | `F00-T04` · Fase 0 · `docs/sdd/packages/P-00-foundation-and-emulator.md` |
| **Criterio asignado** | `CA-04` |
| **Rol** | Tester independiente (ejecución propia; riesgo 2) |
| **Versión / Loop** | `v1 — Loop 1/3` |
| **Fecha** | `2026-11-17` |
| **Método** | Comandos declarados + inspección estática + verificación en vivo (sin TDD de producto, según `task.md` §4) |
| **Veredicto global** | **`PASSED`** |

## 1. Fuentes leídas (obligatorias)

`.agents/roles/tester.md`, `AGENTS.md`, `STATE.md`, `docs/sdd/packages/P-00-foundation-and-emulator.md` (§5 `CA-04`), `docs/decisions/ADR-001-stack-and-aws-emulator.md` (Decisión 4), `reports/implementation/F00/F00-T04-task.md` (incl. §5 nota de reanudación), `reports/implementation/F00/F00-T04-developer.md`, `infra/terraform/**`, `.env.example`, `docker-compose.yml`, `docs/runbooks/development-workflow.md` y las 5 evidencias del Developer (`fmt`, `init`, `validate`, `plan`, `emulator`).

**Independencia:** no se reutilizó ninguna salida del Developer como evidencia propia. Todo lo que se consigna abajo fue reejecutado en esta sesión con los binarios indicados en el encargo (rutas redactadas como `<TF_BIN>` / `<DOCKER_BIN>`).

## 2. Ejecución propia

| # | Comando (rutas redactadas) | Exit code | Evidencia propia |
|---|---|---|---|
| 1 | `<TF_BIN> fmt -check -no-color` (en `infra/terraform/`) | `0` | `evidence/F00-T04-tester-fmt.txt` |
| 2 | `<TF_BIN> init -input=false -no-color` | `0` | `evidence/F00-T04-tester-init.txt` |
| 3 | `<TF_BIN> validate -no-color` | `0` | `evidence/F00-T04-tester-validate.txt` |
| 4 | `<DOCKER_BIN> compose up -d` + espera `healthy` (G-7: 2g/2.0) | `0` / `HEALTHY=True` | `evidence/F00-T04-tester-plan.txt` |
| 5 | `<DOCKER_BIN> inspect` (límites) + `docker cp` de `ca.pem`/`config`/`emulator_credentials` + `curl.exe --cacert … /__admin/health` → `ok` | `0` | `evidence/F00-T04-tester-plan.txt` |
| 6 | `<TF_BIN> plan -input=false -no-color` (sin `-out`, sin `apply`) | `0` | `evidence/F00-T04-tester-plan.txt` |
| 7 | Inspección estática + coherencia A-03 | — | `evidence/F00-T04-tester-config.txt` |
| 8 | Comparación de ámbito (mtimes + contenido) | — | `evidence/F00-T04-tester-scope.txt` |
| 9 | `<DOCKER_BIN> compose down` + `docker ps -a` + `docker network ls` | `0` / limpio | `evidence/F00-T04-tester-down.txt` |

**Resultado del `plan` (propio):** `data.aws_caller_identity.emulator: Read complete after 2s [id=000000000000]`; único cambio propuesto son 3 outputs (`authenticated_account_id="000000000000"`, `emulator_endpoint="https://127.0.0.1:9297"`, `provider_region="us-east-1"`); **0 cambios de infraestructura**. No se generó `*.tfstate*` (recuento final: 0). Nunca se ejecutó `terraform apply`.

## 3. Dictamen por criterio

| Requisito / fuente | Comportamiento observable | Evidencia propia | Límite | Estado |
|---|---|---|---|---|
| `fmt -check` sin diff — `task.md` §4 | Exit `0`, sin salida de reformateo | `tester-fmt.txt` | Solo comprueba formato, no semántica | **PASSED** |
| `terraform init` con provider y backend local — `CA-04`, `versions.tf` | `Successfully configured the backend "local"!` (init #1 del Developer) y, en mi reejecución, `Initializing the backend...` + `Terraform has been successfully initialized!`, reutilizando `hashicorp/aws v5.100.0` en caché; `backend "local" { path = "terraform.tfstate" }` | `tester-init.txt`, `tester-config.txt` §6 | El proveedor ya estaba cacheado; se verifica reutilización, no una descarga nueva. Sin estado remoto | **PASSED** |
| `terraform validate` — `CA-04` | `Success! The configuration is valid.`, exit `0` | `tester-validate.txt` | Valida esquema, no conectividad (esta se cubre con `plan`) | **PASSED** |
| `terraform plan` sin AWS real — `CA-04`, `task.md` §5 | Exit `0`; sonda STS en vivo devuelve `id=000000000000`; solo outputs; mensaje `without changing any real infrastructure` | `tester-plan.txt` | Plan sin `-out`: no persiste estado; no cubre creación real de S3/SQS/DynamoDB (reservada a F04) | **PASSED** |
| Provider apunta al emulador `:9297` — `CA-04`, `provider.tf`, `variables.tf` | `default = "https://127.0.0.1:9297"`; bloque `endpoints { s3, sqs, dynamodb, sts } = var.aws_endpoint_url`; `emulator_endpoint` del plan = `:9297` | `tester-config.txt` §1–§2, `tester-plan.txt` | No se verifican los cuatro servicios por separado (fuera del bootstrap) | **PASSED** |
| TLS con CA del emulador — `runbook` §1.3 | `custom_ca_bundle = var.ca_bundle_path` (`../../.local/aws-emulator/ca.pem`); exportación vía `docker cp` (566 bytes) + healthcheck `BODY=ok` con `--cacert`; `plan` completa la llamada STS | `tester-config.txt` §3, `tester-plan.txt` | El CA se regenera en cada arranque; la exportación debe repetirse (nota N-01) | **PASSED** |
| Credenciales por archivo, sin secretos fijos — `G-3`, `A-03`, `provider.tf` | `shared_credentials_files` / `shared_config_files` desde variables; 0 apariciones de `access_key`/`secret_key` como valor; entorno sin `AWS_ACCESS_KEY_ID`/`SECRET`/`PROFILE`; 0 patrones de secretos y 0 rutas absolutas de unidad Windows en `infra/terraform/` | `tester-config.txt` §4, §8; `tester-plan.txt` | Archivos de credenciales efímeras del emulador no se imprimen; A-05 (exclusión de `.local/` en Git) sigue abierto y se cierra en T05 | **PASSED** |
| `skip_*` justificados — `provider.tf` | Los tres (`skip_credentials_validation`, `skip_requesting_account_id`, `skip_metadata_api_check`) a `true`, con comentario «el emulador no ofrece IMDS ni validación…» y `AWS_EC2_METADATA_DISABLED=true` en el entorno | `tester-config.txt` §5, `tester-plan.txt` | Defensa en profundidad: no sustituyen al CA ni a las credenciales por archivo | **PASSED** |
| Coherencia A-03: 0 usos activos de `:9324` — `task.md` §5, ADR/runbook | 6 ocurrencias textuales, **todas** de prohibición/documentación o de la validación que **rechaza** el valor (`!can(regex(":9324", …))`); **0 usos activos como valor** de endpoint/QueueUrl. Sin recursos SQS en este bootstrap y sin `:9324` en la QueueUrl de `.env.example` | `tester-config.txt` §7 | El criterio se interpreta como «0 usos de configuración»; las menciones en comentarios son salvaguardas, no configuración | **PASSED** |
| Ámbito de escritura del Developer — `task.md` §3 | `.env.example` (16:03), `docker-compose.yml` (16:12), `STATE.md` (16:24:10), `tasks.md` (16:23:31), `frontend/`, `backend/`, `.github/` (ausente), `.gitignore` (ausente) y reportes ajenos: todos **anteriores** a la ventana T04 (16:25:49–16:30:49); solo se escribieron `infra/terraform/**`, `evidence/F00-T04-*` y `F00-T04-developer.md` | `tester-scope.txt` | `mtime` no es prueba criptográfica (repo sin Git); se complementa con lectura de contenido de `.env.example` y `docker-compose.yml` | **PASSED** |
| Apagado del emulador sin residuos — `G-7`, `task.md` §5 | `docker compose down` exit `0`; `docker ps -a` sin contenedores (`CONTENEDORES_RESIDUALES=0`); `docker network ls` sin `mediashrink-cloud_default` (`RED_COMPOSE_RESIDUAL=NO`); `LIMPIEZA_OK=TRUE` | `tester-down.txt` + control `docker ps -a` final | El volumen named `aws-emulator-data` persiste por diseño del runbook (no contenedor ni red) | **PASSED** |
| Sin secretos ni rutas Windows absolutas en salidas — `G-3` | Auditoría de redacción sobre los 7 ficheros `tester-*`: 0 rutas absolutas de unidad Windows, 0 secretos (`<PROJECT_ROOT>`, `<TF_BIN>`, `<DOCKER_BIN>` en su lugar) | `tester-config.txt` §8, artefactos `tester-*` | Las menciones a `:9324` en `config.txt`/`scope.txt` son documentación de la prohibición | **PASSED** |

## 4. Hallazgos

**Ninguno.** No se abre ningún loop: todos los criterios de `CA-04` están satisfechos con evidencia propia y no hay incumplimientos que documentar con los 7 campos obligatorios. Los problemas `P1`/`P2`/`P3` del Developer quedan fuera de este dictamen: son incidencias de ejecución ya resueltas por él y confirmadas por mis reejecuciones (`fmt`/`init`/`validate`/`plan` exit `0`).

## 5. Veredicto global

**`PASSED`** — `CA-04` queda verificado: `terraform init`, `validate` y `plan` pasan sin acceso a AWS real, contra el emulador `:9297`, con backend local, credenciales por archivo y CA propio, sin secretos, sin `:9324` activo y sin contenedor residual. El contenedor quedó **APAGADO** y no se ejecutó `terraform apply`.

**Fuera de ámbito (no bloqueante para esta tarea):** `A-05` sigue abierto (no existe `.gitignore`; `.local/` y `.terraform/` deben excluirse en `F00-T05`). La auditoría de riesgo 2 (`F00-T04-auditor.md`) es competencia del Auditor; este Tester no la emite ni la modifica.

**Índice de evidencia propia:** `evidence/F00-T04-tester-{fmt,init,validate,plan,config,scope,down}.txt`.
