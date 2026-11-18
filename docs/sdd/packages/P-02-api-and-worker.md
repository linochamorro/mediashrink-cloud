# P-02 — API Hono y Worker de procesamiento (`sharp` + S3 + SQS/DLQ)

- **Estado:** CERRADO (`FASE_COMPLETA`, revisado por CTO el 2026-11-18)
- **Fase del roadmap:** Fase 2 (`docs/sdd/tasks.md`) — Paralela con `F03`
- **Prioridad:** P1
- **Harness asignado:** OpenCode
- **Coordinación:** Architect de fase (retorna a CTO) · Roles: Developer, Tester, Auditor (obligatorio por Riesgo 3)

## 1. Objetivo y resultado verificable
Implementar la API HTTP completa en Hono (`POST /jobs`, `POST /jobs/:id/confirm`, `GET /jobs`, `GET /jobs/:id`, `GET /jobs/:id/download/:imageId`, `GET /jobs/:id/download.zip`, `DELETE /jobs/:id`), el adaptador DynamoDB de `UserStore` (`T03-A-04`), la corrección de clave de rate-limiting no suplantable (`T03-A-01`), y el worker/Lambda SQS + `sharp` (WebP + AVIF + miniatura WebP, eliminación total de metadatos EXIF/GPS, guarda de tamaño previa al escaneo `A-05`, 3 reintentos + DLQ sin abortar lote y métricas reales en DynamoDB), todo verificado bajo TDD e integración real contra `aws/aws-emulator`.

## 2. Dependencias y gates de entrada (Checklist DoR)
- **Contratos previos:** `F01` cerrada (`FASE_COMPLETA`); `backend/src/contracts/**` y `frontend/src/api/types.generated.ts` congelados.
- **G-2 Apertura de fase:** pendiente de autorización expresa de Lino.
- **G-3 / G-4 / G-7:** autorizados (`aws/aws-emulator` con `--memory=2g --cpus="2.0"`, apagar al terminar).

## 3. Ámbito exclusivo de archivos (sin colisión con `F03`/`F04`)
| Área | Rutas de escritura exclusivas | Rol propietario | ¿Compartido? |
|---|---|---|---|
| Backend API y Worker | `backend/src/api/**`, `backend/src/worker/**`, `backend/src/storage/**`, `backend/src/db/**` (solo adaptador `UserStore`) | Developer | **No** |
| Pruebas | `tests/unit/api/**`, `tests/unit/worker/**`, `tests/integration/api/**`, `tests/integration/worker/**` | Developer | **No** |
| Reportes | `reports/implementation/F02/**`, `reports/audits/F02/**`, `reports/verification/F02-architect.md` | Todos los roles | **No** |

**PROHIBIDO en `P-02`:** escribir en `frontend/`, `infra/terraform/`, `.github/`, `package.json`/`package-lock.json` raíz, `STATE.md` o `docs/sdd/tasks.md` (CTO consolida `STATE.md`/`tasks.md` al retorno).

## 4. Tareas de la fase
| ID | Tarea | Depende de | Rol | Riesgo | Criterios |
|---|---|---|---|---|---|
| `F02-T01` | Rutas Hono `/jobs`, `POST /jobs/:id/confirm`, `GET /jobs`, `GET /jobs/:id` con filtro `userId` + adaptador DynamoDB `UserStore` (`T03-A-04`) + rate-limit no suplantable (`T03-A-01`) | `F01` | Developer (+ Auditor) | 3 | `CA-01` |
| `F02-T02` | Servicio S3 Presigned URLs (`raw` PUT y `optimized` GET) + pruebas integración en `aws/aws-emulator` | `F02-T01` | Developer | 2 | `CA-02` |
| `F02-T03` | Worker `sharp`: WebP + AVIF + miniatura WebP, guarda de tamaño antes de escanear (`A-05`), strip total EXIF/GPS (`exifStripped: true`) | `F01-T05` | Developer (+ Auditor) | 3 | `CA-03` |
| `F02-T04` | Consumidor SQS + DLQ (3 reintentos, envío a DLQ, imagen `FAILED` sin abortar lote) | `F02-T03` | Developer (+ Auditor) | 3 | `CA-04` |
| `F02-T05` | Descarga individual + ZIP (`optimized` + miniaturas, `A-05`) + `DELETE /jobs/:id` (S3 `raw`+`optimized` + DynamoDB) | `F02-T02` | Developer (+ Auditor) | 2 | `CA-05` |
| `F02-T06` | Actualización de métricas reales en DynamoDB (`bytesBefore`, `bytesAfter`, `savingsPct`, `exifStripped`) e integración E2E de backend | `F02-T03`, `F02-T04` | Developer | 2 | `CA-06` |

## 5. Condiciones de cierre (DoD)
- `F02-T01`..`F02-T06` con `PASSED` de Tester y auditorías de Riesgo 2–3 en `reports/audits/F02/` sin `CRITICAL`/`HIGH`.
- Docker apagado al terminar pruebas; `reports/verification/F02-architect.md` entregado al CTO.
