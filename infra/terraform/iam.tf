# MediaShrink Cloud — IAM de minimo privilegio (F04-T04 / CA-04)
#
# Un unico rol de aplicacion para la API Hono (Lambda) y el worker de
# procesamiento. TODAS las acciones y TODOS los ARNs son concretos y se derivan
# de los recursos declarados en s3.tf / sqs.tf / dynamodb.tf. No hay comodines
# amplios: ningun "Action": "*" ni "Resource": "*". El unico sufijo "/*" aparece
# en ARNs de OBJETO de un bucket NOMBRADO (permiso indispensable para
# PutObject/GetObject/DeleteObject); no es un comodin amplio.
#
# Soporte del emulador VERIFICADO EN VIVO (F04-T04-iam-support.txt):
# `aws_iam_role`, `aws_iam_role_policy` (PutRolePolicy) y `data.aws_iam_role`
# funcionan contra :9297 con credenciales por archivo y CA propio. No se usa
# AWS real. La representacion declarativa (locals/outputs/check) se mantiene
# ademas como fuente unica de verdad y para inspeccion sin llamadas a la API.

variable "iam_role_name" {
  description = "Nombre del rol IAM de la aplicacion (API Hono + worker)."
  type        = string
  default     = "mediashrink-app-role"

  validation {
    condition     = length(var.iam_role_name) >= 1 && length(var.iam_role_name) <= 64
    error_message = "iam_role_name debe tener entre 1 y 64 caracteres (rango IAM)."
  }
}

locals {
  # Confianza: solo el servicio Lambda puede asumir el rol. Sin Principal "*".
  iam_trust_policy = {
    Version = "2012-10-17"
    Statement = [{
      Sid       = "LambdaAssumeRoleOnly"
      Effect    = "Allow"
      Action    = "sts:AssumeRole"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  }

  # Permisos concretos por recurso. Cada Resource se deriva de un recurso HCL;
  # no se repiten nombres literales de bucket/cola/tabla.
  iam_permissions = {
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "S3RawObjectsReadWrite"
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
        Resource = ["${aws_s3_bucket.raw.arn}/*"]
      },
      {
        Sid      = "S3OptimizedObjectsReadWrite"
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
        Resource = ["${aws_s3_bucket.optimized.arn}/*"]
      },
      {
        Sid      = "S3ListOnlyNamedBuckets"
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = [aws_s3_bucket.raw.arn, aws_s3_bucket.optimized.arn]
      },
      {
        Sid    = "SqsJobsAndDlqMessaging"
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:ChangeMessageVisibility",
          "sqs:GetQueueAttributes",
          "sqs:GetQueueUrl",
        ]
        Resource = [aws_sqs_queue.jobs.arn, aws_sqs_queue.dlq.arn]
      },
      {
        Sid    = "DynamoDbJobsTableCrud"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:BatchGetItem",
          "dynamodb:BatchWriteItem",
          "dynamodb:DescribeTable",
        ]
        Resource = [aws_dynamodb_table.jobs.arn]
      },
    ]
  }

  iam_permissions_json = jsonencode(local.iam_permissions)
}

resource "aws_iam_role" "app" {
  name               = var.iam_role_name
  description        = "MediaShrink Cloud API + worker: permisos minimos sobre S3, SQS+DLQ y DynamoDB (F04-T04)."
  assume_role_policy = jsonencode(local.iam_trust_policy)
}

resource "aws_iam_role_policy" "app" {
  name   = "mediashrink-least-privilege"
  role   = aws_iam_role.app.id
  policy = local.iam_permissions_json
}

# Lectura en vivo del rol aprovisionado: prueba de que la API IAM responde en el
# emulador y de que el rol existe con el nombre derivado de la variable.
data "aws_iam_role" "app" {
  name       = aws_iam_role.app.name
  depends_on = [aws_iam_role.app]
}

# Guardias declarativas del minimo privilegio (core Terraform, sin proveedor).
check "iam_no_broad_wildcards" {
  assert {
    condition = alltrue([
      for stmt in local.iam_permissions.Statement : (
        alltrue([for a in flatten([stmt.Action]) : a != "*"]) &&
        alltrue([for r in flatten([stmt.Resource]) : r != "*"])
      )
    ])
    error_message = "Ninguna politica IAM puede usar Action \"*\" ni Resource \"*\" (CA-04)."
  }
}

check "iam_arns_derived_from_resources" {
  assert {
    condition = alltrue([
      for stmt in local.iam_permissions.Statement :
      alltrue([for r in flatten([stmt.Resource]) : (
        strcontains(r, aws_s3_bucket.raw.arn) ||
        strcontains(r, aws_s3_bucket.optimized.arn) ||
        strcontains(r, aws_sqs_queue.jobs.arn) ||
        strcontains(r, aws_sqs_queue.dlq.arn) ||
        strcontains(r, aws_dynamodb_table.jobs.arn)
      )])
    ])
    error_message = "Todo ARN de la politica debe derivarse de un recurso declarado (sin ARNs literales)."
  }
}

check "iam_trust_no_wildcard_principal" {
  assert {
    condition     = length(local.iam_trust_policy.Statement) == 1 && local.iam_trust_policy.Statement[0].Principal.Service == "lambda.amazonaws.com"
    error_message = "Solo lambda.amazonaws.com puede asumir el rol (sin Principal \"*\")."
  }
}

output "iam_role_name" {
  description = "Nombre del rol IAM de la aplicacion (verificado en vivo con data.aws_iam_role)."
  value       = aws_iam_role.app.name
}

output "iam_role_arn" {
  description = "ARN del rol IAM de la aplicacion."
  value       = aws_iam_role.app.arn
}

output "iam_inline_policy" {
  description = "Politica inline de minimo privilegio aplicada al rol (representacion declarativa)."
  value       = jsondecode(local.iam_permissions_json)
}

output "iam_trust_policy" {
  description = "Politica de confianza del rol: solo lambda.amazonaws.com."
  value       = local.iam_trust_policy
}
