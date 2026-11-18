# Cierre de tarea (Architect) — `F02-T01`

| Campo | Valor |
|---|---|
| **Tarea** | `F02-T01` — Rutas Hono `/jobs` + `UserStore` + rate limit no suplantable |
| **Fase / paquete** | Fase 2 — `docs/sdd/packages/P-02-api-and-worker.md` |
| **Versión / Loop usado** | `v1` (PASSED) → **`v2 — Loop 2/3`** (correctivo, sin loop 3) |
| **Rol implementador / verificadores** | Developer / Tester + Auditor (riesgo 3 sensible) |
| **Dictamen Tester** | **`PASSED`** en v1 (31/31) y en addendum de loop 2 (36/36, concurrencia 1 publicación) |
| **Dictamen Auditor** | **`READY_WITH_CONCERNS`** en v1 y addendum: A-01/A-02 cerrados por corrección, 0 CRITICAL/HIGH, sin bloqueantes |
| **Estado de la tarea** | `CERRADA — PASSED (loop 2/3)` |

## 1. Revisión de aceptación reforzada (METHODOLOGY.md §3.2)

| Requisito / fuente superior | Comportamiento observable | Evidencia | Límite de cobertura | Estado |
|---|---|---|---|---|
| `CA-01` (P-02 §5) · rutas `/jobs` con filtro `userId` | Tester v1: 401 antes que el limitador, 404 indistinto para ajeno/inexistente, `POST /jobs` con esquemas congelados y métricas 0/0/0, `confirm` idempotente, listado solo del usuario; 7/7 integración real | `F02-T01-tester-{api,authz,unit}.txt` | Servidor real se cablea en F05 | **CUMPLIDO** |
| T03-A-01 · rate limit no suplantable | Clave = `userId` del token en `/jobs`; `NonSpoofableAuthLimiter` con principal fijado en `/auth`; `x-forwarded-for`/`x-real-ip` sin efecto; fail-closed | `F02-T01-tester-rate-limit.txt`; auditoría | Cubo global `auth:anonimo` derivado a F05 (A-03) | **CUMPLIDO** |
| T03-A-04 · adaptador `UserStore` | Archivo nuevo `backend/src/db/user-store-adapter.ts`, `TransactWriteCommand` condicional, `schemas.AuthenticatedUser` | `F02-T01-tester-userstore.txt`; auditoría | `409` vs `201` permite enumerar correos (A-04, heredado F01) | **CUMPLIDO** |
| A-01 (Auditor) · idempotencia bajo concurrencia | `backend/src/api/job-transition.ts` con `ConditionExpression: '#status = :from'`; perdedor obtiene `JobAlreadyConfirmedError` y responde sin publicar; prueba real: **1 sola publicación** | `F02-T01-tester-loop2-{concurrency,api}.txt`; auditoría addendum | `git diff` confirma que `backend/src/db/job-store.ts` no se tocó | **CUMPLIDO (loop 2/3)** |
| A-02 (Auditor) · rollback robusto | `PUBLISH_FAILED` (reversión ok) y `CONFIRM_INCONSISTENT` (reversión fallida, sin `confirmed`) → 503; cubierto en unit e integración | `F02-T01-tester-loop2-rollback.txt`; auditoría addendum | Tras `CONFIRM_INCONSISTENT`, reintento responde `confirmed: true` (at-most-once): seguimiento para T04/T06 | **CUMPLIDO (loop 2/3)** |
| Ámbito anti-colisión | Sin tocar `backend/src/index.ts`, módulos F01, manifiestos, frontend, IaC, `STATE.md`, `tasks.md`; sin push; Docker apagado | `F02-T01-tester-{scope,down}.txt`, `loop2-scope.txt` | Lint global rojo por F03 (paralelo), interferencia externa no aceptada | **CUMPLIDO** |

**Conclusión:** `CA-01` satisfecho. Los dos MEDIUM del Auditor se corrigieron en el loop 2 y fueron reverificados por Tester y Auditor; no quedan hallazgos MEDIUM abiertos de F02-T01. No hay `PASSED` condicional ni G-10.

## 2. Problemas y disposición

| ID | Disposición |
|---|---|
| `A-01` / `A-02` | **CERRADOS por corrección** en loop 2/3; transición condicional en `backend/src/api/**` (decisión de capa documentada por no poder tocar `backend/src/db/job-store.ts`) |
| Seguimiento de A-02 | `CONFIRM_INCONSISTENT` señaliza pero no repara: at-most-once en reintento; marcador duradero a decidir en T04/T06 |
| `A-03` — cubo global `auth:anonimo` | **Derivado a F05** (wiring de producción), no bloqueante |
| `A-04` — enumeración de correos (409 vs 201) | Heredado de F01, no regresión de F02; seguimiento |
| `A-05` — métricas 0/0/0 pendientes | T06 debe publicar métricas reales (PR-12) |
| `A-06` — lint global F03 | Interferencia externa; lint acotado a F02 en verde |

Cronología v1 RED (24 fallos por comportamiento) → GREEN → REFACTOR; loop 2 RED (2 fallos: doble publicación y 500) → GREEN 36/36, revisadas como registro.

## 3. Cobertura y cierre

- `F02-T01` queda **`CERRADA — PASSED (loop 2/3)`**. No se actualizan `STATE.md` ni `docs/sdd/tasks.md` (CTO consolida al retorno; regla anti-colisión). Habilita `F02-T02` (presign S3). Se recomienda a T04 usar `processImage` (no `renderWithSharp`) y considerar el seguimiento de `CONFIRM_INCONSISTENT`.
