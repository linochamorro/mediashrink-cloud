# Dictamen de Tester independiente — `F02-T05`

| Campo | Valor |
|---|---|
| **Tarea** | `F02-T05` — Descarga individual/ZIP y borrado de lote |
| **Fase / paquete** | Fase 2 — `docs/sdd/packages/P-02-api-and-worker.md` (`CA-05`) |
| **Rol / harness** | Tester independiente · OpenCode |
| **Riesgo** | 2 (Relevante) |
| **Versión revisada** | `v1 — Loop 1/3` (entrega del Developer) |
| **Loop consumido por este dictamen** | **`Ninguno`** (veredicto `PASSED` en la primera revisión) |
| **Ejecución propia** | Sí: 10 evidencias `F02-T05-tester-*.txt`, emulador levantado con G-7, 2 sondas propias (ZIP y DELETE) sin ficheros temporales |
| **Veredicto global** | **`PASSED`** |

## 1. Fuentes y criterio aplicado

Contrato de rol (`.agents/roles/tester.md`), `AGENTS.md`, `STATE.md`, `docs/sdd/packages/P-02-api-and-worker.md` (`CA-05`), `docs/sdd/spec.md` (FR-17/FR-18/FR-19, A-05, FR-15/FR-21), `constitution.md` (IN-03/IN-04/PR-07), `F02-T05-task.md`, `F02-T05-developer.md`, `F02-T02-architect.md` (seguimiento `A-02`), `docs/runbooks/development-workflow.md` §1, y código sin modificar en `backend/src/api/{app,download}.ts` y `backend/src/storage/**`.

Criterio: **ejecución propia** contra la aceptación aprobada, no contra la interpretación del implementador. La evidencia del Developer se consultó solo como registro cronológico (TDD); ningún artefacto ajeno se presenta como evidencia propia. Sin secretos ni rutas Windows absolutas en los artefactos nuevos (`SCAN_CLEAN`).

## 2. Dictamen por criterio

| # | Criterio / fuente | Verificación propia y evidencia | Resultado |
|---|---|---|---|
| 1 | Suite API (`F02-T05-tester-suite.txt`) | `npx vitest run tests/unit/api tests/integration/api` → **14 archivos, 105/105**, exit 0. Escaneo de `tests/unit/api/**` y `tests/integration/api/**` con `\.(skip\|only\|todo)\(`: **NINGUNO**. Incluye 4/4 integración CA-05. | **CUMPLIDO** |
| 2 | Descarga individual (`F02-T05-tester-integration.txt`, `F02-T05-tester-focused.txt`, `F02-T05-tester-keys.txt`) | Integración real 4/4: bucle sobre `webp`, `avif`, `thumbnail`, `original` con URL `https://127.0.0.1:9297`, `X-Amz-Expires=900`, ruta con la clave `<userId>/<jobId>/…`, descarga de los bytes reales y comparación byte a byte. Unitarias 18/18: `userId` del JWT aunque lleguen `x-user-id`/`x-forwarded-user`, 404 byte-idéntico para lote ajeno/inexistente/imagen ajena, 401 sin JWT sin firmar nada, 400 para variantes e IDs inseguros. `presign-keys.test.ts` 30/30. | **CUMPLIDO** |
| 3 | ZIP + lector externo (`F02-T05-tester-zip-external.txt`, `F02-T05-tester-temp-scan.txt`) | Sonda propia contra la API real del emulador: `status=200`, `content-type=application/zip`, 407 bytes. Lector externo independiente (`python.zipfile`): `CRC_TEST=None`, 3 entradas exactas `img_ext.webp`, `img_ext.avif`, `img_ext_thumb.webp`, `EXPECTED_SET_OK=True` y `BYTES_OK=True` en las tres. Sin `.zip`/`.tmp` generados: bytes solo en memoria. | **CUMPLIDO** |
| 4 | DELETE (`F02-T05-tester-delete-probe.txt`, `F02-T05-tester-integration.txt`, `F02-T05-tester-focused.txt`) | Sonda propia real: `DELETE_STATUS=204`, `raw=[]` y `optimized=[]` del lote, `X_JOB_NULL=true`, `X_IMAGES=0`, `SECOND_DELETE_STATUS=404`. **Ajenos intactos**: otro lote del mismo usuario (Z) y lote de otro usuario (Y) conservan sus objetos `raw`/`optimized` y sus filas DynamoDB. Unitarias: reintento tras fallo S3 conserva la fila y 401 sin JWT. | **CUMPLIDO** |
| 5 | `If-None-Match` / prefijo (`F02-T05-tester-keys.txt`) | Revisión de código: T05 solo usa `GetObjectCommand` y `DeleteObjectsCommand` (sin `PutObject`/`CopyObject`); `DeleteObjects` no admite `If-None-Match`, por lo que la no aplicabilidad documentada en §6 del developer es correcta. Refuerzo de prefijo presente: `assertKeyWithinPrefix`/`assertSafeKeySegment` en `download.ts` (2), `objects.ts` (8), `keys.ts` (10), `presigner.ts` (3), con `userId` del JWT antes de cualquier lectura/borrado y verificación de cada clave listada. 30/30 tests de claves. | **CUMPLIDO** |
| 6 | Regresión y gates (`F02-T05-tester-regression.txt`) | `npm run test:unit` → **28 archivos, 259/259**, exit 0. `npm run typecheck` (global) → exit 0. ESLint acotado a `backend/src/api`, `backend/src/storage`, `tests/unit/api`, `tests/integration/api` → exit 0. `npm run lint` global → exit 1 por **1 error en `tests/unit/frontend/core.test.ts:6:37`** (`Theme` sin usar), código de **F03 paralelo, ajeno a F02-T05**: interferencia documentada, no bloqueante. | **CUMPLIDO** |
| 7 | Ámbito, sin push y Docker (`F02-T05-tester-scope.txt`, `F02-T05-tester-down.txt`) | `git status --short` idéntico al de inicio de sesión (solo trabajo paralelo F02/F03); último commit `469888b` sin cambios ni push; rama `main`. Escrituras propias limitadas a 10 evidencias y este dictamen; sin edición de código, tests, manifiestos, `STATE.md`, `tasks.md` ni reportes ajenos. Emulador `up` con `memory=2147483648`, `nanoCpus=2000000000`, `127.0.0.1:9297` (sin `:9324`), `docker cp` ×3 y healthcheck `ok` (sin CA → exit 60); al cerrar: `docker compose down` exit 0, `docker compose ps` y `docker ps -a` vacíos, sin red `mediashrink-cloud_default`. | **CUMPLIDO** |
| 8 | Cronología TDD (revisión documental, sin reejecución) | Registro cronológico del Developer: RED **15 fallos por comportamiento / 3 pasan**, GREEN **18/18**, REFACTOR **18/18**. Revisado como registro íntegro; **no se reejecutó el RED ni se invirtió código** para certificarlo. | **CUMPLIDO (como registro)** |

