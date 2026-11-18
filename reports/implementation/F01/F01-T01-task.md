# Tarea `F01-T01` — Contratos Zod congelados y tipos generados

| Campo | Valor |
|---|---|
| **ID completo** | `F01-T01` |
| **Fase y paquete** | Fase 1 — `docs/sdd/packages/P-01-critical-foundations.md` |
| **Prioridad** | `P0` |
| **Rol implementador** | `Developer` |
| **Rol verificador** | `Tester` + `Auditor` |
| **Harness** | OpenCode |
| **Versión / Loop actual** | `v1 — Loop 1/3` |
| **Nivel de riesgo** | `2 (Relevante)` |
| **Excepción metodológica** | `Ninguna` |
| **Estimación / hitos / seguimiento** | Estimación 30 min. Hitos: (1) inventario de contratos desde SDD, (2) tests RED, (3) esquemas Zod + generador, (4) verificación. Revisión ≥5 min; diagnóstico a 10 min sin progreso o >2× estimación. Limitación: el harness notifica inactividad del subagente; no observación continua; se exigen entregas parciales en el reporte. |
| **Procesos y verificación proporcional** | `npx vitest run tests/unit/contracts.test.ts`, `npm run typecheck`, `npm run lint`. Timeout 180 s. Tester reejecuta; Auditor revisa congelación/duplicación. |

## 1. Fuentes aprobadas y criterios de aceptación
- **Requisitos:** `spec.md` §2 (FR-01…FR-22), §4 (modelo de datos), §5 (API); `plan.md` §2/§3; `constitution.md` IN-01…IN-14; `P-01` §5 `CA-01`.
- **Criterio asignado:** `CA-01`: esquemas Zod validan entradas/salidas (auth, presets `HIGH`/`BALANCED`/`MAX_COMPRESSION`, jobs, imágenes, métricas, estados); `frontend/` consume `frontend/src/api/types.generated.ts` sin duplicar tipos; `typecheck`/`lint`/tests en verde.

## 2. Entradas, contratos y entorno
- **Revisión previa de Architect:** F00 cerrada; workspaces y config loader (`backend/src/config/index.ts`) existen y están verdes. No hay contratos previos que congruir. No se implementan rutas HTTP `/jobs` (F02), worker `sharp` (F02) ni UI (F03).
- **Interpretación de ámbito (Architect):** `backend/package.json` puede recibir dependencias (Zod, utilidades de generación) por ser manifiesto del workspace backend; el `package.json` raíz **solo** podrá ser tocado por `F01-T04` para el script `seed`.
- **Entorno:** Node 26 / npm 11; sin AWS real; Docker no necesario en esta tarea.
- **Gates:** G-1/G-2 aprobados, G-3 resuelto (`.env.example`), G-6/G-6b repo público, G-8 autorizado para dependencias.

## 3. Ámbito exclusivo de archivos y límites
- **Escritura permitida:** `backend/src/contracts/**`, `frontend/src/api/types.generated.ts`, `backend/package.json` (dependencias), `tests/unit/contracts.test.ts`, `docs/architecture/04-api-and-component-contract.md`, `reports/implementation/F01/evidence/F01-T01-*`, `reports/implementation/F01/F01-T01-developer.md`.
- **Prohibido tocar:** `package.json` raíz, `backend/src/{db,auth,domain}/**`, `frontend/src/**` salvo `api/types.generated.ts`, `infra/terraform/**`, `.github/**`, `.env.example`, `STATE.md`, `docs/sdd/tasks.md`, reportes ajenos.

## 4. Método exigido y entregables
- **Método:** `RED → GREEN → REFACTOR` en `tests/unit/contracts.test.ts` (casos negativos: preset inválido, estado inválido, job sin `userId`, métrica incoherente; positivos: round-trip de cada esquema).
- **Congelación:** los esquemas y sus nombres quedan fijos al cierre de la tarea; el generador debe ser reproducible y el archivo generado debe coincidir con la fuente (test de sincronía).
- **Reporte:** `F01-T01-developer.md` (estado + 7 campos de problemas). **Evidencia:** `evidence/F01-T01-{red,green,refactor,typecheck,lint,freeze}.txt`.
- **Dictamen:** `F01-T01-tester.md`. **Auditoría:** `reports/audits/F01/F01-T01-auditor.md`. **Cierre:** `F01-T01-architect.md`.
