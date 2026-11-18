# Auditoría de cambio — `F02-T05` (Descarga individual/ZIP y borrado de lote)

| Campo | Valor |
|---|---|
| **Tarea / fase** | `F02-T05` · Fase 2 (`P-02-api-and-worker.md`) |
| **Riesgo** | `2 (Relevante)` — auditoría antes/después de la verificación funcional |
| **Rol** | Auditor ( contrato `.agents/roles/auditor.md`; METHODOLOGY §3.1/§4/§7 ) |
| **Fecha / entorno** | `2026-11-17` · Win32 / Node / Vitest · inspección estática + lectura de evidencia |
| **Loop** | `1/3` (sin addenda previos) · **append-only**: no borrar este registro; añadir addendum si hay correcciones |
| **Encargo** | Aislamiento PR-07; ZIP A-05; DELETE completo/atómico-lógico/idempotente; `If-None-Match` (T02-A-02); secretos G-3 y ámbito |
| **Frontera con Tester** | **No se repite la suite funcional**: no se ejecutaron pruebas, Docker, Git ni AWS. Se revisan código, contratos, evidencia ya producida y riesgos específicos |
| **Emitir** | Solo este reporte. **No se emite `PASSED`/`NO-PASSED`**, no se cierra la tarea, no se acepta riesgo en nombre de Lino (G-10) |

## 1. Fuentes, lentes y muestreo

- **Fuentes obligatorias leídas:** `.agents/roles/auditor.md`, `AGENTS.md`, `STATE.md`, `P-02-api-and-worker.md` (CA-05), `spec.md` FR-17/FR-18/FR-19/A-05/FR-15/§6, `constitution.md` IN-03/IN-04/PR-07/PR-08/IN-09, `F02-T05-task.md`, `F02-T05-developer.md`, `F02-T02-architect.md`, plantilla de 7 campos.
- **Código inspeccionado:** `backend/src/api/{download,app}.ts`, `backend/src/storage/{objects,archive,keys,client,presigner,index}.ts`, `backend/src/auth/{middleware,errors}.ts`, `backend/src/db/{job-store,keys}.ts`, `backend/src/config/index.ts`.
- **Evidencia y pruebas leídas (sin ejecutar):** 14 artefactos `evidence/F02-T05-*`, `tests/unit/api/{download,zip,delete}.test.ts`, `tests/unit/api/object-access-fixture.ts`, `tests/integration/api/download.test.ts`.
- **Lentes:** seguridad/aislamiento (PR-07/FR-21), integridad de borrado, disponibilidad/memoria, secretos (G-3/PR-08), gobernanza de seguimientos (T02-A-02), ámbito anti-colisión.
- **Muestreo y exclusiones:** se revisó el 100 % de la ruta de las tres operaciones de `CA-05`. Se excluyó la ejecución de cargas de estrés, inyección de fallos en S3 y comprobaciones en vivo de Docker/Git/AWS (prohibidas para este rol). La sintaxis ZIP/CRC se acepta por la evidencia de Tester y el lector externo del Developer, sin reejecutarla.

## 2. Hallazgos

### Hallazgo `A-01` — ZIP sin acotación explícita de tamaño/memoria

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID: `A-01` · Tarea: `F02-T05` · Fase: `P-02` · Loop: `1/3` · Fecha: `2026-11-17` · Entorno: inspección estática Win32/Node |
| **2. Problema** | **Síntoma:** `readOptimizedObjects` materializa cada variante con `Buffer.from(await result.Body.transformToByteArray())` sin consultar `ContentLength` ni acotar el total (`storage/objects.ts:128-154`); `createZipArchive` copia cada entrada (`Buffer.from(entry.bytes)`, `storage/archive.ts:72`) y termina con `Buffer.concat([...])` (`archive.ts:130`), duplicando el conjunto. No hay `maxZipBytes`, tope de entradas ni streaming en `api/download.ts:124-151`. **Esperado:** «tamano acotado para evitar abuso de memoria» (alcance del encargo). **Observado:** única acotación indirecta, aguas arriba: `MAX_IMAGES_PER_BATCH=20` y `MAX_FILE_SIZE_MB=15` (`config/index.ts:293-297`); peor caso teórico 20×3×≈15 MB ≈ 900 MB, con pico de 1,8–2,7 GB por copias. **Impacto:** agotamiento de memoria del proceso API (que corre fuera del contenedor con límite G-7) por un usuario autenticado; además, offsets ZIP de 32 bits en EOCD (`archive.ts:120-127`) se desbordan por encima de 4 GB. **Reproducción:** lectura estática de la ruta completa; no se ejecutó prueba de estrés (fuera de alcance). |
| **3. Causa** | **Estado:** `DEMOSTRADA` · **Evidencia:** `storage/objects.ts:128-154`, `storage/archive.ts:65-130`, `config/index.ts:293-297`, `api/download.ts:124-151` · **Alternativas descartadas:** no existe comprobación de tamaño en la ruta de descarga; los límites de subida no acotan el tamaño agregado del ZIP. |
| **4. Solución** | **Cambios aplicados:** ninguno (el Auditor no implementa) · **Motivo técnico:** la descarga agregada debe tener su propio límite, no heredar el de ingesta · **Propuesta para el implementador:** sumar `ContentLength` (o `HeadObject`) antes de descargar y responder `413` al superar un tope configurable (`MAX_ZIP_BYTES`), o streaming con un directorio temporal controlado y borrado; responsable: Developer, con seguimiento del Architect y decisión de configuración del CTO. |
| **5. Verificación** | **Verificador independiente:** `Auditor` (estático) · **Comando/procedimiento:** traza completa `download.zip → readOptimizedObjects → GetObject/transformToByteArray → createZipArchive → Buffer.concat` · **Resultado y evidencia:** ausencia de acotación corroborada en las líneas citadas; clasificación `CORROBORADA` · **Regresión comprobada:** N/A (no se reejecutó la suite del Tester) · **Límites:** `SUFFICIENT` para afirmar que no hay tope en el código; `LIMITED` para el comportamiento real bajo carga (no se ejecutó estrés). |
| **6. Pendientes** | **Riesgo residual:** `MEDIUM`, **no bloqueante**, mitigado parcialmente por límites de ingesta, autenticación obligatoria, limiter por `userId` y datos ficticios · **Cobertura ausente:** prueba con lote máximo y objetos grandes · **Responsable y siguiente paso:** Architect registra seguimiento; Developer evalúa el tope en una corrección/fase posterior; CTO decide si entra en `spec.md`/`.env.example`. **No aceptado por Lino (sin G-10).** |
| **7. Aprendizaje** | **Prevención propuesta:** toda respuesta agregada construida en memoria debe declarar un límite explícito en la propia ruta HTTP, sin depender de límites de otra capa · **Ámbito candidato:** `PROPUESTA_GLOBAL` · **Estado:** `PENDIENTE_DE_EVALUAR` |

