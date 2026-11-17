# Especificación funcional — MediaShrink Cloud

> **ESTADO: APROBADO (Gate 1 / G-1, Lino, 2026-11-17).** Consolidado por CTO (Atenea) con `D-01`…`D-16` y `A-01`…`A-07`.

Incluye los invariantes de `constitution.md`. Fuente: entrevista D-01…D-16 + ADR-001.

---

## 1. Actores

| Actor | Descripción |
|---|---|
| **Visitante** | Se registra con correo y contraseña (D-16) |
| **Usuario autenticado** | Sube lotes, consulta progreso, descarga y borra **sus** lotes |
| **Usuario demo** | Cuenta creada por el script seed (D-13) |
| **Worker/Lambda** | Consume SQS, optimiza con `sharp`, actualiza DynamoDB |
| **Architect / CTO** | Coordinación del proceso; no es usuario de producto |

## 2. Requisitos funcionales

| ID | Requisito | Criterio verificable |
|---|---|---|
| **FR-01** | Registro de usuario con contraseña hasheada | `POST /auth/register` crea usuario; la contraseña nunca se almacena en claro; registro público habilitado (D-16) |
| **FR-02** | Login JWT (access + refresh) | `POST /auth/login` devuelve tokens; rutas privadas rechazan peticiones sin token válido (D-06) |
| **FR-03** | Renovación de sesión | `POST /auth/refresh` devuelve nuevo access token sin reenviar credenciales |
| **FR-04** | Cuentas demo sintéticas | El script seed crea usuarios e imágenes pequeñas; ejecutable en local/CI (D-13) |
| **FR-05** | Carga por drag & drop y selector | La SPA acepta imágenes arrastradas y seleccionadas; muestra errores de validación |
| **FR-06** | Elección de preset | El usuario elige uno de tres presets por lote: Alta / Equilibrada / Máxima compresión (D-03) |
| **FR-07** | Validación estricta antes de subir | Se rechazan archivos por magic bytes, MIME real, extensión, tamaño, píxeles y formatos peligrosos (D-08, D-11) |
| **FR-08** | Presigned URL de subida | La API crea el job en DynamoDB (`PENDING`) y devuelve URL firmada hacia S3 `raw` con prefijo `userId` |
| **FR-09** | Subida directa a S3 | El navegador sube a `raw` sin pasar el binario por la API |
| **FR-10** | Encolado del trabajo | La confirmación de subida publica en SQS; la cola tiene DLQ configurada |
| **FR-11** | Procesamiento de imagen | El worker genera WebP, AVIF y miniatura, elimina **todos** los metadatos y guarda en `optimized` (D-02, D-11) |
| **FR-12** | Métricas reales | Se persisten bytes antes/después, `% ahorro` y `exifStripped: true` (D-10) |
| **FR-13** | Reintentos y DLQ | 3 reintentos; agotados → DLQ, imagen `FAILED`, el resto del lote continúa (D-09) |
| **FR-14** | Consulta de estado por polling | `GET /jobs/:id` devuelve estado y progreso; la SPA consulta cada ~2 s (D-15) |
| **FR-15** | Comparativa antes/después | La SPA muestra original (`raw`) vs. optimizado (`optimized`) dentro de los 30 días de retención (`A-07`) |
| **FR-16** | Tabla de métricas | La SPA muestra por imagen: formato, preset, bytes antes/después y % ahorro |
| **FR-17** | Descarga individual | URL presignada por archivo optimizado y por miniatura (`WebP`, `A-04`) |
| **FR-18** | Descarga ZIP | ZIP con todos los resultados optimizados (`WebP` + `AVIF`) y miniaturas del lote (`A-05`) |
| **FR-19** | Borrado manual del lote | Elimina `raw` + `optimized` y la fila DynamoDB del lote del usuario |
| **FR-20** | Limpieza automática | Ciclo de vida 30 días en S3 y TTL 30 días en DynamoDB (D-10) |
| **FR-21** | Aislamiento por usuario | Ningún endpoint devuelve o modifica lotes de otro `userId` (D-07) |
| **FR-22** | Interfaz en español con tema Claro/Dark | Tema inicial Claro con selector persistente Claro/Dark (`A-01`); textos en español (D-12, D-16) |

