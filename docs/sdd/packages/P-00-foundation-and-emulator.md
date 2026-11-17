# P-00 — Fundación, `aws/aws-emulator`, Terraform bootstrap y GitHub

- **Estado:** LISTO PARA DESPACHO
- **Fase del roadmap:** Fase 0 (`docs/sdd/tasks.md`)
- **Prioridad:** P0
- **Harness asignado:** OpenCode (u otro harness elegido por Lino)
- **Coordinación:** Architect de fase (retorna a CTO) · Roles: Developer, Tester, Auditor

## 1. Objetivo y resultado verificable
Dejar operativo el entorno reproducible de `mediashrink-cloud` sin coste ni cuenta AWS: `.env.example` alineado al SDD, workspaces TypeScript (`frontend/` Vite+React y `backend/` Hono+`sharp`+Vitest+Playwright), contenedor Docker limitado de `aws/aws-emulator` (`--memory=2g --cpus="2.0"`), bootstrap de Terraform validado con `terraform validate`/`plan`, repositorio público `mediashrink-cloud` en GitHub con archivos de IA visibles (`G-6`/`G-6b`), y workflow base de CI en GitHub Actions en verde.

## 2. Dependencias y gates de entrada (Checklist DoR)
- **Contratos y fases previas requeridas:** Gate 1 (`G-1`) aprobado por Lino (2026-11-17); `constitution.md`, `spec.md`, `plan.md`, `tasks.md` y `ADR-001` consolidados.
- **G-2 Apertura de fase:** AUTORIZADO para Fase 0 (`P-00`).
- **G-3 Entorno (`.env`):** RESUELTO — solo `.env.example` versionable; `.env` local en `.gitignore`.
- **G-4 Base de datos:** NO APLICA en Fase 0 (DynamoDB en emulador entra en Fase 1).
- **G-5 Servicios externos:** NO APLICA (100 % local/`aws-emulator`).
- **G-6 Git / GitHub:** AUTORIZADO desde Fase 0 (repositorio público `mediashrink-cloud`).
- **G-6b Archivos de agentes/IA en GitHub:** PERMITIDO SUBIR (`AGENTS.md`, `STATE.md`, `.agents/`, `docs/sdd/`, `reports/`).
- **G-7 Docker (`aws/aws-emulator`):** AUTORIZADO con límite `--memory=2g --cpus="2.0"`, encendido solo en pruebas/desarrollo y apagado al terminar.
- **G-8 Dependencias:** AUTORIZADO para instalación de paquetes en Fase 0.

## 3. Ámbito exclusivo de archivos
| Área | Rutas de escritura exclusivas | Rol propietario | ¿Compartido en escritura? |
|---|---|---|---|
| Configuración y tooling | `.env.example`, `.gitignore`, `package.json`, `tsconfig.base.json`, `docker-compose.yml`, `Dockerfile*` | Developer | No |
| Workspaces iniciales | `frontend/**`, `backend/**` (solo esqueleto base + healthcheck/humo) | Developer | No |
| IaC bootstrap | `infra/terraform/**` | Developer | No |
| Pruebas y CI | `tests/unit/**`, `.github/workflows/**` | Developer | No |
| Docs técnicas | `docs/architecture/**`, `docs/runbooks/**`, `AGENTS.md` (solo §6 comandos comprobados) | Developer / Architect | No |
| Reportes de fase | `reports/implementation/F00/**`, `reports/audits/F00/**`, `reports/verification/F00-architect.md` | Todos los roles | No |

## 4. Tareas de la fase
| ID | Tarea | Depende de | Rol | Riesgo (1-3) | Criterios de aceptación |
|---|---|---|---|---|---|
| `F00-T01` | Actualizar `.env.example` con variables de límites, JWT, rate-limit y emulador + esquema de validación de configuración | Ninguna | Developer | 1 | `CA-01` |
| `F00-T02` | Inicializar workspaces `frontend/` (Vite+React+TS) y `backend/` (Hono+TS+`sharp`+Vitest+Playwright) y estructura canónica | `F00-T01` | Developer | 1 | `CA-02` |
| `F00-T03` | Configurar `docker-compose.yml` (+ `Dockerfile` si aplica) para `aws/aws-emulator` con `--memory=2g --cpus="2.0"` y scripts start/stop | `F00-T01` | Developer | 2 | `CA-03` |
| `F00-T04` | Bootstrap Terraform en `infra/terraform/` (proveedor apuntando a `aws-emulator`, backend local) y validar `terraform validate`/`plan` | `F00-T03` | Developer | 2 | `CA-04` |
| `F00-T05` | Configurar `.gitignore` y crear/conectar repo público GitHub `mediashrink-cloud` (`G-6`/`G-6b`, sin `.env` ni `temporary/`) | `F00-T02` | Developer | 2 | `CA-05` |
| `F00-T06` | Configurar `.github/workflows/ci.yml` base (`install`, `typecheck`, `lint`, `test:unit`) y verificar run verde | `F00-T02`, `F00-T05` | Developer (+ Auditor) | 2 | `CA-06` |

## 5. Criterios de aceptación y verificación
| ID | Criterio verificable | Método | Rol verificador | Evidencia requerida |
|---|---|---|---|---|
| `CA-01` | `.env.example` completo sin secretos reales; test unitario de carga/validación de config pasa en `tests/unit/` | `TDD` | Tester | Salida de Vitest en `reports/implementation/F00/evidence/` |
| `CA-02` | `typecheck`, `lint` y test unitario de humo pasan con exit 0 en `frontend/` y `backend/` | `TDD` | Tester | Salida de comandos en `reports/implementation/F00/evidence/` |
| `CA-03` | Contenedor `aws/aws-emulator` arranca con límites `--memory=2g --cpus="2.0"`, responde en HTTPS local con `ca.pem` y se apaga limpio | `Integración` | Tester | Logs de arranque, healthcheck y `docker compose down` |
| `CA-04` | `terraform init`, `terraform validate` y `terraform plan` pasan sin acceso a AWS real | `Documental` / CLI | Tester | Salida de comandos Terraform en `evidence/` |
| `CA-05` | Repo público `mediashrink-cloud` conectado, archivos IA (`G-6b`) presentes y `.env`/secretos/`temporary/` excluidos | `Auditoría` / CLI | Tester + Auditor | `git status` / listado de árbol remoto + `F00-T05-auditor.md` |
| `CA-06` | CI en `.github/workflows/ci.yml` ejecuta `install`, `typecheck`, `lint`, `test:unit` en verde y Auditor cierra F00 sin hallazgos bloqueantes | `CI` + `Auditoría` | Tester + Auditor | Run CI en verde + `F00-T06-auditor.md` |

## 6. Condiciones de cierre de la fase (DoD)
- `F00-T01` a `F00-T06` con `PASSED` de Tester en `reports/implementation/F00/`.
- Revisiones de riesgo 2 cerradas por Auditor en `reports/audits/F00/` sin hallazgos bloqueantes.
- `AGENTS.md` (§6 comandos comprobados), `docs/sdd/tasks.md` y `STATE.md` actualizados.
- Informe consolidado de retorno en `reports/verification/F00-architect.md`.
