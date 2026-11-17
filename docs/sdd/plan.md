# Plan técnico — MediaShrink Cloud

> **ESTADO: APROBADO (Gate 1 / G-1, Lino, 2026-11-17).** Consolidado por CTO (Atenea). Hash de contraseñas: `scrypt` nativo (`node:crypto`) o `bcryptjs` (`A-02`); rate limiting en auth configurable por `.env` (`A-06`).

Estrategia técnica derivada de ADR-001, `docs/architecture/` y la especificación.

---

## 1. Arquitectura (mapa lógico)

```text
[ Navegador SPA — Vite + React + TS, español, tema Claro/Dark ]
        |  JWT access token
        v
[ API Hono (Lambda / Node local) ]  ---> [ DynamoDB: jobs + imágenes ]
        |  Presigned URL (PUT)                     ^
        v                                          |
[ S3 raw  (prefijo userId) ]                       |
        |  confirmación                            |
        v                                          |
[ SQS + DLQ ] ---> [ Worker/Lambda + sharp ] ------+
                          |
                          v
                 [ S3 optimized (prefijo userId) ]
```

- Separación real: el binario nunca atraviesa la API; subida y descarga usan URLs presignadas.
- TTL/ciclo de vida de 30 días en DynamoDB y S3 (D-10).

## 2. Estructura de código (canónica, AGENTS §3)

| Ruta | Contenido | Propietario de fase |
|---|---|---|
| `frontend/` | SPA Vite + React + TS, auth UI, drag & drop, polling, comparativa, tema | Fase 3 |
| `backend/src/api/` | Rutas Hono: auth, jobs, descarga, borrado | Fase 2 |
| `backend/src/worker/` | Consumidor SQS + pipeline `sharp` | Fase 2 |
| `backend/src/contracts/` | Esquemas Zod y tipos compartidos (fuente única, congelada en Fase 1) | Fase 1 |
| `frontend/src/api/types.generated.ts` | Tipos consumidos por el frontend, generados en Fase 1 (solo lectura después) | Fase 1 |
| `infra/terraform/` | Buckets, ciclo de vida, SQS + DLQ, DynamoDB, IAM, CORS | Fase 0 (bootstrap) / Fase 4 (completo) |
| `tests/unit/`, `tests/integration/`, `tests/e2e/` | Suite permanente | Según fase |
| `tools/scripts/seed` | Script seed sintético (usuarios + imágenes) | Fase 1 |
| `temporary/` | Scratch efímero; borrado verificado en Fase Final | — |

> Nota `[PROPUESTA]`: la ubicación exacta de los contratos compartidos y del archivo de tipos generado se fija en Fase 1 para garantizar propiedad exclusiva de archivos y evitar colisiones entre fases paralelas.

## 3. Flujos técnicos

### 3.1 Alta y autenticación
1. `POST /auth/register`: validación Zod, hash de contraseña (bcrypt/argon2 `[PROPUESTA A-02]`), item de usuario.
2. `POST /auth/login`: verificación, JWT access (corta duración) + refresh.
3. Middleware Hono valida el access token y extrae `userId`; las rutas de job filtran por ese valor (D-06, D-07).
4. `POST /auth/refresh`: valida refresh y emite nuevo access.

### 3.2 Subida y procesamiento
1. `POST /jobs`: valida preset, límites y lista de archivos; crea job `PENDING` con `userId`; devuelve Presigned URLs a `raw/<userId>/<jobId>/`.
2. Navegador sube cada binario directamente a S3.
3. Confirmación → mensaje SQS con `userId`, `jobId`, `imageId`, claves S3.
4. Worker: descarga de `raw` → valida magic bytes/MIME/dimensiones → elimina todos los metadatos → genera WebP + AVIF + miniatura con `sharp` → guarda en `optimized/<userId>/<jobId>/` → actualiza DynamoDB con bytes y `% ahorro`.
5. Fallo: reintento hasta 3; agotados, mensaje a DLQ e imagen `FAILED`; el lote sigue (D-09).

### 3.3 Consulta, descarga y limpieza
1. `GET /jobs/:id`: estado agregado y por imagen; la SPA hace polling ~2 s (D-15).
2. Descarga individual: URL presignada al objeto optimizado/miniatura.
3. ZIP: generación al vuelo desde `optimized` del lote `[PROPUESTA A-05]`.
4. `DELETE /jobs/:id`: borra objetos `raw` y `optimized` del lote y su item DynamoDB (D-05).
5. Terraform configura ciclo de vida S3 y TTL DynamoDB a 30 días (D-10).

## 4. Validación y privacidad (pipeline)

| Paso | Regla |
|---|---|
| Cabecera | Magic bytes + MIME real + extensión coherente |
| Formatos | Rechazo de SVG, GIF animados y cualquier formato no raster permitido |
| Tamaño | `MAX_FILE_SIZE` desde `.env`; rechazo antes de presignar |
| Dimensiones | `MAX_PIXELS` desde `.env`; anti-bomba de descompresión |
| Metadatos | `sharp` sin conservar metadatos: `exifStripped: true` verificable en DynamoDB y en tests |

## 5. Pruebas y verificación

| Nivel | Herramienta | Foco |
|---|---|---|
| Unitarias | Vitest | Reglas puras: validación, cálculo de ahorro, estados, JWT |
| Integración | Vitest + `aws/aws-emulator` | S3, SQS/DLQ, DynamoDB, contratos HTTP Hono (`app.request`) |
| E2E | Playwright | Registro/login, subida, polling, comparativa, descarga, borrado, tema Claro/Dark |
| UI | QA de Designer + Tester | Accesibilidad y comportamiento visual; evidencia en `reports/implementation/` |
| IaC | Comandos declarados (`terraform validate` / `plan`) | Criterio documental, sin `apply` a AWS real |

Ciclo obligatorio `RED → GREEN → REFACTOR`; Tester independiente emite `PASSED`/`NO-PASSED`; Auditor interviene en riesgo 2–3 (especialmente auth, privacidad y DLQ).

## 6. Gates por fase

| Fase | Gates que debe tener resueltos |
|---|---|
| Fase 0 | G-1 (aprobado), G-3 (`.env.example`), G-6 + G-6b (repo), G-7 (Docker), G-8 (dependencias) |
| Fase 1 | G-4 (BD en emulador), contratos congelados |
| Fases 2–4 | G-2 (apertura de fase), G-7 solo si se levanta el emulador |
| Fase Final | G-11 (borrado de `temporary/`), G-12 (publicación), aceptación de Lino |

## 7. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| `aws-emulator` no cubre algún servicio | Verificar cobertura en Fase 0; aislar la capa de infraestructura tras interfaces |
| Cold start / RAM con `sharp` | Procesamiento por streaming (libvips), fixtures pequeños en tests, límite configurable |
| Fuga entre usuarios | Filtro `userId` en cada consulta; pruebas de aislamiento unitarias e integración |
| Metadata residual | Test que verifica ausencia de EXIF/GPS en salida WebP/AVIF y miniatura |
| Colisiones entre fases paralelas | DoR: ámbito exclusivo de archivos y puertos en cada `P-xx` |
| Secretos en reportes | Revisión G-3 en cada cierre; `.env.example` sin valores reales |

## 8. Criterios de cierre

- `spec.md` FR-01…FR-22 y NFR-01…NFR-07 con `PASSED` de Tester.
- Auditor sin hallazgos bloqueantes en tareas de riesgo 2–3.
- `tasks.md` y `STATE.md` actualizados; `temporary/` borrado y build/tests reejecutados (Fase Final).
- Informe `reports/verification/<phase-id>-architect.md` por fase y retorno final al CTO.
