# Reporte Developer — `F02-T03`

| Campo | Valor |
|---|---|
| **ID completo** | `F02-T03` — Worker `sharp` (WebP + AVIF + miniatura, privacidad) |
| **Versión / Loop** | `v1 — Loop 1/3` |
| **Rol / Harness** | Developer / OpenCode |
| **Fecha** | `2026-11-17` |
| **Riesgo** | `3 (Sensible)` — privacidad EXIF/GPS y procesamiento |
| **Estado final** | **`DONE`** — implementación y evidencia entregadas; **no se emite `PASSED` ni se cierra la tarea** (compete a Tester/Auditor/Architect) |
| **Criterio asignado** | `CA-03`: por imagen produce WebP + AVIF + miniatura WebP, elimina **todos** los metadatos con `exifStripped: true` verificable, aplica la guarda de tamaño **antes** de escanear (cierra `A-05` de T05), usa límites de `loadConfig()` y reglas puras de F01-T05 sin reimplementarlas |

---

## 1. Fuentes leídas y alcance

`AGENTS.md`; `STATE.md`; `.agents/roles/developer.md`; `docs/sdd/packages/P-02-api-and-worker.md` (§5 `CA-03`); `docs/sdd/spec.md` (FR-07, FR-11, FR-12, NFR-05); `docs/sdd/plan.md` (§3.2, §4); `docs/sdd/constitution.md` (PR-01, IN-01, IN-10, IN-12); `reports/verification/F01-architect.md` (§3, `A-05`); `reports/audits/F01/F01-T05-auditor.md` (`A-05`, disposición `checkFileSize() → validateImageHeader() → checkDimensions()`); `reports/implementation/F02/F02-T03-task.md` (**fuente de verdad de alcance**); `backend/src/domain/**`, `backend/src/contracts/**`, `backend/src/config/index.ts`, `backend/package.json` (sharp `0.33.5` ya declarado), `backend/tsconfig.json`, `tsconfig.base.json`.

**Archivos escritos (solo ámbito autorizado):**
- `backend/src/worker/{index,preflight,render,processImage}.ts`
- `tests/unit/worker/{fixtures,processImage.test,antiBomb.test}.ts`
- `tests/integration/worker/{metadata.test,pipeline.test}.ts`
- `reports/implementation/F02/evidence/F02-T03-{red,green,refactor,formats,metadata,anti-bomb,typecheck,lint,regression}.txt`
- `reports/implementation/F02/F02-T03-developer.md`

**No se tocó:** manifiestos (raíz ni backend), `backend/src/{api,storage,db}/**`, frontend, IaC, `.github/`, `STATE.md`, `docs/sdd/tasks.md`, reportes ajenos. Sin Docker, sin AWS, sin Git/GitHub, sin secretos ni rutas Windows absolutas en artefactos (se usa `<PROJECT_ROOT>`). Las sondas efímeras se hicieron en `temporary/` y se eliminaron; ningún archivo de producto o de `tests/` depende de `temporary/`.

## 2. Resultado frente a `CA-03`

