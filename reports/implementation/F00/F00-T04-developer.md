# Developer — `F00-T04` (Bootstrap Terraform contra el emulador local)

| Campo | Valor |
|---|---|
| **Tarea / fase / paquete** | `F00-T04` · Fase 0 · `docs/sdd/packages/P-00-foundation-and-emulator.md` |
| **Versión / Loop** | `v1 — Loop 1/3` |
| **Riesgo** | `2 (Relevante)` |
| **Rol** | Developer (implementación no visual / IaC) |
| **Fecha** | `2026-11-17` |
| **Método** | Comandos declarados + criterio documental (IaC). Sin TDD de producto (según `task.md` §4). |
| **Estado final** | **`DONE`** |

## 1. Fuentes leídas (obligatorias y de contexto)

- `AGENTS.md`, `STATE.md`, `.agents/roles/developer.md`.
- `docs/sdd/packages/P-00-foundation-and-emulator.md` (§3 ámbito, §5 `CA-04`, §6 DoD).
- `docs/sdd/{constitution,spec,plan}.md` (PR-04, NFR-01, plan §5–§6).
- `docs/decisions/ADR-001-stack-and-aws-emulator.md` (Decisión 4).
- `reports/implementation/F00/F00-T04-task.md` (contrato + §5 nota de reanudación).
- `reports/implementation/F00/F00-T03-architect.md` (T03 `PASSED`; contenedor apagado).
- `reports/audits/F00/F00-T03-auditor.md` (A-03 cerrado; A-05 abierto → T05; recomendación al Tester de T04: verificar que Terraform no herede `:9324`).
- `.env.example`, `docker-compose.yml`, `docs/runbooks/development-workflow.md` (§§1.1–1.4).

## 2. Criterio de aceptación atendido

**`CA-04`** — `terraform init`, `validate` y `plan` pasan **sin acceso a AWS real**; el provider apunta al emulador local; backend local; sin secretos en archivos ni salidas.

Cómo se satisface:

