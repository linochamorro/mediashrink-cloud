# Retorno de Fase `P-02` — MediaShrink Cloud

| Campo | Valor |
|---|---|
| **Fecha** | `2026-11-17` |
| **Fase / Paquete** | Fase 2 — `docs/sdd/packages/P-02-api-and-worker.md` |
| **Harness** | OpenCode |
| **Motivo de retorno** | **`FASE_COMPLETA`** — `F02-T01`…`F02-T06` con `PASSED` de Tester y auditorías sin `CRITICAL`/`HIGH` ni bloqueantes |
| **Estado de `tasks.md` y `STATE.md`** | **NO actualizados** por este rol: el CTO consolida al retorno (regla anti-colisión del encargo) |
| **¿Push a `main`?** | **NO** (`main` sin avanzar; commit local `469888b` sin cambios de F02 publicados) |

---

## 1. Resumen de tareas ejecutadas

| ID | Resultado | Loops | Tester | Auditor | Cierre |
|---|---|---|---|---|---|
| `F02-T01` — Rutas `/jobs` + `UserStore` + rate limit | `PASSED` | `2/3` | `PASSED` (36/36) | `READY_WITH_CONCERNS` (A-01/A-02 cerrados) | `F02-T01-architect.md` |
| `F02-T02` — Presigned URLs S3 | `PASSED` | `1/3` | `PASSED` (83/83, round-trip real) | `READY_WITH_CONCERNS` | `F02-T02-architect.md` |
| `F02-T03` — Worker `sharp` y privacidad | `PASSED` | `1/3` | `PASSED` (18/18, strip real) | `READY_WITH_CONCERNS` | `F02-T03-architect.md` |
| `F02-T04` — SQS + DLQ y publicador real | `PASSED` | `2/3` | `PASSED` (21/21) | `READY_WITH_CONCERNS` (A-01/A-02/A-03 cerrados) | `F02-T04-architect.md` |
| `F02-T05` — Descarga individual/ZIP + DELETE | `PASSED` | `2/3` | `PASSED` (112/112) | `READY_WITH_CONCERNS` (A-01/A-02 cerrados) | `F02-T05-architect.md` |
| `F02-T06` — Métricas reales + E2E backend | `PASSED` | `2/3` | `PASSED` (50/50) | `READY_WITH_CONCERNS` (A-01 cerrado por decisión CTO) | `F02-T06-architect.md` |

Ninguna tarea agotó el loop 3/3. Cuatro tareas requirieron un loop correctivo por hallazgos `MEDIUM` de auditoría; todos los hallazgos fueron corregidos y reverificados por Tester **y** Auditor. No hubo `NO-PASSED`, `BLOCKED` ni `NEEDS_CONTEXT` bloqueante tras la decisión CTO sobre dependencias.

## 2. Verificación de criterios de aceptación

Contraste contra `P-02` §5 y el SDD aprobado, no solo contra los contratos de tarea redactados por este rol.

