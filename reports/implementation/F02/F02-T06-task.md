# Tarea `F02-T06` — Métricas reales e integración backend completa

| Campo | Valor |
|---|---|
| **ID completo** | `F02-T06` |
| **Fase / paquete** | Fase 2 — `docs/sdd/packages/P-02-api-and-worker.md` |
| **Prioridad** | `P1` |
| **Rol implementador / verificadores** | Developer / Tester + Auditor |
| **Harness / Loop** | OpenCode · `v1 — Loop 1/3` |
| **Nivel de riesgo** | `2 (Relevante)` |
| **Estimación / hitos** | 40 min: (1) métricas reales, (2) estados, (3) integración E2E backend, (4) verificación. Revisión ≥5 min; diagnóstico a 10 min o >2× estimación. |
| **Procesos** | `npx vitest run tests/integration/api tests/integration/worker`, `npm run typecheck`, `npm run lint`. Timeout 300 s. |

## 1. Fuentes y criterio
- `spec.md` FR-12/FR-14, PR-12; `constitution.md` PR-12/IN-08; `P-02` §5 `CA-06`.
- **`CA-06`**: al completar el job se persisten `bytesBefore`, `bytesAfter`, `savingsPct` y `exifStripped` con bytes reales (0 % y negativos permitidos, sin ocultar), estados coherentes (`COMPLETED`/`PARTIAL`/`FAILED`) e integración E2E del backend (create → presign → confirm → worker → métricas → consulta) contra el emulador.

## 2. Entradas y entorno
- Depende de `F02-T03` y `F02-T04` PASSED; usa la app de `backend/src/api/app.ts` con `app.request()` para E2E en memoria. **No modificar manifiestos ni `backend/src/index.ts`.**
- Flujo E2E sin UI (F03) ni Terraform completo (F04); el emulador sirve S3/SQS/DynamoDB en `:9297` y se apaga al terminar.

## 3. Ámbito exclusivo
`backend/src/api/**`, `backend/src/worker/**`, `tests/integration/api/**`, `tests/integration/worker/**`, `reports/implementation/F02/evidence/F02-T06-*`, `reports/implementation/F02/F02-T06-developer.md`.
**Prohibido:** manifiestos, frontend, IaC, `.github/`, `STATE.md`, `tasks.md`, push a `main`.

## 4. Método y entregables
- TDD/integración: métricas calculadas con bytes reales de S3 (no estimados), coherencia Zod `savings-coherence`, `exifStripped: true` solo si el strip se ejecutó, `PARTIAL` si hay imagen `FAILED`; flujo completo verde en el emulador.
- Evidencia: `F02-T06-{red,green,refactor,metrics,states,e2e,emulator-down}.txt`.
- Dictamen `F02-T06-tester.md`; auditoría `reports/audits/F02/F02-T06-auditor.md`; cierre `F02-T06-architect.md`.
