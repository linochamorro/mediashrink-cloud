# Entrega de Developer — `F02-T05`

| Campo | Valor |
|---|---|
| **Tarea** | `F02-T05` — Descarga individual/ZIP y borrado de lote |
| **Fase / paquete** | Fase 2 — `docs/sdd/packages/P-02-api-and-worker.md` (`CA-05`) |
| **Versión / Loop** | `v1 — Loop 1/3` (sin loops correctivos consumidos) |
| **Rol / verificadores** | Developer / Tester + Auditor (riesgo 2) |
| **Harness** | OpenCode · raíz autorizada del proyecto |
| **Fuente de verdad de alcance** | `reports/implementation/F02/F02-T05-task.md` |
| **Estado de entrega** | **`DONE`** — pendiente de Tester y Auditor; **no se emite `PASSED` ni se cierra la tarea** |

## 1. Fuentes consultadas

- `AGENTS.md`, `STATE.md`, `.agents/roles/developer.md`.
- `docs/sdd/packages/P-02-api-and-worker.md` §1/§3/§5 (`CA-05`); `docs/sdd/spec.md` FR-17/FR-18/FR-19, FR-15 (comparativa), A-05 y §5/§6; `docs/sdd/constitution.md` IN-03/IN-04/PR-07; `docs/sdd/plan.md` §3.3.
- `reports/implementation/F02/F02-T05-task.md` (alcance), `F02-T02-architect.md` (seguimiento **A-02**: `If-None-Match`), `F02-T02-developer.md` y `F02-T04-developer.md` (convenciones de reporte y evidencia).
- Código leído sin modificar: `backend/src/api/{app,jobs,presign,rate-limit}.ts`, `backend/src/auth/{errors,middleware}.ts`, `backend/src/contracts/{index,zod-schemas,catalog}.ts`, `backend/src/config/index.ts`, `backend/src/db/{job-store,types,keys,errors}.ts`, `backend/src/storage/{client,keys,presigner}.ts`, `frontend/src/api/jobs.ts` (forma de respuesta esperada por la SPA), `docs/runbooks/development-workflow.md` §1.2–1.4.
- Sin modificar: manifiestos, `backend/src/worker/**`, `backend/src/db/**`, `backend/src/index.ts`, `frontend/`, `infra/`, `.github/`, `STATE.md`, `tasks.md`, reportes ajenos; sin push.

## 2. Criterio de aceptación atendido — `CA-05`

- **`GET /jobs/:id/download/:imageId?variant=…`** devuelve una URL presignada **HTTPS** (`https://127.0.0.1:9297`, sin `:9324`) para `webp`, `avif`, `thumbnail` (miniatura WebP, A-04) y `original` (comparativa FR-15). Se valida con esquemas congelados (`ImageRecord.imageId` → `nonempty`, `OutputFormat` → `webp`/`avif`) y con la lista blanca de segmentos de clave (`assertSafeKeySegment`). Cuerpo: `{ downloadUrl, url, expiresAt }`; `url` es alias del campo usado por `/presign/download` y `downloadUrl`/`expiresAt` coinciden con el tipo `DownloadLink` que consume la SPA.
- **`GET /jobs/:id/download.zip`** genera en memoria un ZIP con **TODAS** las optimizadas existentes del lote (`<imageId>.webp`, `<imageId>.avif`) y sus miniaturas (`<imageId>_thumb.webp`), a partir de los objetos de `optimized` listados por `JobStore` bajo el `userId` del JWT. Método `STORE`, CRC32 propio, **sin dependencias nuevas y sin archivos temporales**; response `application/zip`, `Content-Disposition: attachment; filename="<jobId>.zip"` y `Cache-Control: no-store`.
- **`DELETE /jobs/:id`** elimina objetos `raw` **y** `optimized` del prefijo `<userId>/<jobId>/` (listado paginado + `DeleteObjects` en lotes de 1000) y la fila DynamoDB con `deleteJobWithImages()` de F01. Devuelve `204`; repetir la operación sobre el lote ya borrado da `404`, indistinto de lote inexistente o ajeno. Si falla S3, la fila se conserva para reintentar.
- **Aislamiento (PR-07/FR-21):** `userId` siempre del JWT; cabeceras `x-user-id`/`x-forwarded-user` se ignoran. Claves construidas con el prefijo del usuario y verificadas con `assertKeyWithinPrefix` antes de leer/borrar. 404 genérico y byte-idéntico para lote ajeno e inexistente; nunca se firma ni se devuelve binario ajeno.

