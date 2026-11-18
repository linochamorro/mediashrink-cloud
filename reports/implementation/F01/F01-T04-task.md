# Tarea `F01-T04` — Script seed sintético

| Campo | Valor |
|---|---|
| **ID completo** | `F01-T04` |
| **Fase y paquete** | Fase 1 — `docs/sdd/packages/P-01-critical-foundations.md` |
| **Prioridad** | `P0` |
| **Rol implementador** | `Developer` |
| **Rol verificador** | `Tester` (según `CA-04` del paquete; sin Auditor) |
| **Harness** | OpenCode |
| **Versión / Loop actual** | `v1 — Loop 1/3` |
| **Nivel de riesgo** | `2 (Relevante)` |
| **Excepción metodológica** | `Ninguna` |
| **Estimación / hitos / seguimiento** | Estimación 30 min. Hitos: (1) generador de usuarios/imágenes, (2) idempotencia, (3) ejecución en emulador, (4) verificación. Revisión ≥5 min; diagnóstico a 10 min sin progreso o >2× estimación. |
| **Procesos y verificación proporcional** | `npm run seed -- --dry-run` y `npm run seed` contra emulador; `npx vitest run tests/integration/seed`. Timeout 240 s. Tester reejecuta y verifica en DynamoDB. |

## 1. Fuentes aprobadas y criterios de aceptación
- **Requisitos:** `spec.md` FR-04, PR-02 (datos ficticios); `plan.md` §2 (`tools/scripts/seed`); `constitution.md` PR-01/PR-02; `P-01` §5 `CA-04`.
- **Criterio asignado:** `CA-04`: script seed crea usuarios demo e imágenes sintéticas `100x100` px de forma **idempotente** en local/emulador, sin datos reales.

## 2. Entradas, contratos y entorno
- **Revisión previa:** `F01-T02` y `F01-T03` deben estar `PASSED`; reutilizar el cliente DynamoDB y el servicio de auth/hash con contratos congelados, sin reimplementarlos.
- **Entorno:** emulador con límites 2g/2.0, apagado al terminar; credenciales/CA en `.local/aws-emulator/`. Docker CLI fuera de PATH (ruta en `AGENTS.md` §6 / task.md de T02).
- **Gates:** G-4 autorizado (datos 100 % ficticios), G-7 con límites, G-3 sin secretos.

## 3. Ámbito exclusivo de archivos y límites
- **Escritura permitida:** `tools/scripts/seed/**`, `package.json` raíz (**solo** añadir el script `seed`), `tests/integration/seed/**`, `reports/implementation/F01/evidence/F01-T04-*`, `reports/implementation/F01/F01-T04-developer.md`.
- **Prohibido tocar:** `backend/**`, `frontend/**`, `infra/terraform/**`, `.env.example`, `STATE.md`, `tasks.md`, reportes ajenos. Sin datos personales reales, sin AWS real.

## 4. Método exigido y entregables
- **Método:** verificación de integración + TDD para la idempotencia: ejecutar dos veces el seed y comprobar que no duplica usuarios ni ítems; `--dry-run` sin escribir; imágenes `100×100` generadas sintéticamente; contraseñas demo hasheadas con el servicio de T03.
- **Reporte:** `F01-T04-developer.md` (7 campos). **Evidencia:** `evidence/F01-T04-{dry-run,seed-run-1,seed-run-2,idempotence,db-check,emulator-down}.txt`.
- **Dictamen:** `F01-T04-tester.md`. **Cierre:** `F01-T04-architect.md`.
