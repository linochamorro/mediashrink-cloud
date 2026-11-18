# Entrega Developer — `F01-T02` (cliente DynamoDB y modelo de datos)

| Campo | Valor |
|---|---|
| **Tarea / fase** | `F01-T02` — Fase 1, paquete `P-01-critical-foundations.md` |
| **Versión / Loop** | `v1 — Loop 1/3` |
| **Rol** | Developer (no emito dictamen ni cierro la tarea) |
| **Criterio asignado** | `CA-02`: CRUD DynamoDB en `aws/aws-emulator` con TTL 30 días y aislamiento estricto por `userId`, con ítems hijos por imagen |
| **Riesgo** | 3 (Sensible): persistencia y aislamiento por usuario |
| **Excepción metodológica** | Ninguna |
| **Fecha** | 2026-11-17 |
| **Estado final** | **`DONE_WITH_CONCERNS`** (obra propia verde; múltiples preocupaciones externas/deuda, detalladas en §6) |

## 1. Fuentes consultadas

`AGENTS.md`; `STATE.md`; `.agents/roles/developer.md`; `docs/sdd/packages/P-01-critical-foundations.md` (CA-02); `docs/sdd/{constitution,spec,plan}.md` (spec §4 modelo de datos, §6 errores; PR-07, IN-06, IN-09); `reports/implementation/F01/F01-T01-{task,architect}.md` (catálogo congelado v1, hash `5d0082f8…68d626d`); `reports/implementation/F01/F01-T02-task.md` (fuente de verdad de alcance); `backend/src/contracts/**`; `backend/src/config/index.ts`; `docs/runbooks/development-workflow.md`; `.env.example`; `reports/verification/F00-architect.md` §7.

## 2. Cronología (todas las rutas relativas a `<PROJECT_ROOT>`)

