# MediaShrink Cloud — Cola principal SQS + DLQ (F04-T02 / CA-02)
#
# Declara dos colas SQS estándar en el emulador:
#   - `mediashrink-jobs`     : cola de trabajo (publicada por POST /jobs/:id/confirm)
#   - `mediashrink-jobs-dlq` : dead-letter queue de la anterior
#
# La cola principal enlaza la DLQ mediante `redrive_policy` INLINE (un atributo
# nativo de `aws_sqs_queue`, soportado por la API SQS del emulador) con
# `maxReceiveCount = 3` (IN-08 / FR-13 / D-09). El worker de F02-T04 además
# reintenta 3 veces por imagen y envía el sobre a la DLQ de forma explícita;
# esta redrive policy es la guarda declarativa de infraestructura equivalente.
#
# Visibilidad: `visibility_timeout_seconds = 120` (2 min) cubre con holgura el
# procesamiento de un lote completo (MAX_IMAGES_PER_BATCH=20) por el worker
# `sharp` antes de que SQS pueda redeliverar el mismo sobre. Con 3 intentos,
# el tiempo máximo hasta DLQ por redrive es 3 x 120 s = 360 s (6 min).
# El intervalo de polling del worker es POLL_INTERVAL_MS=2000 (2 s), muy por
# debajo del timeout, por lo que no solapa recepciones del mismo mensaje.
#
# QueueUrls canónicas: el `id` devuelto por el provider/Emulador conserva el
# host AWS como identificador lógico (`https://sqs.us-east-1.amazonaws.com/
# 000000000000/<cola>`). `AWS_ENDPOINT_URL=:9297` es SOLO transporte; nunca
# se escribe :9324 en ninguna QueueUrl (addendum A-03 de F00-T01).

variable "sqs_queue_name" {
  description = "Nombre de la cola SQS principal de trabajos (SQS_QUEUE_URL)."
  type        = string
  default     = "mediashrink-jobs"
}

variable "sqs_dlq_name" {
  description = "Nombre de la DLQ de la cola principal (SQS_DLQ_URL)."
  type        = string
  default     = "mediashrink-jobs-dlq"
}

variable "sqs_visibility_timeout_seconds" {
  description = <<-EOT
    Segundos que un mensaje recibido queda invisible antes de poder ser
    redeliverado. 120 s (2 min) cubre el procesamiento de un lote de hasta 20
    imagenes con sharp y es muy superior al polling de 2 s del worker. El rango
    admitido por SQS es 0..43200 s.
  EOT
  type        = number
  default     = 120

  validation {
    condition     = var.sqs_visibility_timeout_seconds >= 0 && var.sqs_visibility_timeout_seconds <= 43200
    error_message = "sqs_visibility_timeout_seconds debe estar entre 0 y 43200 (rango SQS)."
  }
}

variable "sqs_max_receive_count" {
  description = <<-EOT
    Numero de recepciones agotadas antes de mover el mensaje a la DLQ.
    Equivale a SQS_MAX_RETRIES=3 de .env.example (IN-08 / FR-13 / D-09).
  EOT
  type        = number
  default     = 3

  validation {
    condition     = var.sqs_max_receive_count >= 1 && var.sqs_max_receive_count <= 1000
    error_message = "sqs_max_receive_count debe estar entre 1 y 1000 (rango SQS)."
  }
}

# DLQ primero: la cola principal necesita su ARN para la redrive policy.
# Se declara el mismo visibility timeout por coherencia operativa (no se
# consume con procesamiento largo, pero mantiene un unico valor documentado).
resource "aws_sqs_queue" "dlq" {
  name                       = var.sqs_dlq_name
  visibility_timeout_seconds = var.sqs_visibility_timeout_seconds
}

# Cola principal con redrive_policy inline hacia la DLQ.
# NOTA DE EMULADOR (evidencia F04-T02-apply.txt, modulo 1): el emulador
#normaliza `maxReceiveCount` a NUMERO en el JSON devuelto por
#GetQueueAttributes (`{"...","maxReceiveCount":3}`). Declararlo como string
#(`tostring`, `"3"`) hace que el waiter de creacion del provider nunca alcance
#el estado 'equal' y agote 3 min de timeout, aunque la politica quede aplicada.
#Se declara por tanto el numero (`var.sqs_max_receive_count = 3`), que coincide
#byte a byte con lo que devuelve el emulador y evita diffs perpetuos de estado.
resource "aws_sqs_queue" "jobs" {
  name                       = var.sqs_queue_name
  visibility_timeout_seconds = var.sqs_visibility_timeout_seconds

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq.arn
    maxReceiveCount     = var.sqs_max_receive_count
  })
}

output "sqs_queue_url" {
  description = "QueueUrl canonica de la cola de trabajos (host AWS como id logico)."
  value       = aws_sqs_queue.jobs.id
}

output "sqs_dlq_url" {
  description = "QueueUrl canonica de la DLQ (host AWS como id logico)."
  value       = aws_sqs_queue.dlq.id
}

output "sqs_queue_arn" {
  description = "ARN de la cola principal."
  value       = aws_sqs_queue.jobs.arn
}

output "sqs_dlq_arn" {
  description = "ARN de la DLQ, referenciado desde la RedrivePolicy de la cola principal."
  value       = aws_sqs_queue.dlq.arn
}

output "sqs_visibility_timeout_seconds" {
  description = "Visibility timeout aplicado a ambas colas (coherente con el reintento del worker)."
  value       = var.sqs_visibility_timeout_seconds
}

output "sqs_max_receive_count" {
  description = "Maximo de recepciones antes de redirigir a la DLQ (SQS_MAX_RETRIES)."
  value       = var.sqs_max_receive_count
}