## 3. Cronología (TDD)

| Hora (aprox.) | Hito | Resultado |
|---|---|---|
| 22:35–22:39 | Lectura obligatoria y diseño de puertos (`ObjectAccessService`, `createZipArchive`) | Sin cambios fuera de ámbito |
| 22:40 | Stubs tipados `NOT_IMPLEMENTED` + 18 pruebas unitarias (descarga, ZIP, DELETE) | **RED**: 15 fallos por comportamiento, 3 pasan (401), exit 1 |
| 22:42 | **GREEN**: ZIP en memoria, servicio S3 de objetos y tres rutas cableadas en `createApiApp()` | **18/18**, exit 0 |
| 22:43 | **REFACTOR**: `isValidId()` único, traducción centralizada de errores y verificación | **18/18**, exit 0 |
| 22:43 | Regresión unitaria, typecheck y lint acotado | 259/259 · exit 0 · exit 0 |
| 22:44–22:46 | Emulador arrancado con límites G-7, `docker cp` y healthcheck `ok` | `healthy`, 2 GiB / 2 CPU |
| 22:46 | Integración real (URLs firmadas descargadas con CA, ZIP, DELETE, aislamiento) | **4/4**, exit 0 |
| 22:46–22:47 | Evidencias focalizadas de individual / ZIP / DELETE | 7/7+1/1 · 6/6+1/1 · 5/5+1/1 |
| 22:47 | Verificación externa del ZIP con `Expand-Archive` (`temporary/`, limpiado después) | 3/3 entradas y bytes correctos |
| 22:48 | Typecheck y lint finales; apagado del contenedor | exit 0 / 0 · `docker ps -a` vacío |

## 4. Comandos ejecutados y resultados

| Comando | Exit | Resultado |
|---|---|---|
| `npx vitest run tests/unit/api/{download,zip,delete}.test.ts --reporter=verbose` (RED) | 1 | 15 fallos por comportamiento / 3 pasan |
| idem (GREEN y REFACTOR) | 0 | **18/18** (7 descarga + 6 ZIP + 5 DELETE) |
| `npm run test:unit` | 0 | 28 archivos, **259/259** (241 previos + 18 nuevos) |
| `docker compose up -d` / `inspect` | 0 | `healthy`, `memory=2147483648`, `nanoCpus=2000000000` |
| `docker cp` ×3 + `curl.exe --cacert … /__admin/health` | 0 | cuerpo `ok` |
| `npx vitest run tests/integration/api/download.test.ts --reporter=verbose` | 0 | **4/4** contra S3 + DynamoDB reales del emulador |
| `-t 'descarga individual'` / `-t 'ZIP:'` / `-t 'DELETE:'` | 0 | 1/1, 1/1, 1/1 (con las unitarias: 7/7, 6/6, 5/5) |
| `npx tsx temporary/F02-T05-zip-check.ts` + `Expand-Archive` | 0 | ZIP válido para lector externo; 3/3 entradas |
| `npm run typecheck` | 0 | sin diagnósticos |
| `npx eslint backend/src/api backend/src/storage tests/unit/api tests/integration/api --ext .ts` | 0 | sin hallazgos (lint acotado a F02) |
| `docker compose down` / `docker compose ps` / `docker ps -a` | 0 | contenedor y red eliminados; 0 contenedores |

**Evidencia:** `reports/implementation/F02/evidence/F02-T05-{red,green,refactor,individual,zip,delete,integration,zip-external,emulator-up,emulator-down,unit-all,typecheck,lint-scoped}.txt`. Todas las evidencias usan `<PROJECT_ROOT>` (sin rutas Windows absolutas) y `SCAN_CLEAN` para secretos/credenciales/firmas largas. El lint global no se ejecutó como señal de salud porque F03 escribe en paralelo; se usó el lint acotado, según la convención de T02/T04.

## 5. Decisiones de implementación