## 3. Notas

- La verificación se realizó con el emulador `aws/aws-emulator` en vivo, bajo G-7, levantado solo durante las pruebas y apagado al terminar. No se usó AWS real ni credenciales secretas.
- El lint global rojo y el `git status` con trabajo paralelo proceden de `F03`, que escribe en el mismo árbol. Se aislaron con gates acotados en verde y evidencia separada; no se modificó código ajeno para «arreglarlos». No constituyen hallazgo contra `CA-05`.
- No se encontraron incumplimientos, por lo que no se registran problemas con los 7 campos ni se activa ningún loop de corrección.

## 4. Conclusión

`CA-05` queda satisfecho con evidencia de ejecución propia: descarga individual de las cuatro variantes con URL firmada de 900 s y `userId` del JWT, ZIP validado por lector externo con bytes correctos y sin temporales, DELETE completo en S3 y DynamoDB con ajenos intactos y 404 en la segunda llamada, aislamiento por `userId` en todas las operaciones, refuerzo de prefijo transporte seguro y Docker apagado. Registros cronológicos íntegros, sin hallazgos bloqueantes CRITICAL/HIGH ni revisiones obligatorias pendientes.

**Veredicto global: `PASSED`.** No se activa ningún loop de corrección. Se entrega a Architect para su integración y cierre.

---

## Addendum — `v2 — Loop 2/3` (re-verificación de `A-01`/`A-02`)

| Campo | Valor |
|---|---|
| **Versión revisada** | `v2 — Loop 2/3` (entrega correctiva del Developer) |
| **Origen** | `reports/audits/F02/F02-T05-auditor.md` — `A-01` y `A-02` (`MEDIUM`); `A-03`/`A-04` (`LOW`) quedan como seguimiento, fuera de este addendum |
| **Alcance de esta re-verificación** | Solo los criterios afectados por la corrección: tope del ZIP (`A-01`) y fallo parcial de `DeleteObjects` (`A-02`). El `PASSED` de v1 se conserva íntegro. |
| **Ejecución propia** | Sí: 8 evidencias `F02-T05-tester-loop2-*.txt`, emulador G-7 levantado/apagado y 2 sondas propias con **cliente S3 inyectado propio** (independiente del fixture de fallos del Developer) |
| **Loop consumido por este addendum** | `Loop 2/3` (ya consumido por la corrección); **no se activa el loop 3** |
| **Veredicto del addendum** | **`PASSED`** |

