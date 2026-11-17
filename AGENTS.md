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
- **Confinamiento:** todo trabajo y borrado se limita a `D:\Projects\Bluemind_Lab\projects\portfolio\mediashrink-cloud`.

## 6. Comandos comprobados
*(Se completarán y validarán en Fase 0 tras inicializar `package.json`, `docker-compose.yml` y `infra/terraform/`).*
