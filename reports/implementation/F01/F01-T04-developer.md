# Reporte Developer — `F01-T04` (Script seed sintético)

| Campo | Valor |
|---|---|
| **Tarea** | `F01-T04` — Script seed sintético (usuarios demo + imágenes `100x100`) |
| **Fase / paquete** | Fase 1 — `docs/sdd/packages/P-01-critical-foundations.md` |
| **Versión / Loop** | `v1 — Loop 1/3` |
| **Rol implementador / verificador** | Developer / `Tester` (según `CA-04`; sin Auditor) |
| **Riesgo** | `2 (Relevante)` |
| **Criterio asignado** | `CA-04`: script seed crea usuarios demo e imágenes sintéticas `100x100` de forma **idempotente** en local/emulador, sin datos reales |
| **Estado final del Developer** | **`DONE`** (entrega para verificación independiente; **no se emite `PASSED` ni se cierra la tarea**) |
| **Contenedor Docker** | Apagado (`docker ps -a` vacío, sin red residual) — G-7 cumplido |

## 1. Fuentes consultadas (obligatorias y de alcance)

- `AGENTS.md`, `STATE.md`, `.agents/roles/developer.md`.
- `docs/sdd/packages/P-01-critical-foundations.md` (§5 `CA-04`), `docs/sdd/spec.md` (FR-04, PR-02), `docs/sdd/constitution.md` (PR-01, PR-02, PR-12).
- `reports/implementation/F01/F01-T01-architect.md`, `F01-T02-architect.md`, `F01-T03-architect.md` (todas `PASSED`).
- `reports/implementation/F01/F01-T04-task.md` (**fuente de verdad de alcance**).
- Contratos congelados: `backend/src/contracts/{index,catalog}.ts`; persistencia: `backend/src/db/{client,index,job-store,types,keys}.ts`; auth: `backend/src/auth/{password,identity,service,user-store,index}.ts`; configuración: `backend/src/config/index.ts`.
- `docs/runbooks/development-workflow.md` (§1 arranque/CA/ddocker cp, §2 TDD), `.env.example`, `docs/templates/problema-solucion.md` (referido por el contrato; no presente en el repositorio — se usan los 7 campos enumerados en el contrato del rol).
- Patrones de prueba existentes: `tests/integration/db/{table-fixture,factories,job-store.test}.ts`, `tests/integration/auth/fixtures.ts`.

## 2. Criterio `CA-04` — satisfacción observada

| Requisito de `CA-04` / tarea | Comportamiento implementado | Evidencia |
|---|---|---|
| Usuarios demo hasheados con el servicio de T03 | `hashPassword` importado de `backend/src/auth/password.ts`; ninguna reimplementación del hash. Se verifica con `verifyPassword` que el hash almacenado autentica la contraseña demo. | `F01-T04-idempotence.txt`, `F01-T04-db-check.txt` |
| Imágenes `100x100` sintéticas, sin datos reales | Píxeles construidos en memoria con `sharp` (`create` + patrón determinista); PNG/WebP/AVIF generados por código; se valida `metadata.width/height === 100`. Sin archivos personales ni descargas. | `F01-T04-dry-run.txt` |
| Idempotencia (dos ejecuciones sin duplicar) | IDs fijos + escrituras condicionales / comprobación por ítem. Conteo estable `3/3/6 → 12` antes y después de la segunda ejecución. | `F01-T04-seed-run-{1,2}.txt`, `F01-T04-idempotence.txt` |
| `--dry-run` sin escrituras | El modo dry-run **no abre conexión con DynamoDB**: genera el plan y las imágenes, imprime `[SE CREARÍA]` y no llama a `ensureSeedTable`. Conteo previo = posterior en el test. | `F01-T04-dry-run.txt`, `F01-T04-idempotence.txt` |
| Reutilizar cliente T02 y contratos T01 | `createDynamoDbDocumentClientFromConfig`, `createJobStore`, `schemas.Job`/`schemas.ImageRecord`, `computeTtl` y `PRESET_VALUES` se importan; no se redefinen. | Código en `tools/scripts/seed/**` |
| Persistencia en emulador, sin AWS real | Guardia `assertEmulatorOnly`: `AWS_ENDPOINT_URL` debe ser `https://127.0.0.1:9297`; credenciales/CA efímeros de `.local/aws-emulator/`; tabla efímera propia del seed. | `F01-T04-seed-run-*.txt`, `F01-T04-db-check.txt` |
| Ejecutable en local y CI | `npm run seed` en `package.json` raíz (única modificación permitida en ese archivo), implementado con `tsx` (devDependency ya instalada, sin nuevos manifiestos). | `F01-T04-dry-run.txt`, `F01-T04-seed-run-*.txt` |