| Requisito | Implementación | Evidencia |
|---|---|---|
| WebP + AVIF + miniatura WebP con bytes reales | `renderWithSharp` decodifica una vez a RAW y codifica tres salidas; miniatura `fit: inside`, `256 px` máx., `withoutEnlargement` | `F02-T03-formats.txt` (4/4); `F02-T03-green.txt`; salidas validadas con `validateImageHeader()` (webp/avif/webp) |
| Strip total de metadatos (EXIF/GPS/XMP/IPTC) | Decodificación intermedia a píxeles crudos; **jamás** se invoca `withMetadata()`; verificación en caliente de las 3 salidas | `F02-T03-metadata.txt` (3/3): fixture con EXIF+GPS, XMP e IPTC → salidas sin `exif`/`xmp`/`iptc` ni marcadores ASCII; control negativo demuestra que `withMetadata({})` sí filtraría |
| `exifStripped: true` verificable | El flag se emite solo tras `assertMetadataStripped()` y el render completo; en rechazos es `false` | `F02-T03-metadata.txt`; `schemas.JobMetrics` y `schemas.ImageRecord` validan los resultados |
| Guarda de tamaño **antes** de escanear (`A-05`) | `preflightImage`: `limitsFromConfig → checkFileSize → scanHeader(validateImageHeader) → checkDimensions` | `F02-T03-anti-bomb.txt` (7/7): con 1 MB+1 y `MAX_FILE_SIZE_MB=1`, los spies de escaneo y render **no se invocan** |
| Límites desde `loadConfig()`, sin literales propios | `limitsFromConfig(options.config)`; `checkFileSize`/`checkDimensions` son reglas puras importadas | Caso con `MAX_FILE_SIZE_MB=2`: el mismo buffer pasa la guarda y sí se escanea → `DIMENSIONS_UNAVAILABLE` |
| Reutilización de reglas puras y contratos congelados | Se importan `checkFileSize`, `checkDimensions`, `limitsFromConfig`, `validateImageHeader`, `computeSavings`, `resolveBatchStatus`, `JobMetrics`, `Preset`; **no se reimplementa ninguna** | `F02-T03-green.txt`; `F02-T03-regression.txt` (193/193) |
| Invocable con buffers, sin `storage/**` ni `api/**` | `processImage(bytes, options)` devuelve `ProcessImageResult` discriminado; rechazos no lanzan hacia el llamador | `backend/src/worker/processImage.ts`; `F02-T03-green.txt` |
| Métricas honestas (0 % y negativo permitidos) | `computeSavings()` con `bytesAfter = webp + avif + miniatura`; sin recorte | Test con render inyectado de salidas mayores → `savingsPct < 0` reportado tal cual y coherente con Zod |

**Nota de decisión técnica (no G-10):** `bytesAfter` es la suma de los tres objetos optimizados (WebP + AVIF + miniatura), es decir, los bytes totales persistidos en `optimized` por imagen. `THUMBNAIL_MAX_EDGE = 256` y las calidades por preset son detalles de implementación; el preset no altera el strip ni los formatos.

## 3. Cronología TDD (RED → GREEN → REFACTOR)

| Fase | Acción y resultado | Evidencia |
|---|---|---|
| **Baseline** | `npm run typecheck` exit 0; árbol de dominio/contratos leído; sonda efímera de `sharp` (0.33.5 / libvips 8.15.3, AVIF vía `format.heif`) | — |
| **RED** | 18 tests con stubs de firmas exactas y valores deliberadamente erróneos. **17 fallos por aserción de comportamiento, 1 acierto** (control de la fixture): 0 `MODULE_NOT_FOUND`, 0 errores de sintaxis. Start `20:50:37`, exit 1 | `F02-T03-red.txt` |
| **GREEN (1er intento)** | Implementación completa: 16/18. Dos fallos por **suposiciones erróneas del test** (no de la lógica): el relleno `0xff` simulaba JPEG sin SOF (`DIMENSIONS_UNAVAILABLE`, no `FORMAT_NOT_ALLOWED`) y `64 B × 3` no superaba el JPEG de entrada | registro en cronología; no se debilitó ninguna expectativa |
| **GREEN (final)** | Corregidas las dos expectativas (sin tocar la implementación): **18/18**, exit 0. Start `20:52:43` | `F02-T03-green.txt` |
| **REFACTOR** | Extraídos `fail()` en `preflight.ts` y `rejected()` en `processImage.ts` (conducta idéntica). **18/18**, exit 0. Start `20:53:26` | `F02-T03-refactor.txt` |
| **Familias focalizadas** | formatos 4/4 · metadata 3/3 · anti-bomba 7/7 | `F02-T03-{formats,metadata,anti-bomb}.txt` |
| **Regresión** | `npx vitest run tests/unit`: 22 archivos, **193/193**, exit 0 | `F02-T03-regression.txt` |
| **Verificación** | `npm run typecheck` exit 0 · `npm run lint` (global) exit 1 por un hallazgo en `tests/unit/frontend/core.test.ts`, propiedad de F03; `npx eslint` sobre mi alcance exit 0 | `F02-T03-{typecheck,lint}.txt` |

