# Tarea `F00-T01` — `.env.example` y validación de configuración

| Campo | Valor |
|---|---|
| **ID completo** | `F00-T01` |
| **Fase y paquete** | Fase 0 — `docs/sdd/packages/P-00-foundation-and-emulator.md` |
| **Prioridad** | `P0` |
| **Rol implementador** | `Developer` |
| **Rol verificador** | `Tester` (riesgo 1, sin Auditor) |
| **Harness** | OpenCode |
| **Versión / Loop actual** | `v1 — Loop 1/3` |
| **Nivel de riesgo** | `1 (Ordinario)` |
| **Excepción metodológica** | `Ninguna` |
| **Estimación / hitos / seguimiento** | Estimación 20 min. Hitos: (1) inventario de variables desde SDD, (2) test RED, (3) loader GREEN, (4) evidencia. Revisión del subagente al menos cada 5 min; diagnóstico a los 10 min sin progreso o >2× estimación. Limitación: el harness notifica cuando el subagente queda inactivo; no hay observación continua de pulsaciones, se exigen entregas parciales en el reporte. |
| **Procesos y verificación proporcional** | `npx vitest run tests/unit/config.test.ts`, `npx tsc --noEmit`. Timeout 120 s por comando. Ámbito Tester: reejecución independiente + inspección de secretos. Ámbito Architect: solo revisión de evidencia, sin corrida propia. |

## 1. Fuentes aprobadas y criterios de aceptación
- **Requisitos:** `spec.md` NFR-06, D-08 (límites configurables), A-06 (rate limit configurable), `plan.md` §4; `constitution.md` PR-08 / IN-07; `P-00` §5 `CA-01`.
- **Criterios asignados:**
  - `CA-01`: `.env.example` completo (límites de archivo/lote/píxeles, JWT, rate limit, emulador AWS local, buckets/colas/tabla, retención, polling) sin secretos reales; test unitario de carga/validación de configuración en `tests/unit/` en verde con evidencia RED→GREEN.

## 2. Entradas, contratos y entorno
- **Revisión previa de Architect:** los nombres de variables son propuesta del implementador derivada del SDD; no hay esquemas de dominio ni JWT funcional en esta tarea (F01). Los valores de `.env.example` son marcadores locales, nunca secretos reales (G-3).
- **Contratos de entrada:** `docs/sdd/{spec,plan,constitution}.md`, `ADR-001`, `P-00`.
- **Entorno de prueba:** Node 26.13.0 / npm 11.20.0 disponibles; sin AWS real; sin Docker/Terraform necesarios aquí.
- **Gates:** G-1 aprobado, G-2 autorizado, G-3 resuelto (solo `.env.example`), G-6/G-6b autorizado, G-7 no aplica, G-8 autorizado.

## 3. Ámbito exclusivo de archivos y límites
- **Escritura permitida:** `.env.example`, `package.json` (mínimo temporal con Vitest/TypeScript, será extendido en `F00-T02`), `backend/src/config/**`, `tests/unit/config.test.ts`, `reports/implementation/F00/evidence/F00-T01-*`.
- **Prohibido tocar:** `.env` real, secretos, `frontend/**`, `infra/terraform/**`, `.github/**`, `STATE.md`, `docs/sdd/tasks.md`, reportes de otros roles.

## 4. Método exigido y entregables
- **Método:** `RED → GREEN → REFACTOR` en `tests/unit/config.test.ts` (principalmente casos negativos: variable ausente, valor inválido, secretos detectados).
- **Reporte del implementador:** `reports/implementation/F00/F00-T01-developer.md` (estado + 7 campos de problemas si los hay).
- **Evidencia:** `reports/implementation/F00/evidence/F00-T01-red.txt`, `F00-T01-green.txt`, `F00-T01-env-audit.txt`.
- **Dictamen independiente:** `reports/implementation/F00/F00-T01-tester.md`.
- **Cierre de Architect:** `reports/implementation/F00/F00-T01-architect.md`.