**Severidad:** `MEDIUM` · **Confianza:** `HIGH` · **Evidencia:** `CORROBORADA` · **Bloqueante:** `NO`.

### Hallazgo `A-02` — `DeleteObjects` parcial no inspeccionado: riesgo de objetos huérfanos

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID: `A-02` · Tarea: `F02-T05` · Fase: `P-02` · Loop: `1/3` · Fecha: `2026-11-17` · Entorno: inspección estática Win32/Node |
| **2. Problema** | **Síntoma:** `deleteJobObjects` envía `DeleteObjectsCommand` y contabiliza `deleted += chunk.length` sin leer la respuesta (`storage/objects.ts:172-177`). S3 puede responder HTTP 200 con un array `Errors[]` de fallos por clave; esos errores se ignoran, el método retorna normalmente y `api/download.ts:162` borra la fila DynamoDB. **Esperado:** «borra raw+optimized+DynamoDB de forma completa y atómica-lógica; evaluar riesgo de objetos huérfanos si falla un DeleteObjects parcial» (encargo; FR-19). **Observado:** el orden S3 → DynamoDB protege correctamente contra **excepciones de comando** (fila conservada para reintento, `delete.test.ts:97-113`), pero no contra **respuestas parciales**. **Impacto:** objetos huérfanos bajo `<userId>/<jobId>/` inalcanzables por la API (un `DELETE` posterior devuelve 404 porque `getJob` es `null`), hasta la limpieza por ciclo de vida de 30 días (IN-09/FR-20). Sin fuga entre usuarios. **Reproducción:** inspección estática; el doble `failNextDelete` (`tests/unit/api/object-access-fixture.ts:88-91`) simula fallo de comando entero, no `Errors[]` parciales. |
| **3. Causa** | **Estado:** `DEMOSTRADA` · **Evidencia:** `storage/objects.ts:159-181` (sin inspección de `Errors`), `api/download.ts:159-163`, `tests/unit/api/delete.test.ts:97-113`, `object-access-fixture.ts:88-91` · **Alternativas descartadas:** la conservación de la fila ante excepciones sí está cubierta y es correcta; el riesgo queda limitado al modo parcial. |
| **4. Solución** | **Cambios aplicados:** ninguno (Auditor no implementa) · **Motivo técnico:** la atomicidad lógica depende de que S3 confirme la eliminación efectiva antes de borrar la fila · **Propuesta:** inspeccionar `result.Errors` (y comparar `Deleted` con las claves enviadas); si hay errores, relanzar para conservar la fila o reintentar solo las claves fallidas, con backoff · **Intentos fallidos relevantes:** añadir una condición `If-None-Match` al borrado no es alternativa: `DeleteObjects` no la admite (ver `A-05`). |
| **5. Verificación** | **Verificador independiente:** `Auditor` (estático) · **Comando/procedimiento:** traza `DELETE → getJob → deleteJobObjects → ListObjectsV2/DeleteObjects → deleteJobWithImages` + revisión del doble de fallo · **Resultado y evidencia:** riesgo `CORROBORADO` por código · **Regresión comprobada:** N/A · **Límites:** `SUFFICIENT` para el flujo de código; `LIMITED` para la respuesta exacta del emulador ante errores parciales (no se inyectaron fallos). |
| **6. Pendientes** | **Riesgo residual:** `MEDIUM`, **no bloqueante**, mitigado por el ciclo de vida 30 días, el carácter ficticio de los datos y la conservación de la fila ante excepciones · **Cobertura ausente:** prueba con `Errors[]` parcial y con paginación de múltiples páginas · **Responsable y siguiente paso:** Developer (mismo módulo, fase de seguimiento); Architect registra; CTO decide prioridad. **Sin G-10.** |
| **7. Aprendizaje** | **Prevención propuesta:** todo `DeleteObjects`/`BatchWrite` debe tratar los errores parciales de la respuesta como fallo, no como éxito · **Ámbito candidato:** `PROPUESTA_GLOBAL` · **Estado:** `PENDIENTE_DE_EVALUAR` |

**Severidad:** `MEDIUM` · **Confianza:** `HIGH` · **Evidencia:** `CORROBORADA` · **Bloqueante:** `NO`.