| Criterio | Estado | Evidencia verificada por Tester |
|---|---|---|
| `CA-01` — Rutas `/jobs` con `userId`, `UserStore` DynamoDB, rate limit no suplantable | **`PASSED`** | 401 antes que el limitador, 404 indistinto, preset validado con esquemas congelados, `confirm` idempotente; **1 sola publicación** bajo concurrencia real; 7/7 integración en vivo |
| `CA-02` — Presign PUT `raw` / GET `optimized` | **`PASSED`** | 83/83; PUT de fixture 342 B con bytes idénticos en `raw`, GET 38/38 idénticos; traversal/NUL/%xx y prefijo ajeno rechazados; expiración `[60,3600]` |
| `CA-03` — Worker `sharp`: WebP+AVIF+miniatura, strip total, guarda A-05 | **`PASSED`** | 18/18; `exif/xmp/iptc=0` en las 3 salidas con control negativo que sí filtra (262 B EXIF, 82 B XMP); sin `withMetadata()`; escaneo/render no invocados con límite bajo |
| `CA-04` — SQS + DLQ: 3 reintentos, imagen `FAILED`, lote continúa | **`PASSED`** | 21/21; reintentos desde config, DLQ canónica, redelivery → 1 sola entrada DLQ, fallo de DLQ inyectado → lote continúa |
| `CA-05` — Descarga individual/ZIP y DELETE | **`PASSED`** | 112/112; ZIP con lector externo (3 entradas, bytes correctos), DELETE sin objetos ni filas, 413 `ZIP_TOO_LARGE` sin materializar, 502 `PARTIAL_DELETE_FAILED` conservando la fila |
| `CA-06` — Métricas reales e integración backend | **`PASSED`** | 50/50; `HeadObject=768` vs declarado `1`, `bytesBefore=768`, `bytesAfter` re-derivado de objetos persistidos (`98+304+98=500`), descarga/ZIP byte-idénticos, estados `COMPLETED`/`PARTIAL`/`FAILED`, E2E completo |

**Sin hallazgos bloqueantes de Auditor** en ninguna tarea; ningún `PASSED` condicional. **No se concedió G-9 ni G-10** (ningún riesgo aceptado en nombre de Lino).

## 3. Decisiones del CTO y disposición de hallazgos

| Tema | Decisión / disposición |
|---|---|
| Dependencias AWS SDK (pre-dispatch) | **CTO autorizó** `backend/package.json` para `@aws-sdk/client-s3`, `s3-request-presigner` y `client-sqs`, declaradas una sola vez en T02; manifiesto raíz invariante |
| Persistencia de optimizadas en S3 (A-01 de T06) | **CTO decidió corregir en el loop**: `writeOptimizedVariants()` con `PutObject`+`HeadObject` y `bytesAfter` derivado de bytes persistidos |
| `CONFIRM_INCONSISTENT` (T01) / `A-03` (T06) | At-most-once documentado, sin reparación fingida; marcador duradero y reconciliación a decisión de CTO/Lino (sin G-10) |
| Cubo global `auth:anonimo` (T01 A-03) | Derivado al wiring de producción de **F05** |
| `bytesBefore` desde buffer del sobre (T06 A-02) | Seguimiento a **F05**: reforzar `HeadObject` de `raw` en consumo |
| Exposición de `bucket`/`key` en `/presign` (T02 A-01) | Decisión de producto para **F05** |
| Sobreescritura sin `If-None-Match` (T02 A-02) | Documentada como competencia de `/presign/upload`; prefijo `userId` impide acceso ajeno |
| `UnprocessedItems` en `db/**`, semántica 204→404 | Hallazgos LOW heredados de F01/T05, documentados, sin G-10 |
| Lint global en rojo | `tests/unit/frontend/core.test.ts` y `frontend/src/App.tsx` pertenecen a **F03 (harness paralelo)**; clasificado como interferencia externa, **no aceptado como riesgo de F02**. El lint acotado a F02 pasa en todas las tareas |

Los cuatro bucles correctivos se originaron en: concurrencia de `confirm` y rollback (T01), idempotencia ante redelivery y DLQ aislada (T04), tope de ZIP y `Errors[]` en `DeleteObjects` (T05), y persistencia de optimizadas (T06, decisión CTO). Cronología RED→GREEN→REFACTOR de cada bucle revisada como registro por Tester; ninguna fue reejecutada invirtiendo código.

## 4. Gates, cobertura y confinamiento

