# Terraform — IaC contra `aws/aws-emulator` (F00-T04 / CA-04, F04-T01 / CA-01, F04-T02 / CA-02, F04-T03 / CA-03)

El bootstrap de F00 aporta proveedor, backend local, variables, sonda STS y
outputs. **F04-T01 añade los dos buckets S3 con ciclo de vida de expiración a
30 días** (`s3.tf`). **F04-T02 añade la cola SQS principal `mediashrink-jobs` y
su DLQ `mediashrink-jobs-dlq` con redrive y `maxReceiveCount = 3`** (`sqs.tf`).
**F04-T03 añade la tabla DynamoDB `mediashrink-jobs` (PK `userId` / SK `jobId`)
con TTL habilitado sobre `ttl`** (`dynamodb.tf`). **F04-T04 añade el rol IAM de
mínimo privilegio (`iam.tf`), el CORS explícito de la SPA en ambos buckets
(`s3.tf`) y el interruptor `is_emulator` que evita heredar los flags `skip_*` a
un entorno real** (`provider.tf`). No se ejecuta `terraform apply` contra AWS real.

## Archivos

| Archivo | Contenido |
|---|---|
| `versions.tf` | Versión de Terraform/provider y backend local (`terraform.tfstate`). |
| `provider.tf` | Provider AWS con endpoint único, credenciales por archivo, CA y `skip_*`. |
| `variables.tf` | Variables declaradas y documentadas (valores por defecto locales). |
| `data.tf` | Sonda mínima `aws_caller_identity` que ejercita STS contra el emulador durante `plan`. |
| `outputs.tf` | Endpoint, cuenta autenticada y región (sin secretos). |
| `s3.tf` | (F04-T01) Buckets `mediashrink-raw-local` / `mediashrink-optimized-local` con expiración a `retention_days` y **sin** notificaciones de eventos. |
| `sqs.tf` | (F04-T02) Cola `mediashrink-jobs` + DLQ `mediashrink-jobs-dlq`, `redrive_policy` inline (`maxReceiveCount = 3`) y `visibility_timeout_seconds = 120`. |
| `dynamodb.tf` | (F04-T03) Tabla `mediashrink-jobs` (PK `userId` / SK `jobId`), TTL sobre `ttl` y TTL en segundos **derivado** de `retention_days`. |
| `iam.tf` | (F04-T04) Rol `mediashrink-app-role`, política inline de mínimo privilegio sobre S3/SQS+DynamoDB y `check`s anti-comodines. |
| `s3.tf` (CORS) | (F04-T04) `aws_s3_bucket_cors_configuration` en `raw` y `optimized`: origen `CORS_ORIGIN`, métodos `GET`/`PUT` y cabeceros explícitos de presign. |

## Variables

| Variable | Default (relativo a `infra/terraform/`) | Equivale en `.env.example` |
|---|---|---|
| `aws_region` | `us-east-1` | `AWS_REGION` |
| `aws_account_id` | `000000000000` | `AWS_ACCOUNT_ID` |
| `aws_endpoint_url` | `https://127.0.0.1:9297` | `AWS_ENDPOINT_URL` |
| `aws_shared_credentials_file` | `../../.local/aws-emulator/emulator_credentials` | `AWS_SHARED_CREDENTIALS_FILE` |
| `aws_config_file` | `../../.local/aws-emulator/config` | `AWS_CONFIG_FILE` |
| `ca_bundle_path` | `../../.local/aws-emulator/ca.pem` | `CA_BUNDLE_PATH` / `AWS_CA_BUNDLE` |
| `is_emulator` | `true` | Interruptor de entorno (solo Terraform). `false` en AWS real. |
| `cors_origin` | `http://localhost:5173` | `CORS_ORIGIN` |

Las rutas son **relativas** para no versionar rutas Windows absolutas (PR-08).
Se pueden sobreescribir con `TF_VAR_<nombre>`; el directorio de trabajo de
Terraform es `infra/terraform/`, por lo que `../../.local/...` apunta a la raíz
del proyecto. `aws_endpoint_url` tiene una validación que rechaza explícitamente
`:9324` (addendum A-03): el emulador solo expone `127.0.0.1:9297`.

