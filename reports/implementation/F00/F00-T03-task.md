# Tarea `F00-T03` — `aws/aws-emulator` en Docker con límites

| Campo | Valor |
|---|---|
| **ID completo** | `F00-T03` |
| **Fase y paquete** | Fase 0 — `docs/sdd/packages/P-00-foundation-and-emulator.md` |
| **Prioridad** | `P0` |
| **Rol implementador** | `Developer` |
| **Rol verificador** | `Tester` + `Auditor` |
| **Harness** | OpenCode |
| **Versión / Loop actual** | `v1 — Loop 1/3` |
| **Nivel de riesgo** | `2 (Relevante)` |
| **Excepción metodológica** | `Ninguna` |
| **Estimación / hitos / seguimiento** | Estimación 30 min. Hitos: (1) `docker-compose.yml`, (2) certificado `ca.pem` del emulador, (3) arranque con límites, (4) apagado limpio. Revisión ≥5 min; diagnóstico a 10 min sin progreso o >2× estimación. |
| **Procesos y verificación proporcional** | `docker compose up -d`, healthcheck HTTPS con `ca.pem`, `docker compose down`. Timeout arranque 180 s. **Observación de Architect:** en la comprobación DoR no se encontró `docker` en PATH ni en rutas habituales; el implementador debe localizarlo o instalarlo solo dentro de G-7/G-8. Si no está disponible, reportar el bloqueo sin fabricar evidencia; Tester emitirá `NEEDS_CONTEXT`, no `PASSED`. |

## 1. Fuentes aprobadas y criterios de aceptación
- **Requisitos:** `ADR-001` Decisión 4, `NFR-01`, `NFR-02`, `constitution.md` PR-04, `plan.md` §5, `P-00` §5 `CA-03`.
- **Criterios asignados:**
  - `CA-03`: `docker-compose.yml` levanta `aws/aws-emulator` con `--memory=2g --cpus="2.0"`, expone HTTPS local con `ca.pem`, responde al healthcheck y se apaga limpio (`docker compose down`). Evidencia de logs, healthcheck y apagado.

## 2. Entradas, contratos y entorno
- **Revisión previa:** `F00-T01` PASSED (variables del emulador). Los límites de recursos son obligatorios; no se levanta el contenedor sin ellos.
- **Gates:** G-7 AUTORIZADO con límites y apagado al terminar; G-8 autorizado para instalar dependencias; G-5 no aplica (sin servicios reales).

## 3. Ámbito exclusivo de archivos y límites
- **Escritura permitida:** `docker-compose.yml`, `Dockerfile*`, `docs/runbooks/development-workflow.md` (comandos comprobados), `reports/implementation/F00/evidence/F00-T03-*`.
- **Prohibido tocar:** `infra/terraform/**`, `.github/**`, `frontend/**`, `backend/**`, `STATE.md`, `tasks.md`. No dejar el contenedor encendido al terminar.

## 4. Método exigido y entregables
- **Método:** verificación de integración + comandos declarados; documentar versión de imagen, puertos, límites y ruta de `ca.pem` sin rutas locales absolutas en artefactos públicos.
- **Reporte:** `F00-T03-developer.md` (con 7 campos si hay bloqueo). **Evidencia:** `evidence/F00-T03-up.txt`, `F00-T03-healthcheck.txt`, `F00-T03-down.txt`.
- **Dictamen:** `F00-T03-tester.md`. **Auditoría:** `reports/audits/F00/F00-T03-auditor.md`. **Cierre:** `F00-T03-architect.md`.

---

## 5. Addendum de reanudación (CTO, 2026-11-17 — Opción A, sin G-9)

- **Versión / Loop:** `v2 — Loop 1/3` (el loop anterior NO se consumió: `NEEDS_CONTEXT` por recurso ausente).
- **Entorno:** Docker Desktop 4.99.0 / engine 29.9.3 y Terraform 1.17.2 instalados por Lino. **PATH no incluye los binarios**: Docker CLI en `D:\Programs\DevApps\Containers\Docker\Desktop\resources\bin\docker.exe`, Terraform en `D:\Programs\DevApps\DevOps\Terraform\CLI\terraform.exe`. Todo subagente debe anteponer esos directorios a `$env:PATH` o usar rutas absolutas.
- **Hardening previo (Auditor):**
  - `A-01`: fijar la imagen en `docker-compose.yml` por digest inmutable `ghcr.io/xsavikx/aws-emulator@sha256:<digest>` (el digest ya constaba en un comentario), verificándolo con `docker image inspect` cuando esté disponible.
  - `A-02`: documentar en `docs/runbooks/development-workflow.md` la procedencia de la imagen comunitaria (AWS no publica imagen oficial), tag/digest y responsable de actualización.
- **Verificación en vivo exigida (G-7: `--memory=2g --cpus="2.0"`; apagar al terminar):** `docker compose config`, `docker compose up -d`, `docker inspect` (memoria `2147483648`, nanoCpus `2000000000`), healthcheck HTTPS con `ca.pem` y `docker compose down`.
- **Evidencias reales obligatorias:** `evidence/F00-T03-config.txt`, `F00-T03-up.txt`, `F00-T03-inspect.txt`, `F00-T03-healthcheck.txt`, `F00-T03-down.txt`, además de `F00-T03-a01-digest.txt` y `F00-T03-a02-runbook.txt`.
- **Dictámenes:** Tester emite `PASSED` con evidencia propia (no basta la del Developer); Auditor añade addendum append-only en `reports/audits/F00/F00-T03-auditor.md` (sección 6, sin borrar hallazgos v1) cerrando A-01/A-02/A-04 y A-05 (A-05 se cierra en T05); Architect cierra con `F00-T03-architect.md`.
- **Sin `G-9` ni `G-10`:** la verificación es real; ningún riesgo se da por aceptado sin Lino.