## 3. Cronología (RED → GREEN → REFACTOR → verificación)

1. **Lectura y alcance.** Verificadas fuentes y ámbitos; confirmado que `F01-T02`/`F01-T03` están `PASSED` y que la raíz `package.json` solo podía recibir el script `seed`.
2. **Emulador (G-7).** `docker compose up -d` → `healthy` (~9 s), límites efectivos `memory=2147483648` / `nanoCpus=2000000000` / `user=1000:1000`; `docker cp` de `ca.pem`, `config`, `emulator_credentials` según runbook §1.3; healthcheck HTTPS `ok`.
3. **RED.** Escrito `tests/integration/seed/idempotence.test.ts` (4 pruebas) y un stub no-op en `tools/scripts/seed/index.ts`. Ejecución → **4/4 fallos por comportamiento** (plan vacío, `dryRun=false`, 0 creados, 0 omitidos). Evidencia: `evidence/F01-T04-red.txt`.
4. **GREEN.** Implementados `tools/scripts/seed/{demo-data,images,store,index,cli}.ts`; reutilización de hash T03, cliente T02 y contratos T01; añadido `"seed": "tsx tools/scripts/seed/cli.ts"` a `package.json` raíz. Ejecución → 5/5 (se añadió el caso de reparación).
5. **REFACTOR.** (a) La idempotencia de imágenes pasó a comprobarse por ítem, no por creación del job; se añadió la prueba de "lote sembrado a medias". (b) Coeficientes del ruido sintético ajustados para evitar patrones degenerados con ahorro negativo. (c) Barrel exports corregidos para lint. Verificado: typecheck 0, lint 0, suite seed 6/6, suite completa 188/188.
6. **Integración CLI.** `npm run seed -- --dry-run` → 0;` npm run seed` (1.ª) → creados `3/3/6`, conteo `0 → 12`; `npm run seed` (2.ª) → creados `0/0/0`, omitidos `3/3/6`, conteo `12 → 12`.
7. **DB check.** `tests/integration/seed/db-check.test.ts` → `DB-CHECK ... usuarios=3 jobs=3 imagenes=6 total=12`, hashes `scrypt$` y correos coincidentes.
8. **Apagado.** `docker compose down` → 0; `docker ps -a` vacío; red `mediashrink-cloud_default` eliminada. Evidencia: `F01-T04-emulator-down.txt`.

### Rutas creadas / modificadas (ámbito exclusivo)

- `tools/scripts/seed/demo-data.ts` — plan determinista y datos ficticios.
- `tools/scripts/seed/images.ts` — generación `100x100` con `sharp` y bytes reales.
- `tools/scripts/seed/store.ts` — DDL/conteo/usuarios sobre el cliente de T02.
- `tools/scripts/seed/index.ts` — orquestador `runSeed` y API pública.
- `tools/scripts/seed/cli.ts` — entrada `npm run seed`, `--dry-run` y formato de salida.
- `tests/integration/seed/{helpers,idempotence.test,db-check.test}.ts`.
- `package.json` raíz — **solo** la clave `"seed"`.
- `reports/implementation/F01/evidence/F01-T04-*.txt` (8 archivos) y este reporte.