| Requisito del encargo | Implementación | Verificación |
|---|---|---|
| Provider → `AWS_ENDPOINT_URL=https://127.0.0.1:9297` | Variable `aws_endpoint_url` con default `https://127.0.0.1:9297`, inyectada en el bloque `endpoints { s3, sqs, dynamodb, sts }` de `provider.tf` | `plan` refresca la sonda STS contra `:9297` (`id=000000000000`) |
| Cero herencia de `:9324` (A-03) | Ninguna referencia activa a `:9324`; validación explícita en `variables.tf` que rechaza el valor; comentarios documentan que no existe puerto SQS separado | Búsqueda: 0 usos como valor (solo comentarios de prohibición) |
| `skip_credentials_validation` / `skip_requesting_account_id` / `skip_metadata_api_check` | Los tres a `true` en `provider.tf`, más `AWS_EC2_METADATA_DISABLED=true` en el entorno del comando | `validate` + `plan` exit 0 |
| CA bundle / SSL con `ca.pem` generado | `custom_ca_bundle = var.ca_bundle_path` (`../../.local/aws-emulator/ca.pem`, ruta relativa) + `AWS_CA_BUNDLE` en el entorno | Healthcheck HTTPS `ok` con `--cacert`; `plan` válida TLS |
| Región `us-east-1`, account `000000000000` | Variables `aws_region` y `aws_account_id` (marcadores no secretos) | Outputs del plan: `provider_region="us-east-1"`, `authenticated_account_id="000000000000"` |
| Sin credenciales fijas | `shared_credentials_files` / `shared_config_files` leen los archivos generados por el emulador; se eliminan `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_PROFILE`, `AWS_SESSION_TOKEN` del entorno | Sin `access_key`/`secret_key` en `.tf`; evidencia sin secretos impresos |
| Backend local, sin remoto real | `backend "local" { path = "terraform.tfstate" }` | Salida de `init`: `Successfully configured the backend "local"!` |
| Variables declaradas y documentadas | `variables.tf` + tabla en `infra/terraform/README.md` | `validate` exit 0 |
| Sin secretos en archivos ni salidas | Rutas relativas, sin valores de credenciales; evidencias redactadas (`<PROJECT_ROOT>`, `<TF_BIN>`, `<DOCKER_BIN>`) | Grep de `D:\` y credenciales en evidencias → 0 coincidencias |
| **Solo bootstrap** (sin S3/SQS/DynamoDB completos) | Solo provider, backend, variables, outputs y **una sonda mínima** `data "aws_caller_identity" "emulator"` | Justificación de la sonda en §3 |

### Justificación del recurso mínimo de verificación

Se incluye **un único data source** (`aws_caller_identity`), no un `resource`. Motivo: sin él, `terraform plan` se limitaría a `No changes` y no ejercitaría el transporte HTTPS, dejando sin probar el extremo "provider apunta al emulador" que exige `CA-04` y la recomendación de `A-05`/auditoría T03. La sonda fuerza una llamada real `STS:GetCallerIdentity` durante `plan`, demostrando en vivo endpoint, credenciales por archivo y CA, **sin crear infraestructura ni implementar buckets, colas ni tabla** (reservados a F04). No se ejecutó `terraform apply` en ningún momento.

## 3. Tabla de comandos y exit codes

Todos ejecutados con rutas absolutas a los binarios (fuera de PATH), anteponiendo `<PROJECT_ROOT>` en los artefactos. Timeout 180 s por comando Terraform; ciclo de vida del emulador bajo G-7 (`2g` / `2.0`).

| # | Comando (rutas redactadas) | Exit code | Evidencia |
|---|---|---|---|
| 1 | `<TF_BIN> fmt` + `<TF_BIN> fmt -check` | `0` | `F00-T04-fmt.txt` |
| 2 | `<TF_BIN> init -input=false -no-color` | `0` | `F00-T04-init.txt` |
| 3 | `<TF_BIN> validate -no-color` | `0` (tras corrección P2) | `F00-T04-validate.txt` |
| 4 | `<DOCKER_BIN> ps -a` (previo: sin contenedor) | `0` | `F00-T04-emulator.txt` |
| 5 | `<DOCKER_BIN> compose up -d` | `0` | `F00-T04-emulator.txt` |
| 6 | `docker inspect` health poll (`starting → healthy` en ~20 s) | `HEALTHY=True` | `F00-T04-emulator.txt` |
| 7 | `<DOCKER_BIN> inspect` límites: `memory=2147483648 nanoCpus=2000000000 user=1000:1000` | `0` | `F00-T04-emulator.txt` |
| 8 | `docker cp` de `ca.pem`, `config`, `emulator_credentials` (3/3, contenidos no impresos) | `0` | `F00-T04-emulator.txt` |
| 9 | `curl.exe --cacert …/ca.pem https://127.0.0.1:9297/__admin/health` → `ok` | `0` | `F00-T04-emulator.txt` |
| 10 | `<TF_BIN> plan -input=false -no-color` (con entorno AWS del emulador) | `0` | `F00-T04-plan.txt` |
| 11 | `<DOCKER_BIN> compose down` | `0` | `F00-T04-emulator.txt` |
| 12 | `<DOCKER_BIN> ps -a` (posterior: vacío, sin red ni contenedor residual) | `0` | `F00-T04-emulator.txt` |

**Resultado del `plan`:** `data.aws_caller_identity.emulator: Read complete after 2s [id=000000000000]`; solo cambios en outputs (`authenticated_account_id`, `emulator_endpoint`, `provider_region`); **0 cambios de infraestructura**. No se generó `terraform.tfstate` (plan sin `apply`): directorio `infra/terraform/` sin `*.tfstate*`.

**Apagado:** el contenedor se levantó **solo** para el `plan` y se apagó en un bloque `finally`, verificando `docker ps -a` vacío y red `mediashrink-cloud_default` eliminada. Volumen named `aws-emulator-data` persistente, documentado en el runbook (fuera de G-7).

## 4. Archivos creados

Ámbito exclusivo `infra/terraform/**` + evidencias + este reporte:

| Archivo | Descripción |
|---|---|
| `infra/terraform/versions.tf` | `required_version >= 1.5.0`, provider `hashicorp/aws ~> 5.0`, `backend "local"`. |
| `infra/terraform/provider.tf` | Endpoint único, credenciales por archivo, `endpoints { … }`, `custom_ca_bundle`, `skip_*`. |
| `infra/terraform/variables.tf` | 6 variables documentadas + validación anti-`:9324` y de longitud de cuenta. |
| `infra/terraform/data.tf` | Sonda mínima `aws_caller_identity` (no crea recursos). |
| `infra/terraform/outputs.tf` | 3 outputs no sensibles. |
| `infra/terraform/README.md` | Variables, precondición del emulador y comandos (sin rutas Windows absolutas). |
| `infra/terraform/.terraform.lock.hcl` | Generado por `init` (provider v5.100.0). |
| `infra/terraform/.terraform/` | Plugins del provider (generado por `init`; excluir en T05). |
| `reports/implementation/F00/evidence/F00-T04-{fmt,init,validate,plan,emulator}.txt` | 5 evidencias reales con exit codes. |
| `reports/implementation/F00/F00-T04-developer.md` | Este reporte. |

