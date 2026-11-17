# MediaShrink Cloud — bootstrap de IaC (F00-T04 / CA-04)
#
# ALCANCE: solo bootstrap. Este directorio declara proveedor, backend local,
# variables, outputs y una sonda mínima de verificación (data source).
# NO se aprovisionan aquí buckets S3, colas SQS/DLQ ni DynamoDB: esos recursos
# de producto corresponden a Fase 4 (F04). No se ejecuta `apply` contra AWS real.

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Backend local: estado en disco dentro de infra/terraform/, sin estado
  # remoto ni cuenta AWS (CA-04, PR-04). `terraform.tfstate` y `.terraform/`
  # quedan excluidos de Git en F00-T05 (hallazgo A-05).
  backend "local" {
    path = "terraform.tfstate"
  }
}