## 4. Tabla de comandos y exit codes

| Comando (ejecutado desde `<PROJECT_ROOT>`) | Exit | Resultado / evidencia |
|---|---:|---|
| `npm run typecheck` | 0 | Sin diagnósticos |
| `npm run lint` | 0 | Sin hallazgos |
| `npx vitest run tests/integration/seed/idempotence.test.ts` (**RED**, stub) | 1 | 4/4 fallos por comportamiento — `F01-T04-red.txt` |
| `npx vitest run tests/integration/seed/idempotence.test.ts` (**GREEN**) | 0 | 5/5 |
| `docker compose up -d` | 0 | Contenedor `healthy` |
| `docker inspect --format ... mediashrink-aws-emulator` | 0 | `memory=2147483648 nanoCpus=2000000000 user=1000:1000` |
| `curl.exe --cacert ... https://127.0.0.1:9297/__admin/health` | 0 | Cuerpo `ok` |
| `npm run seed -- --dry-run` | 0 | Sin escrituras, 3 usuarios / 3 lotes / 6 imágenes `[SE CREARÍA]` — `F01-T04-dry-run.txt` |
| `npm run seed` (1.ª ejecución) | 0 | Creados 3/3/6; conteo `0 → 12` — `F01-T04-seed-run-1.txt` |
| `npm run seed` (2.ª ejecución) | 0 | Creados 0/0/0, omitidos 3/3/6; conteo `12 → 12` — `F01-T04-seed-run-2.txt` |
| `npx vitest run tests/integration/seed` | 0 | 2 archivos, **6/6** — `F01-T04-idempotence.txt` |
| `npx vitest run tests/integration/seed/db-check.test.ts` | 0 | **1/1**, `DB-CHECK ... total=12` — `F01-T04-db-check.txt` |
| `npx vitest run` (regresión completa) | 0 | 22 archivos, **188/188** — `F01-T04-regression.txt` |
| `docker compose down` | 0 | Sin contenedor ni red — `F01-T04-emulator-down.txt` |
| `docker ps -a --format ...` | 0 | Salida vacía (`CONTAINERS=0`) |

**Incidente intermedio (resuelto, ver P-01):** una ejecución de `npx vitest run tests/integration/seed` antes del aislamiento de tablas terminó con exit 1 (4 fallos por `ResourceInUseException`/`ResourceNotFoundException`). No se oculta: se documenta en P-01 y la ejecución final es 6/6.

## 5. Contenido sembrado (100 % ficticio)

**Usuarios demo** (contraseñas hasheadas con `scrypt` de T03; **no se registran en claro**):

| `userId` | Correo | Nombre mostrado | `jobId` | Preset | Contraseña |
|---|---|---|---|---|---|
| `demo-user-ana` | `ana.demo@example.com` | Ana (usuario ficticio) | `demo-job-ana` | `BALANCED` | demo, 12 caracteres, hasheada |
| `demo-user-bruno` | `bruno.demo@example.com` | Bruno (usuario ficticio) | `demo-job-bruno` | `HIGH` | demo, 14 caracteres, hasheada |
| `demo-user-carla` | `carla.demo@example.com` | Carla (usuario ficticia) | `demo-job-carla` | `MAX_COMPRESSION` | demo, 14 caracteres, hasheada |

**Imágenes sintéticas** (6 en total, 2 por lote; todas `100×100`, generadas por código, sin EXIF/GPS):

| `imageId` | Tamaño | Bytes originales (PNG) | Bytes optimizados (WebP+AVIF) | Ahorro |
|---|---|---:|---:|---:|
| `img-ana-01` | 100×100 | 7226 | 5755 | 20,4 % |
| `img-ana-02` | 100×100 | 7217 | 3040 | 57,9 % |
| `img-bruno-01` | 100×100 | 7229 | 5390 | 25,4 % |
| `img-bruno-02` | 100×100 | 7196 | 5714 | 20,6 % |
| `img-carla-01` | 100×100 | 7220 | 5749 | 20,4 % |
| `img-carla-02` | 100×100 | 7206 | 6249 | 13,3 % |

