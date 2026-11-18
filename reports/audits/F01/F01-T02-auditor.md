# Auditoría de cambio — `F01-T02` (cliente DynamoDB y modelo de datos)

| Campo | Valor |
|---|---|
| **Auditoría / tarea** | `F01-T02` — Fase 1, paquete `P-01-critical-foundations.md` (`CA-02`) |
| **Rol** | Auditor (riesgo 3 — sensible: persistencia y aislamiento por usuario) |
| **Loop** | `1/3` · **Fecha** `2026-11-17` · **Entorno** inspección estática + revisión de evidencia (sin ejecución propia) |
| **Encargo** | Aislamiento (PR-07/IN-06), TTL/retención (IN-09), credenciales y transporte (G-3/PR-08), Docker (G-7), dependencias (G-8) y documento `03` |
| **Frontera** | No se emite `PASSED`/`NO-PASSED` (compete a Tester), no se implementa, no se cierra la tarea, no se acepta riesgo en nombre de Lino (G-10), no se usan Docker/Git/AWS |
| **Plantilla** | `docs/templates/problema-solucion.md` del laboratorio — 7 campos por hallazgo |

## 1. Preguntas falsificables y método

1. ¿Existe alguna operación del almacén que resuelva un `jobId` sin exigir el `userId` dueño, o que use `Scan`/GSI como ruta alternativa?
2. ¿El mismo `jobId` en dos usuarios puede colisionar o filtrar datos?
3. ¿`ttl = createdAt + 30 días` en segundos Unix, con `ENABLED` en la tabla de prueba y coherente con `RETENTION_DAYS`? ¿Hay literales contradictorios?
4. ¿El cliente apunta a `AWS_ENDPOINT_URL`, usa `fromIni` sobre archivos efímeros y CA explícito, sin credenciales fijas, secretos, AWS real ni `:9324` activo? ¿Las pruebas imprimen contenidos de `emulator_credentials`?
5. ¿La evidencia acredita límites 2g/2.0 efectivos, apagado limpio (`docker ps -a` vacío) y tablas efímeras sin huérfanas?
6. ¿`@aws-sdk/*` y `@vitest/coverage-v8` están declarados con integridad en lockfile, sin tocar `package.json` raíz fuera del script `seed` (T04)?
7. ¿El documento `03` describe claves, TTL y aislamiento sin rutas Windows absolutas ni secretos?

**Método:** lectura íntegra del código y las pruebas, contraste con SDD/paquete, búsquedas literales focalizadas y revisión de evidencia ya producida. Según METHODOLOGY §3.1, el Auditor no repite la suite funcional del Tester ni ejecuta Docker; la ejecución en vivo se califica como `CORROBORATED` por multiplicidad de artefactos, no como `REPRODUCED` propia.

**Fuentes:** `backend/src/db/{client,keys,job-store,types,errors,index}.ts`; `tests/integration/db/{table-fixture,factories,job-store.test,ttl.test,isolation.test}.ts`; `backend/src/contracts/{catalog,zod-schemas}.ts`; `backend/src/config/index.ts`; `backend/package.json`; `package-lock.json`; `.env.example`; `docs/architecture/03-data-model-and-storage-contract.md`; reportes `F01-T02-{task,developer}.md` y `evidence/F01-T02-*.txt`.

## 2. Matriz de verificación del alcance

