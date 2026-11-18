# P-01 — Fundamentos críticos (Contratos, DynamoDB, Auth JWT, Seed y Reglas puras)

- **Estado:** EN EJECUCIÓN (`G-2` autorizado por Lino el 2026-11-17)
- **Fase del roadmap:** Fase 1 (`docs/sdd/tasks.md`)
- **Prioridad:** P0
- **Harness asignado:** OpenCode
- **Coordinación:** Architect de fase (retorna a CTO) · Roles: Developer, Tester, Auditor (obligatorio por Riesgo 3)

## 1. Objetivo y resultado verificable
Congelar los contratos Zod y tipos compartidos entre `backend/` y `frontend/`, implementar la capa de persistencia en DynamoDB (modelo `userId`/`jobId`, TTL 30 días, aislamiento por usuario) probada contra `aws/aws-emulator`, implementar autenticación JWT propia (`register`, `login`, `refresh`, hash `scrypt`/`bcryptjs`, rate limiting configurable), crear el script seed sintético (`tools/scripts/seed`) y cubrir bajo TDD (`RED → GREEN → REFACTOR`) todas las reglas puras de validación estricta, anti-bomba, cálculo de ahorro y máquina de estados. Al cerrar esta fase quedan congelados los contratos para habilitar las fases paralelas `F02`, `F03` y `F04`.

## 2. Dependencias y gates de entrada (Checklist DoR)
- **Fases previas:** Fase 0 (`P-00`) cerrada (`FASE_COMPLETA`, `reports/verification/F00-architect.md` §7).
- **G-1 / G-2:** SDD aprobado (Gate 1); `G-2` (Fase 1) pendiente de confirmación de Lino al despachar.
- **G-3 (`.env`):** RESUELTO — solo `.env.example` versionado; sin secretos reales en código ni reportes.
- **G-4 (Base de datos — DynamoDB en emulador):** AUTORIZADO en `aws/aws-emulator` (datos 100 % ficticios).
- **G-6 / G-6b (Git / GitHub):** AUTORIZADO (`mediashrink-cloud` público, archivos IA permitidos).
- **G-7 (Docker / `aws-emulator`):** AUTORIZADO con `--memory=2g --cpus="2.0"`, encendido solo en pruebas y **apagado al terminar**.

## 3. Ámbito exclusivo de archivos
| Área | Rutas de escritura exclusivas | Rol propietario | ¿Compartido en escritura? |
|---|---|---|---|
| Contratos y backend base | `backend/src/contracts/**`, `backend/src/domain/**`, `backend/src/db/**`, `backend/src/auth/**`, `backend/src/config/**` | Developer | No |
| Tipos generados frontend | `frontend/src/api/types.generated.ts` | Developer | No (solo lectura tras F01) |
| Script seed | `tools/scripts/seed/**` (o `tools/scripts/seed.*`) + `package.json` (solo script `seed`) | Developer | No |
| Pruebas permanentes | `tests/unit/**`, `tests/integration/**` | Developer | No |
| Documentación técnica | `docs/architecture/03-data-model-and-storage-contract.md`, `04-api-and-component-contract.md` | Developer / Architect | No |
| Reportes de fase | `reports/implementation/F01/**`, `reports/audits/F01/**`, `reports/verification/F01-architect.md` | Todos los roles | No |

*(Restricción: no implementar rutas HTTP `/jobs` ni worker `sharp` ni UI React en esta fase — pertenecen a `F02` y `F03`.)*

## 4. Tareas de la fase
| ID | Tarea | Depende de | Rol | Riesgo (1-3) | Criterios de aceptación |
|---|---|---|---|---|---|
| `F01-T01` | Esquemas Zod y tipos compartidos congelados (auth, presets `HIGH`/`BALANCED`/`MAX_COMPRESSION`, jobs, imágenes, métricas) + generación en `frontend/src/api/types.generated.ts` | `F00-T02` | Developer | 2 | `CA-01` |
| `F01-T02` | Cliente DynamoDB + modelo de datos (`userId`/`jobId`, TTL 30 días, ítems hijos por imagen) + tests integración en `aws/aws-emulator` | `F01-T01` | Developer (+ Auditor) | 3 | `CA-02` |
| `F01-T03` | Auth JWT propio en Hono/servicio (`register`, `login`, `refresh`, hash `scrypt`/`bcryptjs`, middleware `userId`, rate limiting configurable por `.env`) | `F01-T01` | Developer (+ Auditor) | 3 | `CA-03` |
| `F01-T04` | Script seed sintético (usuarios demo + imágenes sintéticas `100x100` px) ejecutable en local/CI | `F01-T02`, `F01-T03` | Developer | 2 | `CA-04` |
| `F01-T05` | Reglas puras TDD: validación estricta (magic bytes, MIME real, rechazo SVG/GIF animado, anti-bomba `MAX_PIXELS`, `MAX_FILE_SIZE`), cálculo de ahorro real (incl. 0%/negativo) y máquina de estados (`PENDING`/`PROCESSING`/`COMPLETED`/`PARTIAL`/`FAILED`) | `F01-T01` | Developer (+ Auditor) | 3 | `CA-05` |

## 5. Criterios de aceptación y verificación
| ID | Criterio verificable | Método | Rol verificador | Evidencia requerida |
|---|---|---|---|---|
| `CA-01` | Contratos Zod validan entradas/salidas; `frontend/` consume `types.generated.ts` sin duplicar tipos; `typecheck`/`lint`/tests en verde | `TDD` | Tester + Auditor | Salida Vitest + `typecheck` en `reports/implementation/F01/evidence/` |
| `CA-02` | CRUD DynamoDB en `aws/aws-emulator` con TTL 30 días y aislamiento estricto por `userId` (un usuario nunca lee/modifica lotes ajenos) | `TDD` / `Integración` | Tester + Auditor | Salida `tests/integration/` contra emulador + `F01-T02-auditor.md` |
| `CA-03` | `register`/`login`/`refresh`, contraseñas hasheadas (nunca en claro), verificación JWT, aislamiento `401`/`404` y rate limiting configurable probados | `TDD` | Tester + Auditor | Salida `tests/` + `F01-T03-auditor.md` sin hallazgos críticos/altos |
| `CA-04` | Script seed crea usuarios demo e imágenes `100x100` de forma idempotente en local/emulador sin datos reales | `Integración` | Tester | Log de ejecución seed + verificación en emulador |
| `CA-05` | Reglas puras 100 % cubiertas (`RED→GREEN→REFACTOR`): magic bytes, rechazo SVG/GIF animado, anti-bomba, ahorro real y estados | `TDD` | Tester + Auditor | Salida `tests/unit/` + `F01-T05-auditor.md` |

## 6. Condiciones de cierre de la fase (DoD)
- `F01-T01` a `F01-T05` con `PASSED` de Tester en `reports/implementation/F01/`.
- Auditorías de Riesgo 2–3 cerradas en `reports/audits/F01/` sin hallazgos `CRITICAL`/`HIGH` ni bloqueantes.
- Contratos congelados documentados en `docs/architecture/03-data-model-and-storage-contract.md` y `04-api-and-component-contract.md`.
- Contenedor Docker apagado tras pruebas; `docs/sdd/tasks.md` y `STATE.md` actualizados; `reports/verification/F01-architect.md` entregado al CTO.