1. **Nuevo puerto `ObjectAccessService`** (`backend/src/storage/objects.ts`): `presignVariant`, `readOptimizedObjects` y `deleteJobObjects`. No se modificó `PresignService` (contrato de T02) para no romper sus dobles; T05 inyecta su propio servicio en `createApiApp()` mediante dependencias opcionales `objectAccess`/`downloadLimiter`, con fábrica perezosa para no leer el CA en tests unitarios.
2. **ZIP sin dependencias**: `backend/src/storage/archive.ts` implementa cabeceras locales, directorio central y EOCD con `STORE` + CRC32. Es determinista (fecha DOS fija 1980-01-01) y no filtra marca de tiempo. Formato acordado: entradas planas `<imageId>.webp`, `<imageId>.avif`, `<imageId>_thumb.webp`; no se añade `manifest.json`. Un lote `PARTIAL` omite variantes ausentes (`NoSuchKey`/404) sin fallar.
3. **Borrado**: `ListObjectsV2` paginado sobre `Prefix=<userId>/<jobId>/` en ambos buckets, `DeleteObjects` en lotes de 1000, verificación `assertKeyWithinPrefix` de cada clave listada y afterwards `deleteJobWithImages()`. Nunca se usan `imageId` del cliente para direccionar borrados.
4. **`original` como extensión documentada**: la SPA (`frontend/src/api/jobs.ts`) usa `?variant=original` para la comparativa FR-15; se firma un `GET` sobre `raw` con la misma clave y expiración de 900 s. No amplía el conjunto de formatos de salida (sigue siendo WebP + AVIF).
5. **Sin `original` en el ZIP**: A-05 pide solo optimizadas y miniaturas; el original se descarga individualmente.
6. **Códigos de error**: 400 para IDs/variantes inválidos, 401 sin JWT, 404 para lote/imagen inexistente o ajena (cuerpo `RESOURCE_NOT_FOUND` idéntico), 429 por límite con `Retry-After`, 5xx genérico sin detalles internos (G-3).

## 6. Gestión de `If-None-Match` (seguimiento T02-A-02)

**No aplica a las tres operaciones de T05.** La descarga individual y el ZIP son lecturas (`GetObjectCommand` / URL firmada `GET`) y no pueden sobreescribir objetos; el borrado usa `DeleteObjectsCommand`, que **no admite condición `If-None-Match`** y debe ser incondicional para garantizar la limpieza completa del lote. La única escritura de la API sigue siendo el `PUT` a `raw` de `/presign/upload`, donde el control de sobreescritura intra-usuario queda como responsabilidad de esa ruta (evaluar en su momento; objetos ajenos ya impedidos por el prefijo `userId`).

Además, T05 refuerza el aislamiento con dos barreras: (a) IDs validados en el límite HTTP con `assertSafeKeySegment`, y (b) `assertKeyWithinPrefix(key, userId)` antes de cada lectura/borrado, más el `getJob`/`getImage` con el `userId` del JWT antes de cualquier efecto. No se introdujo ninguna operación `PutObject`/`CopyObject` en esta tarea.

## 7. Registro de problemas (7 campos)

### Problema 1

1. **Identificación:** `F02-T05-P1` — dos aserciones de las propias pruebas fallaron en el primer GREEN.
2. **Problema:** `delete.test.ts` consultó `listImages()` **después** de borrar el job (el doble exige que el padre exista) y `download.test.ts` esperaba cuatro variantes cuando el bucle solo ejercitaba tres en esa instancia.
3. **Causa:** **demostrada** — errores de la fixture/prueba, no del producto; el GREEN mostró `JobNotFoundError` del doble y un array de longitud 3.
4. **Solución e intentos fallidos:** se movió la comprobación de imágenes antes del `DELETE` y se ajustó la expectativa a `['avif','thumbnail','original']`. No se debilitaron expectativas de comportamiento ni se ocultaron fallos.
5. **Verificación:** GREEN 18/18 reflejado en `F02-T05-green.txt`.
6. **Pendientes:** ninguno.
7. **Aprendizaje candidato:** los dobles que exigen precondiciones (padre existente) deben consultarse en el orden en que el producto las usa.

### Problema 2

1. **Identificación:** `F02-T05-P2` — `createdBuckets.client.putObject is not a function` en la integración.
2. **Problema:** la fixture de integración usaba el azúcar sintáctico `putObject()` de la SDK v2 sobre un `S3Client` v3.
3. **Causa:** **demostrada** — `@aws-sdk/client-s3` v3 expone `send(command)`; la fixture de T02 ya usaba `PutObjectCommand`.
4. **Solución e intentos fallidos:** se sustituyó por `client.send(new PutObjectCommand({...}))`; no se cambió el producto.
5. **Verificación:** integración 4/4 y evidencias focalizadas 1/1 en cada caso.
6. **Pendientes:** ninguno.
7. **Aprendizaje candidato:** al reutilizar fixtures de otra tarea, copiar el patrón de comandos del SDK, no suponer API de conveniencia.

### Problema 3

