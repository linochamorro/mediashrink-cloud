# Tarea `F02-T02` — Presigned URLs S3 (raw PUT / optimized GET)

| Campo | Valor |
|---|---|
| **ID completo** | `F02-T02` |
| **Fase / paquete** | Fase 2 — `docs/sdd/packages/P-02-api-and-worker.md` |
| **Prioridad** | `P1` |
| **Rol implementador / verificadores** | Developer / Tester + Auditor |
| **Harness / Loop** | OpenCode · `v1 — Loop 1/3` |
| **Nivel de riesgo** | `2 (Relevante)` |
| **Estimación / hitos** | 35 min: (1) cliente S3 contra emulador, (2) presign PUT/GET, (3) integración real, (4) verificación. Revisión ≥5 min; diagnóstico a 10 min o >2× estimación. |
| **Procesos** | `npx vitest run tests/integration/api`, `npm run typecheck`, `npm run lint`. Timeout 240 s. |

## 1. Fuentes y criterio
- `spec.md` FR-08/FR-09/FR-17, PR-02; `plan.md` §3.2; `ADR-001` Decisión 4; `constitution.md` PR-04/PR-07; `P-02` §5 `CA-02`.
- **`CA-02`**: servicio en `backend/src/storage/**` que genera Presigned URLs de subida a `raw` (PUT) y descarga de `optimized` (GET) contra `aws/aws-emulator`, con claves por `userId`/`jobId`/`imageId`, sin pasar el binario por la API, sin secretos reales.

## 2. Entradas y entorno
- Depende de `F02-T01` PASSED; usa contratos congelados y la config (`AWS_ENDPOINT_URL`, `CA_BUNDLE_PATH`, buckets). **Credenciales por `fromIni` de archivos generados por el emulador; nunca fijas; sin `:9324`.**
- **CTO autorizó dependencias en `backend/package.json`**: como primer propietario del manifiesto en F02, instala **las tres** que necesita la fase: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` y `@aws-sdk/client-sqs` (esta última para T04), actualizando el lockfile bajo G-8. Así T04 no vuelve a escribir el manifiesto.
- **No tocar** manifiestos raíz, `STATE.md`, `tasks.md`, `frontend/`, `infra/`, `.github/`, `backend/src/index.ts`.

## 3. Ámbito exclusivo
`backend/src/storage/**`, `backend/src/api/**` (rutas de presign si aplica), `backend/package.json` + lockfile (autorizado), `tests/integration/api/**`, `reports/implementation/F02/evidence/F02-T02-*`, `reports/implementation/F02/F02-T02-developer.md`.

## 4. Método y entregables
- TDD con integración real: subir un fixture 100×100 con la URL presignada y verificar objeto en `raw`; generar GET de `optimized` y verificar acceso; URLs con expiración acotada; prefijo por `userId`; rechazo de claves que intenten escapar del prefijo.
- Emulador: `docker compose up -d` (2g/2.0), `docker cp` de CA/credenciales según runbook, `docker compose down` **obligatorio** y `docker ps -a` vacío.
- Evidencia: `F02-T02-{red,green,refactor,emulator-up,upload,download,emulator-down}.txt`.
- Dictamen `F02-T02-tester.md`; auditoría `reports/audits/F02/F02-T02-auditor.md`; cierre `F02-T02-architect.md`.