- **Consumidos:** G-2 (Fase 2 autorizada), G-3 (sin secretos en código/reportes/evidencia), G-4 (DynamoDB 100 % ficticio en emulador), G-6/G-6b (repo público, archivos IA permitidos; **sin push** en esta fase), G-7 (Docker con 2 GiB/2.0 CPUs, `docker cp` de CA/credenciales en cada arranque y apagado al terminar), G-8 (tres dependencias declaradas en el manifiesto backend con integridad en lockfile).
- **No ejecutados:** G-9 (no necesario), G-10 (ningún riesgo aceptado), G-11/G-12 (Fase Final).
- **Cobertura:** API HTTP, almacenamiento presignado, worker de procesamiento, consumidor SQS/DLQ, descarga/ZIP, borrado y métricas reales cubiertos con evidencia de Tester. No se hicieron UI React (F03), Terraform completo (F04) ni wiring del servidor en `backend/src/index.ts` (F05): las rutas se exponen vía `createApiApp()` y se ejercitan con `app.request()`.
- **Confinamiento:** no se modificaron `frontend/`, `infra/terraform/`, `.github/`, manifiestos raíz, `STATE.md` ni `docs/sdd/tasks.md`; no se hizo push; no se usó AWS real; Docker quedó apagado (`docker ps -a` vacío, `:9297` cerrado); `temporary/` intacto; ninguna dependencia de `temporary/` en producto; sin secretos ni rutas Windows absolutas en artefactos nuevos.

## 5. Aprendizajes candidatos

| Aprendizaje | Ámbito | Evidencia |
|---|---|---|
| `withMetadata({})` en sharp 0.33 conserva EXIF/XMP: el strip debe hacerse decodificando a RAW y recodificando, con control negativo | `PROPUESTA_GLOBAL` | `F02-T03-auditor.md`, `F02-T03-tester-metadata.txt` |
| Las transiciones que disparan efectos externos (publicar SQS, escribir optimized) deben ser condicionales al estado previo y derivar métricas de bytes persistidos | `PROPUESTA_GLOBAL` | `F02-T01` y `F02-T06` bucles correctivos |
| El envío a DLQ y el borrado S3 deben aislarse del bucle principal e inspeccionar errores parciales (`Errors[]`) para no dejar jobs inalcanzables | `PROPUESTA_GLOBAL` | `F02-T04` y `F02-T05` bucles correctivos |
| Un emulador único en `127.0.0.1:9297` exige serializar las tareas con integración real entre harnesses | `SOLO_LOCAL` | Coordinación de T01…T06 en esta fase |
| Un ZIP generado en memoria necesita tope explícito de entradas/bytes antes de materializar | `PROPUESTA_GLOBAL` | `F02-T05-tester-loop2-zip.txt` |

Tiempo observado: ejecución secuencial de seis tareas con tres reintentos correctivos y verificación simultánea Tester/Auditor en varias de ellas; esperas de herramienta/harness no cuantificadas, no reconstruidas solo desde fechas de archivo.

---

**Retorno final:** `FASE_COMPLETA` — P-02 cerrada con CA-01…CA-06 en `PASSED`. Se detiene la ejecución del Architect y se entrega al CTO para revisión, consolidación de `STATE.md`/`tasks.md` y autorización de las fases siguientes (F03/F04/F05).

---

## ADDENDUM — Interoperabilidad F02 ↔ F03 (`F02-AUD-01`, 2026-11-18)

> Addendum **append-only** por decisión de Lino y CTO. No modifica el retorno de Fase 0/2 anterior; lo amplía con la adopción del contrato de creación de lote acordado con F03. **Estado: `CERRADO — PASSED`.**

| Campo | Valor |
|---|---|
| **Tarea** | `F02-AUD-01` — Addendum de interoperabilidad de `POST /jobs` |
| **Motivo** | `F03-AUD-01` (HIGH): el handler F02 leía `images` y devolvía `{job}`, divergiendo del acuerdo F03 `files` → `{job, uploads}` |
| **Autoridad** | Decisión de Lino y CTO (encargo del addendum) |
| **Dictamen Tester** | **`PASSED`** — `F02-AUD-01-tester.md` (contrato exacto, 2 PUT reales + `HeadObject`, sonda negra 34/34, 275/275 unit, 29/29 integración) |
| **Dictamen Auditor** | **`READY_WITH_CONCERNS`** — `reports/audits/F02/F02-AUD-01-auditor.md` (0 CRITICAL/HIGH/MEDIUM, sin bloqueantes) |
| **Consecuencia** | **F03-AUD-01 queda resuelto** en lo que respecta a la adopción del acuerdo por el servidor F02 |