### Variables de F04-T01 (declaradas en `s3.tf`)

| Variable | Default | Equivale en `.env.example` |
|---|---|---|
| `retention_days` | `30` | `RETENTION_DAYS` (alineado con `TTL_SECONDS=2592000`, T02-A-01) |
| `s3_bucket_raw` | `mediashrink-raw-local` | `S3_BUCKET_RAW` |
| `s3_bucket_optimized` | `mediashrink-optimized-local` | `S3_BUCKET_OPTIMIZED` |

Los dos buckets comparten la misma regla `expire-after-retention-days`
(`Enabled`, `expiration.days = 30`). **No se declara**
`aws_s3_bucket_notification` ni configuración de eventos alguna: el pipeline
no genera bucles S3 → SQS → S3 (CA-01).

### Variables de F04-T02 (declaradas en `sqs.tf`)

| Variable | Default | Equivale en `.env.example` |
|---|---|---|
| `sqs_queue_name` | `mediashrink-jobs` | `SQS_QUEUE_URL` (host AWS canónico) |
| `sqs_dlq_name` | `mediashrink-jobs-dlq` | `SQS_DLQ_URL` (host AWS canónico) |
| `sqs_visibility_timeout_seconds` | `120` | Política de visibilidad (2 min > `POLL_INTERVAL_MS=2000`) |
| `sqs_max_receive_count` | `3` | `SQS_MAX_RETRIES` (IN-08 / FR-13 / D-09) |

Las QueueUrls se conservan canónicas (`https://sqs.us-east-1.amazonaws.com/
000000000000/<cola>`): el host AWS es un identificador lógico y
`AWS_ENDPOINT_URL=https://127.0.0.1:9297` actúa **solo** como transporte hacia
el emulador. **Nunca se escribe `:9324`** (addendum A-03 de F00-T01).

> **Particularidad del emulador (hallazgo P1 del reporte de Developer, evidencia
> `F04-T02-apply-inline-string-timeout.txt`):** `GetQueueAttributes` devuelve
> `maxReceiveCount` como **número** (`"maxReceiveCount":3`). Declararlo como
> string (`tostring`, `"3"`) hace que el waiter de creación del provider AWS
> compare formatos distintos, agote 3 min y falle el `apply` aunque la política
> quede aplicada. La declaración usa por tanto el valor numérico
> (`maxReceiveCount = var.sqs_max_receive_count`), que coincide byte a byte con
> la respuesta real y evita diffs perpetuos (`F04-T02-plan-post-apply.txt`:
> `No changes`).

### Variables de F04-T03 (declaradas en `dynamodb.tf`)

| Variable | Default | Equivale en `.env.example` |
|---|---|---|
| `dynamodb_table_jobs` | `mediashrink-jobs` | `DYNAMODB_TABLE_JOBS` |

**Única fuente de retención (cierra `T02-A-01`):** `var.retention_days` (declarada
en `s3.tf`, default `30`) gobierna tanto el ciclo de vida de los buckets S3 como
el TTL de DynamoDB. El TTL en segundos se **deriva** como
`local.ttl_seconds = var.retention_days * 86400` (`86400` es la constante de
conversión días→segundos, no un literal de retención), y se expone en el output
`dynamodb_ttl_seconds`. No se repite el literal `30` ni `2592000` en HCL. Dos
bloques `check` del core Terraform (≥ 1.5; disponible en 1.17.2, no dependen
del proveedor AWS) verifican (a) que el TTL derivado es coherente con
`retention_days` y (b) que la tabla habilita `TimeToLiveSpecification` sobre
`ttl`.

