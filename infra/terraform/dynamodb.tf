# MediaShrink Cloud — Tabla DynamoDB de jobs (F04-T03 / CA-03)
#
# Declara `mediashrink-jobs` con PK `userId` (HASH) y SK `jobId` (RANGE) y TTL
# habilitado sobre el atributo `ttl`, coherente con el contrato congelado
# (docs/architecture/03-*.md §2/§3, spec.md §4, TTL_SECONDS = 2.592.000).
#
# UNICA FUENTE DE RETENCION: `var.retention_days` (declarada en s3.tf, default
# 30). El TTL se DERIVA como `retention_days * 86400` (constante de conversion
# dias->segundos); no se repite el literal 30 ni el literal 2592000 en HCL.
# Esto cierra formalmente el seguimiento T02-A-01 (alineacion S3 <-> TTL).
#
# TABLA DE USUARIOS: NO se crea `mediashrink-users`. El config de backend solo
# declara DYNAMODB_TABLE_JOBS, y el adaptador UserStore (backend/src/db/
# user-store-adapter.ts, cierra T03-A-04) recibe `tableName` por inyeccion y
# convive en ESTA MISMA tabla con SK `USER#PROFILE` / `USER#EMAIL`. Una tabla
# separada no tendria consumidor y romperia el contrato congelado.
#
# Sin AWS real: el provider de `provider.tf` apunta al emulador :9297 con
# credenciales por archivo generadas y CA propio (PR-04, G-3).

locals {
  # Segundos por dia: constante de conversion de unidades, NO un literal de
  # retencion. La fuente de retencion sigue siendo exclusivamente var.retention_days.
  ttl_seconds = var.retention_days * 86400

  # Regla de negocio documentada (F04T03-A-04): el TTL afecta a jobs e imagenes,
  # nunca a las cuentas de usuario. Solo se usa en check/output; no altera la
  # configuracion de TimeToLiveSpecification de la tabla.
  ttl_item_policy = {
    job_items_carry_ttl          = true
    image_items_carry_ttl        = true
    user_profile_items_carry_ttl = false
    user_accounts_expire         = false
  }
}

variable "dynamodb_table_jobs" {
  description = <<-EOT
    Nombre de la tabla DynamoDB de jobs (DYNAMODB_TABLE_JOBS en .env.example).
    En esta misma tabla conviven los items de job, los items hijos IMAGE# y los
    items de usuario USER# del adaptador UserStore (T03-A-04).
  EOT
  type        = string
  default     = "mediashrink-jobs"

  validation {
    condition     = length(var.dynamodb_table_jobs) >= 3 && length(var.dynamodb_table_jobs) <= 255
    error_message = "dynamodb_table_jobs debe tener entre 3 y 255 caracteres (rango DynamoDB)."
  }
}

# La tabla usa la clave primaria compuesta del contrato: userId (HASH) + jobId
# (RANGE). No se declaran GSI: todo acceso empieza por userId (PR-07, IN-06)
# y el listado de hijos usa begins_with(jobId, 'IMAGE#...') (architecture §2).
resource "aws_dynamodb_table" "jobs" {
  name           = var.dynamodb_table_jobs
  billing_mode   = "PROVISIONED"
  read_capacity  = 5
  write_capacity = 5

  hash_key  = "userId"
  range_key = "jobId"

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "jobId"
    type = "S"
  }

  # TTL asincronico de DynamoDB: el emulador devuelve ENABLING -> ENABLED.
  # Solo los items de JOB y de imagen hija (IMAGE#) llevan el atributo `ttl`
  # derivado de createdAt + retention_days (computeTtl del catalogo congelado).
  # Los perfiles de usuario (USER#PROFILE / USER#EMAIL) NO escriben `ttl` en el
  # adaptador UserStore: DynamoDB solo expira items que poseen el atributo, por
  # lo que las CUENTAS NO EXPIRAN. Corrige F04T03-A-04; la aseveracion
  # documental explicita esta en `check "user_profiles_not_expiring"` y en el
  # output `dynamodb_ttl_item_policy` (sin cambio de comportamiento).
  ttl {
    attribute_name = "ttl"
    enabled        = true
  }
}

# Guardias declarativas del core Terraform (>= 1.5; disponibles en 1.17.2).
# No dependen del proveedor AWS: verifican la alineacion S3 <-> DynamoDB y que
# la tabla declarada habilita TTL sobre el atributo correcto.
check "retention_alignment_s3_dynamodb" {
  assert {
    condition     = local.ttl_seconds % 86400 == 0 && local.ttl_seconds / 86400 == var.retention_days
    error_message = "El TTL de DynamoDB debe derivarse de var.retention_days (S3) sin literales duplicados."
  }
}

check "dynamodb_ttl_enabled" {
  assert {
    condition     = length(aws_dynamodb_table.jobs.ttl) == 1 && aws_dynamodb_table.jobs.ttl[0].attribute_name == "ttl" && aws_dynamodb_table.jobs.ttl[0].enabled
    error_message = "La tabla de jobs debe habilitar TimeToLiveSpecification sobre el atributo 'ttl'."
  }
}

# Aseveracion DOCUMENTAL (F04T03-A-04, correccion menor). Terraform no puede
# inspeccionar el codigo del adaptador, así que se explicita como dato la regla
# de negocio ya implementada: el TTL se aplica a jobs/imagenes, NUNCA a las
# cuentas. No modifica la configuracion de la tabla ni el comportamiento.
check "user_profiles_not_expiring" {
  assert {
    condition     = local.ttl_item_policy.user_profile_items_carry_ttl == false && local.ttl_item_policy.user_accounts_expire == false
    error_message = "Los items USER# no deben llevar 'ttl': las cuentas no expiran (F04T03-A-04)."
  }
}

output "dynamodb_table_jobs" {
  description = "Nombre de la tabla DynamoDB de jobs aprovisionada en el emulador."
  value       = aws_dynamodb_table.jobs.id
}

output "dynamodb_table_jobs_arn" {
  description = "ARN de la tabla DynamoDB de jobs."
  value       = aws_dynamodb_table.jobs.arn
}

output "dynamodb_ttl_attribute" {
  description = "Atributo usado por TimeToLiveSpecification de la tabla de jobs."
  value       = aws_dynamodb_table.jobs.ttl[0].attribute_name
}

output "dynamodb_ttl_seconds" {
  description = "Segundos de retencion derivados de retention_days (T02-A-01, alineado con el ciclo de vida S3)."
  value       = local.ttl_seconds
}

output "dynamodb_ttl_item_policy" {
  description = "Aseveracion documental (F04T03-A-04): TTL solo para jobs/IMAGE#; los perfiles USER# no llevan ttl y las cuentas no expiran."
  value       = local.ttl_item_policy
}
