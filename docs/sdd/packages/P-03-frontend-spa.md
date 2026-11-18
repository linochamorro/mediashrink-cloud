# P-03 — SPA Frontend en Vite + React + TypeScript (`frontend/`)

- **Estado:** CERRADO (`PASSED` tras reapertura acotada; `F03-AUD-01` `RESOLVED`; revisado por CTO el 2026-11-18)
- **Fase del roadmap:** Fase 3 (`docs/sdd/tasks.md`) — Paralela con `F02`
- **Prioridad:** P1
- **Harness asignado:** Codex
- **Coordinación:** Architect de fase (retorna a CTO) · Roles: Designer, Tester, Auditor (Riesgo 2 en cierre)

## 1. Objetivo y resultado verificable
Implementar la interfaz web completa en español sobre `frontend/` consumiendo únicamente los contratos congelados en `frontend/src/api/types.generated.ts`: tema Claro por defecto con selector persistente Claro/Dark (`A-01`), flujos de registro/login/refresh JWT, carga por *drag & drop* con 3 presets (`HIGH`/`BALANCED`/`MAX_COMPRESSION`) y validación previa en cliente, polling cada ~2 s (`GET /jobs/:id`), comparativa visual *antes vs. después* y tabla de métricas reales (sin ocultar ahorro negativo), descarga individual/ZIP y borrado manual de lote. Todo probado con Vitest/RTL + dobles HTTP deterministas y preparación de suite Playwright en `tests/e2e/`.

## 2. Dependencias y gates de entrada (Checklist DoR)
- **Contratos previos:** `F01` cerrada (`FASE_COMPLETA`); `frontend/src/api/types.generated.ts` congelado (solo lectura).
- **G-2 Apertura de fase:** pendiente de autorización expresa de Lino.
- **G-7 Docker:** NO APLICA en `F03` (la SPA se prueba contra mocks/dobles de API; la integración real en vivo va en `F05`).

## 3. Ámbito exclusivo de archivos (sin colisión con `F02`/`F04`)
| Área | Rutas de escritura exclusivas | Rol propietario | ¿Compartido? |
|---|---|---|---|
| Frontend SPA | `frontend/src/**` (excepto `frontend/src/api/types.generated.ts` que es **solo lectura**), `frontend/index.html`, `frontend/public/**` | Designer | **No** |
| Pruebas UI y E2E | `tests/unit/frontend/**`, `tests/e2e/**` | Designer | **No** |
| Reportes | `reports/implementation/F03/**`, `reports/audits/F03/**`, `reports/verification/F03-architect.md` | Todos los roles | **No** |

**PROHIBIDO en `P-03`:** escribir en `backend/`, `infra/terraform/`, `.github/`, `frontend/src/api/types.generated.ts`, `package.json`/`package-lock.json` raíz, `STATE.md` o `docs/sdd/tasks.md` (CTO consolida al retorno).

## 4. Tareas de la fase
| ID | Tarea | Depende de | Rol | Riesgo | Criterios |
|---|---|---|---|---|---|
| `F03-T01` | Estructura SPA, router, layout en español y tema Claro por defecto con selector persistente Claro/Dark (`A-01`) | `F01-T01` | Designer | 1 | `CA-01` |
| `F03-T02` | Vistas y cliente HTTP para registro, login, refresh JWT y manejo de sesión/errores | `F03-T01` | Designer | 2 | `CA-02` |
| `F03-T03` | Zona *drag & drop*, selector de 3 presets y validación previa en cliente (MIME/tamaño/cantidad) | `F03-T01` | Designer | 2 | `CA-03` |
| `F03-T04` | Polling `GET /jobs/:id` (~2 s) y barra de progreso con estados `PENDING/PROCESSING/COMPLETED/PARTIAL/FAILED` | `F03-T02`, `F03-T03` | Designer | 2 | `CA-04` |
| `F03-T05` | Comparativa visual *antes vs. después* y tabla de métricas reales (sin ocultar ahorro negativo + badge EXIF limpio) | `F03-T04` | Designer | 2 | `CA-05` |
| `F03-T06` | Descarga individual/ZIP, borrado manual de lote y suite Playwright (contra mock server determinista) + revisión Auditor | `F03-T04` | Designer (+ Auditor) | 2 | `CA-06` |

## 5. Condiciones de cierre (DoD)
- `F03-T01`..`F03-T06` con `PASSED` de Tester (incl. navegador real Playwright contra mock/preview y evidencia visual).
- Auditoría de cierre en `reports/audits/F03/` sin hallazgos `CRITICAL`/`HIGH`.
- `npm run build` y `npm run typecheck` de `frontend/` en verde; `reports/verification/F03-architect.md` entregado al CTO.