## 4. Tabla de comandos y exit codes

Todos ejecutados desde `<PROJECT_ROOT>`; salidas normalizadas a `<PROJECT_ROOT>` (P4/G-6b).

| Comando | Exit | Resultado |
|---|---|---|
| `npx vitest run tests/unit/worker tests/integration/worker` (**RED**) | 1 | 4 archivos fallidos · 17 failed / 1 passed (18) |
| `npx vitest run tests/unit/worker tests/integration/worker` (**GREEN 1er intento**) | 1 | 2 failed / 16 passed |
| `npx vitest run tests/unit/worker tests/integration/worker` (**GREEN final**) | 0 | 4 archivos · 18/18 |
| `npx vitest run tests/unit/worker tests/integration/worker` (**REFACTOR**) | 0 | 4 archivos · 18/18 |
| `npx vitest run tests/unit/worker/processImage.test.ts` | 0 | 4/4 (formatos y métricas) |
| `npx vitest run tests/integration/worker/metadata.test.ts` | 0 | 3/3 (strip EXIF/GPS/XMP/IPTC) |
| `npx vitest run tests/unit/worker/antiBomb.test.ts` | 0 | 7/7 (orden de guardas) |
| `npx vitest run tests/unit` | 0 | 22 archivos · 193/193 |
| `npm run typecheck` | 0 | sin diagnósticos |
| `npx tsc --noEmit … <archivos de worker + tests de worker>` | 0 | sin diagnósticos en el alcance |
| `npm run lint` | 1 | 1 error **ajeno** en `tests/unit/frontend/core.test.ts` (F03) |
| `npx eslint backend/src/worker tests/unit/worker tests/integration/worker --ext .ts` | 0 | sin hallazgos en el alcance |

## 5. Decisión de configuración `sharp` y verificación del strip

1. **No se invoca `withMetadata()`.** Sonda empírica (sharp `0.33.5`): `sharp(fixture).withMetadata({}).webp()` **conserva EXIF (262 B) y XMP (82 B)**. En esta versión `withMetadata()` activa `keepMetadata()`; por tanto la sugerencia literal `.withMetadata({})` de la tarea **no garantiza el strip**: se descarta con evidencia y se documenta aquí.
2. **Strip por reconstrucción desde RAW.** `sharp(bytes).raw().toBuffer({ resolveWithObject: true })` produce solo píxeles; las tres salidas se generan desde ese buffer RAW con `sharp(data, { raw })`. No existe ruta por la que EXIF/GPS/XMP/IPTC puedan llegar a la salida.
3. **Verificación en caliente.** `assertMetadataStripped()` consulta `.metadata()` de cada salida y falla si aparece `exif`, `xmp` o `iptc`. Solo después se certifica `exifStripped: true`.
4. **Fixture significativa.** JPEG 100×100 con EXIF real (incluido IFD GPS, verificado en la sonda) más segmentos APP1 XMP y APP13 IPTC insertados tras el SOI. Un control negativo en el propio test demuestra que `sharp` sí podría conservar esos metadatos; por tanto la limpieza observada es consecuencia de nuestra configuración, no de una fixture inerte.
5. **Formatos comprobados por reglas puras**, no por comparación de magic bytes propia: `validateImageHeader()` acepta los WebP y el AVIF generados y extrae sus dimensiones.

## 6. Problemas registrados (7 campos cada uno)

### `F02-T03-P1` — RED por resolución de módulo en módulos nuevos

1. **Identificación:** `F02-T03-P1`.
2. **Problema:** `backend/src/worker/**` no existía; importar directamente en los tests habría producido `MODULE_NOT_FOUND`, no un RED conductual.
3. **Causa:** **DEMOSTRADA** — inspección inicial del árbol (`backend/src` solo tenía `config`, `contracts`, `domain`, `db`, `api` en curso ajeno).
4. **Solución e intentos fallidos:** cuatro stubs con firmas y tipos exactos y valores deliberadamente erróneos (preflight siempre exitoso, render con salidas vacías, `processImage` siempre `FAILED`), sustituidos por completo en GREEN. Sin intentos fallidos adicionales.
5. **Verificación:** `F02-T03-red.txt`: 17 fallos de aserción (`expected … to be …`), 0 errores de resolución/sintaxis.
6. **Pendientes:** ninguno.
7. **Aprendizaje candidato:** `PROPUESTA_GLOBAL` — en módulos nuevos, el stub conductual es la forma de obtener un RED por comportamiento sin erosionar el criterio metodológico.