**No tocados:** `.env.example`, `docker-compose.yml`, `frontend/`, `backend/`, `.github/`, `.gitignore`, `STATE.md`, `tasks.md`, reportes ajenos. Sin Git/GitHub (propiedad de T05). Sin `terraform apply`.

## 5. Problemas encontrados (7 campos obligatorios)

### Problema `F00-T04-P1` — `-chdir=<variable>` no expandido por PowerShell

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID `F00-T04-P1` · Tarea `F00-T04` · Fase `P-00` · Loop `1/3` · Fecha `2026-11-17` · Entorno: PowerShell/Windows, Terraform 1.17.2 · Fuentes: primer intento de `fmt`/`init`. |
| **2. Problema** | **Síntoma:** `& $tf -chdir=$tfDir fmt` devolvió `Error handling -chdir option: chdir $tfDir: The system cannot find the file specified.` (exit 1 en `fmt` e `init`). **Esperado:** Terraform resolvería la variable `$tfDir`. **Observado:** el literal `$tfDir` llegó como argumento. **Impacto:** bloqueó temporalmente `fmt`/`init`; sin efecto en el producto. **Reproducción:** invocar `-chdir=$var` en este shell. |
| **3. Causa** | **DEMOSTRADA.** El analizador de argumentos nativos de PowerShell no expande la variable cuando se usa la forma `-chdir=$var` pegada al valor en este contexto. **Alternativa descartada:** cambiar la ruta del binario o la configuración Terraform (no tenía relación). |
| **4. Solución e intentos fallidos** | **Aplicada:** sustituir `-chdir` por `Push-Location $tfDir` / `Pop-Location` alrededor de cada comando. **Intentos fallidos:** 1 (el original con `-chdir=$tfDir`). **Motivo:** el directorio de trabajo pasa a ser `infra/terraform/`, además de resolver correctamente las rutas relativas `../../.local/...` del provider. |
| **5. Verificación** | Verificador: el propio Developer en el mismo loop. Procedimiento: reejecutar `fmt -check` e `init`. Resultado: `FMT_CODE=0`, `INIT_CODE=0`, evidencias `F00-T04-fmt.txt` y `F00-T04-init.txt` (`Successfully configured the backend "local"!`, provider v5.100.0). Regresión: `validate` y `plan` posteriores también exit 0. Límites: comportamiento específico de este shell, no del código Terraform. |
| **6. Pendientes** | Riesgo residual: **ninguno**. Cobertura ausente: ninguna. Responsable: Developer (resuelto). No requiere `G-10`. |
| **7. Aprendizaje** | **Prevención propuesta:** en PowerShell, preferir `Push-Location`/`Pop-Location` frente a `-chdir=$variable` cuando la ruta se construye en el script; verificar el exit code del primer comando antes de encadenar. **Ámbito candidato:** `SOLO_LOCAL`. **Estado:** `RESUELTO`. |

### Problema `F00-T04-P2` — `endpoints` rechazado como argumento por el provider AWS v5

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID `F00-T04-P2` · Tarea `F00-T04` · Fase `P-00` · Loop `1/3` · Fecha `2026-11-17` · Entorno: provider `hashicorp/aws v5.100.0` (resuelto por `init`) · Fuentes: primera ejecución de `validate`. |
| **2. Problema** | **Síntoma:** `terraform validate` devolvió `Error: Unsupported argument — on provider.tf line 16: An argument named "endpoints" is not expected here. Did you mean to define a block of type "endpoints"?` (exit 1). **Esperado:** los endpoints del emulador se declararan y validaran. **Observado:** el esquema del provider v5 define `endpoints` como **bloque**, no como argumento (`=`). **Impacto:** bloqueó `validate` y, por dependencia, el `plan`; sin riesgo de seguridad (no se contactó a AWS). **Reproducción:** `provider "aws" { endpoints = { … } }` con v5.100.0. |
| **3. Causa** | **DEMOSTRADA** por el mensaje literal del validador de Terraform. **Hipótesis inicial** (descartada): versión de Terraform insuficiente o variable no soportada; `init` había seleccionado v5.100.0 y el resto de argumentos (`custom_ca_bundle`, `skip_*`) fueron aceptados sin error. **Alternativas descartadas:** cambiar de versión del provider (innecesario; el bloque `endpoints` existe en v5) y usar variables de entorno `AWS_ENDPOINT_URL_*` en lugar de la configuración explícita (se conservan además en el entorno del comando, pero el bloque hace explícito el propósito y la validación anti-`:9324`). |
| **4. Solución e intentos fallidos** | **Aplicada:** convertir `endpoints = { … }` en bloque `endpoints { s3 = …; sqs = …; dynamodb = …; sts = … }` en `provider.tf`, seguido de `fmt`. **Intentos fallidos:** 1 (forma argumento). **Motivo:** alinearse con el esquema real del provider sin rebajar el criterio `CA-04`. |
| **5. Verificación** | Verificador: Developer (mismo loop). Procedimiento: `fmt` + `validate -no-color` de nuevo. Resultado: `Success! The configuration is valid.` (`F00-T04-validate.txt`, exit 0). Regresión: `plan` exit 0 con la sonda STS leyendo `id=000000000000`, confirmando que los cuatro endpoints apuntan al emulador. Límites: no se probó cada servicio por separado (fuera del bootstrap; F04). |
| **6. Pendientes** | Riesgo residual: **ninguno**. Cobertura ausente: verificación de S3/SQS/DynamoDB reales (Fase 4). Responsable: Developer (resuelto). Sin `G-10`. |
| **7. Aprendizaje** | **Prevención propuesta:** antes de fijar un provider, comprobar su esquema con `terraform providers schema -json` o confiar en `validate` temprano (ejecutar `validate` justo tras `init`, no al final). **Ámbito candidato:** `PROPUESTA_GLOBAL` (checklist IaC). **Estado:** `RESUELTO`. |

