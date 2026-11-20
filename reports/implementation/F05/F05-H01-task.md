# Tarea `F05-H01` — Corrección H-01 Opción A: seed escribe en `DYNAMODB_TABLE_JOBS` + verificación de seguridad defensiva

| Campo | Valor |
|---|---|
| **ID / Fase** | `F05-H01` · Fase Final — hallazgo `H-01` de `reports/verification/F05-qa-roadmap-architect.md` §4 |
| **Rol / verificadores** | Developer + Tester + Auditor |
| **Harness / Loop** | OpenCode · `v1 — Loop 1/3` |
| **Riesgo** | `3 (Sensible)` · gates: **H-01 Opción A AUTORIZADA**, **G-6 push autorizado**, **G-7** Docker 2g/2.0 (apagar al terminar), **G-12 RETENIDO** (no declarar cierre final) |
| **Depende de** | Roadmap QA `PASSED` 7/7 · `temporary/` ausente (G-11 ejecutado) |

## 1. Criterio (`CA-H01`)
1. `tools/scripts/seed/` escribe en `DYNAMODB_TABLE_JOBS` (valor por defecto `mediashrink-jobs` desde `config/.env`), respetando la tabla creada por Terraform (`infra/terraform/dynamodb.tf`); se retira `SEED_TABLE_NAME = 'mediashrink-seed-demo'` como destino de escritura (no debe quedar rastro de uso).
2. Verificación Tester en vivo contra `aws/aws-emulator`: `terraform apply` → `npm run seed` → `POST /auth/login` con `ana.demo@example.com`/`DemoAna2026!` devuelve `200 OK` y lista sus lotes demo; el seed sigue idempotente (2 ejecuciones → mismos IDs, sin duplicados).
3. Verificación defensiva de seguridad: cabeceras HTTP en `backend/src/api/` (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`), límite de tamaño de body JSON en endpoints API (añadir bajo TDD lo que falte); `npm audit --omit=dev` con hallazgos exactos y **0 CRITICAL/HIGH en producción**; suite completa en verde (typecheck, lint, build, `test:unit`, `tests/integration`).
4. Retorno del Architect en `reports/verification/F05-H01-security-architect.md` con evidencia de Tester y Auditor + commit/run CI; **sin marcar `F05-T06` ni G-12**.

## 2. Entradas y entorno
- Hallazgo: `F05-qa-roadmap-architect.md` §4 (H-01 Media). Seed en `tools/scripts/seed/{cli,index,store}.ts`; tests en `tests/integration/seed/` + `tests/unit/**` donde aplique.
- Binarios fuera de PATH: Docker `<DOCKER_CLI_DIR>`, Terraform `<TF_CLI_DIR>`.
- `docker cp` de CA/config/credenciales en cada arranque; `docker compose down` **obligatorio al terminar**; sin AWS real.
- **G-12 RETENIDO:** push de avances autorizado (G-6) pero sin declarar `F05-T06` ni cierre final.

## 3. Ámbito
- **Permitido:** `tools/scripts/seed/**`, `backend/src/api/**` (solo hardening de cabeceras/límite body), `tests/**/seed*`, `tests/unit/**` (seguridad), `.env.example` si falta una variable de hardening, evidencias y reportes `F05-H01-*`.
- **Prohibido:** tocar contratos Zod congelados, `infra/terraform/`, `frontend/`, `README.md`, `STATE.md`, `tasks.md`, reportes de otros roles, nada fuera de la raíz; declarar cierre G-12.

## 4. Método y entregables
- TDD: RED (tests del seed apuntando a `DYNAMODB_TABLE_JOBS` + tests de cabeceras/límite) → GREEN → REFACTOR, con evidencias.
- Prueba viva del Tester: emulador `healthy` → `terraform apply` (11 recursos) → `npm run seed` (tabla `mediashrink-jobs`) → login `200 OK` + lotes de Ana visibles → re-seed idempotente.
- Auditoría defensiva: 0 CRITICAL/HIGH, 0 secretos, inventario LOW/INFO sin G-10.
- Evidencia `reports/implementation/F05/evidence/F05-H01-*`; reportes `F05-H01-{developer,tester}.md` + `reports/audits/F05/F05-H01-auditor.md`; push a `main` con run CI verde; cierre en `reports/verification/F05-H01-security-architect.md`.