### `F02-T03-P2` — Dos expectativas incorrectas en el primer GREEN

1. **Identificación:** `F02-T03-P2`.
2. **Problema:** 16/18 en el primer GREEN: se esperaba `FORMAT_NOT_ALLOWED` para un relleno `0xff` que empieza con SOI JPEG (la regla pura devuelve `DIMENSIONS_UNAVAILABLE` al no hallar SOF) y se asumió que `64 B × 3` superarían un JPEG 100×100 (en realidad ~343 B).
3. **Causa:** **DEMOSTRADA** — mensajes de aserción `expected 'DIMENSIONS_UNAVAILABLE' to be 'FORMAT_NOT_ALLOWED'` y `expected 44.02… to be less than 0`.
4. **Solución e intentos fallidos:** corregir las **expectativas de test** (`DIMENSIONS_UNAVAILABLE`; buffer de 512 B para forzar ahorro negativo), sin relajar la implementación ni eliminar pruebas. No se modificó código productivo.
5. **Verificación:** `F02-T03-green.txt`: 18/18; la aserción de ahorro negativo comprueba el valor exacto y la coherencia Zod.
6. **Pendientes:** ninguno.
7. **Aprendizaje candidato:** `SOLO_LOCAL` — medir el tamaño real de la fixture antes de escribir aserciones sobre signo de métricas; los bytes de una imagen sintética dependen del codificador.

### `F02-T03-P3` — `.withMetadata({})` filtra metadatos en sharp 0.33

1. **Identificación:** `F02-T03-P3`.
2. **Problema:** la configuración sugerida en la tarea (`.withMetadata({})`/equivalente) no garantiza el strip total: conserva EXIF y XMP.
3. **Causa:** **DEMOSTRADA** — sonda empírica: la fixture con EXIF/GPS/XMP produce, tras `.withMetadata({}).webp()`, `exif=262 B` y `xmp=82 B`. En sharp 0.33 `withMetadata()` activa `keepMetadata()` internamente (`node_modules/sharp/lib/output.js`).
4. **Solución e intentos fallidos:** descartar `withMetadata()`; implementar strip por reconstrucción desde datos RAW y verificación explícita de las tres salidas. Intento descartado: el `.withMetadata({})` literal de la tarea, precisamente por la sonda anterior.
5. **Verificación:** `F02-T03-metadata.txt`: control negativo (con `withMetadata({})` hay marcadores) + tres salidas del pipeline sin metadatos; `exifStripped: true`.
6. **Pendientes:** ninguno para esta tarea; se recomienda al Auditor revisar esta decisión por tratarse de riesgo 3.
7. **Aprendizaje candidato:** `PROPUESTA_GLOBAL` — verificar empíricamente el comportamiento de la librería de imágenes antes de fijar una opción de privacidad; la documentación de versiones puede cambiar el significado de `withMetadata`.

### `F02-T03-P4` — Tipado de GPS en la API de `sharp` 0.33

1. **Identificación:** `F02-T03-P4`.
2. **Problema:** `TS2353: 'GPS' does not exist in type 'Exif'` al construir la fixture con etiquetas GPS.
3. **Causa:** **DEMOSTRADA** — `node_modules/sharp/lib/index.d.ts` declara `Exif` solo con `IFD0`…`IFD3`, pero el runtime de libvips acepta la clave `GPS`; sonda: el EXIF resultante contiene el puntero `0x8825` y campos GPS.
4. **Solución e intentos fallidos:** declarar un tipo local `ExifForFixture` (`IFD0` + `GPS?`) asignable a `Exif`, sin `as any` ni casting. Se descartó recurrir a un tag IFD0 con texto GPS por no acreditar un IFD GPS real.
5. **Verificación:** `npm run typecheck` exit 0; la fixture expone `exif` con GPS y marcadores ASCII en `F02-T03-metadata.txt`.
6. **Pendientes:** ninguno.
7. **Aprendizaje candidato:** `SOLO_LOCAL` — las definiciones de tipos pueden ir por detrás del runtime; extensiones estructurales mínimas son preferibles a `any`.