Cada lote queda `COMPLETED` con `formats: ['webp','avif']`, `exifStripped: true`, `savingsPct` coherente con bytes reales (PR-12) y `ttl = createdAt + 30 días` mediante `computeTtl` del contrato congelado. Los ítems imagen son hijos del job (`IMAGE#<jobId>#<imageId>`) y heredan su TTL. La tabla del seed es `mediashrink-seed-demo`, distinta de la que Terraform aprovisionará en F04.

## 6. Problemas registrados (7 campos cada uno)

### P-01 — Colisión de tablas entre archivos de prueba en paralelo

- **Identificación:** `F01-T04-P-01` (incidente de integración, resuelto en el mismo loop).
- **Problema:** `npx vitest run tests/integration/seed` ejecutó `idempotence.test.ts` y `db-check.test.ts` en workers paralelos; ambos usaban `SEED_TABLE_NAME`, provocando `ResourceNotFoundException` y `ResourceInUseException: Table is being deleted` con 4 fallos.
- **Causa:** **Demostrada** por las trazas de la primera ejecución: estado compartido (misma tabla) entre workers independientes de Vitest, cada uno con `beforeAll` (drop/create) y `afterAll` (drop).
- **Solución e intentos fallidos:** se reejecutó una vez el mismo comando confirmando que el fallo se repetía; solución definitiva: derivar tablas propias por archivo (`${SEED_TABLE_NAME}-idem`, `${SEED_TABLE_NAME}-dbcheck`) y reescribir ambos tests. No se desactivó el paralelismo global.
- **Verificación:** `npx vitest run tests/integration/seed` → 2 archivos, 6/6; `npx vitest run` → 188/188.
- **Pendientes:** ninguno para esta tarea; el Tester puede reejecutar sin riesgo de colisión.
- **Aprendizaje candidato:** en `tests/integration/**`, cada archivo debe poseer su propia tabla efímera (o fijar `fileParallelism: false`) antes de dar por válida una suite paralela.

### P-02 — DDL y conteo sin redefinir el cliente de T02

- **Identificación:** `F01-T04-P-02` (decisión de diseño).
- **Problema:** `CreateTable`, `DescribeTable`, `UpdateTimeToLive` y `Scan` no son `DocumentClientCommand`; TypeScript no los acepta en el `send` del `DynamoDBDocumentClient` devuelto por T02.
- **Causa:** **Demostrada** por la API de `@aws-sdk/lib-dynamodb` y la firma de `send`.
- **Solución e intentos fallidos:** se añadió un helper local `sendLowLevel<T>` que envía esos comandos por el **mismo stack middleware y configuración** del cliente de T02 (sin construir un segundo cliente ni duplicar CA/credenciales). Todos los datos se escriben con `PutCommand`/`GetCommand`/`JobStore`. No hubo intentos fallidos: se diseñó así desde el inicio.
- **Verificación:** tabla creada con TTL `ENABLED`; conteos `3/3/6`; suite completa 188/188; sin credenciales fijas ni secretos.
- **Pendientes:** sugerencia no bloqueante para F04: exponer `ensureTable` desde la capa `backend/src/db` para que futuras herramientas no repitan este helper.
- **Aprendizaje candidato:** el `DynamoDBDocumentClient` reutiliza el stack base, por lo que el tooling puede hacer DDL sin duplicar transporte.

### P-03 — Ahorro negativo en patrones sintéticos degenerados