## 3. Requisitos no funcionales

| ID | Requisito |
|---|---|
| **NFR-01** | Ejecución local y en CI sin cuenta AWS ni coste, mediante `aws/aws-emulator` (ADR-001) |
| **NFR-02** | Docker con `--memory=2g --cpus="2.0"`, encendido solo en pruebas/desarrollo (G-7) |
| **NFR-03** | Seguridad: contraseñas hasheadas, JWT firmado, CORS explícito, validación Zod, errores sin filtrar secretos o rutas internas (G-3) |
| **NFR-04** | Toda lógica de producto con cobertura `RED → GREEN → REFACTOR` en `tests/` |
| **NFR-05** | Fixtures pequeños (100×100 px) para unitarias e integración (runbook) |
| **NFR-06** | Sin secretos en repositorio: solo `.env.example` se versiona |
| **NFR-07** | Trazabilidad: reportes por tarea en `reports/implementation/<phase-id>/` y cierres de fase en `reports/verification/` |

## 4. Modelo de datos (DynamoDB)

| Campo | Tipo | Descripción |
|---|---|---|
| `userId` | string (PK) | Dueño del lote; prefijo S3 |
| `jobId` | string (SK) | Identificador del lote |
| `status` | enum | `PENDING` / `PROCESSING` / `COMPLETED` / `FAILED` / `PARTIAL` |
| `preset` | enum | `HIGH` / `BALANCED` / `MAX_COMPRESSION` `[PROPUESTA: nombres a confirmar en Fase 1]` |
| `formats` | string[] | `["webp","avif"]` |
| `bytesBefore` | number | Suma de bytes originales |
| `bytesAfter` | number | Suma de bytes optimizados |
| `savingsPct` | number | `(bytesBefore − bytesAfter) / bytesBefore × 100` |
| `exifStripped` | boolean | `true` si se eliminaron todos los metadatos |
| `createdAt` / `updatedAt` | string (ISO) | Timestamps |
| `ttl` | number | Unix seconds = `createdAt + 30 días` |

Por imagen se mantiene un item hijo con `imageId`, estado individual, bytes y motivo de fallo si aplica (D-09).

## 5. Contratos de API (borrador)

| Método | Ruta | Autenticación | Propósito |
|---|---|---|---|
| `POST` | `/auth/register` | No | Alta de usuario |
| `POST` | `/auth/login` | No | Emisión de JWT |
| `POST` | `/auth/refresh` | Refresh token | Renovación |
| `POST` | `/jobs` | JWT | Crear lote + Presigned URLs |
| `POST` | `/jobs/:id/confirm` | JWT | Confirmar subida a `raw` y publicar tarea en SQS |
| `GET` | `/jobs/:id` | JWT | Estado y progreso (polling) |
| `GET` | `/jobs/:id/download/:imageId` | JWT | Descarga individual |
| `GET` | `/jobs/:id/download.zip` | JWT | Descarga ZIP |
| `DELETE` | `/jobs/:id` | JWT | Borrado manual |

Los contratos Zod se congelan en Fase 1 y solo se consumen desde el frontend (sin redefiniciones duplicadas).

## 6. Estados y errores

- `PENDING` → `PROCESSING` → `COMPLETED`; con fallos parciales → `PARTIAL` (hay `FAILED`) o `FAILED` si falla todo.
- Errores de validación: `400` con campo y motivo. No autorizado: `401`. Acceso a lote ajeno: `404` (no filtrar existencia).
- Fallo de worker tras 3 reintentos: mensaje a DLQ, estado `FAILED` en la imagen, sin detener el lote.

## 7. Fuera de alcance (MVP)

- Cognito, OAuth externo o cualquier servicio AWS real.
- SSE/WebSocket para progreso.
- Edición de imágenes, filtros o retoque.
- Compartir lotes públicamente o enlaces sin autenticación.
- Internacionalización (solo español) y subida desde móvil nativo.
- Conservación de metadatos o de imágenes originales en `optimized`.

## 8. Aceptación

La especificación se considera satisfecha cuando FR-01…FR-22 y NFR-01…NFR-07 tienen evidencia de Tester (`PASSED`) y, por riesgo 2–3, revisión de Auditor sin hallazgos bloqueantes, antes del cierre de la Fase Final.