### 1. Contrato confirmado

```
POST /jobs   (Authorization: Bearer <JWT>)
Request  201: { preset, files: [{ fileName: string, contentType: string, sizeBytes: number }] }
Response 201: { job: Job, uploads: [{ imageId: string, uploadUrl: string, method: 'PUT', headers?: Record<string,string> }] }
```

- Campo por campo idéntico a `JobUploadRequest` / `JobUploadPlan` de `frontend/src/api/jobs.ts` (cliente F03, **no modificado**).
- Cada `uploadUrl` es HTTPS, PUT firmada sobre `raw/<userId>/<jobId>/<imageId>`, con `imageId = randomUUID()` (nunca derivado de `fileName`). La respuesta **no expone** `bucket`, `key` ni tiempos de expiración.
- Validación conservada: `preset` con `schemas.Preset`; lote `1…maxImagesPerBatch`; `sizeBytes` entero > 0 y ≤ `maxFileSizeMb` vía `schemas.JobMetrics`; MIME raster (JPEG/PNG/WebP/AVIF), rechazo de SVG/GIF/PDF; claves desconocidas → 400; `userId` siempre del JWT (cabeceras suplantables ignoradas).
- El job permanece `PENDING` con métricas `0/0/0` y TTL vigente; `/presign`, `/confirm`, descarga y la integración E2E de T06 siguen sin regresión.

### 2. Evidencia y gobernanza

- PUT real contra `aws/aws-emulator`: 2 archivos → 2 UUID bajo un mismo `jobId`; `HeadObject` confirma `ContentLength` exacto en `raw/<userId>/<jobId>/raw/<imageId>`. Sonda negra propia del Tester: 34/34 comprobaciones (alojada en `temporary/` y eliminada).
- **Contratos congelados intactos**: catálogo v1 hash `5d0082f8d97e0329862739123b7599c75ff7261834430039fa6e815bf68d626d`; `backend/src/contracts/**` y `frontend/src/api/types.generated.ts` sin cambios. No se definieron tipos nuevos en el catálogo: el addendum usa tipos locales en `backend/src/api/**` validados con `schemas.*`.
- Sin tocar `frontend/`, `infra/terraform/`, `.github/`, `STATE.md` ni `docs/sdd/tasks.md`; sin manifiestos; **sin push** (`HEAD = origin/main = ls-remote = 469888b…`). Docker con 2 GiB/2.0 CPUs, `docker cp` de CA/credenciales repetido y apagado (`docker ps -a` vacío, `:9297` cerrado).
- Hallazgos del Auditor: A-01 INFO (F03-AUD-01 resuelto), A-02 LOW (`contentType`/`sizeBytes` no vinculados a la firma PUT; inherente al patrón presigned, seguimiento F04/F05, sin G-10), A-03 INFO (verificación de Git confirmada por Tester).

### 3. Desbloqueo de F03

El bloqueo **`F03-AUD-01` (HIGH) queda cubierto**: el servidor F02 acepta y responde exactamente el acuerdo que el cliente F03 ya implementa. Corresponde al responsable de F03 registrar el cierre de ese hallazgo en su expediente (`reports/audits/F03/F03-auditor.md` y `reports/verification/F03-architect.md`) y repetir la verificación de integración que antes usaba un doble de API, ahora contra el handler real. Los demás hallazgos F03 (`AUD-03/07/08/09`, `LOOP3-E2E-01`) quedan **fuera de este alcance** y no se dan por cerrados.

**Estado del addendum:** `CERRADO — PASSED`. No se reabre P-02 ni se autoriza ninguna fase adicional por este documento.