### Hallazgo `A-03` — `BatchWrite` sin reintento de `UnprocessedItems` en `deleteImages` (código F01, dependencia de T05)

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID: `A-03` · Tarea: `F02-T05` (dependencia `F01-T02`) · Fase: `P-02` · Loop: `1/3` · Fecha: `2026-11-17` · Entorno: inspección estática |
| **2. Problema** | **Síntoma:** `deleteImages` envía lotes de 25 `DeleteRequest` con `BatchWriteCommand` y no inspecciona `UnprocessedItems` (`db/job-store.ts:196-206`); `deleteJobWithImages` elimina a continuación la fila padre (`job-store.ts:308-311`). **Esperado:** borrado completo de la fila del lote y de sus imágenes hijas (FR-19). **Observado:** ante throttling parcial, pueden quedar items `IMAGE#...` huérfanos bajo el mismo `userId`. **Impacto:** baja — inalcanzables por la API (toda lectura exige el padre) y expiran por TTL de 30 días (IN-09); sin cruce de usuarios. **Reproducción:** lectura estática de `db/job-store.ts`. |
| **3. Causa** | **Estado:** `DEMOSTRADA` · **Evidencia:** `backend/src/db/job-store.ts:179-207` y `:308-312` · **Alternativas descartadas:** el borrado del padre es condicionado a que exista (`getJob`), pero eso no cubre los hijos no procesados. |
| **4. Solución** | **Cambios aplicados:** ninguno; el archivo pertenece a `backend/src/db/**`, fuera del ámbito de escritura de `T05` · **Motivo técnico:** mismo patrón que `A-02`, pero en DynamoDB · **Propuesta:** reintentar `UnprocessedItems` con backoff antes de borrar el padre; propiedad del responsable de `db/**` (seguimiento F04/F05), no del Developer de T05. |
| **5. Verificación** | **Verificador independiente:** `Auditor` (estático) · **Comando/procedimiento:** lectura de `deleteImages`/`deleteJobWithImages` y de la convención de claves (`db/keys.ts:23-32`) · **Resultado y evidencia:** `CORROBORADA` · **Regresión comprobada:** N/A · **Límites:** `LIMITED` (no se simuló throttling). |
| **6. Pendientes** | **Riesgo residual:** `LOW`, **no bloqueante**; `UnprocessedItems` es poco frecuente en el emulador local · **Cobertura ausente:** inyección de throttling en `BatchWrite` · **Responsable y siguiente paso:** Architect deriva al responsable de `db/**`; no modificar en T05. **Sin G-10.** |
| **7. Aprendizaje** | **Prevención propuesta:** incluir `UnprocessedItems` en la lista de respuestas parciales a verificar en borrados por lote · **Ámbito candidato:** `PROPUESTA_GLOBAL` · **Estado:** `PENDIENTE_DE_EVALUAR` |

**Severidad:** `LOW` · **Confianza:** `HIGH` · **Evidencia:** `CORROBORADA` · **Bloqueante:** `NO`.

### Hallazgo `A-04` — Idempotencia de `DELETE`: efecto idempotente, respuesta 404 en la segunda llamada

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID: `A-04` · Tarea: `F02-T05` · Fase: `P-02` · Loop: `1/3` · Fecha: `2026-11-17` |
| **2. Problema** | **Síntoma:** la primera `DELETE /jobs/:id` devuelve 204; la segunda devuelve 404 (`api/download.ts:159-160`), indistinto de lote ajeno o inexistente. **Esperado:** `F02-T05-task.md` pide un borrado «idempotente/seguro»; `spec.md` §6 exige 404 para acceso a lote ajeno. **Observado:** el estado final es idéntico tras repetir, no hay efectos adicionales ni sondeo de existencia; el código es 404 en lugar de 204. **Impacto:** ninguno funcional; los clientes que reintentan deben tratar 404 como «ya borrado». **Reproducción:** `tests/unit/api/delete.test.ts:77-95` y `tests/integration/api/download.test.ts:108-129` (evidencia leída, no reejecutada). |
| **3. Causa** | **Estado:** `DEMOSTRADA` · **Evidencia:** `api/download.ts:153-163`, `auth/errors.ts:47-48`, pruebas citadas · **Alternativas descartadas:** devolver 204 siempre revelaría que el lote existió (o requeriría conservar tumbas), en contradicción con spec §6. |
| **4. Solución** | **Cambios aplicados:** ninguno · **Motivo técnico:** la decisión es coherente con PR-07/FR-21 · **Propuesta:** documentar explícitamente que la idempotencia es **de efecto/estado final**, no de código de respuesta; no cambiar el comportamiento. |
| **5. Verificación** | **Verificador independiente:** `Auditor` (estático + lectura de evidencia) · **Comando/procedimiento:** revisión de la ruta y de las pruebas de segunda llamada · **Resultado y evidencia:** `CORROBORADA` · **Regresión comprobada:** cubierta por Tester (no repetida) · **Límites:** `SUFFICIENT`. |
| **6. Pendientes** | **Riesgo residual:** `LOW` de documentación/contrato, **no bloqueante** · **Cobertura ausente:** ninguna relevante · **Responsable y siguiente paso:** CTO, al consolidar contratos/SPA, registrar la semántica 204→404. **Sin G-10.** |
| **7. Aprendizaje** | **Prevención propuesta:** distinguir «idempotente de efecto» de «idempotente de respuesta» al redactar criterios de aceptación · **Ámbito candidato:** `PROPUESTA_GLOBAL` · **Estado:** `PENDIENTE_DE_EVALUAR` |

**Severidad:** `LOW` · **Confianza:** `HIGH` · **Evidencia:** `CORROBORADA` · **Bloqueante:** `NO`.

