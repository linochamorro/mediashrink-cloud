# Roadmap integral de pruebas y evidencia visual (Playwright CLI) — MediaShrink Cloud

Vigente: 2026-11-18 · Autorizado por Lino tras aceptación `F05-T03` y autorización `G-11` (previo a `G-12`).

## 1. Matriz de pruebas por capa y componente

| Capa / Parte | Tipo de prueba | Qué valida | Evidencia requerida |
|---|---|---|---|
| **0. Independencia tras `G-11`** | Verificación post-borrado | `temporary/` inexistente; `typecheck`, `lint`, `build`, `test:unit` (303/303) y `tests/integration` (97/97) en verde sin `temporary/` | Logs `F05-T05-*` en `reports/implementation/F05/evidence/` |
| **1. Infraestructura (`infra/terraform/` + `aws/aws-emulator`)** | IaC + Integración en vivo | `terraform fmt -check`, `validate`, `apply` (11 recursos); 2 buckets S3 (`raw`/`optimized`) con lifecycle 30 d y sin bucles; SQS + DLQ (`maxReceiveCount=3`); DynamoDB (`userId`/`jobId`, TTL `ENABLED`); CORS exacto | Salida Terraform + `tests/integration/infra/` |
| **2. Contratos, Auth y Persistencia (`backend/src/{contracts,auth,db}/`)** | Unitarias + Integración | Catálogo Zod v1 congelado; `register`/`login`/`refresh` (JWT HS256 + `scrypt`); `401/404` sin oracle; `429` rate limit no suplantable; aislamiento `userId` en DynamoDB; seed sintético idempotente | Salida Vitest (`tests/unit/` + `tests/integration/`) |
| **3. API HTTP y Storage (`backend/src/{api,storage}/`)** | Integración HTTP + S3 | `POST /jobs` (`{ preset, files }` → `{ job, uploads }`); Presigned PUT/GET en `raw`/`optimized`; `POST /jobs/:id/confirm` idempotente bajo concurrencia; descarga individual y ZIP (con tope `413`); `DELETE /jobs/:id` | Salida `tests/integration/api/` |
| **4. Worker de imágenes (`backend/src/worker/` + `sharp`)** | Unitarias + Privacidad + Resiliencia | Conversión **WebP + AVIF + miniatura WebP**; **strip total EXIF/XMP/IPTC** (`exifStripped: true` con control negativo); `HeadObject` real para `bytesBefore`/`bytesAfter`; guarda de tamaño `A-05`; archivo corrupto → 3 reintentos → **DLQ** + estado `PARTIAL`/`FAILED` sin abortar lote | Salida `tests/unit/worker/` + `tests/integration/worker/` |
| **5. Frontend SPA (`frontend/`) — Navegador real** | E2E real + QA visual (Playwright CLI) | Flujos reales sin mocks contra `backend` + `aws/aws-emulator` (ver §2) | Salida Playwright + **Screenshots PNG** en `reports/implementation/F05/evidence/qa-roadmap/` |
| **6. Seguridad e Higiene final** | Auditoría / Estático | `0` secretos, `0` rutas Windows absolutas en artefactos `G-6b`, allowlist HTTPS en SPA (`F03-AUD-03`), `0` contenedores/puertos residuales | Checklist de cierre en `reports/verification/F05-qa-roadmap-architect.md` |

## 2. Catálogo obligatorio de screenshots vía Playwright CLI (entorno real, sin mocks)

Todos los screenshots se capturan con **Playwright CLI** contra la app real corriendo sobre `aws/aws-emulator` (`frontend` + `backend` + `seed`) y se guardan en `reports/implementation/F05/evidence/qa-roadmap/`:

| # | Archivo PNG | Escenario verificado |
|---|---|---|
| `01` | `01-auth-login-claro.png` | Pantalla de acceso en español, tema **Claro** por defecto |
| `02` | `02-auth-error-credenciales.png` | Mensaje de error acotado y seguro ante credenciales inválidas (sin detalles internos) |
| `03` | `03-auth-registro.png` | Flujo de registro público de usuario ficticio |
| `04` | `04-dashboard-tema-oscuro.png` | Panel autenticado tras cambiar a tema **Oscuro** y recargar (persistencia verificada) |
| `05` | `05-upload-validacion-error.png` | Rechazo en cliente de archivo no permitido (ej. SVG o exceso de tamaño) |
| `06` | `06-upload-lote-preset-progreso.png` | Carga *drag & drop* con selector de 3 presets y barra de progreso en polling |
| `07` | `07-resultados-comparativa-metricas.png` | Lote `COMPLETED`: comparativa visual *antes vs. después*, bytes reales, `% ahorro` y badge `EXIF eliminado` |
| `08` | `08-descarga-individual-y-zip.png` | Confirmación de descarga individual y descarga ZIP del lote |
| `09` | `09-lote-parcial-o-error.png` | Estado `PARTIAL`/`FAILED` en UI ante archivo corrupto enviado a DLQ (o estado de error controlado) |
| `10` | `10-borrado-manual-lote.png` | Confirmación de borrado manual (`DELETE /jobs/:id`) y lista actualizada |
| `11` | `11-aislamiento-usuario-b.png` | Sesión de `bruno.demo@example.com` confirmando que no ve los lotes de `ana.demo@example.com` |
| `12` | `12-logout-limpio.png` | Tras cerrar sesión, sin datos ni previews residuales en pantalla |
