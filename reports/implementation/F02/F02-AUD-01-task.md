# Tarea `F02-AUD-01` (Addendum) — Contrato interoperable de `POST /jobs` con F03

| Campo | Valor |
|---|---|
| **ID completo** | `F02-AUD-01` (addendum de interoperabilidad, decisión Lino/CTO) |
| **Fase / paquete** | Fase 2 — `docs/sdd/packages/P-02-api-and-worker.md` (addendum) |
| **Prioridad** | `P0` — desbloquea `F03-AUD-01` (HIGH) |
| **Rol implementador / verificadores** | Developer / Tester + Auditor |
| **Harness / Loop** | OpenCode · `v1 — Loop 1/3` |
| **Nivel de riesgo** | `3 (Sensible)` — contrato público y superficie de subida |
| **Estimación / hitos** | 40 min: (1) tests RED del contrato F03, (2) adaptación de `POST /jobs` + presign integrado, (3) integración emulador, (4) verificación. Revisión ≥5 min; diagnóstico a 10 min o >2× estimación. |
| **Procesos** | `npx vitest run tests/unit/api tests/integration/api`, `npm run typecheck`, lint acotado a F02. Timeout 240 s. |

## 1. Fuentes y criterio
- Decisión de Lino/CTO (encargo del addendum) y `reports/audits/F03/F03-auditor.md` `F03-AUD-01` (HIGH): `POST /jobs` debe aceptar `{preset, files:[{fileName, contentType, sizeBytes}]}` y responder 201 `{job, uploads:[{imageId, uploadUrl, method:'PUT', headers?}]}`.
- Cliente de referencia (solo lectura): `frontend/src/api/jobs.ts` (`JobUploadRequest`, `JobUploadPlan`).
- `spec.md` FR-08/FR-09/FR-07, `constitution.md` PR-07/PR-08/IN-07/IN-10; `P-02` §5 `CA-01`/`CA-02`.
- **Criterio del addendum:** interoperabilidad demostrada con el contrato acordado, conservando validación de preset, MIME/tamaño/lote, `userId` del JWT, URLs PUT a `raw/<userId>/<jobId>/<imageId>` y sin secretos.

## 2. Entradas y entorno
- Contratos congelados v1 (`hash 5d0082f8…`): **no modificar el catálogo** salvo que sea imprescindible; preferir tipos locales en `backend/src/api/**` validando con `schemas.*`. Cualquier cambio en `backend/src/contracts/**` exige documentar impacto en la congelación (regeneración de `types.generated.ts` y versión), y está prohibido tocar `frontend/`.
- Reutilizar `PresignService` de `backend/src/storage/**` (inyectado en la app) para generar las PUT URLs dentro de `POST /jobs`; no llama HTTP internas ni duplica firma S3.
- Emulador: `docker compose up -d` con 2 GiB/2.0, `docker cp` de CA/credenciales según runbook, **apagado obligatorio**.

## 3. Ámbito exclusivo
`backend/src/api/**`, `backend/src/contracts/**` (solo si es imprescindible), `tests/unit/api/**`, `tests/integration/api/**`, `reports/implementation/F02/**`, `reports/audits/F02/**`, `reports/verification/F02-architect.md` (addendum append-only).
**Prohibido:** `frontend/`, `infra/terraform/`, `.github/`, `STATE.md`, `docs/sdd/tasks.md`, manifiestos, `backend/src/{worker,storage,db}/**` (salvo consumo de su API pública), push a `main`, secretos o rutas Windows absolutas.

## 4. Método y entregables
- `RED → GREEN → REFACTOR` en `tests/unit/api/**` y `tests/integration/api/**`: caso positivo (201 con `job` + `uploads` para cada archivo, URLs HTTPS PUT verificables con el emulador), negativos (preset inválido, lote vacío/excedido, `sizeBytes` > límite, MIME peligroso/no raster, `fileName` con traversal/NUL/%xx, cuerpo con claves desconocidas), y aislamiento (clave bajo el `userId` del JWT, nunca del cuerpo).
- Evidencia: `evidence/F02-AUD-01-{red,green,refactor,unit,integration,contract-shape,upload-put,emulator-down}.txt`.
- Reporte `F02-AUD-01-developer.md` (7 campos por problema); dictamen `F02-AUD-01-tester.md`; auditoría `reports/audits/F02/F02-AUD-01-auditor.md`; addendum final en `reports/verification/F02-architect.md`.