| # | Criterio de alcance | Comprobación propia | Resultado | Calificación |
|---|---|---|---|---|
| V-1 | Aislamiento en TODAS las operaciones | Las 10 firmas de `JobStore` (`types.ts:33-49`) exigen `userId`. `getJob`/`getImage`: `GetCommand` con `Key: { userId, jobId }`. `listImages`/`deleteImages`: `Query` con `userId = :u AND begins_with(jobId, :p)`. `updateJob`/`deleteJob`/`deleteJobWithImages`: `getJob` previo + `Key: { userId, jobId }`. `putImage`/`updateImage`: `getJob` previo + SK `IMAGE#<jobId>#<imageId>`. **0** `ScanCommand` y **0** firmas con `jobId` sin `userId`. | Conforme | `REPRODUCED` (estático) |
| V-2 | `jobId` ajeno no resoluble / sin colisión | PK `userId` + SK `jobId` (`table-fixture.ts:69-77`). `isolation.test.ts:31-105` cubre B leyendo, modificando y borrando el job de A, imágenes de A, y A/B con el mismo `jobId`: 6/6. `updateImage` comprueba el padre antes que el hijo (`job-store.ts:288-293`, P-04 del Developer). | Conforme | `CORROBORATED` |
| V-3 | TTL y retención | `catalog.ts:16-18,35-41`: `RETENTION_DAYS=30`, `TTL_SECONDS=2_592_000`, `computeTtl = floor(ms/1000)+TTL_SECONDS`. `zod-schemas.ts:127-139` rechaza TTL incoherente. `table-fixture.ts:80-95` habilita `AttributeName:'ttl', Enabled:true` y espera `ENABLED`. `job-store.ts:89-99,271,299` hereda `parent.ttl` a los hijos. `ttl.test.ts:30-81` verifica los 5 casos. `config/index.ts:330` usa `RETENTION_DAYS` con default 30; `.env.example:68` = 30. | Conforme (con A-01) | `CORROBORATED` |
| V-4 | Credenciales y transporte | `client.ts:28-47`: `endpoint: options.endpointUrl`, `fromIni({ filepath, configFilepath })`, `Agent({ ca: readFileSync(caBundlePath) })` solo cuando `useSsl !== false`. `table-fixture.ts:27-48`: mismas rutas relativas y `https://127.0.0.1:9297`. Búsqueda literal: **0** `AKIA`/`ASIA`/`PRIVATE KEY`/`eyJ` en evidencia T02 y tests de integración; **0** rutas Windows absolutas; `:9324` aparece solo en documentación de prohibición (`.env.example:57`, doc `03:71`), nunca como valor activo. Las evidencias mencionan `emulator_credentials` solo como ruta de `docker cp`, jamás su contenido. | Conforme | `REPRODUCED` (estático) + `CORROBORATED` (evidencia) |
| V-5 | Docker G-7 | `F01-T02-emulator-up.txt:34-35`: `memory=2147483648 nanoCpus=2000000000 user=1000:1000`. `...-emulator-down.txt:6-24`: `docker compose down`, `docker ps -a` y `docker compose ps` vacíos. `...-orphan-check.txt:19-23,31-42`: `ALL_TABLES=[]`, `ORPHAN_COUNT=0`, `REMAINING_DBTEST=0`, apagado limpio. No ejecutado por este rol. | Conforme | `CORROBORATED` |
| V-6 | Dependencias G-8 | `backend/package.json:13-16,22` declara `@aws-sdk/{client-dynamodb,credential-providers,lib-dynamodb}`, `@smithy/node-http-handler` y `@vitest/coverage-v8`. `package-lock.json` L69/273/328/2394/2743 con `resolved`+`integrity` para todas. `package.json` raíz (leído íntegro) conserva exactamente los scripts F00 (`dev:*`, `build`, `typecheck`, `lint`, `test:unit`): sin `seed` (aún no ejecutado T04) ni dependencias nuevas. | Conforme (con A-04) | `CORROBORATED` |
| V-7 | Documento `03` | Describe modelo (§2), claves con `userId` (§2), TTL 30 días y herencia (§3), las 10 operaciones y su aislamiento (§4), `AWS_ENDPOINT_URL` + `fromIni` + CA y prohibición de `:9324` (§5). Sin secretos ni rutas absolutas. | Conforme | `REPRODUCED` (estático) |
| V-8 | Cronología TDD | `F01-T02-red.txt`: 3 suites fallan por `NOT_IMPLEMENTED` (19 omitidas) — fallo por comportamiento. `...-green.txt`: 19/19. `...-refactor.txt`: 19/19 + typecheck acotado 0. `...-typecheck-global.txt`: `npm run typecheck` exit 0 tras estabilizar F01-T05. | Conforme | `CORROBORATED` |

