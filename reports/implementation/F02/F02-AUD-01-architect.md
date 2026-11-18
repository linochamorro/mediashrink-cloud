# Cierre de tarea (Architect) — `F02-AUD-01`

| Campo | Valor |
|---|---|
| **Tarea** | `F02-AUD-01` — Addendum de interoperabilidad `POST /jobs` ↔ F03 |
| **Fase / paquete** | Fase 2 — addendum a `docs/sdd/packages/P-02-api-and-worker.md` |
| **Versión / Loop usado** | `v1 — Loop 1/3` |
| **Rol implementador / verificadores** | Developer / Tester + Auditor (riesgo 3) |
| **Dictamen Tester** | **`PASSED`** (`F02-AUD-01-tester.md`: contrato exacto, 2 PUT reales con `HeadObject`, 34/34 sonda negra, 275/275 unit, 29/29 integración) |
| **Dictamen Auditor** | **`READY_WITH_CONCERNS`** (`F02-AUD-01-auditor.md`: 0 HIGH/MEDIUM, sin bloqueantes; **F03-AUD-01 resuelto**) |
| **Estado de la tarea** | `CERRADA — PASSED` |

## 1. Revisión de aceptación reforzada (METHODOLOGY.md §3.2)

| Requisito / fuente superior | Comportamiento observable | Evidencia | Límite de cobertura | Estado |
|---|---|---|---|---|
| Decisión Lino/CTO y `F03-AUD-01` (HIGH) · forma del contrato | Request `{preset, files:[{fileName, contentType, sizeBytes}]}` → 201 `{job, uploads:[{imageId, uploadUrl, method:'PUT'}]}`, campo por campo idéntico a `JobUploadRequest`/`JobUploadPlan` de `frontend/src/api/jobs.ts` | `F02-AUD-01-tester-contract-shape.txt`, `F02-AUD-01-tester.md` | `headers?` opcional correctamente omitido | **CUMPLIDO** |
| FR-08/FR-09 · PUT a `raw/<userId>/<jobId>/<imageId>` | 2 URLs usadas para PUT directo → 200; `HeadObject` confirma `ContentLength` exacto en ambas claves; URL HTTPS sin `bucket`/`key`/`expires*` | `F02-AUD-01-tester-upload-put.txt` | Emulador local, sin AWS real | **CUMPLIDO** |
| PR-07/IN-07/IN-10 · validación | `userId` del JWT; `imageId` `randomUUID` no derivado de `fileName`; MIME raster (JPEG/PNG/WebP/AVIF), SVG/GIF/PDF rechazados; `sizeBytes` y lote desde config; claves desconocidas → 400 | `F02-AUD-01-tester.md` (negativos y suplantación) | A-02 del Auditor: `contentType`/`sizeBytes` no vinculados a la firma PUT (LOW, seguimiento F04/F05) | **CUMPLIDO** |
| Congelación y anti-colisión | Hash `5d0082f8…68d626d` intacto, `contracts/**` y `types.generated.ts` sin cambios; `frontend/`, `infra/`, `.github/`, `STATE.md`, `tasks.md`, manifiestos intactos; sin push (`HEAD=origin/main=469888b…`) | `F02-AUD-01-tester.md` (mtimes + Git), auditoría A-03 | Auditor no pudo verificar Git por frontera de rol; Tester sí | **CUMPLIDO** |
| Sin regresión y G-7 | 275/275 unit, 29/29 integración, typecheck/lint acotados exit 0; emulador 2 GiB/2.0 CPUs, `docker cp`, `down` → `docker ps -a` vacío y `:9297` cerrado | `F02-AUD-01-tester-{unit,integration,emulator-down}.txt` | Lint global ajeno a F02 (F03 paralelo) | **CUMPLIDO** |

**Conclusión:** el addendum satisface su objetivo: el servidor F02 adopta el acuerdo acordado y `F03-AUD-01` (HIGH) queda resuelto en el plano del contrato y de la implementación, con dictamen funcional `PASSED` y auditoría sin bloqueantes. No se modificaron contratos congelados ni artefactos de F03.

## 2. Problemas y disposición

| ID | Clasificación | Disposición |
|---|---|---|
| `F03-AUD-01` — divergencia `images`/`{job}` vs `files`/`{job, uploads}` | HIGH (F03) | **RESUELTO** por adopción del acuerdo; debe registrarse en el expediente F03 por el responsable de esa fase |
| A-02 — `contentType`/`sizeBytes` no vinculados a la firma PUT | LOW | Seguimiento a F04/F05 (limitación del patrón presigned PUT), sin G-10 |
| A-03 — verificación de "sin push" | INFO | Confirmada por Tester (Auditor la registró como limitación de rol) |
| P-3 — unificación de fixtures de T06 | INFO | Seguimiento documental, no bloqueante |

Los tres problemas del reporte del Developer están documentados con sus 7 campos. Cronología RED (7 fallos por comportamiento) → GREEN 103/103 → REFACTOR 103/103, revisada como registro por el Tester, sin reejecutar invirtiendo código.

## 3. Cobertura y cierre

- `F02-AUD-01` queda **`CERRADA — PASSED`**. Se actualiza el expediente de fase únicamente con el addendum append-only en `reports/verification/F02-architect.md`.
- No se tocan `STATE.md` ni `docs/sdd/tasks.md` (CTO consolida); no se hace push; Docker apagado.
