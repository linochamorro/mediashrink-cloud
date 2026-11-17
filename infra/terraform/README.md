# Terraform — bootstrap contra `aws/aws-emulator` (F00-T04 / CA-04)

Configuración **solo de bootstrap**. Aquí no se aprovisionan buckets S3, colas
SQS/DLQ ni tablas DynamoDB: esos recursos de producto se introducen en Fase 4.
No se ejecuta `terraform apply` contra AWS real en esta fase.

## Archivos

| Archivo | Contenido |
|---|---|
| `versions.tf` | Versión de Terraform/provider y backend local (`terraform.tfstate`). |
| `provider.tf` | Provider AWS con endpoint único, credenciales por archivo, CA y `skip_*`. |
| `variables.tf` | Variables declaradas y documentadas (valores por defecto locales). |
| `data.tf` | Sonda mínima `aws_caller_identity` que ejercita STS contra el emulador durante `plan`. |
| `outputs.tf` | Endpoint, cuenta autenticada y región (sin secretos). |

## Variables

| Variable | Default (relativo a `infra/terraform/`) | Equivale en `.env.example` |
|---|---|---|
| `aws_region` | `us-east-1` | `AWS_REGION` |
| `aws_account_id` | `000000000000` | `AWS_ACCOUNT_ID` |
| `aws_endpoint_url` | `https://127.0.0.1:9297` | `AWS_ENDPOINT_URL` |
| `aws_shared_credentials_file` | `../../.local/aws-emulator/emulator_credentials` | `AWS_SHARED_CREDENTIALS_FILE` |
| `aws_config_file` | `../../.local/aws-emulator/config` | `AWS_CONFIG_FILE` |
| `ca_bundle_path` | `../../.local/aws-emulator/ca.pem` | `CA_BUNDLE_PATH` / `AWS_CA_BUNDLE` |

Las rutas son **relativas** para no versionar rutas Windows absolutas (PR-08).
Se pueden sobreescribir con `TF_VAR_<nombre>`; el directorio de trabajo de
Terraform es `infra/terraform/`, por lo que `../../.local/...` apunta a la raíz
del proyecto. `aws_endpoint_url` tiene una validación que rechaza explícitamente
`:9324` (addendum A-03): el emulador solo expone `127.0.0.1:9297`.

## Precondición: emulador en vivo

El `plan` refresca la sonda STS, así que el emulador debe estar arrancado y los
tres archivos deben haberse exportado **en esa misma sesión** (runbook §1.3,
nota N-01). Desde la raíz del proyecto:

```powershell
docker compose up -d
# esperar a `healthy`, luego exportar los archivos generados:
New-Item -ItemType Directory -Force ./.local/aws-emulator | Out-Null
docker cp mediashrink-aws-emulator:/home/emulator/.aws/emulator/9297/ca.pem ./.local/aws-emulator/ca.pem
docker cp mediashrink-aws-emulator:/home/emulator/.aws/emulator/9297/config ./.local/aws-emulator/config
docker cp mediashrink-aws-emulator:/home/emulator/.aws/emulator/9297/emulator_credentials ./.local/aws-emulator/emulator_credentials
```

Y apagar al terminar: `docker compose down` (G-7).

## Comandos (desde la raíz del proyecto)

```powershell
# terraform.exe está fuera de PATH en este entorno: definir $tf con la ruta
# local del binario (ruta redactada aquí; ver F00-T04-task.md §5).
$env:AWS_ENDPOINT_URL = 'https://127.0.0.1:9297'
$env:AWS_REGION = 'us-east-1'
$env:AWS_SHARED_CREDENTIALS_FILE = './.local/aws-emulator/emulator_credentials'
$env:AWS_CONFIG_FILE = './.local/aws-emulator/config'
$env:AWS_CA_BUNDLE = './.local/aws-emulator/ca.pem'
$env:AWS_EC2_METADATA_DISABLED = 'true'
# NO definir AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_PROFILE

& $tf -chdir=infra/terraform fmt -check
& $tf -chdir=infra/terraform init -input=false
& $tf -chdir=infra/terraform validate
& $tf -chdir=infra/terraform plan -input=false
```

> `AWS_ENDPOINT_URL`, `AWS_CA_BUNDLE` y las rutas relativas de los archivos se
> documentan como ejemplo. La ruta del binario de Terraform es especifica de
> este entorno local y se redacta deliberadamente (__TF_BIN__) en artefactos
> públicos.
