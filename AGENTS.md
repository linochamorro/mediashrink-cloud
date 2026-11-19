# MediaShrink Cloud — Reglas locales del proyecto

Vigente desde: 2026-11-17 · Coordinación global: CTO (Atenea) · Aprobación de alcance y gates: Lino.

## 1. Propósito del proyecto
**MediaShrink Cloud** es una aplicación web de uso cotidiano para optimizar lotes de fotografías privadas: convierte imágenes a formatos ligeros (**WebP/AVIF**), genera miniaturas, elimina metadatos **EXIF/GPS** por privacidad y muestra métricas reales de espacio ahorrado. Toda la infraestructura cloud (**S3, SQS + DLQ, Lambda, DynamoDB**) se aprovisiona con **Terraform** y se ejecuta y prueba en local/CI sin coste ni cuenta AWS mediante **`aws/aws-emulator`**.

## 2. Lectura obligatoria al iniciar cualquier sesión
1. Leer este archivo (`AGENTS.md`).
2. Leer [STATE.md](STATE.md) en la raíz para conocer la fase, tarea autorizada, gates y relevos.
3. Leer el SDD vigente en [docs/sdd/constitution.md](docs/sdd/constitution.md), [spec.md](docs/sdd/spec.md), [plan.md](docs/sdd/plan.md), [tasks.md](docs/sdd/tasks.md) y el paquete de fase activo en `docs/sdd/packages/`.
4. Leer el contrato de tu rol en `.agents/roles/`.

## 3. Estructura del proyecto (Canónica completa)
- `frontend/`: SPA en **Vite + React + TypeScript**.
- `backend/`: API serverless en **Hono (TypeScript)** + worker/Lambda de procesamiento de imágenes con **`sharp` (`libvips`)**.
- `infra/terraform/`: Definición declarativa de buckets S3 (`raw` y `optimized`), cola SQS + DLQ, tabla DynamoDB y recursos contra `aws/aws-emulator`.
- `tests/`: Pruebas permanentes (`unit/`, `integration/`, `e2e/`).
- `docs/`: `architecture/`, `decisions/`, `runbooks/`, `sdd/` (con `packages/`).
- `reports/`: `intake/`, `implementation/<phase-id>/`, `audits/<phase-id>/`, `verification/`.
- `temporary/`: Material efímero exclusivo (se elimina físicamente al cerrar el proyecto tras verificar build y `tests/`).

## 4. Roles y reglas de ejecución
- **Catálogo de 5 roles:** `Architect`, `Developer`, `Designer`, `Tester` y `Auditor` (contratos en `.agents/roles/`).
- **SDD + TDD obligatorio:** toda lógica de producto pasa por `RED → GREEN → REFACTOR` en `tests/`. Documentación y Terraform se verifican por criterios documentales/comandos declarados.
- **Autonomía de Architect por fase:** Architect recibe el paquete `P-xx` completo, coordina cada tarea (`Developer`/`Designer` → revisión de alcance → `Tester` independiente con `PASSED`/`NO-PASSED`, hasta 3 loops) y avanza autónomamente tras cada `PASSED`. Solo retorna al CTO si: (1) cierra toda la fase (`reports/verification/<phase-id>-architect.md`), (2) agota 3 loops en `NO-PASSED` (`BLOCKED`), (3) encuentra un gate pendiente, o (4) falta contexto (`NEEDS_CONTEXT`).
- **Supervisión activa:** Architect no ejecuta pruebas ni implementa código; revisa evidencia real de `Tester` y controla hitos/tiempos.

## 5. Gates y decisiones vigentes de Lino
- **G-3 (`.env`):** solo `.env.example` se versiona. Nunca publicar secretos en código, reportes o logs.
- **G-6 (Git/GitHub):** **AUTORIZADO desde Fase 0**.
- **G-6b (Archivos de agentes/IA en GitHub):** **PERMITIDO SUBIR** (`AGENTS.md`, `STATE.md`, `.agents/`, `docs/sdd/`, `reports/` serán visibles en GitHub para mostrar el flujo de ingeniería asistido por IA).
- **G-7 (Docker / `aws/aws-emulator`):** **AUTORIZADO** con límites de recursos (`--memory=2g --cpus="2.0"`), levantando el contenedor solo durante pruebas/desarrollo y apagándolo al terminar.
- **Confinamiento:** todo trabajo y borrado se limita a la raíz autorizada del proyecto (`<PROJECT_ROOT>`).

