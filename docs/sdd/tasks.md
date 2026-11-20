# Roadmap único — MediaShrink Cloud

> **ESTADO: SDD APROBADO (Gate 1, Lino, 2026-11-17).** Fase 0 (`P-00`) autorizada para despacho; fases posteriores requieren cierre previo y autorización explícita (`G-2`).

Estructura según `WORKFLOW.md` §4: Fase 0 → Fase 1 → fases desacopladas (2, 3, 4) → Fase Final.

```text
Fase 0: Entorno, .env.example, Docker/emulator, bootstrap Terraform, Git y CI base
                          |
Fase 1: Fundamentos Críticos (contratos Zod congelados, DynamoDB, auth JWT, seed, reglas puras TDD)
                          |
       +------------------+------------------+
       |                  |                  |
    Fase 2            Fase 3            Fase 4
   API + worker      SPA (UI)         Terraform + CI
   (Harness 1)      (Harness 2)       (Harness 3)
       |                  |                  |
       +------------------+------------------+
                          |
Fase Final: Integración, E2E, auditoría de seguridad, pruebas de Lino,
            README, borrado verificado de temporary/, publicación (G-12)
```

---

## Fase 0 — Entorno, credenciales y herramientas base (`F00`)

- **Estado:** **`CERRADA — FASE_COMPLETA`** (2026-11-17) — `F00-T01`…`F00-T06` `PASSED`; CA-01…CA-06 verificados por Tester; auditorías sin bloqueantes. Seguimientos no bloqueantes: P4 → F05/G-12, deudas CI/herramientas a tareas futuras. `P-01` NO iniciada |
- **Objetivo:** proyecto ejecutable en local/CI sin cuenta AWS: `.env.example`, `package.json`, `docker-compose.yml`, bootstrap Terraform, repo GitHub público, CI base de typecheck/lint.
- **Gates:** G-1 aprobado, G-3 (solo `.env.example`), G-6 + G-6b (repo público `mediashrink-cloud`, incluir archivos IA), G-7 (Docker `2g`/`2.0`), G-8 (dependencias), G-5 = no aplica.
- **Riesgo:** 2 → Auditor en cierre.

| ID | Tarea | Depende de | Rol | Criterio verificable |
|---|---|---|---|---|
| `F00-T01` | Definir `.env.example` y validación de configuración | — | Developer | **PASSED (Loop 1/3)** — `F00-T01-architect.md`; 30/30 tests, G-3 sin hallazgos |
| `F00-T02` | Inicializar workspace Vite/React + Hono + Vitest/Playwright | `F00-T01` | Developer | **PASSED (Loop 1/3)** — `F00-T02-architect.md`; typecheck/lint 0, 35/35 tests, `npm ci` reproducible |
| `F00-T03` | `docker-compose.yml` para `aws/aws-emulator` con límites | `F00-T01` | Developer | **PASSED (v2, Loop 1/3)** — `F00-T03-architect.md`; `up`/`inspect` (`2147483648`/`2000000000`)/TLS `ca.pem`/`down` reales; A-01/A-02 cerrados; A-05 → T05 |
| `F00-T04` | Bootstrap Terraform (proveedor Emulator, backend local) | `F00-T03` | Developer | **PASSED (Loop 1/3)** — `F00-T04-architect.md`; `fmt`/`init`/`validate`/`plan` exit 0, STS en vivo, 0 cambios de infra, sin `apply` |
| `F00-T05` | Repo GitHub público + `.gitignore` (excluir `.env`, secretos, `temporary/`) | `F00-T02` | Developer | **PASSED (Loop 1/3)** — `F00-T05-architect.md`; repo `PUBLIC`, G-6b 5/5, 0 secretos; A-05/T04-A-01/A-02 cerrados; P4 → F05 |
| `F00-T06` | CI base (install, typecheck, lint, unit test) | `F00-T02`, `F00-T05` | Developer | **PASSED (Loop 1/3)** — `F00-T06-architect.md`; run `44184037945` `success`, 4/4 pasos |

---

## Fase 1 — Fundamentos críticos (`F01`)

- **Estado:** **`CERRADA — FASE_COMPLETA (P-01)`** — `F01-T01`…`F01-T05` `PASSED`; CA-01…CA-05 verificados; auditorías sin bloqueantes. Fases 2/3/4 NO iniciadas (`docs/sdd/packages/P-01-critical-foundations.md`)
- **Objetivo:** contratos congelados y reglas puras bajo TDD; base de datos y autenticación operativos en emulador.
- **Gates:** G-4 (DynamoDB en emulador), contratos de Fase 0 congelados.
- **Riesgo:** 3 (auth + privacidad) → Auditor obligatorio.

