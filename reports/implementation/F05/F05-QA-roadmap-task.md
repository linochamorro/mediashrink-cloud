# Tarea `F05-QA` — Roadmap integral de pruebas (6 capas) + 12 screenshots Playwright CLI

| Campo | Valor |
|---|---|
| **ID / Fase** | `F05-QA` · Fase Final — `docs/runbooks/qa-testing-roadmap.md` (autorizado por Lino) |
| **Rol / verificadores** | Tester (ejecución) / Architect (matriz en `F05-qa-roadmap-architect.md`) |
| **Harness / Loop** | OpenCode · `v1 — Loop 1/3` |
| **Riesgo** | `3 (Sensible)` · gates: **G-7** Docker 2g/2.0 (apagar al terminar), **G-12 RETENIDO** (prohibido push), G-11 ya ejecutado |
| **Depende de** | `F05-T05` PASSED (`temporary/` ausente) |

## 1. Criterio (`CA-QA`) — matriz del runbook §1
Ejecutar y documentar **resultados reales** por capa:

| Capa | Verificación exigida | Evidencia |
|---|---|---|
| **0** | `temporary/` inexistente; typecheck/lint/build/`test:unit` 303/303 e integración 97/97 sin `temporary/` (hereda de `F05-T05`) | `F05-T05-*` |
| **1** | `terraform fmt -check`, `validate`, `apply` (11 recursos); buckets S3 `raw`/`optimized` con lifecycle 30 d; SQS+DLQ `maxReceiveCount=3`; DynamoDB TTL `ENABLED`; CORS exacto | `qa-roadmap/cap1-*` + `tests/integration/infra/` |
| **2** | Catálogo Zod v1 congelado; `register`/`login`/`refresh` (JWT HS256 + scrypt); `401/404` sin oracle; `429` no suplantable; aislamiento `userId`; seed idempotente | `qa-roadmap/cap2-*` (Vitest unit + integración) |
| **3** | `POST /jobs` `{preset, files}` → `{job, uploads}`; presigned PUT/GET; confirm idempotente; ZIP + `413`; `DELETE` | `qa-roadmap/cap3-*` (`tests/integration/api/`) |
| **4** | WebP+AVIF+miniatura WebP; strip total EXIF/XMP/IPTC con control negativo; `HeadObject` real; corrupto → 3 reintentos → DLQ + `PARTIAL`/`FAILED` | `qa-roadmap/cap4-*` |
| **5** | SPA en navegador real **sin mocks** (backend+frontend+emulador+seed) vía **Playwright CLI**, con los **12 PNG obligatorios** del §2 | `qa-roadmap/01..12*.png` + log Playwright |
| **6** | 0 secretos, 0 rutas Windows absolutas en artefactos nuevos, `temporary/` ausente, Docker apagado y puertos 3001/9297 cerrados | `qa-roadmap/cap6-*` |

## 2. Screenshots obligatorios (runbook §2)
En `reports/implementation/F05/evidence/qa-roadmap/`, capturados con Playwright CLI sobre el stack real:
`01-auth-login-claro.png`, `02-auth-error-credenciales.png`, `03-auth-registro.png`, `04-dashboard-tema-oscuro.png`, `05-upload-validacion-error.png`, `06-upload-lote-preset-progreso.png`, `07-resultados-comparativa-metricas.png`, `08-descarga-individual-y-zip.png`, `09-lote-parcial-o-error.png`, `10-borrado-manual-lote.png`, `11-aislamiento-usuario-b.png`, `12-logout-limpio.png`.

## 3. Entradas y entorno
- Binarios fuera de PATH: Docker `<DOCKER_CLI_DIR>`, Terraform `<TF_CLI_DIR>`.
- Cuentas seed: `ana.demo@example.com`/`DemoAna2026!`, `bruno.demo@example.com`/`DemoBruno2026!`, `carla.demo@example.com`/`DemoCarla2026!` (ficticias, no secretos).
- `docker cp` de CA/config/credenciales en **cada** arranque; **`docker compose down` obligatorio al terminar**.
- **G-12 RETENIDO:** prohibido `git push`, commit, release o deploy.

## 4. Ámbito y entregables
- **Prohibido:** editar producto (`frontend/`, `backend/`, `infra/`), `README.md`, `STATE.md`, `tasks.md`, reportes ajenos; borrar nada (ya borrado); push.
- Evidencia por capa en `reports/implementation/F05/evidence/qa-roadmap/`; reporte `F05-QA-roadmap-tester.md` (veredicto por capa con cifras); cierre del Architect en `reports/verification/F05-qa-roadmap-architect.md`.
