# Salidas del bootstrap: solo metadatos no sensibles del emulador.

output "emulator_endpoint" {
  description = "Transporte HTTPS usado por el provider (AWS_ENDPOINT_URL)."
  value       = var.aws_endpoint_url
}

output "authenticated_account_id" {
  description = "Cuenta devuelta por STS:GetCallerIdentity del emulador (sonda de verificación)."
  value       = data.aws_caller_identity.emulator.account_id
}

output "provider_region" {
  description = "Región usada por el provider (us-east-1)."
  value       = var.aws_region
}