## 3. Hallazgos

### Hallazgo `T02-A-01` — `RETENTION_DAYS` configurable convive con `TTL_SECONDS` literal

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID: `T02-A-01` · Tarea: `F01-T02` · Fase: `P-01` · Loop: `1/3` · Fecha: `2026-11-17` · Entorno: inspección estática. **Severidad:** `INFO` · **Confianza:** `ALTA` · **Evidencia:** `CORROBORATED` · **Bloqueo:** NO |
| **2. Problema** | **Síntoma:** existen dos fuentes del valor de retención: `backend/src/config/index.ts:330` lee `RETENTION_DAYS` del entorno (default `30`) y expone `worker.retentionDays`, mientras que `backend/src/contracts/catalog.ts:16-18,35-41` fija `RETENTION_DAYS=30`/`TTL_SECONDS=2_592_000` y `computeTtl()` calcula con el literal. **Esperado:** una única fuente de verdad o, si se permite configuración, que el TTL persistido refleje ese valor. **Observado:** ambos son `30` hoy (`.env.example:68`) y no hay contradicción de valores; pero un cambio de `RETENTION_DAYS` en `.env` alteraría `config.worker.retentionDays` sin alterar el `ttl` escrito. **Impacto:** `INFO` — riesgo de desincronización futura entre configuración y dato persistido; no afecta a `CA-02` ni a IN-09 en el estado actual. **Reproducción:** lectura comparativa de los tres archivos citados. |
| **3. Causa** | **Estado:** `DEMOSTRADA` (convivencia de dos fuentes). **Evidencia:** `config/index.ts:41,71,330`; `catalog.ts:16-18,35-41`; `.env.example:68`; `ttl.test.ts:30-35`. **Alternativas descartadas:** contradicción de valores — descartada (ambos 30); incumplimiento de IN-09 — descartado (el catálogo congelado fija 30 días y el contrato lo refuerza). |
| **4. Solución** | **Cambios aplicados:** ninguno (no compete a este rol ni al alcance de T02: `config/index.ts` y `catalog.ts` son propiedad de F00/T01, congelados). **Motivo técnico:** IN-09 exige retención fija de 30 días; el literal del catálogo es la fuente congelada y es coherente con la spec. **Intentos fallidos relevantes:** ninguno. |
| **5. Verificación** | **Verificador independiente:** Auditor. **Comando/procedimiento:** lectura de `catalog.ts`, `zod-schemas.ts:127-139`, `config/index.ts`, `.env.example` y `ttl.test.ts`. **Resultado y evidencia:** default 30 en ambas fuentes; 5/5 pruebas de TTL según `evidence/F01-T02-ttl.txt`. **Regresión comprobada:** no aplica (sin cambios). **Límites:** no se evaluó el consumo futuro de `worker.retentionDays` en F04 (Terraform/lifecycle S3), fuera de este encargo. |
| **6. Pendientes** | **Riesgo residual:** desincronización latente si alguien modifica `RETENTION_DAYS` sin actualizar el catálogo. **Cobertura ausente:** consumo de `worker.retentionDays` en tareas posteriores. **Responsable y siguiente paso:** CTO/Architect al planificar F04; decidir si se documenta el literal como fuente única o se hace derivar el TTL de la config con control de cambios. **No aceptado como riesgo por Lino (sin G-10).** |
| **7. Aprendizaje** | **Prevención propuesta:** check de coherencia entre constantes de retención del catálogo, `.env.example` y config en la verificación de cada fase que las consuma. **Ámbito candidato:** `PROPUESTA_GLOBAL` · **Estado:** `PENDIENTE_DE_EVALUAR` |