1. **Identificación:** `F02-T05-P3` — `TS2459: 'JobStore' declares 'JobStore' locally, but it is not exported`.
2. **Problema:** el typecheck final falló porque la fixture importaba el tipo `JobStore` desde `db/job-store.ts`, que solo lo declara internamente.
3. **Causa:** **demostrada** — el puerto público vive en `backend/src/db/types.ts` (leído en las fuentes obligatorias).
4. **Solución e intentos fallidos:** se cambió el import a `import type { JobStore } from '../../../backend/src/db/types'`; se reejecutó typecheck y lint. No se tocó `backend/src/db/**`.
5. **Verificación:** `F02-T05-typecheck.txt` con `EXIT=0`; lint acotado `EXIT=0`.
6. **Pendientes:** ninguno.
7. **Aprendizaje candidato:** las verificaciones finales deben repetirse después de añadir archivos de integración, aunque el código de producto no haya cambiado.

### Problema 4

1. **Identificación:** `F02-T05-P4` — seguimiento `T02-A-02` (`If-None-Match`) evaluado y descartado para T05.
2. **Problema:** el Auditor de T02 pidió valorar condición de sobreescritura intra-usuario en las operaciones de storage usadas por T05.
3. **Causa:** **demostrada** — no hay escrituras en T05: dos `GET` de solo lectura y un `DELETE` cuya API (`DeleteObjectsCommand`) no acepta `If-None-Match`; el borrado incondicional es necesario para la limpieza.
4. **Solución e intentos fallidos:** documentar la no aplicabilidad en §6 y reforzar el aislamiento con `assertKeyWithinPrefix` + `userId` del JWT; se descartó añadir una condición artificial al borrado (rompería la idempotencia/seguridad del cleanup).
5. **Verificación:** 18/18 unitarias y 4/4 integración, incluidos casos de lote ajeno, inexistente y de otro `jobId` del mismo usuario.
6. **Pendientes:** el control de sobreescritura sigue abierto para la única escritura (`/presign/upload`); competencia de una corrección futura, no de `CA-05`.
7. **Aprendizaje candidato:** una condición `If-None-Match` solo tiene sentido donde existe riesgo de sobreescritura; aplicarla a lecturas o borrados añade complejidad sin ganancia de seguridad.

### Problema 5

1. **Identificación:** `F02-T05-P5` — alineación de la forma de respuesta con la SPA de F03 paralela.
2. **Problema:** la respuesta individual podía seguir el estilo `PresignResult` de T02 (`url`, `key`, `bucket`, `expiresIn`) o el tipo `DownloadLink` de la SPA (`downloadUrl`, `expiresAt`); exponer `key`/`bucket` reaparecía el hallazgo `A-01` de T02 (información interna).
3. **Causa:** **demostrada** — `frontend/src/api/jobs.ts:6` define `DownloadLink = { downloadUrl: string; expiresAt: string }` y valida HTTPS sobre `downloadUrl`.
4. **Solución e intentos fallidos:** se devuelve `{ downloadUrl, url, expiresAt }`: se satisfacen ambos consumidores sin publicar `key`/`bucket`/bytes. Se descartó incluir metadatos internos para no reabrir `A-01`.
5. **Verificación:** la integración descarga los bytes reales con la URL devuelta (4 variantes) y la unidad comprueba ausencia de `bytes`.
6. **Pendientes:** Auditor debe confirmar que el alias `url` no se considera fuga (es la misma URL pública firmada, sin rutas internas).
7. **Aprendizaje candidato:** en fases paralelas, leer el cliente ya escrito evita desajustes de contrato sin modificar archivos ajenos.

## 8. Estado final

- `CA-05` implementado y verificado: **18/18** unitarias nuevas, **4/4** integración real contra `aws/aws-emulator`, **259/259** regresión unitaria, typecheck y lint F02 limpios. ZIP validado también por `Expand-Archive`.
- Sin secretos, credenciales fijas ni rutas Windows absolutas en artefactos nuevos; sin `:9324`; `docker compose down` ejecutado con `docker ps -a` vacío (G-7 conforme).
- Ámbito respetado: solo `backend/src/api/**`, `backend/src/storage/**`, `tests/unit/api/**`, `tests/integration/api/**` y reportes/evidencias propias. Sin push.
- **No se emite `PASSED` y no se cierra la tarea**: procede revisión de Tester y Auditor.

**Estado: `DONE`.**

---

## Addendum — `v2 — Loop 2/3` (correctivo de auditoría)

