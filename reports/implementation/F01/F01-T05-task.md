# Tarea `F01-T05` — Reglas puras bajo TDD

| Campo | Valor |
|---|---|
| **ID completo** | `F01-T05` |
| **Fase y paquete** | Fase 1 — `docs/sdd/packages/P-01-critical-foundations.md` |
| **Prioridad** | `P0` |
| **Rol implementador** | `Developer` |
| **Rol verificador** | `Tester` + `Auditor` |
| **Harness** | OpenCode |
| **Versión / Loop actual** | `v1 — Loop 1/3` |
| **Nivel de riesgo** | `3 (Sensible)` — validación de privacidad y seguridad de archivos |
| **Excepción metodológica** | `Ninguna` |
| **Estimación / hitos / seguimiento** | Estimación 40 min. Hitos: (1) tests RED por familia de regla, (2) implementación pura, (3) cobertura 100 %, (4) verificación. Revisión ≥5 min; diagnóstico a 10 min sin progreso o >2× estimación. |
| **Procesos y verificación proporcional** | `npx vitest run tests/unit/domain --coverage`, `npm run typecheck`. Timeout 180 s. Tester reejecuta y Auditor revisa reglas de privacidad/anti-bomba. |

## 1. Fuentes aprobadas y criterios de aceptación
- **Requisitos:** `spec.md` FR-07/FR-11/FR-12, NFR-04/NFR-05; `plan.md` §4 (validación y privacidad); `constitution.md` PR-01/IN-08/IN-10/IN-12; `P-01` §5 `CA-05`.
- **Criterio asignado:** `CA-05`: reglas puras **100 % cubiertas** bajo `RED → GREEN → REFACTOR`: magic bytes y MIME real, rechazo de SVG/GIF animados, anti-bomba (`MAX_PIXELS`/`MAX_FILE_SIZE`), cálculo de ahorro real (0 % y negativo) y máquina de estados (`PENDING`/`PROCESSING`/`COMPLETED`/`PARTIAL`/`FAILED`).

## 2. Entradas, contratos y entorno
- **Revisión previa:** `F01-T01` PASSED; usar contratos congelados y la configuración del loader para límites. No se implementa el pipeline `sharp` (F02): solo reglas puras deterministas, sin I/O de red ni S3.
- **Gates:** G-3 (sin secretos), G-6/G-6b; Docker no necesario en esta tarea.

## 3. Ámbito exclusivo de archivos y límites
- **Escritura permitida:** `backend/src/domain/**`, `backend/package.json` (solo si hace falta una dependencia de imagen para cabeceras), `tests/unit/domain/**`, `reports/implementation/F01/evidence/F01-T05-*`, `reports/implementation/F01/F01-T05-developer.md`.
- **Prohibido tocar:** `backend/src/{contracts,db,auth,config}/**`, `frontend/**`, `package.json` raíz, `infra/terraform/**`, `.env.example`, `STATE.md`, `tasks.md`, reportes ajenos.

## 4. Método exigido y entregables
- **Método:** `RED → GREEN → REFACTOR` por familia: (a) cabeceras JPEG/PNG/WebP/AVIF válidas y extensions coherentes; (b) rechazo de SVG, GIF animado y polimorfismo de extensión; (c) anti-bomba por píxeles y tamaño desde config; (d) ahorro real con bytes enteros (0 % y negativo, sin ocultar); (e) transiciones de estado válidas e inválidas (incl. `PARTIAL` con imagen `FAILED`). Sin mocks que sustituyan la lógica bajo prueba.
- **Cobertura:** 100 % de líneas y ramas del módulo `backend/src/domain/**`, verificable con `--coverage`.
- **Reporte:** `F01-T05-developer.md` (7 campos). **Evidencia:** `evidence/F01-T05-{red,green,refactor,coverage,privacy,states}.txt`.
- **Dictamen:** `F01-T05-tester.md`. **Auditoría:** `reports/audits/F01/F01-T05-auditor.md`. **Cierre:** `F01-T05-architect.md`.
