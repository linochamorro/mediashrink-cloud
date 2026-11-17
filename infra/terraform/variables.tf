# Variables del bootstrap (F00-T04). Todos los valores por defecto son
# marcadores locales del emulador: no hay secretos ni rutas Windows absolutas.
# Se pueden sobreescribir con TF_VAR_<nombre> o con un terraform.tfvars local
# (excluido de Git en F00-T05).

variable "aws_region" {
  description = "Región fija del emulador aws/aws-emulator (us-east-1)."
  type        = string
  default     = "us-east-1"
}

variable "aws_account_id" {
  description = "ID de cuenta fijo del emulador (000000000000). No es un secreto."
  type        = string
  default     = "000000000000"

  validation {
    condition     = length(var.aws_account_id) == 12
    error_message = "aws_account_id debe tener 12 dígitos (ID de cuenta AWS)."
  }
}

variable "aws_endpoint_url" {
  description = <<-EOT
    Endpoint HTTPS ÚNICO del emulador para todos los servicios (S3, SQS, DynamoDB
    y STS). Equivale a AWS_ENDPOINT_URL en .env.example. NUNCA debe contener :9324:
    aws-emulator no expone un puerto SQS separado (addendum A-03 / hallazgo A-03
    cerrado en F00-T01). Las QueueUrls canónicas de SQS usan el host AWS como
    identificador lógico; el transporte lo fija esta variable.
  EOT
  type        = string
  default     = "https://127.0.0.1:9297"

  validation {
    condition     = !can(regex(":9324", var.aws_endpoint_url))
    error_message = "aws_endpoint_url no debe contener :9324; el emulador solo expone 127.0.0.1:9297 (A-03)."
  }
}

variable "aws_shared_credentials_file" {
  description = <<-EOT
    Ruta RELATIVA (desde infra/terraform/) al archivo de credenciales efímeras
    que genera el emulador en cada arranque y se exporta con `docker cp`
    (runbook §1.3). Equivale a AWS_SHARED_CREDENTIALS_FILE. Sin credenciales fijas.
  EOT
  type        = string
  default     = "../../.local/aws-emulator/emulator_credentials"
}

variable "aws_config_file" {
  description = <<-EOT
    Ruta RELATIVA (desde infra/terraform/) al archivo `config` generado por el
    emulador y exportado con `docker cp` (runbook §1.3). Equivale a AWS_CONFIG_FILE.
  EOT
  type        = string
  default     = "../../.local/aws-emulator/config"
}

variable "ca_bundle_path" {
  description = <<-EOT
    Ruta RELATIVA (desde infra/terraform/) al CA PEM autofirmado que genera el
    emulador en cada arranque (runbook §1.3). Equivale a CA_BUNDLE_PATH /
    AWS_CA_BUNDLE. Debe exportarse de nuevo tras cada arranque (nota N-01).
  EOT
  type        = string
  default     = "../../.local/aws-emulator/ca.pem"
}
