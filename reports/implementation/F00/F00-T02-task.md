# Tarea `F00-T02` — Workspaces Vite/React + Hono + sharp + Vitest/Playwright

| Campo | Valor |
|---|---|
| **ID completo** | `F00-T02` |
| **Fase y paquete** | Fase 0 — `docs/sdd/packages/P-00-foundation-and-emulator.md` |
| **Prioridad** | `P0` |
| **Rol implementador** | `Developer` |
| **Rol verificador** | `Tester` (riesgo 1, sin Auditor) |
| **Harness** | OpenCode |
| **Versión / Loop actual** | `v1 — Loop 1/3` |
| **Nivel de riesgo** | `1 (Ordinario)` |
| **Excepción metodológica** | `Ninguna` |
| **Estimación / hitos / seguimiento** | Estimación 25 min. Hitos: (1) manifiesto workspaces, (2) esqueleto frontend, (3) esqueleto backend + healthcheck, (4) typecheck/lint/test. Revisión ≥5 min; diagnóstico a 10 min sin progreso o >2× estimación. Limitación de observación igual que `F00-T01`. |
| **Procesos y verificación proporcional** | `npm run typecheck`, `npm run lint`, `npm run test:unit`. Timeout 180 s. Tester reejecuta los tres comandos y comprueba que no hay código de producto de F01–F03. |

## 1. Fuentes aprobadas y criterios de aceptación
- **Requisitos:** `ADR-001`, `docs/architecture/00-overview.md`, `01-stack.md`, `plan.md` §2, `P-00` §5 `CA-02`.
- **Criterios asignados:**
  - `CA-02`: `typecheck`, `lint` y test unitario de humo pasan con exit 0 en `frontend/` y `backend/`; estructura canónica creada; sin pantallas, esquemas Zod de dominio, DynamoDB, JWT ni worker `sharp` (excluidos a F01–F03).

## 2. Entradas, contratos y entorno
- **Revisión previa de Architect:** `F00-T01` debe estar `PASSED`; `package.json` puede ampliarse conservando la configuración de Vitest ya verificada. No se reducen criterios por falta de herramientas.
- **Entorno:** Node 26.13.0 / npm 11.20.0; G-8 autorizado para dependencias del manifiesto. Sin AWS real.
- **Gates:** G-1, G-2, G-3, G-6/G-6b, G-8 resueltos; G-5 no aplica.

## 3. Ámbito exclusivo de archivos y límites
- **Escritura permitida:** `package.json`, `tsconfig.base.json`, `frontend/**`, `backend/**`, `tests/unit/**`, `docs/architecture/**` (solo actualización de mapa de estructura), `reports/implementation/F00/evidence/F00-T02-*`. `backend/src/config/**` y `tests/unit/config.test.ts` quedan intactos (propiedad de `F00-T01`).
- **Prohibido tocar:** `.env.example`, `infra/terraform/**`, `.github/**`, `.gitignore`, `STATE.md`, `docs/sdd/tasks.md`.

## 4. Método exigido y entregables
- **Método:** `RED → GREEN → REFACTOR` para el test de humo; para la configuración de tooling se admite verificación documental de comandos declarados (no hay comportamiento de producto).
- **Reporte:** `F00-T02-developer.md`. **Evidencia:** `evidence/F00-T02-typecheck.txt`, `F00-T02-lint.txt`, `F00-T02-test-unit.txt`.
- **Dictamen:** `F00-T02-tester.md`. **Cierre:** `F00-T02-architect.md`.
