# Tarea `F02-T01` — Rutas Hono `/jobs` + adaptador `UserStore` + rate limit

| Campo | Valor |
|---|---|
| **ID completo** | `F02-T01` |
| **Fase / paquete** | Fase 2 — `docs/sdd/packages/P-02-api-and-worker.md` |
| **Prioridad** | `P1` |
| **Rol implementador / verificadores** | Developer / Tester + Auditor |
| **Harness / Loop** | OpenCode · `v1 — Loop 1/3` |
| **Nivel de riesgo** | `3 (Sensible)` — autenticación/aislamiento y API |
| **Estimación / hitos / seguimiento** | 45 min. Hitos: (1) adaptador UserStore, (2) rutas y filtro userId, (3) rate limit no suplantable, (4) verificación. Revisión ≥5 min; diagnóstico a 10 min sin progreso o >2× estimación. Limitación: notificación de inactividad del subagente, sin observación continua. |
| **Procesos** | `npx vitest run tests/unit/api tests/integration/api`, `npm run typecheck`, `npm run lint`. Timeout 240 s. |

## 1. Fuentes y criterio
- `spec.md` §5 (API), FR-08/FR-10/FR-14/FR-21; `plan.md` §3; `docs/architecture/04-*.md` §4; `P-02` §5 `CA-01`.
- **`CA-01`**: rutas `POST /jobs`, `POST /jobs/:id/confirm`, `GET /jobs`, `GET /jobs/:id` con filtro estricto por `userId`; adaptador DynamoDB de `UserStore` (cierra `T03-A-04`); clave de rate limit **no suplantable** (cierra `T03-A-01`); validación con esquemas congelados; sin hallazgos críticos/altos.

## 2. Entradas y entorno
- F01 cerrada: contratos v1 hash `5d0082f8…` (`backend/src/contracts/index.ts`), almacén (`backend/src/db/index.ts`), auth (`backend/src/auth/index.ts`), reglas (`backend/src/domain/index.ts`). **No redefinirlos**.
- **No tocar `backend/src/index.ts`**: crear `backend/src/api/app.ts` con `createApiApp()` que monte `mountAuthRoutes` y las rutas `/jobs`; los tests importan desde ahí. El wiring del servidor se consolidará en F05.
- CTO autorizó `backend/package.json` para dependencias AWS SDK (decisión registrada); **no tocar el `package.json`/`package-lock.json` raíz**.
- Gates: G-1/G-2 aprobados, G-3 sin secretos, G-4 emulador, G-7 con límites y apagado.

## 3. Ámbito exclusivo
`backend/src/api/**`, `backend/src/db/**` **solo** el adaptador `UserStore`, `tests/unit/api/**`, `tests/integration/api/**`, `reports/implementation/F02/evidence/F02-T01-*`, `reports/implementation/F02/F02-T01-developer.md`.
**Prohibido:** `frontend/`, `infra/terraform/`, `.github/`, manifiestos raíz, `STATE.md`, `docs/sdd/tasks.md`, `backend/src/index.ts`, otros módulos de F01, reportes ajenos, push a `main`.

## 4. Método y entregables
- TDD `RED → GREEN → REFACTOR`: 401 sin token, 404 para lote ajeno (cuerpo idéntico al inexistente), creación con preset inválido rechazada, `confirm` idempotente, listado solo del usuario, rate limit por clave **derivada del `userId` autenticado** (no de `x-forwarded-for`/`x-real-ip`).
- Evidencia: `F02-T01-{red,green,refactor,authz,rate-limit,userstore}.txt`.
- Dictamen `F02-T01-tester.md`; auditoría `reports/audits/F02/F02-T01-auditor.md`; cierre `F02-T01-architect.md`.
