# Tarea `F05-T01` — Integración global real y sincronización

| Campo | Valor |
|---|---|
| **ID / Fase** | `F05-T01` · Fase Final — `docs/sdd/packages/P-05-final-integration-and-delivery.md` |
| **Rol / verificadores** | Developer / Tester |
| **Harness / Loop** | OpenCode · `v1 — Loop 1/3` |
| **Riesgo / Estimación** | `3 (Sensible)` · 60 min. Revisión ≥5 min; diagnóstico a 10 min o >2×. |
| **Procesos** | typecheck, lint, build, unit, integración S3/SQS/DLQ/DynamoDB, Playwright real. Timeout amplio justificado. |

## 1. Criterio (`CA-01`)
- Completar `backend/src/index.ts`: servidor Hono con `createApiApp()` real + arranque del consumidor/worker SQS conectado a `aws/aws-emulator` (sin mocks), conservando `/health`.
- Alinear `RETENTION_DAYS` en runtime con Terraform/catálogo (cierra `F04T03-A-03` MEDIUM): una sola fuente verificable, sin duplicar literales 30/2592000 en código.
- Sincronizar manifiestos/código pendientes de F02/F03/F04 en `main` (G-6 autorizado; `pull --ff-only`, sin force push) y **retirar el paso temporal `npm install --no-save`** de `.github/workflows/` ahora que los SDK S3/SQS están declarados en `backend/package.json`.
- Suite completa real: typecheck, lint, build, unitarias, integración S3/SQS/DLQ/DynamoDB y E2E Playwright contra frontend + backend + terraform + emulador reales: registro/login, subida directa S3, WebP+AVIF+miniatura, strip EXIF/GPS, comparativa, ZIP y borrado.

## 2. Entradas y entorno
- F00/F01/F02(+addendum)/F03(reapertura PASSED)/F04(FASE_COMPLETA) cerradas. Binarios fuera de PATH: Docker `<DOCKER_CLI_DIR>`, Terraform `<TF_CLI_DIR>`.
- Emulador con 2 GiB/2.0, `docker cp` de CA/credenciales por arranque, **apagar al terminar**. Sin AWS real.
- **No borrar `temporary/` (G-11 pendiente) ni hacer publicación final (G-12 pendiente).**

## 3. Ámbito
Acceso controlado a todo el repositorio; sin tocar nada fuera de `<PROJECT_ROOT>`. Sin secretos en reportes/logs; rutas en evidencia con marcadores.

## 4. Método y entregables
- Evidencia `reports/implementation/F05/evidence/F05-T01-*.txt`: wiring, retention-runtime, git-sync, workflow-cleanup, typecheck, lint, build, unit, integration, playwright-real, emulator-down.
- Reporte `F05-T01-developer.md` (7 campos por problema); dictamen `F05-T01-tester.md`; cierre `F05-T01-architect.md`.