| ID | Tarea | Depende de | Rol | Criterio verificable |
|---|---|---|---|---|
| `F01-T01` | Esquemas Zod y tipos compartidos (auth, jobs, imágenes, métricas) | `F00-T02` | Developer | **PASSED (1/3)** — 14 contratos v1 (hash `5d0082f8…`), 32/32 tests, 72/72 suite, sin duplicación; A-01 cerrado por decisión CTO |
| `F01-T02` | Cliente DynamoDB y modelo de datos (TTL 30 días, `userId`/`jobId`) | `F01-T01` | Developer | **PASSED (1/3)** — 19/19 integración, TTL 30 d, 6/6 aislamiento, `npm ci` + cobertura reproducibles |
| `F01-T03` | Auth JWT propio: registro, login, refresh, hash de contraseña | `F01-T01` | Developer | **PASSED (1/3)** — 44/44 auth, 150/150 suite, scrypt + JWT HS256, 401/404 y rate limit; MEDIUM derivados a F02/F04 |
| `F01-T04` | Script seed sintético (usuarios demo + imágenes 100×100) | `F01-T02`, `F01-T03` | Developer | **PASSED (1/3)** — idempotente (12→12), dry-run sin escrituras, 6/6 integración, 188/188 suite |
| `F01-T05` | Reglas puras: validación estricta, ahorro y estados | `F01-T01` | Developer | **PASSED (1/3)** — 47/47, 100 % cobertura, 119/119 suite; AVIF animado aprobado por CTO; A-03 cobertura en corrección por T02 |

---

## Fase 2 — API y worker de procesamiento (`F02`) — Harness 1

- **Estado:** `CERRADA — FASE_COMPLETA` (`reports/verification/F02-architect.md`, revisada por CTO el 2026-11-18)
- **Ámbito exclusivo:** `backend/`, `tests/unit/`, `tests/integration/`. Sin escritura en `frontend/` ni `infra/terraform/`.
- **Riesgo:** 3 (privacidad + DLQ) → Auditor obligatorio.

| ID | Tarea | Depende de | Rol | Criterio verificable |
|---|---|---|---|---|
| `F02-T01` | Rutas Hono `/jobs` y `GET /jobs/:id` con filtro `userId` | `F01` | Developer | `app.request` en memoria; 404 para lote ajeno |
| `F02-T02` | Presigned URLs S3 `raw` y `optimized` | `F02-T01` | Developer | Subida/descarga directa verificada contra emulador |
| `F02-T03` | Worker `sharp`: WebP + AVIF + miniatura, sin metadatos | `F01-T05` | Developer | Tests comprueban salida y ausencia EXIF/GPS |
| `F02-T04` | Consumidor SQS + DLQ, 3 reintentos, fallo parcial | `F02-T03` | Developer | Mensaje a DLQ tras 3 intentos; lote continúa |
| `F02-T05` | Descarga individual y ZIP + borrado manual | `F02-T02` | Developer | ZIP y DELETE verificados; aislamiento por usuario |
| `F02-T06` | Actualización de métricas en DynamoDB | `F02-T03` | Developer | bytes antes/después, `% ahorro`, `exifStripped` persistentes |

---

## Fase 3 — SPA / UI (`F03`) — Harness 2

- **Estado:** `CERRADA — PASSED` (`reports/verification/F03-architect.md` addendum final; revisada por CTO el 2026-11-18)
- **Ámbito exclusivo:** `frontend/`, `tests/e2e/` (preparación). Sin escritura en `backend/` ni `infra/terraform/`.
- **Riesgo:** 2 → Auditor en el cierre.

| ID | Tarea | Depende de | Rol | Criterio verificable |
|---|---|---|---|---|
| `F03-T01` | Estructura SPA, router y tema Claro/Dark | `F01-T01` | Designer | Selector de tema persistente (Claro por defecto, `A-01`); español |
| `F03-T02` | Registro/login/refresh en UI | `F03-T01` | Designer | Flujo completo con JWT; errores claros |
| `F03-T03` | Drag & drop y selección de preset | `F03-T01` | Designer | Tres presets; validación visible antes de subir |
| `F03-T04` | Polling `GET /jobs/:id` y barra de progreso | `F03-T02` | Designer | Actualización ~2 s; estados `PENDING/PROCESSING/COMPLETED/PARTIAL/FAILED` |
| `F03-T05` | Comparativa antes/después y tabla de métricas | `F03-T04` | Designer | Cifras reales; sin ocultar ahorro negativo |
| `F03-T06` | Descarga individual/ZIP y borrado de lote | `F03-T04` | Designer | Acciones verificables en navegador |