### Hallazgo `A-05` — `If-None-Match` (T02-A-02): no aplica a T05, sobreescritura documentada como competencia de `presign/upload`

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID: `A-05` · Tarea: `F02-T05` (seguimiento de `F02-T02`) · Fase: `P-02` · Loop: `1/3` · Fecha: `2026-11-17` |
| **2. Problema** | **Síntoma:** seguimiento `T02-A-02` pedía valorar condición de sobreescritura en las operaciones de storage usadas por T05. **Esperado:** verificar que la no aplicabilidad a GET/`DeleteObjects` esté razonada y que la sobreescritura quede documentada como competencia de `presign/upload` (encargo). **Observado:** `api/download.ts:8-13` y `storage/objects.ts:8-13` documentan explícitamente que descarga y ZIP son lecturas (`GetObject`/URL firmada `GET`) y que `DeleteObjectsCommand` no admite `If-None-Match`, por lo que el borrado debe ser incondicional y acotado por prefijo; `F02-T05-developer.md` §6 y problema 4 lo desarrollan; `F02-T02-architect.md` §2 (`A-02`) registra el traspaso. **Impacto:** ninguno en `CA-05`; la única escritura (`PUT` a `raw` en `/presign/upload`) sigue sin condición de sobreescritura intra-usuario, como riesgo residual documentado y ajeno a T05. **Reproducción:** lectura de los cuatro documentos/código citados. |
| **3. Causa** | **Estado:** `DEMOSTRADA` · **Evidencia:** `backend/src/api/download.ts:8-13`, `backend/src/storage/objects.ts:8-13`, `reports/implementation/F02/F02-T05-developer.md` §6 y §7 problema 4, `reports/implementation/F02/F02-T02-architect.md` §2 · **Alternativas descartadas:** añadir una condición artificial al borrado rompería la limpieza completa y la idempotencia de efecto (`A-04`). |
| **4. Solución** | **Cambios aplicados:** ninguno; disposición correcta ya documentada · **Motivo técnico:** `If-None-Match` solo tiene sentido donde existe riesgo de sobreescritura · **Propuesta:** mantener `A-02` abierto como competencia de `/presign/upload` (introducir `If-None-Match`/`If-None-Match: *` en el `PUT` firmado, o aceptar la sobreescritura intra-usuario solo con decisión expresa de Lino/G-10). |
| **5. Verificación** | **Verificador independiente:** `Auditor` (documental + estática) · **Comando/procedimiento:** cotejo de los cuatro artefactos y búsqueda de `PutObject`/`CopyObject` en T05 (ausentes) · **Resultado y evidencia:** `CORROBORADA` · **Regresión comprobada:** N/A · **Límites:** `SUFFICIENT` para la documentación; no se evalúa el diseño futuro del `PUT`. |
| **6. Pendientes** | **Riesgo residual:** `INFO` para `CA-05`; sigue abierto `T02-A-02` en `presign/upload` · **Cobertura ausente:** ninguna en T05 · **Responsable y siguiente paso:** Developer de la ruta de presign/CTO, en fase posterior; **no se acepta riesgo por Lino**. |
| **7. Aprendizaje** | **Prevención propuesta:** al cerrar un seguimiento, exigir además del registro escrito la comprobación de que no se introdujo una escritura nueva en la tarea · **Ámbito candidato:** `SOLO_LOCAL` · **Estado:** `PENDIENTE_DE_EVALUAR` |

**Severidad:** `INFO` · **Confianza:** `HIGH` · **Evidencia:** `CORROBORADA` · **Bloqueante:** `NO`.

### Hallazgo `A-06` — Aislamiento PR-07/FR-21: verificación positiva sin fuga

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID: `A-06` · Tarea: `F02-T05` · Fase: `P-02` · Loop: `1/3` · Fecha: `2026-11-17` |
| **2. Problema** | **Síntoma:** riesgo de fuga de binarios/objetos de otros lotes o usuarios en descarga y borrado. **Esperado:** `userId` del JWT en las tres operaciones; 404 indistinto para ajeno/inexistente; sin firma de binario ajeno (PR-07/FR-21/spec §6). **Observado:** `requireAuth` (`auth/middleware.ts:47-66`) verifica el JWT y fija `c.set('userId', verified.userId)`; las tres rutas usan ese valor (`api/download.ts:103,128,157`), nunca parámetros ni cabeceras: las pruebas comprueban que `x-user-id`/`x-forwarded-user` se ignoran (`download.test.ts:108-125`). Las claves se construyen con prefijo `<userId>/<jobId>/` y se validan dos veces (`storage/keys.ts:31-40,66-80`; `objects.ts:101-105,135-136,169-171`). El 404 es byte-idéntico vía `resourceNotFound()` (`auth/errors.ts:47-48`), con `getJob`/`getImage`/`listImages` filtrados por `userId` (`db/job-store.ts:130-177`). Los dobles registran cero llamadas de firma/lectura/borrado en intentos ajenos. **Impacto:** ningún hallazgo de fuga; sin superficie de sondeo de existencia. **Reproducción:** inspección estática + lectura de evidencia del Tester (sin reejecutar suite). |
| **3. Causa** | **Estado:** `DEMOSTRADA` (verificación positiva) · **Evidencia:** archivos y líneas citados; `F02-T05-integration.txt` (4/4, caso de aislamiento), `download.test.ts:65-92`, `zip.test.ts:77-138`, `delete.test.ts:50-75` · **Alternativas descartadas:** N/A. |
| **4. Solución** | **Cambios aplicados:** ninguno; patrón a conservar · **Motivo técnico:** defensa en profundidad (JWT → store filtrado → validación de segmento → `assertKeyWithinPrefix`) · **Propuesta:** mantener; no relajar las validaciones al corregir `A-01`/`A-02`. |
| **5. Verificación** | **Verificador independiente:** `Auditor` (estático + evidencia) · **Comando/procedimiento:** traza de las tres rutas y revisión de los casos de aislamiento en pruebas y evidencia · **Resultado y evidencia:** `CORROBORADA` · **Regresión comprobada:** la suite del Tester queda fuera de este alcance; no se reejecutó · **Límites:** `SUFFICIENT` para el código; `LIMITED` para variantes de cabeceras no ensayadas, aunque el código no las lee. |
| **6. Pendientes** | **Riesgo residual:** ninguno · **Cobertura ausente:** no se requiere · **Responsable y siguiente paso:** ninguno; conservar el patrón en correcciones posteriores. |
| **7. Aprendizaje** | **Prevención propuesta:** replicar el cuádruple control (JWT, consulta filtrada, whitelist de segmento, `assertKeyWithinPrefix`) en toda ruta que direccione S3/DynamoDB · **Ámbito candidato:** `PROPUESTA_GLOBAL` · **Estado:** `PENDIENTE_DE_EVALUAR` |

**Severidad:** `INFO` (verificación positiva) · **Confianza:** `HIGH` · **Evidencia:** `CORROBORADA` · **Bloqueante:** `NO`.