| Campo | Valor |
|---|---|
| **Versión / Loop** | `v2 — Loop 2/3` (sin loop 3) |
| **Origen** | `reports/audits/F02/F02-T05-auditor.md` — `A-01` y `A-02` (`MEDIUM`); `A-03`/`A-04` (`LOW`) quedan como seguimiento documentado |
| **Ámbito tocado** | `backend/src/storage/{archive,objects}.ts`, `backend/src/api/download.ts`, `tests/unit/api/{s3-fault-fixture,zip-cap,delete-partial}.test|fixture.ts` |
| **Estado del addendum** | **`DONE_WITH_CONCERNS`** — sin `PASSED`, sin cierre; a revisión de Tester y Auditor |
| **Concerns** | Ninguno dentro de T05. `A-03` (`UnprocessedItems` en `backend/src/db/**`) y `A-04` (semántica 204→404) siguen con responsable y fase, sin aceptación de riesgo (G-10). |

### Cronología y comandos del loop 2

| Hito | Comando / acción | Resultado |
|---|---|---|
| RED | `npx vitest run tests/unit/api/zip-cap.test.ts tests/unit/api/delete-partial.test.ts --reporter=verbose` | exit 1 · **5 fallos por comportamiento** / 2 pasan |
| GREEN | ídm tras implementar topes e inspección de `Errors[]` | exit 0 · **7/7** |
| Ajuste GREEN | refuerzo de pre-check de entradas y `failKeys` en el doble | exit 0 · **7/7** |
| Suite completa | `npx vitest run tests/unit/api tests/integration/api --reporter=dot` | exit 0 · **16 archivos, 112/112** (incluye 4/4 integración real) |
| Focalizadas | `zip-cap.test.ts` / `delete-partial.test.ts` | **4/4** y **3/3** |
| Gates | `npm run typecheck`; `npx eslint backend/src/api backend/src/storage tests/unit/api tests/integration/api --ext .ts` | exit 0 · exit 0 |
| Emulador | `docker compose up -d` + `docker cp` + healthcheck; límites 2 GiB / 2 CPU | `ok`, `healthy` |
| Apagado | `docker compose down` + `docker compose ps` + `docker ps -a` | contenedor/red eliminados; 0 contenedores |

**Evidencias del loop:** `reports/implementation/F02/evidence/F02-T05-loop2-{red,green,zip-cap,delete-partial,all,typecheck,lint-scoped,emulator-up,emulator-down}.txt` (`<PROJECT_ROOT>`, `SCAN_CLEAN`). El lint global queda fuera de esta señal por la escritura paralela de F03; se usa el lint acotado a F02.

### Cambios correctivos

1. **A-01 (tope explícito del ZIP).** `backend/src/storage/archive.ts` define `defaultZipLimits()` (256 MiB y 60 entradas) y `ZipLimitError`; `createZipArchive(entries, limits)` comprueba entradas y bytes **antes de copiar** y reserva un único `Buffer.allocUnsafe`, escribiendo cada objeto desde una vista `Buffer` sin `Buffer.from` intermedia: se pasa de 3 copias del conjunto a 1. `backend/src/storage/objects.ts` añade `resolveZipLimits(config)` (mínimo entre el techo por defecto y `maxImagesPerBatch × {3, maxFileSizeMb}`), y `readOptimizedObjects` rechaza por peor caso de entradas (`imágenes × 3`) y por `ContentLength` declarado **antes** de `transformToByteArray`. `api/download.ts` deriva los límites de la configuración y pasa el mismo objeto al generador como defensa en profundidad; traduce `ZipLimitError` a **413 `ZIP_TOO_LARGE`** con mensaje genérico.
2. **A-02 (`Errors[]` de `DeleteObjects`).** `deleteJobObjects` ya no contabiliza el tamaño del chunk: suma solo `result.Deleted.length`, extrae las claves de `result.Errors`, reintenta **únicamente las fallidas** hasta `MAX_DELETE_ATTEMPTS = 3` y lanza `ObjectDeletionError(failedCount)` si persisten. `api/download.ts` traduce ese error a **502 `PARTIAL_DELETE_FAILED`** sin claves, motivos ni `userId`. Como el error se propaga antes de `deleteJobWithImages()`, la fila y los ítems hijo se conservan para reintento: no quedan objetos huérfanos inalcanzables por un 404 posterior.
3. **Sin cambios** en manifiestos, `backend/src/db/**`, `worker/**`, `index.ts`, `auth/**`, frontend, IaC, `.github`, `STATE.md`, `tasks.md`, reportes ajenos; sin push ni secretos/rutas Windows absolutas nuevas.

