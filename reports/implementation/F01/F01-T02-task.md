# Tarea `F01-T02` — Cliente DynamoDB y modelo de datos

| Campo | Valor |
|---|---|
| **ID completo** | `F01-T02` |
| **Fase y paquete** | Fase 1 — `docs/sdd/packages/P-01-critical-foundations.md` |
| **Prioridad** | `P0` |
| **Rol implementador** | `Developer` |
| **Rol verificador** | `Tester` + `Auditor` |
| **Harness** | OpenCode |
| **Versión / Loop actual** | `v1 — Loop 1/3` |
| **Nivel de riesgo** | `3 (Sensible)` — persistencia y aislamiento por usuario |
| **Excepción metodológica** | `Ninguna` |
| **Estimación / hitos / seguimiento** | Estimación 40 min. Hitos: (1) cliente y esquema de tabla, (2) tests integración RED, (3) CRUD + TTL + aislamiento, (4) verificación contra emulador. Revisión ≥5 min; diagnóstico a 10 min sin progreso o >2× estimación. |
| **Procesos y verificación proporcional** | `npx vitest run tests/integration/db`, `npm run typecheck`. Timeout integración 240 s. Tester reejecuta contra emulador; Auditor revisa aislamiento y TTL. |

## 1. Fuentes aprobadas y criterios de aceptación
- **Requisitos:** `spec.md` §4 (modelo de datos, `userId`/`jobId`, ítems hijos, TTL), FR-08/FR-12/FR-19/FR-21; `plan.md` §3.2/§6; `constitution.md` PR-07/IN-06/IN-09; `P-01` §5 `CA-02`.
- **Criterio asignado:** `CA-02`: CRUD DynamoDB en `aws/aws-emulator` con TTL 30 días y **aislamiento estricto por `userId`** (un usuario nunca lee ni modifica lotes ajenos), con ítems hijos por imagen.

## 2. Entradas, contratos y entorno
- **Revisión previa:** `F01-T01` debe estar `PASSED`; consumir los contratos congelados sin redefinirlos. La tabla aún no existe en Terraform (F04): los tests la crean en un entorno aislado del emulador (setup/teardown), sin afectar a otras fases.
- **Entorno:** emulador vía `docker compose up -d` con límites 2g/2.0; credenciales y CA en `.local/aws-emulator/`; **apagar con `docker compose down` al terminar** y verificar `docker ps -a` vacío. Docker CLI fuera de PATH: `D:\Programs\DevApps\Containers\Docker\Desktop\resources\bin\docker.exe`.
- **Gates:** G-4 AUTORIZADO (100 % ficticio en emulador), G-7 con límites, G-3 sin secretos reales.

## 3. Ámbito exclusivo de archivos y límites
- **Escritura permitida:** `backend/src/db/**`, `backend/package.json` (dependencias AWS SDK), `tests/integration/db/**`, `docs/architecture/03-data-model-and-storage-contract.md`, `reports/implementation/F01/evidence/F01-T02-*`, `reports/implementation/F01/F01-T02-developer.md`.
- **Prohibido tocar:** `backend/src/{contracts,auth,domain}/**`, `frontend/**`, `package.json` raíz, `infra/terraform/**`, `.env.example`, `STATE.md`, `tasks.md`, reportes ajenos. Sin AWS real ni `aws configure`.

## 4. Método exigido y entregables
- **Método:** `RED → GREEN → REFACTOR` en `tests/integration/db/**`: creación de tabla + TTL, create/read/update/delete de jobs, ítems hijos por imagen, y casos negativos de aislamiento (usuario B no ve/modifica job de A → 404/NotFound en la capa de persistencia).
- **Persistencia:** TTL `createdAt + 30 días` calculado en Unix seconds; clave PK `userId`, SK `jobId`; consistencia con `spec.md` §4 y con los contratos de T01.
- **Reporte:** `F01-T02-developer.md` (7 campos). **Evidencia:** `evidence/F01-T02-{red,green,refactor,emulator-up,emulator-down,ttl,isolation}.txt`.
- **Dictamen:** `F01-T02-tester.md`. **Auditoría:** `reports/audits/F01/F01-T02-auditor.md`. **Cierre:** `F01-T02-architect.md`.
