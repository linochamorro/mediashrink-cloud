# Sonda mínima de verificación — NO es un recurso de producto.
#
# `terraform plan` necesita refresh de los data sources, por lo que este bloque
# fuerza una llamada real STS:GetCallerIdentity contra el emulador (:9297).
# Con ello se demuestra en vivo que:
#   (1) el provider usa AWS_ENDPOINT_URL y no :9324;
#   (2) las credenciales se leen de los archivos generados por el emulador;
#   (3) el TLS se valida con el ca.pem exportado.
#
# No crea infraestructura (no hay `resource`), por lo que NO sustituye a los
# buckets S3 / SQS+DLQ / DynamoDB de Fase 4 (F04).
data "aws_caller_identity" "emulator" {}
