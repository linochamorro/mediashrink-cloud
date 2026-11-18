# Tarea `F02-T05` — Descarga individual/ZIP y borrado de lote

| Campo | Valor |
|---|---|
| **ID completo** | `F02-T05` |
| **Fase / paquete** | Fase 2 — `docs/sdd/packages/P-02-api-and-worker.md` |
| **Prioridad** | `P1` |
| **Rol implementador / verificadores** | Developer / Tester + Auditor |
| **Harness / Loop** | OpenCode · `v1 — Loop 1/3` |
| **Nivel de riesgo** | `2 (Relevante)` |
| **Estimación / hitos** | 40 min: (1) descarga individual, (2) ZIP, (3) DELETE, (4) verificación. Revisión ≥5 min; diagnóstico a 10 min o >2× estimación. |
| **Procesos** | `npx vitest run tests/integration/api`, `npm run typecheck`, `npm run lint`. Timeout 240 s. |

## 1. Fuentes y criterio
- `spec.md` FR-17/FR-18/FR-19, A-05 (ZIP optimizadas + miniaturas); `plan.md` §3.3; `constitution.md` IN-03/IN-04/PR-07; `P-02` §5 `CA-05`.
- **`CA-05`**: `GET /jobs/:id/download/:imageId` y `GET /jobs/:id/download.zip` con optimizadas (WebP+AVIF) y miniaturas del lote; `DELETE /jobs/:id` borra S3 `raw`+`optimized` y la fila DynamoDB; **aislamiento por `userId`** en todas las operaciones.

## 2. Entradas y entorno
- Depende de `F02-T02` PASSED; usa el servicio de storage y el almacén de F01. **No modificar manifiestos** (T02 los declaró).
- ZIP generado en memoria a partir de objetos de `optimized` (incluye miniaturas WebP), sin archivos temporales persistentes; sin pasar binarios por la API salvo la respuesta final.

## 3. Ámbito exclusivo
`backend/src/api/**`, `backend/src/storage/**`, `tests/unit/api/**`, `tests/integration/api/**`, `reports/implementation/F02/evidence/F02-T05-*`, `reports/implementation/F02/F02-T05-developer.md`.
**Prohibido:** manifiestos, frontend, IaC, `.github/`, `STATE.md`, `tasks.md`, push a `main`.

## 4. Método y entregables
- TDD: descarga individual solo del usuario (404 para ajeno), ZIP con la forma acordada, DELETE elimina objetos y registro y es idempotente/seguro, verificación en emulador con `docker compose down` al terminar.
- Evidencia: `F02-T05-{red,green,refactor,individual,zip,delete,emulator-down}.txt`.
- Dictamen `F02-T05-tester.md`; auditoría `reports/audits/F02/F02-T05-auditor.md`; cierre `F02-T05-architect.md`.