### Hallazgo `A-07` — ZIP A-05: composición, ausencia de originales y de temporales

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID: `A-07` · Tarea: `F02-T05` · Fase: `P-02` · Loop: `1/3` · Fecha: `2026-11-17` |
| **2. Problema** | **Síntoma:** riesgo de incluir originales en el ZIP, de escribir temporales persistentes o de mezclar variantes de otros lotes. **Esperado:** ZIP con optimizadas WebP+AVIF y miniaturas (A-05/FR-18/IN-01), sin originales salvo el `variant=original` de la comparativa individual (FR-15), sin temporales persistentes. **Observado:** `ZIP_VARIANTS = ['webp','avif','thumbnail']` (`storage/objects.ts:46`); `original` solo se firma en la descarga individual (`objects.ts:100-125`, `api/download.ts:57`); el ZIP se construye en un `Buffer` (`storage/archive.ts:1-14,65-130`) con `cache-control: no-store` (`download.ts:144`); las entradas se leen solo bajo `<userId>/<jobId>/optimized/` y se omiten las ausentes de un lote `PARTIAL` (`objects.ts:128-154`). Evidencia de lector externo (`F02-T05-zip-external.txt`, `F02-T05-developer.md` §3). **Impacto:** ningún hallazgo de composición; el riesgo de memoria se trata separadamente en `A-01`. **Reproducción:** inspección estática + lectura de evidencia. |
| **3. Causa** | **Estado:** `DEMOSTRADA` (verificación positiva) · **Evidencia:** `storage/objects.ts:41-46,100-154`, `storage/archive.ts:1-14,65-130`, `api/download.ts:55-59,124-151` · **Alternativas descartadas:** inclusión de `manifest.json` descartada y documentada en `F02-T05-developer.md` §5.2 (no exigida por A-05). |
| **4. Solución** | **Cambios aplicados:** ninguno · **Motivo técnico:** composición conforme a A-05 · **Propuesta:** conservar; cualquier límite que se añada por `A-01` no debe alterar el conjunto de variantes ni el formato de entradas. |
| **5. Verificación** | **Verificador independiente:** `Auditor` (estático + evidencia) · **Comando/procedimiento:** revisión de la whitelist de variantes, del generador ZIP y de las cabeceras de respuesta · **Resultado y evidencia:** `CORROBORADA` · **Regresión comprobada:** suite del Tester no repetida · **Límites:** `SUFFICIENT` para la composición; `LIMITED` para compatibilidad con lectores externos (se acepta la evidencia del Developer). |
| **6. Pendientes** | **Riesgo residual:** ninguno en composición · **Cobertura ausente:** ninguna relevante · **Responsable y siguiente paso:** ninguno. |
| **7. Aprendizaje** | **Prevención propuesta:** fijar la whitelist de variantes de exportación en una constante única, reutilizada por la descarga individual y el ZIP · **Ámbito candidato:** `SOLO_LOCAL` · **Estado:** `PENDIENTE_DE_EVALUAR` |

**Severidad:** `INFO` (verificación positiva) · **Confianza:** `HIGH` · **Evidencia:** `CORROBORADA` · **Bloqueante:** `NO`.