### Registro de problemas del loop 2 (7 campos)

#### Problema L2-1 (`A-01`)

1. **Identificación:** `F02-T05-L2-A01` · Auditoría `A-01` · Loop 2/3.
2. **Problema:** el ZIP agregado no tenía tope explícito: se materializaban todas las variantes y el generador copiaba cada entrada dos veces más, con pico estimado de hasta 1,8–2,7 GB y offsets ZIP de 32 bits sin proteger.
3. **Causa:** **demostrada** — `readOptimizedObjects` llamaba a `transformToByteArray()` sin consultar `ContentLength`, y `createZipArchive` hacía `Buffer.from(entry.bytes)` + `Buffer.concat([...])`; los únicos límites eran indirectos (ingesta).
4. **Solución e intentos fallidos:** se añadieron `ZipLimits`, `resolveZipLimits(config)` y `ZipLimitError`; el servicio comprueba peor caso de entradas y tamaño declarado antes de leer, y el generador reserva un solo búfer. Se descartó un archivo temporal (prohibido por el contrato) y un tope solo aguas arriba (no acota el agregado). En el primer GREEN falló una prueba porque el chequeo de entradas se hacía antes de la segunda materialización: se movió al peor caso `imágenes × 3` para rechazar sin ninguna lectura.
5. **Verificación:** 4/4 en `zip-cap.test.ts` (bytes, entradas, `ContentLength` engañoso, lote válido) con `materializations === 0` en los tres rechazos; 112/112 en la suite `tests/unit/api + tests/integration/api`, typecheck y lint limpios.
6. **Pendientes:** Auditor debe confirmar el cierre de `A-01`; si el CTO quiere un `MAX_ZIP_BYTES` ajustable por entorno, debe hacerse por control de cambios (config/`.env.example` están fuera del ámbito de T05).
7. **Aprendizaje candidato:** una respuesta agregada en memoria debe declarar su propio límite en la ruta HTTP y comprobarlo antes de asignar/copiar; un `ContentLength` declarado es una señal útil de rechazo temprano, pero debe validarse también contra los bytes reales.

#### Problema L2-2 (`A-02`)

1. **Identificación:** `F02-T05-L2-A02` · Auditoría `A-02` · Loop 2/3.
2. **Problema:** `DeleteObjectsCommand` podía responder HTTP 200 con `Errors[]` y el código lo contaba como éxito, borrando después la fila DynamoDB y dejando objetos inalcanzables hasta el ciclo de vida de 30 días.
3. **Causa:** **demostrada** — `deleted += chunk.length` ignoraba la respuesta; el único fallo cubierto en el loop 1 era una excepción de comando entero (`failNextDelete`), no un error parcial.
4. **Solución e intentos fallidos:** se inspeccionan `Deleted` y `Errors`, se reintentan solo las claves fallen con tope de 3 intentos y se lanza `ObjectDeletionError` antes del borrado de la fila. Se descartó añadir `If-None-Match` (`DeleteObjects` no lo admite) y reintentar de forma ilimitada. En el primer GREEN una prueba no falló porque el doble no tenía `failKeys` asignado: se corrigió la fixture, no el producto.
5. **Verificación:** 3/3 en `delete-partial.test.ts`: fallo permanente → 502 `PARTIAL_DELETE_FAILED`, fila y objeto fallido intactos, ≤6 llamadas; fallo transitorio → reintento, 204, sin objetos; conteo solo de claves confirmadas. Integración real 4/4 y suite completa 112/112.
6. **Pendientes:** Auditor debe confirmar el cierre de `A-02`; `A-03` (`UnprocessedItems` en `db/job-store.ts`) y `A-04` (documentación 204→404) se derivan al responsable de `db/**` y al CTO, respectivamente.
7. **Aprendizaje candidato:** en operaciones por lote, un HTTP 200 con array de errores es un fallo lógico; la atomicidad frente a DynamoDB exige propagar ese fallo antes de borrar la fila, y el reintento debe ser acotado y selectivo.

### Estado del loop 2

`A-01` y `A-02` corregidos sin regresiones: **112/112** en `tests/unit/api + tests/integration/api`, typecheck y lint F02 limpios, Docker apagado. `A-03` y `A-04` quedan como seguimientos documentados (`LOW`, no bloqueantes, sin G-10). **No se emite `PASSED` y no se cierra la tarea**: procede nueva revisión de Tester y Auditor.

**Estado: `DONE_WITH_CONCERNS` (loop 2/3).**
