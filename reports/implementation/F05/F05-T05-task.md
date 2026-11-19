# Tarea `F05-T05` — Borrado verificado de `temporary/` (G-11) + reejecución de suite

| Campo | Valor |
|---|---|
| **ID / Fase** | `F05-T05` · Fase Final — `docs/sdd/packages/P-05-final-integration-and-delivery.md` |
| **Rol / verificadores** | Tester (ejecución) / Architect (cierre) |
| **Harness / Loop** | OpenCode · `v1 — Loop 1/3` |
| **Riesgo** | `2 (Sensible)` · gates: **G-11 AUTORIZADO por Lino**, **G-12 RETENIDO (prohibido push)**, G-7 Docker con límites |
| **Depende de** | `F05-T03` (aceptado), `F05-T04` (PASSED), **G-11 autorizado** |

## 1. Criterio (`CA-05`)
1. Verificar la ruta real de `temporary/` **dentro de la raíz autorizada** (`<PROJECT_ROOT>/temporary`, gitignored, 0 archivos trackeados) y **eliminarla físicamente**.
2. Comprobar que `temporary/` **ya no existe**.
3. Reejecutar `npm run build`, `npm run typecheck`, `npm run lint`, `npm run test:unit` (**303/303**) y `npx vitest run tests/integration` (**97/97**) demostrando **independencia total** de `temporary/`.
4. Registrar el cierre en `F05-T05-tester.md` + `F05-T05-architect.md` y evidencias en `reports/implementation/F05/evidence/`.

## 2. Entradas y entorno
- Roadmap QA: `docs/runbooks/qa-testing-roadmap.md` (capa 0 = esta verificación).
- Binarios fuera de PATH: Docker `D:\Programs\DevApps\Containers\Docker\Desktop\resources\bin`, Terraform `D:\Programs\DevApps\DevOps\Terraform\CLI`.
- Los tests de integración `tests/integration/infra/**` requieren `terraform apply` previo (emulador con `--memory=2g --cpus="2.0"`), `docker cp` de CA/credenciales y **`docker compose down` al terminar**.
- **G-12 RETENIDO:** prohibido `git push`, commit final, release o deploy.

## 3. Ámbito
- **Permitido:** borrar `<PROJECT_ROOT>/temporary/**` (G-11); escribir `F05-T05-{tester,architect}.md` y `evidence/F05-T05-*`.
- **Prohibido:** tocar `frontend/`, `backend/`, `infra/`, `docs/`, `README.md`, `STATE.md`, `tasks.md`, reportes de otros roles, nada fuera de la raíz; ejecutar push.

## 4. Método y entregables
- Evidencia `reports/implementation/F05/evidence/F05-T05-{path-check,delete,post-delete-check,typecheck,lint,build,unit,integration,emulator-down}.txt` con exit codes reales.
- Dictamen `F05-T05-tester.md`; cierre `F05-T05-architect.md`.