### Hallazgo `T02-A-02` — `assertOpaqueId` no se invoca de forma uniforme en todas las firmas

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID: `T02-A-02` · Tarea: `F01-T02` · Fase: `P-01` · Loop: `1/3` · Fecha: `2026-11-17` · Entorno: inspección estática. **Severidad:** `LOW` · **Confianza:** `ALTA` · **Evidencia:** `REPRODUCED` · **Bloqueo:** NO |
| **2. Problema** | **Síntoma:** `assertOpaqueId(userId, ...)` se invoca explícitamente en `getJob`, `getImage`, `listImages` y `createJob`, pero no en `updateJob`, `deleteJob`, `deleteImages` ni `deleteJobWithImages`. **Esperado:** validación defensiva homogénea en la frontera del almacén. **Observado:** las operaciones omitidas obtienen el efecto indirectamente — las tres primeras pasan por `getJob`, y `deleteImages` llama a `imageKeyPrefix(jobId)`; ninguna abre una ruta de acceso ajeno porque la PK es `userId` y un `GetItem`/`Query` no puede alcanzar otra partición. **Impacto:** `LOW` — inconsistencia de estilo/defensa en profundidad, no explotable con la clave actual. **Reproducción:** lectura de `job-store.ts:130-207,209-313` y `keys.ts:17-31`. |
| **3. Causa** | **Estado:** `DEMOSTRADA`. **Evidencia:** `job-store.ts:131-132,141,160,212-213` frente a `:233-261,179-207,308-312`. **Alternativas descartadas:** vacío de aislamiento — descartado (V-1 y V-2 conformes; los 6 casos negativos de `isolation.test.ts` pasan). |
| **4. Solución** | **Cambios aplicados:** ninguno (Auditor no implementa). **Motivo técnico:** la corrección es facultativa y debe pasar por el Developer si se decide; no afecta a la corrección funcional de `CA-02`. **Intentos fallidos relevantes:** ninguno. |
| **5. Verificación** | **Verificador independiente:** Auditor. **Comando/procedimiento:** trazado manual de las 10 operaciones hasta su comando DynamoDB y contraste con `isolation.test.ts`. **Resultado y evidencia:** 0 comandos sin `userId` en clave o condición; 6/6 casos de aislamiento según `evidence/F01-T02-isolation.txt`. **Regresión comprobada:** no aplica. **Límites:** no se ejecutó un test con un `userId` que contuviera `#` (carácter reservado) contra las cuatro firmas omisas. |
| **6. Pendientes** | **Riesgo residual:** bajo; defensivo. **Cobertura ausente:** caso negativo de ID opaco en las cuatro firmas omisas. **Responsable y siguiente paso:** Developer en una tarea de refactor futura, si el Architect lo considera oportuno; no condiciona el cierre de T02. **No aceptado por Lino.** |
| **7. Aprendizaje** | **Prevención propuesta:** mover las aserciones de ID al inicio de cada método público (o a un wrapper común) en lugar de delegarlas a la función que construye la clave. **Ámbito candidato:** `SOLO_LOCAL` · **Estado:** `PENDIENTE_DE_EVALUAR` |

