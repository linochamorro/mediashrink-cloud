# P-04 — Infraestructura Terraform completa y CI de integración (`infra/terraform/`, `.github/`)

- **Estado:** CERRADO (`FASE_COMPLETA`, revisado por CTO el 2026-11-18)
- **Fase del roadmap:** Fase 4 (`docs/sdd/tasks.md`) — Paralela con `F02` y `F03`
- **Prioridad:** P1
- **Harness asignado:** Harness 3 (o secuencial tras `F02`/`F03` si se usa un solo harness)
- **Coordinación:** Architect de fase (retorna a CTO) · Roles: Developer, Tester, Auditor (Riesgo 2–3)

## 1. Objetivo y resultado verificable
Completar la definición declarativa en `infra/terraform/` para aprovisionar en `aws/aws-emulator` los dos buckets S3 (`raw` y `optimized` con ciclo de vida de `RETENTION_DAYS = 30` días alineado con DynamoDB `T02-A-01`), cola SQS + DLQ (`maxReceiveCount = 3`), tabla DynamoDB (`userId`/`jobId` + TTL 30 días), políticas IAM/CORS para la SPA (separando/condicionando flags `skip_*` de bootstrap para no heredarlos a entorno real `T04-A-03`), y ampliar `.github/workflows/` con el job de integración que levanta `aws/aws-emulator`, ejecuta `terraform apply` y valida recursos sin coste.

## 2. Dependencias y gates de entrada (Checklist DoR)
- **Contratos previos:** `F00-T04` (bootstrap Terraform) y `F01` cerradas.
- **G-2 Apertura de fase:** pendiente de autorización expresa de Lino.
- **G-6 / G-6b / G-7:** autorizados (`aws/aws-emulator` con `--memory=2g --cpus="2.0"`, apagar al terminar).

## 3. Ámbito exclusivo de archivos (sin colisión con `F02`/`F03`)
| Área | Rutas de escritura exclusivas | Rol propietario | ¿Compartido? |
|---|---|---|---|
| IaC Terraform | `infra/terraform/**` | Developer | **No** |
| CI / Workflows | `.github/workflows/**` | Developer | **No** |
| Pruebas IaC | `tests/integration/infra/**` | Developer | **No** |
| Reportes | `reports/implementation/F04/**`, `reports/audits/F04/**`, `reports/verification/F04-architect.md` | Todos los roles | **No** |

**PROHIBIDO en `P-04`:** escribir en `frontend/`, `backend/`, `package.json`/`package-lock.json` raíz, `STATE.md` o `docs/sdd/tasks.md` (CTO consolida al retorno).

## 4. Tareas de la fase
| ID | Tarea | Depende de | Rol | Riesgo | Criterios |
|---|---|---|---|---|---|
| `F04-T01` | Buckets S3 `raw` y `optimized` con ciclo de vida 30 días (`RETENTION_DAYS`, `T02-A-01`) y sin bucles de eventos | `F00-T04` | Developer | 2 | `CA-01` |
| `F04-T02` | Cola SQS + DLQ con `maxReceiveCount = 3` y política de visibilidad | `F04-T01` | Developer | 2 | `CA-02` |
| `F04-T03` | Tabla DynamoDB `mediashrink-jobs` (`userId`/`jobId`, TTL 30 días) + tabla usuarios si aplica | `F04-T01` | Developer | 2 | `CA-03` |
| `F04-T04` | Políticas IAM de mínimo privilegio, CORS explícito para SPA y separación de flags `skip_*` (`T04-A-03`) | `F04-T01` | Developer (+ Auditor) | 3 | `CA-04` |
| `F04-T05` | Workflow CI de integración contra `aws/aws-emulator` + `terraform apply` + test en `tests/integration/infra/` | `F00-T06`, `F04-T02`, `F04-T03` | Developer (+ Auditor) | 2 | `CA-05` |

## 5. Condiciones de cierre (DoD)
- `F04-T01`..`F04-T05` con `PASSED` de Tester (`terraform fmt`/`validate`/`apply` contra emulador + CI verde).
- Auditorías en `reports/audits/F04/` sin hallazgos `CRITICAL`/`HIGH`.
- Docker apagado tras pruebas; `reports/verification/F04-architect.md` entregado al CTO.