1. **Lectura y verificación de entorno:** Node 26.13.0 / npm 11.20.0; Docker CLI resuelto como `<DOCKER_CLI_DIR>/docker.exe`; `docker ps -a` inicial sin contenedores.
2. **Dependencias (G-8):** `npm install -w @mediashrink/backend` con `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `@aws-sdk/credential-providers` y `@smithy/node-http-handler`. Solo se tocó el manifiesto backend y el lockfile del workspace; no el `package.json` raíz.
3. **RED:** se escribieron primero `tests/integration/db/{table-fixture,factories,job-store.test,ttl.test,isolation.test}.ts` y un stub `backend/src/db/index.ts` que lanza `NOT_IMPLEMENTED`. Ejecución con emulador levantado: 3 suites fallan **por comportamiento** (el almacén aún no existe), 19 pruebas omitidas por el fallo del `beforeAll`. Evidencia `evidence/F01-T02-red.txt`.
4. **GREEN:** se implementaron `backend/src/db/{client,keys,job-store,errors,types,index}.ts`, sustituyendo el stub. Primera ejecución: 16/19 con tres fallos de causa identificada (TTL `ENABLING`, fábrica que valida antes de la aserción negativa, orden de comprobación en `updateImage`). Corregidas las causas y reejecutado: **19/19**. Evidencia `evidence/F01-T02-green.txt`, más ejecuciones focalizadas `...-ttl.txt` (5/5) y `...-isolation.txt` (6/6).
5. **REFACTOR:** extracción de `imageItem()` (elimina duplicación en `putImage`/`updateImage`), simplificación de `getImage()` y renombrado del tipo local de expresiones. Typecheck acotado y 19/19 de nuevo. Evidencia `evidence/F01-T02-refactor.txt`.
6. **Documentación:** `docs/architecture/03-data-model-and-storage-contract.md` con claves, TTL, índice por `userId`, operaciones y transporte.
7. **Apagado (G-7):** `docker compose down`; `docker ps -a` y `docker compose ps` sin contenedores ni red. Evidencia `evidence/F01-T02-emulator-up.txt` y `...-emulator-down.txt`.

### Archivos creados o modificados (ámbito exclusivo)

- `backend/src/db/{client,errors,index,job-store,keys,types}.ts`
- `backend/package.json` (+ `package-lock.json` del workspace, por G-8)
- `tests/integration/db/{table-fixture,factories,job-store.test,ttl.test,isolation.test}.ts`
- `docs/architecture/03-data-model-and-storage-contract.md`
- `reports/implementation/F01/evidence/F01-T02-{red,green,refactor,emulator-up,emulator-down,ttl,isolation}.txt`
- `reports/implementation/F01/F01-T02-developer.md`
- Efímero (fuera de producto): `temporary/tsconfig.f01-t02.json`

**No se tocó:** `package.json` raíz, `backend/src/{contracts,auth,domain}/**`, `frontend/**`, `infra/terraform/**`, `.github/**`, `.env.example`, `STATE.md`, `docs/sdd/tasks.md`, reportes ajenos. Sin AWS real, sin secretos, sin rutas Windows absolutas en artefactos (se usa `<PROJECT_ROOT>` / `<DOCKER_CLI_DIR>`).

## 3. Tabla de comandos y exit codes

| Comando (desde `<PROJECT_ROOT>`) | Exit | Resultado |
|---|---:|---|
| `npm install -w @mediashrink/backend --save @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb @aws-sdk/credential-providers --no-audit --no-fund` | 0 | 33 paquetes; avisos `install-scripts` (ver P-05) |
| `npm install -w @mediashrink/backend --save @smithy/node-http-handler --no-audit --no-fund` | 0 | `up to date` |
| `<DOCKER_CLI_DIR>/docker.exe compose up -d` | 0 | contenedor creado e iniciado |
| `<DOCKER_CLI_DIR>/docker.exe compose ps` / `inspect` (poll) | 0 | `healthy`; `memory=2147483648`, `nanoCpus=2000000000`, `user=1000:1000` |
| `docker cp` × 3 (`ca.pem`, `config`, `emulator_credentials`) | 0 | CA/credenciales efímeras exportadas (runbook N-01) |
| `curl.exe --cacert ./.local/aws-emulator/ca.pem https://127.0.0.1:9297/__admin/health` | 0 | cuerpo `ok` |
| `npx vitest run tests/integration/db` (**RED**) | 1 | 3 suites fallan por `NOT_IMPLEMENTED` (esperado) |
| `npx tsc --noEmit -p temporary/tsconfig.f01-t02.json` | 0 | sin diagnósticos |
| `npx vitest run tests/integration/db` (**GREEN**) | 0 | **19/19** (3 archivos) |
| `npx vitest run tests/integration/db/ttl.test.ts` | 0 | **5/5** |
| `npx vitest run tests/integration/db/isolation.test.ts` | 0 | **6/6** |
| `npx vitest run tests/integration/db` (**REFACTOR**) | 0 | **19/19** |
| `npx eslint backend/src/db tests/integration/db --ext .ts` | 0 | sin hallazgos |
| `<DOCKER_CLI_DIR>/docker.exe compose down` | 0 | contenedor y red eliminados |
| `<DOCKER_CLI_DIR>/docker.exe ps -a` | 0 | sin contenedores |
| `npx tsc --noEmit -p backend/tsconfig.json` | 1 | fallo ajeno: `tests/unit/domain/savings.test.ts:51` TS2367 (F01-T05, ver P-01) |

## 4. Decisiones de diseño

1. **Claves:** job = PK `userId` / SK `jobId` (spec §4 literal); imagen = PK `userId` / SK `IMAGE#<jobId>#<imageId>`, con `parentJobId` para filtrar. Los IDs son opacos sin `#` (reservado para claves compuestas).
2. **Índice por `userId`:** es la propia HASH key; no se crea GSI. Todo acceso empieza por la partición del dueño, por lo que un `jobId` ajeno no es direccionable. Las imágenes se listan con `Query` por `begins_with`, nunca con `Scan`.
3. **TTL:** `computeTtl(createdAt)` del catálogo congelado (30 días en Unix seconds); hijos heredan el TTL del padre; `schemas.Job` rechaza TTL incoherente antes de escribir. El fixture espera a que el TTL pase de `ENABLING` a `ENABLED`.
4. **Validación en la frontera:** toda escritura pasa por `schemas.Job` / `schemas.ImageRecord`. La capa de datos no redefine tipos de producto ni relaja los contratos de T01.
5. **Errores de aislamiento:** como "no encontrado" (`null` en lecturas, `JobNotFoundError` en mutaciones). Se comprueba el job padre antes que la imagen hija para no revelar existencia ajena (spec §6).
6. **Inyección del cliente:** `createJobStore({ tableName, client })` permite tablas efímeras en tests; `createDynamoDbDocumentClientFromConfig(config)` da el cliente de producción apuntando a `AWS_ENDPOINT_URL` con credenciales `fromIni` y CA explícito.
7. **Tabla de prueba:** nombre único por archivo (`mediashrink-dbtest-<tag>-<uuid>`), creada con `PAY_PER_REQUEST` y TTL, borrada en `afterAll`. Nunca se usa `DYNAMODB_TABLE_JOBS` (F04).

## 5. Evidencias

`reports/implementation/F01/evidence/F01-T02-{red,green,refactor,emulator-up,emulator-down,ttl,isolation}.txt` — todas reales, con rutas redactadas como `<PROJECT_ROOT>` / `<DOCKER_CLI_DIR>`.

## 6. Problemas registrados (7 campos cada uno)

### P-01 — Typecheck global roto por tarea paralela

1. **Identificación:** P-01 · `npx tsc --noEmit -p backend/tsconfig.json` → exit 1.
2. **Problema:** `tests/unit/domain/savings.test.ts(51,24): error TS2367` (comparación sin solapamiento de tipos).
3. **Causa:** demostrada; archivo en curso de `F01-T05` (Developer paralelo), fuera del ámbito de escritura de esta tarea.
4. **Solución e intentos fallidos:** no se modificó el archivo ajeno. Se creó `temporary/tsconfig.f01-t02.json` (solo `backend/src/**` + `tests/integration/db/**`) y se ejecutó el typecheck acotado: exit 0. No se aplicaron parches a ciegas al código propio.
5. **Verificación:** `npx tsc --noEmit -p temporary/tsconfig.f01-t02.json` → 0; `npx eslint backend/src/db tests/integration/db --ext .ts` → 0.
6. **Pendientes:** el Tester/Auditor debe reejecutar el typecheck global cuando `F01-T05` esté estable; comunicar a Architect que el fallo no es de `F01-T02`.
7. **Aprendizaje candidato:** en despachos paralelos con workspace compartido, verificar con tsconfig acotado y no interpretar fallos de otro propietario como regresiones propias.

### P-02 — TTL devuelve `ENABLING` justo después de activarlo

1. **Identificación:** P-02 · `ttl.test.ts`, fallo GREEN inicial: `expected 'ENABLING' to be 'ENABLED'`.
2. **Problema:** la aserción sobre `DescribeTimeToLive` era dependiente del tiempo.
3. **Causa:** demostrada; DynamoDB y el emulador activan TTL de forma asíncrona (`ENABLING` → `ENABLED`).
4. **Solución e intentos fallidos:** no se debilitó la aserción; se añadió espera activa (150 ms, timeout 30 s) en `tests/integration/db/table-fixture.ts` tras `UpdateTimeToLiveCommand`.
5. **Verificación:** `npx vitest run tests/integration/db/ttl.test.ts` → 5/5 (también en GREEN y REFACTOR).
6. **Pendientes:** ninguno.
7. **Aprendizaje candidato:** los cambios de configuración de DynamoDB son asíncronos; el fixture debe esperar al estado final, no a la respuesta de la llamada.

### P-03 — Fábrica validaba antes de la aserción negativa de TTL

1. **Identificación:** P-03 · `ttl.test.ts`, fallo GREEN inicial: `ZodError` lanzado dentro de `makeJob`.
2. **Problema:** `makeJob({ ttl: 60 })` llamaba a `schemas.Job.parse` internamente, por lo que el test no podía comprobar el rechazo.
3. **Causa:** demostrada; la fábrica produce datos válidos y valida en su construcción.
4. **Solución e intentos fallidos:** el test construye un job válido con `makeJob()` y aplica `schemas.Job.parse({ ...job, ttl: 60 })` sobre una copia; se conserva la expectativa de rechazo sin relajarla.
5. **Verificación:** `ttl.test.ts` → 5/5.
6. **Pendientes:** ninguno.
7. **Aprendizaje candidato:** las fábricas deben generar valores válidos; las pruebas negativas mutan copias explícitas.

### P-04 — Orden de comprobación en `updateImage` filtraba jerarquía

1. **Identificación:** P-04 · `isolation.test.ts`, fallo GREEN inicial: `ImageNotFoundError` donde se esperaba `JobNotFoundError`.
2. **Problema:** con `userId` ajeno, `updateImage` consultaba primero la imagen y devolvía un error de hijo.
3. **Causa:** demostrada; orden de validación (`getImage` antes que `getJob`) en la primera implementación.
4. **Solución e intentos fallidos:** se invirtió el orden: comprobar el job del usuario primero (misma regla que `putImage`) y luego la imagen. No se cambió la expectativa del test.
5. **Verificación:** `isolation.test.ts` → 6/6, incluido el caso de igual `jobId` para A y B sin fuga.
6. **Pendientes:** ninguno.
7. **Aprendizaje candidato:** validar la propiedad del padre antes que la existencia del hijo evita revelar estructura ajena.

### P-05 — Avisos de `install-scripts` al instalar dependencias

1. **Identificación:** P-05 · `npm install -w ...` mostró avisos para `sharp@0.33.5` y `esbuild@0.21.5/0.28.2`.
2. **Problema:** npm 11 no ejecuta scripts de instalación no aprobados.
3. **Causa:** demostrada; política de allowScripts heredada de F00, no introducida por esta tarea.
4. **Solución e intentos fallidos:** no se aprobaron scripts (sin gate para ello); la instalación terminó exit 0 y las pruebas de integración cargaron `libvips`/SDK correctamente.
5. **Verificación:** exit 0 en ambas instalaciones; 19/19 pruebas verdes.
6. **Pendientes:** deuda de herramientas/CI ya registrada por F00; responsable CTO, no bloquea CA-02.
7. **Aprendizaje candidato:** no aprobar `install-scripts` sin autorización expresa; documentar el aviso como deuda, no como error.

### P-06 — Tablas efímeras huérfanas durante la fase RED

1. **Identificación:** P-06 · el `beforeAll` de cada suite creaba una tabla antes de que el stub lanzara `NOT_IMPLEMENTED`.
2. **Problema:** el fallo en `beforeAll` pudo impedir el `afterAll`, dejando tablas de prueba efímeras en el emulador.
3. **Causa:** hipótesis razonable (comportamiento observado del runner con suites fallidas); no se pudo confirmar con `ListTables` porque el contenedor ya estaba apagado.
4. **Solución e intentos fallidos:** se usaron nombres únicos por archivo (`mediashrink-dbtest-<tag>-<uuid>`) para impedir colisiones; no se intentó limpieza manual con el emulador ya detenido.
5. **Verificación:** `docker ps -a` y `docker compose ps` sin contenedores ni red tras `docker compose down` (G-7 cumplido).
6. **Pendientes:** si se decide limpiar el volumen named `aws-emulator-data`, usar `docker compose down -v` en una tarea posterior (no ejecutado: no estaba en el alcance ni es necesario para G-7).
7. **Aprendizaje candidato:** en RED con stub que falla en `beforeAll`, usar nombres efímeros y limpiar tablas en un `afterAll` tolerante a fallos de setup.

## 7. Estado final y handoff

- **Estado:** `DONE_WITH_CONCERNS`. La implementación propia está completa y verificada (RED → GREEN → REFACTOR, 19/19 integración, typecheck y lint acotados en verde, emulador apagado). Las preocupaciones son P-01 (fallo de typecheck global causado por tarea paralela), P-05 (deuda heredada de scripts) y P-06 (tablas efímeras sin limpieza explícita).
- **CA-02:** cubierto por evidencia propia de CRUD, TTL (configuración + atributo + herencia) y aislamiento (6 casos negativos, incluido `jobId` idéntico para dos usuarios).
- **No emitido:** `PASSED`, cierre de tarea ni actualización de `STATE.md`/`tasks.md` (compete a Tester/Auditor/Architect).
- **Siguiente paso sugerido:** Tester independiente reejecute `npx vitest run tests/integration/db` con emulador en vivo y Auditor revise aislamiento/TTL; reejecutar typecheck global tras estabilizar `F01-T05`.

---

## Addendum — cierres menores previos a la verificación (append-only)

| Campo | Valor |
|---|---|
| **Fecha** | `2026-11-17` |
| **Versión / Loop** | `v1 — Loop 1/3` (sin cambio; no se reabre la tarea) |
| **Alcance del addendum** | Cierre de P-01, P-06 y del concern P3 de `F01-T05`; sin cambios de comportamiento en `backend/src/db/**` ni en `tests/integration/db/**` |
| **Dictamen emitido** | Ninguno: Developer no emite `PASSED` ni cierra la tarea |

### A.1 Proveedor de cobertura declarado (concern P3 de F01-T05)

1. **Identificación:** concern P3 — `@vitest/coverage-v8` instalado con `--no-save` por otra tarea; no sobreviviría a `npm ci` en CI.
2. **Problema:** la cobertura 100 % de `backend/src/domain/**` no era reproducible desde un lockfile limpio.
3. **Causa:** demostrada; el paquete estaba presente en `node_modules` pero ausente de `backend/package.json` y del lockfile.
4. **Solución e intentos fallidos:** se añadió `"@vitest/coverage-v8": "^2.1.9"` a **devDependencies** de `backend/package.json` (versión alineada con `vitest@^2.1.9`) y se ejecutó `npm install -w @mediashrink/backend --save-dev` para fijar el lockfile (G-8). No se tocó el `package.json` raíz ni código de dominio.
5. **Verificación:** `npm ci --no-audit --no-fund` → exit 0 (324 paquetes); `npm ls @vitest/coverage-v8 --all` → `2.1.9` bajo `@mediashrink/backend`; `npx vitest run tests/unit/domain --coverage` → exit 0, **47/47** pruebas y `backend/src/domain/**` al **100 %** en stmts/branch/funcs/lines.
6. **Pendientes:** ninguno para esta tarea. La deuda de avisos `install-scripts` (P-05) permanece como seguimiento heredado de F00.
7. **Aprendizaje candidato:** una cobertura citada como evidencia debe ser reproducible desde el manifiesto y el lockfile, no desde el estado mutable de `node_modules`.
8. **Estado:** **CERRADO**. Evidencia: `reports/implementation/F01/evidence/F01-T02-coverage-dep.txt`.

### A.2 Tabla efímera huérfana (P-06)

1. **Identificación:** P-06 del reporte original — posible tabla `mediashrink-dbtest-*` dejada por la fase RED.
2. **Problema:** incertidumbre sobre limpieza del fixture cuando fallaba el `beforeAll`.
3. **Causa:** hipótesis no confirmada en el reporte original; se resolvió por comprobación directa, no por suposición.
4. **Solución e intentos fallidos:** se levantó el emulador (`docker compose up -d`, límites 2 GiB/2.0 CPUs verificados, CA/credenciales reexportados, healthcheck `ok`) y se enumeraron **todas** las tablas con `ListTablesCommand` paginado; el filtro por prefijo `mediashrink-dbtest-` devolvió 0. No hubo nada que borrar, por lo que **no se eliminó ningún recurso**. Se apagó con `docker compose down`.
5. **Verificación:** `ALL_TABLES=[]`, `ORPHAN_COUNT=0`, `REMAINING_DBTEST=0`; `docker compose down` exit 0; `docker ps -a` y `docker compose ps` sin contenedores ni red.
6. **Pendientes:** ninguno. El volumen named `aws-emulator-data` sigue persistiendo por diseño del runbook (no es contenedor ni red).
7. **Aprendizaje candidato:** comprobar el estado real del emulador antes de asumir limpieza; el reinicio puede reiniciar el estado en memoria.
8. **Estado:** **CERRADO sin hallazgos**. Evidencia: `reports/implementation/F01/evidence/F01-T02-orphan-check.txt`.

### A.3 Typecheck global (P-01)

1. **Identificación:** P-01 del reporte original — `npm run typecheck` fallaba por `tests/unit/domain/savings.test.ts:51` (TS2367), archivo en curso de `F01-T05`.
2. **Problema:** imposibilidad de verificar el typecheck global mientras el otro Developer estaba escribiendo.
3. **Causa:** demostrada; concurrencia de tareas en el mismo workspace, ya documentada en el reporte original.
4. **Solución e intentos fallidos:** no se corrigió ningún archivo ajeno. Una vez `F01-T05` terminó, se reejecutó el comando global tal cual.
5. **Verificación:** `npm run typecheck` → exit 0, sin diagnósticos en `backend/tsconfig.json` ni `frontend/tsconfig.json`.
6. **Pendientes:** ninguno.
7. **Aprendizaje candidato:** los fallos de typecheck por tareas paralelas deben reverificarse al finalizar el otro trabajo, no darse por permanentes.
8. **Estado:** **CERRADO**. Evidencia: `reports/implementation/F01/evidence/F01-T02-typecheck-global.txt`.

### A.4 Estado tras el addendum

- `P-01` y `P-06` cerrados; concern P3 de `F01-T05` cerrado. Único resto: `P-05` (avisos de `install-scripts` de `sharp`/`esbuild`, deuda heredada de F00, no bloqueante y no aceptada en nombre de Lino).
- **Estado final (actualizado): `DONE_WITH_CONCERNS`** por ese único resto de deuda heredada.
- Sin git, sin AWS real, sin secretos ni rutas Windows absolutas en los artefactos nuevos. Contenedor Docker **apagado** (`docker ps -a` vacío).
- Se mantiene sin emitir `PASSED` y sin cerrar `F01-T02`: corresponde a Tester, Auditor y Architect.
