# Provider AWS — interruptor unico de entorno (F04-T04 / CA-04 / T04-A-03).
#
# `var.is_emulator` (default true) es la UNICA fuente de verdad de las
# excepciones necesarias para trabajar sin cuenta AWS. Con `true` el provider
# apunta al emulador :9297, lee credenciales de los archivos efimeros generados,
# valida TLS con el CA propio y desactiva las tres comprobaciones que exigirian
# la nube real. Con `false` TODAS esas excepciones desaparecen y se usa la cadena
# estandar de credenciales/endpoint de AWS. Ningun flag skip_* se hereda a un
# entorno real (procedimiento documentado en README.md §"AWS real").

provider "aws" {
  region = var.aws_region

  # Credenciales POR ARCHIVO solo en el emulador; se generan en cada arranque y
  # se exportan con `docker cp` (runbook §1.3). Lista vacia en AWS real => se
  # usa la cadena estandar (env / shared config / instance profile). No se
  # declaran access_key/secret_key fijos (G-3, hallazgo A-03 cerrado).
  shared_credentials_files = var.is_emulator ? [var.aws_shared_credentials_file] : []
  shared_config_files      = var.is_emulator ? [var.aws_config_file] : []

  # Unico transporte HTTPS para S3, SQS, DynamoDB y STS. Bloque dinamico: solo
  # existe cuando is_emulator=true; en AWS real no se fuerza ningun endpoint.
  # No existe :9324. El host de las QueueUrls canonicas de SQS es un
  # identificador logico; el trafico se enruta a este endpoint
  # (useQueueUrlAsEndpoint:false en el SDK).
  dynamic "endpoints" {
    for_each = var.is_emulator ? [1] : []

    content {
      s3       = var.aws_endpoint_url
      sqs      = var.aws_endpoint_url
      dynamodb = var.aws_endpoint_url
      sts      = var.aws_endpoint_url
    }
  }

  # T04-A-03: los tres flags se CONDICIONAN al emulador. El emulador no ofrece
  # IMDS ni validacion de credenciales contra AWS real; en produccion deben ser
  # false para no omitir comprobaciones de seguridad del provider.
  skip_credentials_validation = var.is_emulator
  skip_requesting_account_id  = var.is_emulator
  skip_metadata_api_check     = var.is_emulator

  # TLS con el CA autofirmado regenerado por el emulador en cada arranque.
  # `null` en AWS real => se emplea el almacen de confianza del sistema.
  custom_ca_bundle = var.is_emulator ? var.ca_bundle_path : null
}