### Hallazgo `T02-A-03` — Evidencia de ejecución en vivo no reproducible por este rol

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID: `T02-A-03` · Tarea: `F01-T02` · Fase: `P-01` · Loop: `1/3` · Fecha: `2026-11-17` · Entorno: frontera de roles. **Severidad:** `INFO` · **Confianza:** `ALTA` · **Evidencia:** `CORROBORATED` · **Bloqueo:** NO |
| **2. Problema** | **Síntoma:** la acreditación de Docker (límites, apagado, huérfanos) y de las 19 pruebas verdes proviene del Developer y del Tester; el Auditor no la reejecuta. **Esperado:** revisión de riesgo sin duplicar la suite funcional ni usar Docker (METHODOLOGY §3.1 y rol). **Observado:** diez artefactos `evidence/F01-T02-*.txt` con comandos, exit codes y valores coherentes entre sí (up/down/orphan-check/ttl/isolation/red/green/refactor/coverage/typecheck). **Impacto:** `INFO` — limitación declarada de cobertura, no defecto. **Reproducción:** lectura de los diez artefactos. |
| **3. Causa** | **Estado:** `DEMOSTRADA` (restricción de alcance del encargo). **Evidencia:** `F01-T02-emulator-{up,down}.txt`, `F01-T02-orphan-check.txt`, `F01-T02-{red,green,refactor}.txt`. **Alternativas descartadas:** retractar la evidencia por no ser propia — descartado: el rol no debe fabricar ni repetir ejecuciones; se califica correctamente como `CORROBORATED`. |
| **4. Solución** | **Cambios aplicados:** ninguno. **Motivo técnico:** preservar la independencia Tester/Auditor y el gate G-7 (contenedor apagado). **Intentos fallidos relevantes:** ninguno. |
| **5. Verificación** | **Verificador independiente:** Auditor (revisión documental). **Comando/procedimiento:** contraste cruzado de exit codes, timestamps y valores de los diez artefactos. **Resultado y evidencia:** coherentes; `docker ps -a` vacío en dos artefactos independientes. **Regresión comprobada:** no aplica. **Límites:** no se verificó en vivo el comportamiento del emulador ni se levantó el contenedor. |
| **6. Pendientes** | **Riesgo residual:** ninguno para `CA-02`. **Cobertura ausente:** ejecución propia. **Responsable y siguiente paso:** Tester (ya emitió/emitirá su dictamen con ejecución propia); Architect integra. **No aceptado por Lino.** |
| **7. Aprendizaje** | **Prevención propuesta:** declarar explícitamente en cada auditoría de riesgo 3 qué partes son `REPRODUCED`, `CORROBORATED` o `INDICATIVE`. **Ámbito candidato:** `PROPUESTA_GLOBAL` · **Estado:** `PENDIENTE_DE_EVALUAR` |

### Hallazgo `T02-A-04` — Ausencia de historial Git impide probar la no modificación del `package.json` raíz

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID: `T02-A-04` · Tarea: `F01-T02` · Fase: `P-01` · Loop: `1/3` · Fecha: `2026-11-17` · Entorno: inspección estática (el directorio no es repo en este harness). **Severidad:** `INFO` · **Confianza:** `MEDIA` · **Evidencia:** `INDICATIVE` · **Bloqueo:** NO |
| **2. Problema** | **Síntoma:** no es posible un `git diff` para demostrar que `package.json` raíz no fue tocado. **Esperado:** verificar el límite de ámbito (D05: solo el script `seed` de T04 puede modificarlo). **Observado:** el archivo leído íntegro contiene únicamente los scripts F00 (`dev:frontend`, `dev:backend`, `build`, `typecheck`, `lint`, `test:unit`) y las devDependencies F00; no hay `seed` (T04 aún no se ejecuta) ni dependencias nuevas; el Developer declara expresamente no haberlo tocado. **Impacto:** `INFO` — verificación por contenido, no por historial. **Reproducción:** lectura de `package.json` raíz y contraste con `F01-T02-task.md` §3 y `F01-T02-developer.md` §2. |
| **3. Causa** | **Estado:** `DEMOSTRADA` para el contenido actual; `HIPÓTESIS` para cualquier cambio previo no rastreable. **Evidencia:** `package.json:11-27`; `F01-T02-task.md:27-28`; `F01-T02-developer.md:38`. **Alternativas descartadas:** detectar una dependencia AWS en el manifiesto raíz — descartado (están todas en `backend/package.json`). |
| **4. Solución** | **Cambios aplicados:** ninguno. **Motivo técnico:** el Auditor no usa Git (sin gate en este encargo) y no modifica manifiestos. **Intentos fallidos relevantes:** ninguno. |
| **5. Verificación** | **Verificador independiente:** Auditor. **Comando/procedimiento:** lectura del archivo y búsqueda de `seed`/AWS SDK en él. **Resultado y evidencia:** 0 coincidencias de `seed` ni `@aws-sdk` en el manifiesto raíz; G-8 conforme en el workspace `backend`. **Regresión comprobada:** no aplica. **Límites:** sin historial, no se puede descartar un cambio ya revertido. |
| **6. Pendientes** | **Riesgo residual:** nulo en el estado observable. **Cobertura ausente:** trazabilidad de diffs. **Responsable y siguiente paso:** Architect al cierre de Fase 1, cuando T04 añada el script `seed` y se disponga de historial Git. **No aceptado por Lino.** |
| **7. Aprendizaje** | **Prevención propuesta:** cuando el harness no sea repo, adjuntar al reporte del implementador el contenido exacto del manifiesto raíz para establecer línea base. **Ámbito candidato:** `SOLO_LOCAL` · **Estado:** `PENDIENTE_DE_EVALUAR` |