### A.1 Criterios re-verificados

| # | Criterio | Verificación propia y evidencia | Resultado |
|---|---|---|---|
| 1 | Suite y focalizadas (`F02-T05-tester-loop2-suite.txt`, `F02-T05-tester-loop2-focused.txt`) | `npx vitest run tests/unit/api tests/integration/api` → **16 archivos, 112/112**, exit 0 (antes 105/105: +7 pruebas nuevas). Focalizadas `zip-cap` + `delete-partial` → **7/7**, exit 0. Sin `.skip/.only/.todo` en ambos árboles. | **CUMPLIDO** |
| 2 | A-01 — ZIP con tope (`F02-T05-tester-loop2-zip.txt`) | Sonda propia con cliente S3 inyectado y límites derivados de config (`MAX_IMAGES_PER_BATCH=1`, `MAX_FILE_SIZE_MB=1` → `{"maxEntries":3,"maxBytes":1048576}`): (a) 2 MiB declarados → `413 ZIP_TOO_LARGE`, `materializations=0`, cuerpo sin `userId`; (b) 2 imágenes (6 entradas > 3) → `413`, `materializations=0`; (c) `ContentLength` engañoso → `413`, `materializations=0`; (d) lote válido → `200`, `PK`, 3 materializaciones. Confirma rechazo antes de `transformToByteArray` y generación con un solo `Buffer`. | **CUMPLIDO** |
| 3 | A-02 — fallo parcial (`F02-T05-tester-loop2-delete.txt`) | Sonda propia con S3 inyectado devolviendo `Errors[]`: fallo permanente → `502 PARTIAL_DELETE_FAILED`, cuerpo sin `userId`, sin clave ni mensaje del SDK; `job` presente, `images=1`, objeto fallido intacto, 3 llamadas de borrado (tope 3) y `ObjectDeletionError` confirmado. Fallo transitorio → reintento selectivo, `204`, `job` nulo, 0 objetos, 2 llamadas. La fila DynamoDB NO se borra cuando persiste el fallo: operación reintentable. | **CUMPLIDO** |
| 4 | Gates (`F02-T05-tester-loop2-gates.txt`) | `npm run typecheck` → exit 0. ESLint acotado a F02 (`backend/src/api`, `backend/src/storage`, `tests/unit/api`, `tests/integration/api`) → exit 0. Lint global → exit 1 por `tests/unit/frontend/core.test.ts:6:37` (`Theme` sin usar), código de **F03 paralelo, ajeno**. | **CUMPLIDO** |
| 5 | Alcance e infra (`F02-T05-tester-loop2-scope.txt`, `F02-T05-tester-loop2-docker-up.txt`, `F02-T05-tester-loop2-down.txt`) | `git status` idéntico al inicio del loop; commit `469888b` sin push. Solo 8 evidencias nuevas y este addendum; sin código, tests, manifiestos ni reportes ajenos editados. Emulador `healthy`, 2 GiB/2 CPU, `docker cp` ×3, healthcheck `ok`, sin `:9324`; `docker compose down` exit 0, `docker ps -a` vacío y sin red residual. `SCAN_CLEAN=True`. | **CUMPLIDO** |

### A.2 Notas

- No se reejecutó el RED del loop 2 (registro cronológico del Developer: 5 fallos por comportamiento → GREEN 7/7); la verificación se apoya en sondas propias de comportamiento, no en la lectura del reporte ajeno.
- Los criterios no afectados por la corrección (descarga individual, aislamiento, ZIP válido, DELETE correcto, prefijo) permanecen con el dictamen `PASSED` de v1 y fueron cubiertos de nuevo por la suite 112/112.
- `A-03` (`UnprocessedItems` en `backend/src/db/**`) y `A-04` (documentación 204→404) están fuera del alcance de este addendum; son `LOW`, con responsable asignado y sin `G-10`.

### A.3 Conclusión del addendum

La evidencia propia respalda el cierre de `A-01` y `A-02`: rechazo de ZIP sobredimensionado sin materializar objetos y fallo parcial de S3 que conserva la fila DynamoDB y permite reintento, sin regresiones (112/112) y con Docker apagado.

**Veredicto del addendum: `PASSED`.** No se activa ningún loop adicional. Se entrega a Architect para integración y cierre.