### Hallazgo `A-08` — Secretos G-3, ámbito y estado de Docker: sin hallazgos; verificación parcialmente documental

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID: `A-08` · Tarea: `F02-T05` · Fase: `P-02` · Loop: `1/3` · Fecha: `2026-11-17` |
| **2. Problema** | **Síntoma:** riesgo de credenciales, rutas Windows absolutas, firma `:9324`, cambio fuera de ámbito o contenedor encendido. **Esperado:** G-3/PR-08 (solo marcadores), confinement a `backend/src/api/**`, `backend/src/storage/**`, pruebas y reportes propios; sin manifiestos, frontend, IaC, `STATE.md`, `tasks.md`, push; Docker apagado; lint global en rojo por F03 ajeno. **Observado:** escaneo de los 14 artefactos `evidence/F02-T05-*` y del reporte del Developer: sin `D:\`/`C:\`, sin `AKIA`/`ASIA`/`ghp_`/JWT (`eyJ`), sin `:9324` salvo una negación textual; las rutas se sustituyen por `<PROJECT_ROOT>`. El cliente S3 usa `fromIni` + CA explícito y sin secretos fijos (`storage/client.ts:29-56`). La evidencia `F02-T05-emulator-down.txt:1-11` registra `down`/`compose ps` vacío/`docker ps -a` vacío. El Developer declara ámbito respetado y sin push (`F02-T05-developer.md` §1/§8), y lint acotado a F02 en verde con lint global rojo por F03 paralelo (§4, `F02-T02-architect.md` §2 A-04). **Impacto:** ningún hallazgo G-3 ni de ámbito. **Reproducción:** búsqueda de patrones en artefactos y lectura de evidencia; el Auditor **no ejecutó** Git, Docker ni AWS. |
| **3. Causa** | **Estado:** `DEMOSTRADA` para secretos/rutas en artefactos; `INDICATIVA` para el estado real del contenedor y del árbol Git · **Evidencia:** artefactos citados y `storage/client.ts` · **Alternativas descartadas:** N/A. |
| **4. Solución** | **Cambios aplicados:** ninguno · **Motivo técnico:** las barreras ya están implementadas · **Propuesta:** conservar `<PROJECT_ROOT>` en evidencias y la sustitución de secretos por marcadores; el estado de `temporary/` y de G-11 se revisa en el cierre de fase, no aquí. |
| **5. Verificación** | **Verificador independiente:** `Auditor` (estático) · **Comando/procedimiento:** búsqueda literal de rutas/secretos en `reports/implementation/F02/F02-T05-*`; lectura de `emulator-down.txt` y del reporte de entrega · **Resultado y evidencia:** sin coincidencias; `CORROBORADA` para el escaneo, `INDICATIVA` para Docker/ámbito Git · **Regresión comprobada:** N/A · **Límites:** `SUFFICIENT` para secretos/rutas; `LIMITED` para estado real de Docker y para ausencia de cambios fuera de ámbito (no se puede ejecutar Git/Docker por regla de rol). |
| **6. Pendientes** | **Riesgo residual:** ninguno para `CA-05` · **Cobertura ausente:** comprobación en vivo del contenedor y del árbol Git (reservada al Architect/CTO con sus gates) · **Responsable y siguiente paso:** Architect verifica en el cierre de fase; el lint global en rojo por F03 queda documentado como interferencia externa, no como deuda de T05. |
| **7. Aprendizaje** | **Prevención propuesta:** mantener la convención `<PROJECT_ROOT>` y `SCAN_CLEAN` en toda evidencia de fase · **Ámbito candidato:** `PROPUESTA_GLOBAL` · **Estado:** `PENDIENTE_DE_EVALUAR` |

**Severidad:** `INFO` · **Confianza:** `HIGH` (escaneo) / `MEDIUM` (estado Docker/ámbito) · **Evidencia:** `CORROBORADA` + `INDICATIVA` · **Bloqueante:** `NO`.

## 3. Cobertura y clasificación

| Dimensión | Clasificación | Detalle |
|---|---|---|
| Aislamiento PR-07 (JWT, 404 indistinto, sin fuga) | `SUFFICIENT` | Código y evidencia de los tres verbos revisados íntegramente; sin reejecución de suite |
| ZIP A-05 (composición, sin originales, sin temporales) | `SUFFICIENT` | Whitelist, generador y cabeceras revisados; se acepta lector externo del Developer |
| ZIP A-05 (tamaño acotado / abuso de memoria) | `LIMITED` | Ausencia de tope `CORROBORADA`; sin prueba de estrés ni medición de pico |
| DELETE (completo, orden S3→DDB, idempotencia de efecto) | `SUFFICIENT` | Flujo y pruebas de segunda llamada y de fallo de comando revisados |
| DELETE (errores parciales `DeleteObjects` / `UnprocessedItems`) | `LIMITED` | Ruta de código `CORROBORADA`; sin inyección de fallos parciales |
| `If-None-Match` / sobreescritura | `SUFFICIENT` | Documentación y ausencia de escrituras en T05 verificadas |
| Secretos G-3 / rutas / ámbito | `SUFFICIENT` (artefactos) · `LIMITED` (Git/Docker en vivo) | Escaneo propio; sin Git/Docker por regla de rol |
| Explotación activa | `INSUFFICIENT` | No autorizada ni necesaria para este encargo |

**Resumen de severidades:** `0 CRITICAL` · `0 HIGH` · `2 MEDIUM (A-01, A-02)` · `2 LOW (A-03, A-04)` · `4 INFO (A-05…A-08)`.
**Bloqueantes de auditoría:** `ninguno`. Ningún riesgo ha sido aceptado en nombre de Lino; no hay `G-10`.

## 4. Conclusión

**`READY_WITH_CONCERNS`.** `CA-05` está cubierto en sus dimensiones funcionales y de aislamiento: el `userId` del JWT gobierna descarga individual, ZIP y `DELETE`; el 404 es indistinto para lote ajeno, inexistente y ya borrado; el ZIP contiene solo WebP+AVIF+miniaturas, sin originales ni temporales persistentes; el borrado sigue el orden S3 → DynamoDB y conserva la fila ante excepciones de comando; `If-None-Match` queda correctamente documentado como no aplicable y la sobreescritura como competencia de `/presign/upload`; no hay secretos, rutas Windows ni artefactos fuera de ámbito en los archivos revisados.

Las dos preocupaciones (`A-01` acotación de memoria del ZIP, `A-02` errores parciales de `DeleteObjects`) son riesgos reales de código, **no bloqueantes**, con mitigaciones existentes (autenticación + limiter, límites de ingesta, orden de borrado, ciclo de vida de 30 días, datos ficticios). Deben registrarse como seguimientos con responsable y fase, sin aceptarse como riesgos (G-10). El dictamen funcional `PASSED`/`NO-PASSED` compete al Tester; este reporte no lo emite ni cierra la tarea.

**Registro append-only:** si el Developer corrige `A-01`/`A-02`, añadir addendum con la reproduce original, la ruta equivalente verificada y las regresiones; no sobrescribir este archivo.

---

## ADDENDUM — `v2 / Loop 2/3` (verificación de las correcciones de `A-01` y `A-02`)

| Campo | Valor |
|---|---|
| **Fecha / loop** | `2026-11-17` · `v2 — Loop 2/3` (sin loop 3 consumido en esta revisión) |
| **Origen** | `reports/implementation/F02/F02-T05-developer.md` §Addendum (correctivo de auditoría) y su evidencia `F02-T05-loop2-*` |
| **Alcance del addendum** | Reproducir por inspección los dos riesgos originales, verificar las rutas corregidas y comprobar regresiones. **No reabre** `A-03`…`A-08` salvo el estado que se declara más abajo |
| **Método** | Inspección estática del código corregido y de los dobles/pruebas_addendum; lectura de evidencia del Developer. **No se ejecutaron** pruebas, Docker, Git ni AWS (frontera de rol y del encargo) |
| **Conservación** | El registro `v1` anterior permanece íntegro: no se ha borrado ni modificado ninguna línea; este bloque se añade solo al final |
| **Emisión** | No se emite dictamen funcional de Tester ni se cierra la tarea; no se acepta riesgo en nombre de Lino (G-10) |

### Cierre de `A-01` — CERRADO POR CORRECCIÓN

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID: `A-01` (addendum `v2`) · Tarea: `F02-T05` · Fase: `P-02` · Loop: `2/3` · Fecha: `2026-11-17` · Entorno: inspección estática Win32/Node |
| **2. Problema** | **Síntoma original (v1):** ZIP sin tope explícito, con materialización previa y triple copia del conjunto. **Esperado:** rechazo antes de materializar, acotación derivada de configuración y un único búfer de salida. **Observado en v2:** `defaultZipLimits()` fija 256 MiB y 60 entradas (`storage/archive.ts:33-56`); `resolveZipLimits(config)` deriva `maxEntries = min(60, maxImagesPerBatch×3)` y `maxBytes = min(256 MiB, maxImagesPerBatch×maxFileSizeMb×MiB)` (`storage/objects.ts:118-129`), sin añadir variables de entorno (config invariante, verificado en `config/index.ts`). `readOptimizedObjects` rechaza por peor caso de entradas antes de cualquier `GetObject` (`objects.ts:170-174`) y por `ContentLength` **antes** de `transformToByteArray()` (`objects.ts:190-198`), con segunda comprobación sobre los bytes reales. `createZipArchive` verifica entradas, `payloadBytes` y `totalSize` antes de `Buffer.allocUnsafe` (`archive.ts:110-135`) y copia cada objeto una sola vez desde una vista sin `Buffer.from` intermedia (`archive.ts:88-93,135-156`). `failure()` traduce a **413 `ZIP_TOO_LARGE`** con mensaje genérico (`api/download.ts:85-87`). **Impacto:** el pico estimado de 1,8–2,7 GB queda acotado a ≈256 MiB de salida más las entradas ya presentes; los offsets ZIP de 32 bits quedan protegidos por el propio tope. **Reproducción de la corrección:** `tests/unit/api/zip-cap.test.ts:20-79` (bytes, entradas, `ContentLength` engañoso y lote válido) y evidencia `F02-T05-loop2-zip-cap.txt` (4/4). |
| **3. Causa** | **Estado:** `DEMOSTRADA` · **Evidencia:** `backend/src/storage/{archive,objects}.ts`, `backend/src/api/download.ts` (líneas citadas); `tests/unit/api/zip-cap.test.ts`; `tests/unit/api/s3-fault-fixture.ts:166-184` (doble cuenta `materializations` solo al materializar) · **Alternativas descartadas:** archivo temporal (prohibido por el contrato) y tope solo aguas arriba (no acotaba el agregado); ambas ya descartadas en `v1`. |
| **4. Solución** | **Cambios aplicados:** los declarados por el Developer en el addendum `v2` §1, confirmados en el código · **Motivo técnico:** el control se sitúa en la ruta HTTP y en el servicio, en dos capas, y se valida antes de asignar/copiar memoria · **Intentos fallidos relevantes:** el primer GREEN situaba el chequeo de entradas después de la segunda materialización; se corrigió al peor caso `imágenes × 3`, según el registro del Developer (no se reejecutó el RED). |
| **5. Verificación** | **Verificador independiente:** `Auditor` (estático + lectura de evidencia) · **Comando/procedimiento:** traza `download.zip → resolveZipLimits → readOptimizedObjects → createZipArchive → failure`, cotejo con `zip-cap.test.ts` y `F02-T05-loop2-zip-cap.txt` · **Resultado y evidencia:** ruta corregida `CORROBORADA`; `413/ZIP_TOO_LARGE` y `materializations === 0` en los tres rechazos según la prueba leída (`zip-cap.test.ts:33,40,53,64`) · **Regresión comprobada:** el Developer registra **112/112** en `tests/unit/api + tests/integration/api`, typecheck y lint acotado F02 en verde (`F02-T05-loop2-{all,typecheck,lint-scoped}.txt`); **no reejecutado por el Auditor** · **Límites:** `SUFFICIENT` para la existencia y orden de los controles; `LIMITED` para medición real de pico de memoria (no se hizo prueba de estrés). **Ruta equivalente comprobada:** el lote dentro de tope sigue produciendo un ZIP íntegro (`zip-cap.test.ts:67-79`). |
| **6. Pendientes** | **Estado del riesgo:** `CERRADO POR CORRECCIÓN`; severidad residual `LOW`, **no bloqueante** · **Cobertura ausente:** no hay variable de entorno dedicada al tope; el Developer lo registra como decisión del CTO si se quiere ajustable (control de cambios en configuración/`.env.example`, fuera del ámbito de T05) · **Responsable y siguiente paso:** CTO/Architect, como seguimiento documentado, **sin G-10**. |
| **7. Aprendizaje** | **Prevención propuesta:** comprobar los topes antes de asignar y copiar, y validar tanto el tamaño declarado como el real; conservar el modo de límite derivado de configuración existente para no ampliar secretos/manifiestos · **Ámbito candidato:** `PROPUESTA_GLOBAL` · **Estado:** `PENDIENTE_DE_EVALUAR` |

**Conclusión parcial:** `A-01` queda **CERRADO POR CORRECCIÓN** por inspección; confianza `HIGH`, evidencia `CORROBORADA`, sin bloqueo.

### Cierre de `A-02` — CERRADO POR CORRECCIÓN

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID: `A-02` (addendum `v2`) · Tarea: `F02-T05` · Fase: `P-02` · Loop: `2/3` · Fecha: `2026-11-17` · Entorno: inspección estática Win32/Node |
| **2. Problema** | **Síntoma original (v1):** `deleted += chunk.length` ignoraba `Errors[]` y se borraba la fila DynamoDB tras un borrado parcial. **Esperado:** tratar `Errors[]` como fallo, reintentar de forma acotada y conservar la fila si persiste. **Observado en v2:** `deleteJobObjects` suma solo `(result.Deleted ?? []).length`, extrae `Errors[].Key`, reintenta únicamente las claves fallidas hasta `MAX_DELETE_ATTEMPTS = 3` (`objects.ts:58-59,235-257`) y lanza `ObjectDeletionError` si quedan pendientes. `failure()` traduce a **502 `PARTIAL_DELETE_FAILED`** sin claves, motivos ni `userId` (`api/download.ts:88-94`). Como la excepción se produce en `deleteJobObjects` (`download.ts:185`), `deleteJobWithImages()` (`download.ts:186`) **no se ejecuta**: la fila y los ítems hijo se conservan para reintento y no queda un 404 inalcanzable. **Impacto:** se elimina la ventana de huérfanos por error parcial de S3; el reintento es selectivo y acotado (≤3 intentos por lote/bucket), sin bucle infinito. **Reproducción de la corrección:** `tests/unit/api/delete-partial.test.ts:21-72` (fallo permanente, fallo transitorio, conteo solo de confirmadas) y `F02-T05-loop2-delete-partial.txt` (3/3). |
| **3. Causa** | **Estado:** `DEMOSTRADA` · **Evidencia:** `backend/src/storage/objects.ts:213-263`, `backend/src/api/download.ts:81-96,177-191`, `tests/unit/api/{delete-partial.test.ts,s3-fault-fixture.ts:186-204}` · **Alternativas descartadas:** `If-None-Match` no aplica a `DeleteObjects` (ya documentado en `A-05`); el reintento ilimitado se descartó en favor del tope de 3 intentos. |
| **4. Solución** | **Cambios aplicados:** los declarados en el addendum `v2` §2, confirmados en el código · **Motivo técnico:** la atomicidad lógica frente a DynamoDB exige propagar el fallo lógico (HTTP 200 con `Errors[]`) antes de borrar la fila · **Intentos fallidos relevantes:** en el primer GREEN una prueba no falló porque el doble no tenía asignado `failKeys`; se corrigió la fixture, no el producto (según el registro del Developer). |
| **5. Verificación** | **Verificador independiente:** `Auditor` (estático + lectura de evidencia) · **Comando/procedimiento:** traza `DELETE → deleteJobObjects → DeleteObjects/ Errors[] → ObjectDeletionError → failure → (no) deleteJobWithImages`, cotejo con el doble `FaultyS3Client` y la evidencia del loop 2 · **Resultado y evidencia:** ruta corregida `CORROBORADA`; `PARTIAL_DELETE_FAILED`, fila y objeto fallido intactos y ≤6 comandos en fallo permanente (`delete-partial.test.ts:31-41`); reintento con 204 en fallo transitorio (`:43-60`); el doble elimina solo las claves confirmadas (`s3-fault-fixture.ts:197-203`) · **Regresión comprobada:** la misma corrida **112/112** y la integración real 4/4 registradas por el Developer; **no reejecutadas por el Auditor** · **Límites:** `SUFFICIENT` para la lógica de propagate/reintento; `LIMITED` para la semántica exacta de `Errors[]` del emulador real (el doble la simula; no se inyectaron fallos contra el emulador). **Ruta equivalente comprobada:** el fallo transitorio converge a 204 sin huérfanos. |
| **6. Pendientes** | **Estado del riesgo:** `CERRADO POR CORRECCIÓN`; severidad residual `LOW`, **no bloqueante** · **Cobertura ausente:** ninguna relevante para `CA-05`; queda fuera de alcance el comportamiento de `UnprocessedItems` de DynamoDB (`A-03`) · **Responsable y siguiente paso:** ninguno para `A-02`; el Architect puede integrar el cierre. **Sin G-10.** |
| **7. Aprendizaje** | **Prevención propuesta:** en operaciones por lote, un HTTP 200 con array de errores es un fallo lógico; reintentar solo las claves fallidas, con tope, y propagar antes de borrar la entidad padre · **Ámbito candidato:** `PROPUESTA_GLOBAL` · **Estado:** `PENDIENTE_DE_EVALUAR` |

**Conclusión parcial:** `A-02` queda **CERRADO POR CORRECCIÓN** por inspección; confianza `HIGH`, evidencia `CORROBORADA`, sin bloqueo.

### Estado inalterado de los hallazgos restantes

| ID | Estado en `v2` | Disposición |
|---|---|---|
| `A-03` (`UnprocessedItems` en `backend/src/db/job-store.ts`, código F01) | **Seguimiento documentado, `LOW`, no bloqueante** | No se ha tocado `backend/src/db/**` en el loop 2 (confirmado por lectura del alcance del addendum del Developer). Responsable: dueño de `db/**` / fase posterior; Architect deriva. **Sin G-10** |
| `A-04` (semántica 204 → 404 en la segunda `DELETE`) | **Seguimiento documentado, `LOW`, no bloqueante** | El comportamiento no se modificó y sigue siendo coherente con `spec.md` §6. Responsable: CTO, al consolidar contratos/SPA. **Sin G-10** |
| `A-05`…`A-08` (`INFO`) | Sin cambios | Verificaciones positivas y G-3/ámbito se mantienen; el escaneo de los artefactos `F02-T05-loop2-*` no encontró rutas Windows absolutas ni JWT, y `F02-T05-loop2-emulator-down.txt` registra contenedor y red eliminados y `docker ps -a` vacío. El lint global en rojo por F03 sigue siendo interferencia externa ajena |

### Cobertura y conclusión final del addendum

- **Cobertura tras la corrección:** `A-01` y `A-02` pasan de `LIMITED` a `SUFFICIENT` para la existencia y el orden de los controles (inspección de la ruta completa + pruebas focalizadas leídas); permanecen `LIMITED` únicamente la medición real de memoria y la semántica de `Errors[]` contra el emulador en vivo. `A-03`/`A-04` conservan su clasificación original.
- **Severidades tras el addendum:** `0 CRITICAL` · `0 HIGH` · `0 MEDIUM` pendientes (`A-01` y `A-02` cerrados) · `2 LOW` como seguimientos documentados (`A-03`, `A-04`) · `4 INFO` sin cambios.
- **Bloqueantes de auditoría:** **ninguno**.
- **Conclusión:** **`READY_WITH_CONCERNS` — sin bloqueantes.** Los dos riesgos `MEDIUM` de la revisión original están corregidos y verificados por inspección en el loop 2, sin regresiones reportadas en la evidencia consultada. Se mantiene la categoría `READY_WITH_CONCERNS` porque subsisten dos seguimientos `LOW` con responsable y fase (`A-03`, `A-04`), no porque exista riesgo que impida avanzar. No se ha aceptado ningún riesgo en nombre de Lino (G-10), no se ha usado Docker/Git/AWS y **no se emite dictamen funcional ni se cierra la tarea**: corresponde al Tester y al Architect según el flujo vigente.
- **Append-only:** este addendum se añade al final; cualquier revisión posterior debe incorporar un nuevo addendum, sin alterar el registro `v1` ni el presente.
