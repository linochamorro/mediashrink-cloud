# MediaShrink Cloud — Buckets S3 de producto (F04-T01 / CA-01)
#
# Declara los dos buckets S3 (`raw` y `optimized`) con una regla de ciclo de
# vida de expiración a RETENTION_DAYS (30 días), alineada con el TTL de
# DynamoDB (TTL_SECONDS = 2.592.000, T02-A-01 / IN-09).
#
# DELIBERADAMENTE NO se declara `aws_s3_bucket_notification` ni ningún bloque
# de eventos: el pipeline evita bucles S3 -> SQS -> S3 (CA-01). La verificación
# en tiempo de ejecución de esta ausencia se documenta en la evidencia
# `F04-T01-no-event-loop.txt`.
#
# Sin AWS real: el provider de `provider.tf` apunta al emulador :9297 con
# credenciales por archivo generadas y CA propio (PR-04).

variable "retention_days" {
  description = <<-EOT
    Días de retención de los objetos en los buckets S3. Equivale a
    RETENTION_DAYS=30 de .env.example y se alinea con el TTL de DynamoDB
    (TTL_SECONDS=2.592.000). Cierra el seguimiento T02-A-01.
  EOT
  type        = number
  default     = 30

  validation {
    condition     = var.retention_days > 0 && var.retention_days == floor(var.retention_days)
    error_message = "retention_days debe ser un número entero positivo (días)."
  }
}

variable "s3_bucket_raw" {
  description = "Nombre del bucket S3 de imágenes originales (S3_BUCKET_RAW)."
  type        = string
  default     = "mediashrink-raw-local"
}

variable "s3_bucket_optimized" {
  description = "Nombre del bucket S3 de imágenes optimizadas (S3_BUCKET_OPTIMIZED)."
  type        = string
  default     = "mediashrink-optimized-local"
}

resource "aws_s3_bucket" "raw" {
  bucket = var.s3_bucket_raw
}

resource "aws_s3_bucket" "optimized" {
  bucket = var.s3_bucket_optimized
}

# CORS explicito para la SPA (F04-T04 / CA-04, NFR-03, CORS_ORIGIN).
# La aplicacion usa URLS PRESIGNADAS y el navegador las ejecuta con fetch/XHR:
#   - PUT  a `raw` (presignUpload, storage/presigner.ts:106)
#   - GET  a `raw` (presignVariant, storage/objects.ts:185)
#   - GET  a `optimized` (presignDownload, storage/presigner.ts:119)
# Por ello ambos buckets declaran la MISMA regla: origen unico var.cors_origin,
# metodos GET/PUT y los cabeceros que el SDK firma en una URL presignada.
# No se usa `AllowedHeaders = ["*"]`: la lista es explicita y minima.
locals {
  s3_cors_rules = [{
    allowed_headers = [
      "authorization",
      "content-type",
      "content-md5",
      "etag",
      "x-amz-content-sha256",
      "x-amz-date",
      "x-amz-security-token",
      "x-amz-server-side-encryption",
    ]
    allowed_methods = ["GET", "PUT"]
    allowed_origins = [var.cors_origin]
    expose_headers = [
      "content-type",
      "etag",
      "x-amz-id-2",
      "x-amz-request-id",
    ]
    max_age_seconds = 3000
  }]
}

resource "aws_s3_bucket_cors_configuration" "raw" {
  bucket = aws_s3_bucket.raw.id

  dynamic "cors_rule" {
    for_each = local.s3_cors_rules
    content {
      allowed_headers = cors_rule.value.allowed_headers
      allowed_methods = cors_rule.value.allowed_methods
      allowed_origins = cors_rule.value.allowed_origins
      expose_headers  = cors_rule.value.expose_headers
      max_age_seconds = cors_rule.value.max_age_seconds
    }
  }
}

resource "aws_s3_bucket_cors_configuration" "optimized" {
  bucket = aws_s3_bucket.optimized.id

  dynamic "cors_rule" {
    for_each = local.s3_cors_rules
    content {
      allowed_headers = cors_rule.value.allowed_headers
      allowed_methods = cors_rule.value.allowed_methods
      allowed_origins = cors_rule.value.allowed_origins
      expose_headers  = cors_rule.value.expose_headers
      max_age_seconds = cors_rule.value.max_age_seconds
    }
  }
}

# Guarda declarativa: el origen debe ser exactamente CORS_ORIGIN y los metodos
# deben ser GET/PUT (sin comodines) en ambos buckets (core Terraform).
check "s3_cors_explicit_origin_and_methods" {
  assert {
    condition = alltrue([
      for rule in local.s3_cors_rules :
      length(rule.allowed_origins) == 1 &&
      rule.allowed_origins[0] == var.cors_origin &&
      length(rule.allowed_methods) == 2 &&
      contains(rule.allowed_methods, "GET") &&
      contains(rule.allowed_methods, "PUT") &&
      !contains(rule.allowed_headers, "*")
    ])
    error_message = "CORS debe declarar exactamente CORS_ORIGIN, metodos GET/PUT y cabeceros explicitos (sin \"*\")."
  }
}

# Regla de ciclo de vida: expiración de todos los objetos a los 30 días.
# Sin filtro => aplica a la totalidad del bucket (comportamiento equivalente
# al TTL de la tabla de jobs). No se define transición a otras clases de
# almacenamiento ni expiración de versiones: no hay versionado en estos buckets.
resource "aws_s3_bucket_lifecycle_configuration" "raw" {
  bucket = aws_s3_bucket.raw.id

  rule {
    id     = "expire-after-retention-days"
    status = "Enabled"

    # Filtro vacío: aplica a todos los objetos del bucket. Evita la advertencia
    # del provider v5 sobre combinación inválida de atributos (filter/prefix).
    filter {}

    expiration {
      days = var.retention_days
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "optimized" {
  bucket = aws_s3_bucket.optimized.id

  rule {
    id     = "expire-after-retention-days"
    status = "Enabled"

    # Filtro vacío: aplica a todos los objetos del bucket (ver nota en raw).
    filter {}

    expiration {
      days = var.retention_days
    }
  }
}

output "s3_bucket_raw" {
  description = "Nombre del bucket S3 de originales aprovisionado en el emulador."
  value       = aws_s3_bucket.raw.id
}

output "s3_bucket_optimized" {
  description = "Nombre del bucket S3 de optimizadas aprovisionado en el emulador."
  value       = aws_s3_bucket.optimized.id
}

output "s3_lifecycle_expiration_days" {
  description = "Días de expiración aplicados a ambos buckets (RETENTION_DAYS, alineado con el TTL)."
  value       = var.retention_days
}

output "s3_cors_configuration" {
  description = "Regla CORS declarada en los buckets raw y optimized (origen, metodos y cabeceros explicitos)."
  value       = local.s3_cors_rules
}