### Problema `F00-T04-P3` — Error de parseo de PowerShell en la interpolación `$i:`

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID `F00-T04-P3` · Tarea `F00-T04` · Fase `P-00` · Loop `1/3` · Fecha `2026-11-17` · Entorno: PowerShell/Windows · Fuentes: primer intento del script de ciclo de vida del emulador. |
| **2. Problema** | **Síntoma:** `ParserError: Variable reference is not valid. ':' was not followed by a valid variable name character.` en `"POLL $i: healthy"` (exit 1 del script). **Esperado:** el bucle de espera a `healthy` imprimiera `POLL 0: starting`, etc. **Observado:** el script ni siquiera se ejecutó (error en tiempo de parseo). **Impacto:** retraso menor; **no se llegó a levantar el contenedor**, por lo que no hubo estado residual que limpiar. **Reproducción:** interpolación `$i:` dentro de una cadena doble en PowerShell. |
| **3. Causa** | **DEMOSTRADA.** PowerShell interpreta `:` como separator de ámbito/drive después del nombre de variable; requiere `${i}` para delimitar. **Alternativas descartadas:** modificar la lógica de polling (no era el fallo). |
| **4. Solución e intentos fallidos** | **Aplicada:** sustituir `$i:` por `${i}:` en los dos mensajes del bucle. **Intentos fallidos:** 1 (parseo). **Motivo:** corrección sintáctica mínima, sin alterar la lógica. |
| **5. Verificación** | Verificador: Developer. Procedimiento: reejecutar el script completo. Resultado: polls `starting → starting → starting → healthy`, `HEALTHY=True`, `up`/`down`/`ps` exit 0 (`F00-T04-emulator.txt`). Regresión: `plan` exit 0. Límites: ninguno relevante. |
| **6. Pendientes** | Riesgo residual: **ninguno**. Cobertura ausente: ninguna. Responsable: Developer (resuelto). Sin `G-10`. |
| **7. Aprendizaje** | **Prevención propuesta:** delimitar siempre con `${}` las variables seguidas de `:` en cadenas de PowerShell; ejecutar un chequeo de sintaxis del script antes de arrancar servicios. **Ámbito candidato:** `SOLO_LOCAL`. **Estado:** `RESUELTO`. |

## 6. Estado final y handoff

**`DONE`**. `CA-04` queda cubierto con evidencia real de `init`, `validate`, `plan` y ciclo de vida del emulador (arranque `healthy`, límites G-7, TLS con `ca.pem`, apagado limpio sin contenedor residual). No se emite `PASSED` ni se cierra la tarea: corresponde al Tester (y al Auditor por riesgo 2).

**Observaciones fuera de ámbito (no son concerns de esta tarea):**
- `A-05` sigue **ABIERTO**: no existe `.gitignore` y `.local/aws-emulator/` contiene credenciales **efímeras** del emulador. Transferido a `F00-T05`; en T05 debe excluirse `.local/`, `.terraform/` y `*.tfstate*`.
- No se usó Git/GitHub (propiedad de T05), no se hizo `apply`, no se contactó a AWS real y no se versionaron secretos ni rutas Windows absolutas.
- El contenedor quedó **APAGADO**; el volumen named `aws-emulator-data` persiste según el runbook.