**Tabla de usuarios: NO se crea `mediashrink-users`.** El config de backend
solo declara `DYNAMODB_TABLE_JOBS` (`backend/src/config/index.ts`) y el
adaptador `UserStore` (`backend/src/db/user-store-adapter.ts`, cierra `T03-A-04`)
recibe `tableName` por inyección y **convive en esta misma tabla** usando SK
`USER#PROFILE` (PK = `userId`) y `USER#EMAIL` (PK = correo normalizado). Una
tabla separada no tendría consumidor, añadiría superficie innecesaria y
contradeciría el contrato congelado. Los IDs opacos no contienen `#`, por lo que
los prefijos `USER#` no colisionan con `IMAGE#` ni con `jobId`s de job.

### Variables de F04-T04 (IAM / CORS / entorno)

| Variable | Default | Equivale en `.env.example` |
|---|---|---|
| `is_emulator` | `true` | Interruptor propio de Terraform (no existe en `.env.example`) |
| `cors_origin` | `http://localhost:5173` | `CORS_ORIGIN` |
| `iam_role_name` | `mediashrink-app-role` | — (nombre del rol de la aplicación) |

#### `is_emulator`: los flags `skip_*` NO se heredan (cierra `T04-A-03`)

`var.is_emulator` (default `true`) es la **única fuente de verdad** de las
excepciones del emulador. En `provider.tf` se condicionan a esa variable:

| Ajuste del provider | `is_emulator = true` (emulador) | `is_emulator = false` (AWS real) |
|---|---|---|
| `skip_credentials_validation` | `true` | `false` |
| `skip_requesting_account_id` | `true` | `false` |
| `skip_metadata_api_check` | `true` | `false` |
| `shared_credentials_files` / `shared_config_files` | archivos efímeros exportados con `docker cp` | `[]` → cadena estándar del SDK |
| `endpoints { s3, sqs, dynamodb, sts }` | `https://127.0.0.1:9297` | bloque ausente → endpoints reales de AWS |
| `custom_ca_bundle` | `../../.local/aws-emulator/ca.pem` | `null` → almacén de confianza del sistema |

Con `true` se mantiene el transporte `:9297`, el CA propio y las credenciales
**por archivo** (sin `access_key`/`secret_key` fijos, G-3). Con `false` desaparece
todo eso y el provider valida credenciales, cuenta e IMDS como en una cuenta AWS
normal. Evidencia: `F04-T04-skip-flags.txt` (grep + evaluación sin proveedor).

#### AWS real (NO ejecutar en esta fase; documentación únicamente)

El siguiente procedimiento **solo se documenta**. No se ha ejecutado, no se
ejecutará en F04 y no se ha usado ninguna cuenta AWS (G-7, sin AWS real):

```powershell
# 1) Apagar el emulador y NO exportar AWS_ENDPOINT_URL / AWS_CA_BUNDLE.
docker compose down

# 2) En un entorno con credenciales reales (rol de CI / instance profile /
#    AWS_PROFILE), invocar Terraform con el interruptor desactivado:
$env:TF_VAR_is_emulator = 'false'
$env:AWS_REGION = 'us-east-1'
# Opcional, solo si el nombre/retención difieren del default:
$env:TF_VAR_s3_bucket_raw = 'mediashrink-raw-<cuenta>'
$env:TF_VAR_s3_bucket_optimized = 'mediashrink-optimized-<cuenta>'
$env:TF_VAR_cors_origin = 'https://app.tudominio.example'

# 3) Comandos estándar (sin custom CA, sin :9297, sin credenciales por archivo):
terraform -chdir=infra/terraform init -input=false
terraform -chdir=infra/terraform validate
terraform -chdir=infra/terraform plan -input=false
# terraform apply queda sujeto a G-12 (publicación final), NO ejecutar aquí.
```

No se debe reutilizar el `terraform.tfstate` local del emulador en AWS real.

#### IAM de mínimo privilegio (`iam.tf`)

Un único rol `mediashrink-app-role` con confianza **solo** para
`lambda.amazonaws.com` y una política inline con acciones y ARNs concretos,
derivados de los recursos HCL (sin ARNs literales):