- **Identificación:** `F01-T04-P-03` (calidad de datos demo).
- **Problema:** con los coeficientes iniciales del ruido, una imagen daba `1215 B → 5043 B` y, tras el primer ajuste, otra `1212 B → 4931 B` (ahorro negativo) por un patrón regular que PNG comprimía demasiado bien.
- **Causa:** **Demostrada**: para `patternSeed = 11`, los coeficientes `x*(s*7+3)` e `y*(s*11+5)` coincidían módulo 23, generando diagonales periódicas.
- **Solución e intentos fallidos:** primer intento (`y*(s*11+5)`) resolvió `carla-01` pero degeneró `ana-01`; solución final `y*(s*13+5)`, comprobada para los seis seeds (11,12,21,22,31,32). **No se ocultó ningún resultado negativo**: la fórmula sigue usando bytes reales y la coherencia `savingsPct` la valida el contrato (PR-12).
- **Verificación:** dry-run final muestra seis ahorros positivos entre 13,3 % y 57,9 % — `F01-T04-dry-run.txt`.
- **Pendientes:** ninguno.
- **Aprendizaje candidato:** los fixtures deterministas deben revisarse como datos, no solo como bytes: un patrón regular puede invertir las métricas.

### P-04 — ESLint rechaza imports usados únicamente para re-exportar

- **Identificación:** `F01-T04-P-04` (calidad de código).
- **Problema:** `DemoUserSpec`, `dropSeedTable` y `readSeedUser` aparecían como `no-unused-vars` al importarlos y re-exportarlos en el barrel `tools/scripts/seed/index.ts`.
- **Causa:** **Demostrada** por la salida de `npm run lint` (3 errores).
- **Solución e intentos fallidos:** se importó solo lo que el orquestador usa localmente y se re-exportó el resto directamente con `export { ... } from './store'` / `export type { ... } from './demo-data'`. No se desactivó la regla ni se añadió `eslint-disable`.
- **Verificación:** `npm run lint` → exit 0; `npm run typecheck` → exit 0.
- **Pendientes:** ninguno.
- **Aprendizaje candidato:** en barrel files, importar y re-exportar el mismo símbolo es redundante y ESLint 8 lo detecta.

### P-05 — Idempotencia de imágenes acoplada a la creación del job

- **Identificación:** `F01-T04-P-05` (REFACTOR funcional).
- **Problema:** la primera versión solo insertaba imágenes si el job se creaba en esa misma ejecución (`jobCreated && ...`); un lote sembrado parcialmente no se completaba en una repetición.
- **Causa:** **Demostrada** por revisión del orquestador durante REFACTOR (no por un fallo de test): se había modelado la idempotencia a nivel de agregado en lugar de por ítem.
- **Solución e intentos fallidos:** se sustituyó por `store.getImage(...)` independiente de `jobCreated`, y se añadió la prueba «recupera un lote sembrado a medias». No hubo intentos fallidos.
- **Verificación:** la nueva prueba recrea exactamente 2 imágenes, con `users.created = 0` y `jobs.created = 0`; suite seed 6/6 y regresión 188/188.
- **Pendientes:** ninguno.
- **Aprendizaje candidato:** la idempotencia debe decidirse por clave de ítem; el estado del padre no debe condicionar la reparación de los hijos.

## 7. Estado final y handoff

- **Estado:** `DONE`. Entregable listo para el `Tester` de `CA-04`; **este rol no emite `PASSED` ni cierra `F01-T04`**.
- **Sin secretos ni rutas Windows absolutas:** se usan marcadores `REPLACE_WITH_LOCAL_*` y rutas relativas; las rutas de las trazas de Vitest se redactaron a `<PROJECT_ROOT>` en las evidencias.
- **Sin AWS real:** guardia de endpoint en la CLI; credenciales efímeras por archivos generados por el emulador.
- **Dependencias:** no se modificó ningún manifiesto (G-8); `package.json` raíz solo recibió el script `seed`.
- **Docker:** apagado al terminar; `docker ps -a` vacío y red eliminada (G-7).
