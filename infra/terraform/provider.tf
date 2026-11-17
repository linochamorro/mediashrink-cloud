# Provider AWS apuntando EXCLUSIVAMENTE al emulador local (CA-04, PR-04).
# Sin acceso a AWS real: endpoint local, credenciales por archivo generadas,
# CA propio y desactivación de validaciones que exigirían la nube real.

provider "aws" {
  region = var.aws_region

  # Credenciales POR ARCHIVO, generadas por el emulador en cada arranque.
  # No se declaran access_key/secret_key fijos (G-3, hallazgo A-03 cerrado).
  shared_credentials_files = [var.aws_shared_credentials_file]
  shared_config_files      = [var.aws_config_file]

  # Un único transporte HTTPS para S3, SQS, DynamoDB y STS. No existe :9324.
  # El host de las QueueUrls canónicas de SQS es un identificador lógico;
  # el tráfico se enruta a este endpoint (useQueueUrlAsEndpoint:false en el SDK).
  endpoints {
    s3       = var.aws_endpoint_url
    sqs      = var.aws_endpoint_url
    dynamodb = var.aws_endpoint_url
    sts      = var.aws_endpoint_url
  }

  # El emulador no ofrece IMDS ni validación de credenciales contra AWS real.
  # AWS_EC2_METADATA_DISABLED=true se exporta además en el entorno del comando
  # (defensa en profundidad; ver README.md).
  skip_credentials_validation = true
  skip_requesting_account_id  = true
  skip_metadata_api_check     = true

  # TLS con el CA autofirmado regenerado por el emulador en cada arranque.
  custom_ca_bundle = var.ca_bundle_path
}