---

## Fase 4 — Infraestructura completa y CI de integración (`F04`) — Harness 3

- **Estado:** `CERRADA — FASE_COMPLETA` (`reports/verification/F04-architect.md`; run `44312560558` `success`; revisada por CTO el 2026-11-18)
- **Ámbito exclusivo:** `infra/terraform/`, `.github/`. Sin escritura en `frontend/` ni `backend/`.
- **Riesgo:** 2–3 → Auditor según resultados.

| ID | Tarea | Depende de | Rol | Criterio verificable |
|---|---|---|---|---|
| `F04-T01` | Buckets S3 `raw`/`optimized` con ciclo de vida 30 días | `F00-T04` | Developer | `terraform plan` contra emulador; sin bucles de eventos |
| `F04-T02` | SQS + DLQ con política de reintentos | `F04-T01` | Developer | DLQ creada y enlazada; `maxReceiveCount` = 3 |
| `F04-T03` | DynamoDB con TTL 30 días e índices por `userId` | `F04-T01` | Developer | TTL verificado en emulador |
| `F04-T04` | IAM, CORS y parámetros de entorno | `F04-T01` | Developer | Menos privilegios; CORS explícito para la SPA |
| `F04-T05` | CI de integración contra `aws/aws-emulator` | `F00-T06`, `F04-T02` | Developer | Emulador levantado/apagado en el job; sin coste |

---

## Fase Final — Integración, verificación y entrega (`F05`)

- **Estado:** `CERRADA — producto` (2026-11-19) — `F05-AUDIT-FULL`: fix `name` persistido + UX-01..03, tests TDD 338/338 (loop 2: AUD-02 Claim Check canónico, AUD-03 contrato v1.1.0, AUD-05 ventana API propia, AUD-06 host S3 canónico), integración real Claim Check > 400 KiB, E2E real sin muletas 1/1 + 1/1 legacy, rate limits 5/min auth vs 120/min API, P4 0 fugas en worktree; 3 reportes (tester/auditor/architect) + `STATE.md` actualizados; `G-12` retenido |
- **Riesgo:** 3 (auditoría final de seguridad) → Auditor obligatorio.

| ID | Tarea | Depende de | Rol | Criterio verificable |
|---|---|---|---|---|
| `F05-T01` | Integración global y suite completa (unit/integration/E2E) | `F02`,`F03`,`F04` | Tester | Suite verde; reporte en `reports/verification/` |
| `F05-T02` | Auditoría final de seguridad y privacidad | `F05-T01` | Auditor | Sin hallazgos críticos/altos; EXIF/GPS y aislamiento verificados |
| `F05-T03` | Pruebas exploratorias de Lino y correcciones TDD | `F05-T02` | Architect/Developer | **CERRADA (2026-11-20):** `F05-AUDIT-FULL`, `F05-QA-HUMAN` (`31/31 PASSED`), `F05-UX-HEADER-AUTH` (`31/31 PASSED`) y validación manual de Lino |
| `F05-T04` | README público y selección de archivos (G-6b) | `F05-T02` | Designer/CTO | **CERRADA (2026-11-20):** Portada, badges AWS/Terraform/Docker/CI, arquitectura AWS serverless + `aws/aws-emulator`, 18 PNG, `355/355` unitarias |
| `F05-T05` | Borrado verificado de `temporary/` y reejecución de build/tests | `F05-T04` | Architect (G-11) | **CERRADA (`PASSED`):** `temporary/` inexistente; build y tests pasan sin él |
| `F05-T06` | Publicación en GitHub y cierre (`STATE.md`, `PROJECTS.md`) | `F05-T05` (G-12) | CTO | **CERRADA (2026-11-20):** Push final autorizado por Lino (`G-12`); estado final **«Producto terminado»** |

---

## Regla de ejecución

Tras Gate 1, el CTO redacta un paquete `docs/sdd/packages/P-xx.md` por fase con DoR completo (modalidad de estructura, ámbito exclusivo, riesgo, gates, criterios verificables) y entrega el prompt a Lino. **Nota:** ningún paquete ni prompt existe todavía; este roadmap es solo la propuesta de secuencia.