| Recurso | Acciones (sin `*`) |
|---|---|
| `aws_s3_bucket.raw.arn` / `.optimized.arn` | `s3:ListBucket` |
| `${...raw.arn}/*` / `${...optimized.arn}/*` | `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject` |
| `aws_sqs_queue.jobs.arn`, `aws_sqs_queue.dlq.arn` | `sqs:SendMessage`, `sqs:ReceiveMessage`, `sqs:DeleteMessage`, `sqs:ChangeMessageVisibility`, `sqs:GetQueueAttributes`, `sqs:GetQueueUrl` |
| `aws_dynamodb_table.jobs.arn` | `GetItem`, `PutItem`, `UpdateItem`, `DeleteItem`, `Query`, `BatchGetItem`, `BatchWriteItem`, `DescribeTable` |

No hay `"Action": "*"` ni `"Resource": "*"`. El único `/*` son ARNs de **objeto**
dentro de un bucket nombrado (imprescindible para `PutObject`/`GetObject`), no un
comodín amplio. Tres bloques `check` del core Terraform verifican ausencia de
comodines, que todo ARN deriva de un recurso declarado y que el `Principal` de
confianza es únicamente Lambda. La representación declarativa se expone en los
outputs `iam_role_*`, `iam_inline_policy` e `iam_trust_policy`.

**Soporte del emulador verificado en vivo** (`F04-T04-iam-support.txt`): el
emulador acepta `aws_iam_role`, `aws_iam_role_policy` (PutRolePolicy) y la lectura
`data "aws_iam_role"` (GetRole) contra `:9297` con credenciales por archivo y CA
propio. No fue necesario sustituir los recursos por una representación
`jsonencode`-solo. Matiz: una sonda **artesanal** firmada a mano con SigV4 y
servicio `iam` devuelve `SignatureDoesNotMatch` (`F04-T04-support-probe.txt`); el
proveedor oficial de Terraform (que firma correctamente) sí crea y lee los
recursos, por lo que la verificación viva se apoya en Terraform + la
representación declarativa, sin simular `PASSED`.

#### CORS explícito de la SPA (`s3.tf`)

La SPA usa URL presignadas y el navegador las ejecuta con `fetch`/XHR: `PUT` a
`raw` (subida), `GET` a `raw` (variantes) y `GET` a `optimized` (descarga). Por
ello **ambos buckets** declaran la misma regla CORS:

- `allowed_origins = [var.cors_origin]` → `http://localhost:5173` (idéntico a
  `CORS_ORIGIN` de `.env.example`), sin comodines.
- `allowed_methods = ["GET", "PUT"]`.
- `allowed_headers`: `authorization`, `content-type`, `content-md5`, `etag`,
  `x-amz-content-sha256`, `x-amz-date`, `x-amz-security-token`,
  `x-amz-server-side-encryption` (los que firma el presigner del SDK).
- `expose_headers`: `content-type`, `etag`, `x-amz-id-2`, `x-amz-request-id`.
- `max_age_seconds = 3000`.

Verificado en vivo con `GetBucketCors` en ambos buckets
(`F04-T04-cors.txt`: `ORIGIN_EXACT: true`, `METHODS_EXACT: true`,
`HEADERS_NO_WILDCARD: true`). Un `check` adicional impide modificar el origen o
los métodos sin actualizar la declaración.

#### Aseveración documental sobre el TTL de `USER#` (`dynamodb.tf`)

Corrección de `F04T03-A-04`: el comentario HCL ya no afirma que los perfiles de
usuario llevan `ttl`. Solo los ítems de job y `IMAGE#` lo llevan; los ítems
`USER#PROFILE` / `USER#EMAIL` **no escriben `ttl`** en el adaptador y, por tanto,
**las cuentas no expiran**. Se añade el `check "user_profiles_not_expiring"` y el
output `dynamodb_ttl_item_policy` como aseveración documental. No cambia la
configuración de `TimeToLiveSpecification` ni el comportamiento.

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