## 6. Comandos comprobados
*Validados en Fase 0 (`P-00`). Ejecutar siempre desde la raíz del proyecto.*

### Nota de entorno (Windows)
Los binarios de Docker y Terraform **pueden no estar en PATH**. Resuelve `<DOCKER_CLI_DIR>` y `<TF_CLI_DIR>` en tu entorno y anteponlos a `$env:PATH` (o usa rutas absolutas locales). Las rutas concretas de este harness quedan fuera del documento versionado para no ampliar el seguimiento P4 de anonimización (G-6b): versiones verificadas Docker engine 29.9.3 / Compose v5.7.0 y Terraform v1.17.2.

### Node / TDD (verificado en `F00-T01`, `F00-T02` y CI)
| Comando | Resultado esperado |
|---|---|
| `npm ci --no-audit --no-fund` | exit 0 · 243 paquetes desde `package-lock.json` |
| `npm run typecheck` | exit 0 · sin diagnósticos |
| `npm run lint` | exit 0 · sin hallazgos |
| `npm run test:unit` | exit 0 · 3 archivos, **40/40** tests (35 base + 5 de regresión A-03) |
| `npx vitest run tests/unit/config.test.ts` | exit 0 · 35/35 (30 base + 5 de regresión A-03) |

### Docker / `aws/aws-emulator` (verificado en `F00-T03`)
| Comando | Resultado esperado |
|---|---|
| `docker compose config` | exit 0 · esquema válido, `memory=2147483648`, `cpus=2`, `host_ip=127.0.0.1` |
| `docker compose up -d` | exit 0 · contenedor `healthy` (~9 s), límites efectivos `2147483648` bytes / `2000000000` nanoCpus, `user=1000:1000` |
| `curl.exe --cacert ./.local/aws-emulator/ca.pem https://127.0.0.1:9297/__admin/health` | cuerpo `ok`, exit 0 · sin CA debe fallar (exit 60) |
| `docker compose down` | exit 0 · sin contenedor ni red `mediashrink-cloud_default` |

**G-7:** levantar el contenedor **solo** durante pruebas/desarrollo con esos límites y **apagarlo al terminar**. Con volumen named, repetir `docker cp` de `ca.pem`/`config`/`emulator_credentials` en cada arranque (ver runbook).

### Terraform (verificado en `F00-T04`)
| Comando | Resultado esperado |
|---|---|
| `terraform fmt -check` | exit 0 |
| `terraform init` | exit 0 · backend local, provider `hashicorp/aws v5.100.0` |
| `terraform validate` | exit 0 |
| `terraform plan` | exit 0 · sonda STS en vivo `id=000000000000`, **0 cambios de infraestructura** |

**Prohibido:** `terraform apply` contra AWS real. El bootstrap consume `AWS_ENDPOINT_URL=https://127.0.0.1:9297` y credenciales por `AWS_SHARED_CREDENTIALS_FILE`/`AWS_CONFIG_FILE`; nunca `:9324`.

### Git / GitHub (verificado en `F00-T05` y `F00-T06`)
Repo público: `https://github.com/linochamorro/mediashrink-cloud` · rama `main`.
| Comando | Resultado esperado |
|---|---|
| `git status --short` | sin cambios propios tras commit |
| `git ls-files` | sin `.env`, `.local/`, `temporary/`, `.terraform/`, `*.tfstate*`; G-6b incluido |
| `gh repo view --json visibility,name,url` | `PUBLIC`, `mediashrink-cloud` |
| `gh api repos/linochamorro/mediashrink-cloud/git/trees/main?recursive=1` | G-6b 5/5 rutas presentes |
| `gh run list --workflow ci.yml --limit 5` | run más reciente en `main` |
| `gh run view <id>` | conclusión `success` (4 pasos: Install, Typecheck, Lint, Test unit) |

CI verificada: run `44184037945` → `success` (https://github.com/linochamorro/mediashrink-cloud/actions/runs/44184037945).