### `F02-T03-P5` — Fallo global de `lint` por trabajo concurrente de F03

1. **Identificación:** `F02-T03-P5`.
2. **Problema:** `npm run lint` terminó con exit 1 por `'Theme' is defined but never used` en `tests/unit/frontend/core.test.ts`.
3. **Causa:** **DEMOSTRADA** — ruta ajena al ámbito de F02-T03 y propiedad de F03 (fase paralela en ejecución); `git status` muestra trabajo concurrente en `frontend/` y `tests/unit/frontend/**`.
4. **Solución e intentos fallidos:** **no se tocó** el archivo ajeno; se ejecutó `npx eslint backend/src/worker tests/unit/worker tests/integration/worker --ext .ts` → exit 0, y se dejó constancia de ambos resultados en `F02-T03-lint.txt`. Sin intentos de "arreglo" fuera de alcance.
5. **Verificación:** `EXIT_GLOBAL=1` (único hallazgo, F03) y `EXIT_SCOPE=0` (F02-T03 limpio).
6. **Pendientes:** el propietario de F03 debe resolver su hallazgo antes del cierre de fase; el Tester debe contrastar con su propia ejecución.
7. **Aprendizaje candidato:** `PROPUESTA_GLOBAL` — en fases paralelas, acompañar cada comando global con una ejecución acotada al ámbito propio para no atribuir fallos ajenos.

### `F02-T03-P6` — Diagnósticos transitorios de `typecheck` durante la ejecución concurrente

1. **Identificación:** `F02-T03-P6`.
2. **Problema:** a las `20:54`, `npm run typecheck` mostró errores en `backend/src/api/**`, `backend/src/db/**`, `tests/unit/api/**` y `tests/unit/frontend/**` (props. de T01/F03).
3. **Causa:** **DEMOSTRADA** — archivos en escritura por otros harnesses en el mismo árbol de trabajo; ningún diagnóstico señalaba `worker/**`.
4. **Solución e intentos fallidos:** no se modificaron archivos ajenos; se re-ejecutó el comando tras la estabilización de esos propietarios → exit 0. Además se ejecutó una compilación aislada del alcance → exit 0.
5. **Verificación:** `F02-T03-typecheck.txt`: `EXIT_GLOBAL=0`, `EXIT_SCOPE=0`.
6. **Pendientes:** ninguno.
7. **Aprendizaje candidato:** `SOLO_LOCAL` — registrar la hora de cada captura cuando el árbol es compartido; un diagnóstico transitorio no debe interpretarse como regresión propia.

## 7. Estado final y handoff

- **Estado:** `DONE` (Loop 1/3). Implementación completa, TDD íntegro, 18/18 pruebas del worker, 193/193 suite unitaria, typecheck global en verde, lint limpio en el alcance.
- **Sin dictamen propio:** no se emite `PASSED`, no se cierra `F02-T03`, no se actualizan `STATE.md` ni `tasks.md`.
- **Para el Tester:** contrastar CA-03 contra `F02-T03-{formats,metadata,anti-bomb}.txt`; ejecutar `npx vitest run tests/unit/worker tests/integration/worker` y `npm run typecheck`; verificar que el único fallo global de `lint` pertenece a F03.
- **Para el Auditor (riesgo 3):** revisar P3 (decisión `withMetadata`) y P5/P6 (concurrencia), además del orden A-05 con spies y del control negativo de la fixture.
- **Sin Docker, sin AWS, sin secretos, Sin G-9/G-10, sin push.** No se usó el emulador: el worker es una función pura sobre buffers y la integración S3/SQS queda para T04/T06.