## 4. Rutas examinadas y descartadas

- **`ScanCommand` / GSI:** 0 apariciones en `backend/src/db/**`; el listado de hijos es `Query` acotada por `userId` + prefijo. No existe ruta alternativa para resolver un `jobId` ajeno.
- **`deleteImages` sin comprobación de padre:** deliberado (`isolation.test.ts:71-72`: B obtiene `undefined` y los datos de A permanecen). La `Query` filtra por `userId`, por lo que no revela existencia ajena; no es hallazgo.
- **`updateJob`/`deleteJob` con condición de clave:** usan `attribute_exists(userId) AND attribute_exists(jobId)` sobre `Key: { userId, jobId }`, además del `getJob` previo; sin riesgo de TOCTOU que permita cruzar de usuario.
- **Salida de credenciales:** las evidencias contienen solo la ruta `./.local/aws-emulator/emulator_credentials` en comandos `docker cp`; 0 volcados de su contenido.
- **`:9324`:** 0 usos como valor; todas las apariciones en artefactos de T02 son prohibición documental.
- **AWS real:** 0 `aws configure`, 0 hostname AWS distinto del host lógico de QueueUrls heredado de F00; endpoint activo `https://127.0.0.1:9297`.

## 5. Conclusión

**`READY_WITH_CONCERNS`** · **Cobertura: `SUFFICIENT`** para el código, la configuración y la documentación del alcance; **`LIMITED`** únicamente para la ejecución en vivo (no reproducida por este rol, calificada como `CORROBORATED` — ver `T02-A-03`).

- **Hallazgos `CRITICAL`/`HIGH`: 0.** Bloqueantes para `CA-02`: **0**.
- **Concerns:** `T02-A-01` (INFO, coherencia futura de retención), `T02-A-02` (LOW, validación defensiva no uniforme), `T02-A-03` (INFO, ejecución no propia), `T02-A-04` (INFO, sin historial Git). Ninguno requiere reabrir el loop ni modificar `backend/src/db/**`.
- **Aislamiento PR-07/IN-06:** todas las operaciones filtran por `userId`; el mismo `jobId` en dos usuarios no colisiona ni fuga (6/6 casos negativos).
- **TTL IN-09:** `createdAt + 30 días` en Unix seconds, `ENABLED` en la tabla de prueba, herencia a hijos, coherente con `RETENTION_DAYS=30` de la config y `.env.example`; sin literales contradictorios.
- **G-3/PR-08:** sin credenciales fijas, secretos, rutas Windows absolutas nuevas ni `:9324` activo; `fromIni` + CA explícito + `AWS_ENDPOINT_URL`.
- **G-7:** límites 2 GiB / 2.0 CPUs acreditados; apagado limpio con `docker ps -a` vacío en dos evidencias; `ORPHAN_COUNT=0`.
- **G-8 / doc 03:** dependencias declaradas con `integrity` en lockfile; manifiesto raíz sin cambios observables; documento `03` completo y sin secretos ni rutas absolutas.
- Ningún riesgo se registra como aceptado: no se invocó `G-10` y no se emite dictamen funcional (`PASSED`/`NO-PASSED`), que corresponde al Tester.

**Recomendación al Architect:** cerrar el concern `T02-A-01` con una nota de gobernanza al planificar F04 (retención S3 vs. TTL DynamoDB); el resto son seguimientos no bloqueantes. La auditoría previa obligatoria de riesgo 3 queda satisfecha sin hallazgos que impidan el cierre de `F01-T02`.
