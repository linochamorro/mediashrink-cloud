# Tarea `F00-T04` — Bootstrap Terraform contra el emulador local

| Campo | Valor |
|---|---|
| **ID completo** | `F00-T04` |
| **Fase y paquete** | Fase 0 — `docs/sdd/packages/P-00-foundation-and-emulator.md` |
| **Prioridad** | `P0` |
| **Rol implementador** | `Developer` |
| **Rol verificador** | `Tester` + `Auditor` |
| **Harness** | OpenCode |
| **Versión / Loop actual** | `v1 — Loop 1/3` |
| **Nivel de riesgo** | `2 (Relevante)` |
| **Excepción metodológica** | `Ninguna` |
| **Estimación / hitos / seguimiento** | Estimación 30 min. Hitos: (1) provider/backend local, (2) variables desde `.env.example`, (3) `init`/`validate`, (4) `plan`. Revisión ≥5 min; diagnóstico a 10 min sin progreso o >2× estimación. |
| **Procesos y verificación proporcional** | `terraform init`, `terraform validate`, `terraform plan`. Timeout 180 s por comando. **Observación de Architect:** no se encontró `terraform` en PATH ni en rutas habituales; el implementador debe localizarlo/instalarlo bajo G-8. Sin binario, no hay `PASSED`: Tester emitirá `NEEDS_CONTEXT`. Nunca `terraform apply` contra AWS real. |

## 1. Fuentes aprobadas y criterios de aceptación
- **Requisitos:** `ADR-001` Decisión 4, `NFR-01`, `constitution.md` PR-04, `plan.md` §6, `P-00` §5 `CA-04`.
- **Criterios asignados:**
  - `CA-04`: `terraform init`, `validate` y `plan` pasan en `infra/terraform/` sin acceso a AWS real; el provider apunta al emulador local; backend local; sin secretos en archivos ni salidas.

## 2. Entradas, contratos y entorno
- **Revisión previa:** `F00-T03` debe estar `PASSED` (emulador disponible). Esta fase es solo bootstrap: buckets/colas/tabla completas se dejan a F04; no inventar recursos de producto.
- **Gates:** G-1, G-2, G-8 resueltos; G-5 no aplica; G-7 solo si el plan requiere emulador encendido (apagar al terminar).

## 3. Ámbito exclusivo de archivos y límites
- **Escritura permitida:** `infra/terraform/**`, `reports/implementation/F00/evidence/F00-T04-*`.
- **Prohibido tocar:** `docker-compose.yml`, `frontend/**`, `backend/**`, `.github/**`, `STATE.md`, `tasks.md`. Prohibido `apply` a AWS real o guardar `terraform.tfstate` con secretos.

## 4. Método exigido y entregables
- **Método:** comandos declarados + criterio documental (IaC), sin TDD de producto.
- **Reporte:** `F00-T04-developer.md`. **Evidencia:** `evidence/F00-T04-init.txt`, `F00-T04-validate.txt`, `F00-T04-plan.txt`.
- **Dictamen:** `F00-T04-tester.md`. **Auditoría:** `reports/audits/F00/F00-T04-auditor.md`. **Cierre:** `F00-T04-architect.md`.

## 5. Nota de reanudación (CTO, Opción A)
Terraform 1.17.2 instalado pero **fuera de PATH**: `D:\Programs\DevApps\DevOps\Terraform\CLI\terraform.exe` (anteponer ese directorio a `$env:PATH` o usar ruta absoluta). Docker CLI: `D:\Programs\DevApps\Containers\Docker\Desktop\resources\bin\docker.exe` (daemon activo). El addendum A-03 de `F00-T01` ya fijó `.env.example`: sin `:9324`, SQS con host AWS canónico y `AWS_ENDPOINT_URL=https://127.0.0.1:9297` como transporte, credenciales por `AWS_SHARED_CREDENTIALS_FILE`/`AWS_CONFIG_FILE`. Terraform debe consumir `AWS_ENDPOINT_URL` y **no** heredarse `:9324`. Nunca `terraform apply` contra AWS real; solo `init`/`validate`/`plan` contra el emulador. Si se levanta el emulador, usar límites 2g/2.0 y apagarlo con `docker compose down`.
