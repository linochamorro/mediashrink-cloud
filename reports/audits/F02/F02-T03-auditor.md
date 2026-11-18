# Auditoría `F02-T03` — Worker `sharp`: privacidad, anti-bomba, ahorro y formatos

| Campo | Valor |
|---|---|
| **Auditoría / tarea / fase** | `F02-T03` · Fase 2 · `docs/sdd/packages/P-02-api-and-worker.md` (`CA-03`) |
| **Rol / riesgo** | `Auditor` · Riesgo `3 (Sensible)` — privacidad EXIF/GPS y procesamiento |
| **Fecha / loop** | `2026-11-17` · `Loop 1/3` |
| **Encargo** | Privacidad (PR-01/IN-10): decisión `withMetadata` y rutas de salida; guarda anti-bomba A-05; ahorro honesto (PR-12); formatos (IN-01/A-04/PR-06); reutilización y ámbito; clasificación del fallo global de `lint` (F03) |
| **Fuentes** | `AGENTS.md`; `STATE.md`; `.agents/roles/auditor.md`; `<LAB_ROOT>/docs/METHODOLOGY.md` §4/§7 y `<LAB_ROOT>/docs/templates/problema-solucion.md` (7 campos, entregados en el encargo); `P-02` §5 `CA-03`; `spec.md` FR-11/FR-12; `constitution.md` PR-01/PR-06/PR-12/IN-01/IN-10/IN-12; `F01-architect.md` §3 (`A-05`); `F01-T05-auditor.md` (`A-05`); `F02-T03-{task,developer}.md`; `backend/src/worker/**`; `tests/{unit,integration}/worker/**`; `backend/src/domain/**`; `backend/src/config/index.ts`; `node_modules/sharp/lib/output.js`; evidencia `F02-T03-*.txt` |
| **Conclusión** | **`READY_WITH_CONCERNS`** |
| **Cobertura** | **`SUFFICIENT`** para el alcance asignado (inspección estática de código, tests, dependencia y evidencia) · **`LIMITED`** para ejecución funcional (competencia del Tester) e historial Git (prohibido por el encargo) |
| **Hallazgos** | 5 (2 `LOW`, 3 `INFO`) · **0 `CRITICAL` / 0 `HIGH`** · **0 bloqueantes de auditoría** |

> **Frontera respetada:** no implementé código, no emití `PASSED`/`NO-PASSED`, no repetí la suite del Tester, no usé Git/GitHub, Docker ni AWS, y **no acepté riesgo en nombre de Lino (G-10)**. No escribo secretos ni rutas Windows absolutas nuevas en el cuerpo del reporte: se usan los marcadores `<PROJECT_ROOT>` y `<LAB_ROOT>` para las fuentes externas al proyecto. Registro **append-only**.

---

## 1. Hallazgos (7 campos obligatorios)

### Problema `A-01` — `exifStripped: true` se certifica con verificación real solo en el renderizador por defecto

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID: `A-01` · Tarea: `F02-T03` · Fase: `P-02` · Loop: `1/3` · Fecha: `2026-11-17` · Entorno: inspección estática, Node/TypeScript/`sharp 0.33`, sin AWS |
| **2. Problema** | **Síntoma:** `processImage()` fija `exifStripped: true` (l. 106) después de que resuelva `(options.hooks?.render ?? renderWithSharp)` (l. 87); la comprobación en caliente `assertMetadataStripped()` vive **dentro** de `renderWithSharp` (`render.ts` ll. 40–47, 73), no en `processImage`. Un renderizador inyectado que devuelva bytes con metadatos haría que el flag se certificara sin verificación. **Esperado:** PR-01/FR-12 exigen que `exifStripped: true` se emita solo tras verificación real de las tres salidas. **Observado:** en producción no se inyecta `hooks` y siempre se usa `renderWithSharp`, que sí verifica; en pruebas se inyectan renderers falsos (`Buffer.from('w')`, etc.) y el flag se emite sin comprobación. **Impacto:** debilidad latente de diseño, **no fuga demostrada**: la ruta de producto queda protegida, pero el invariante no está ligado al resultado del renderizador, sino a qué renderizador se elija. **Reproducción:** leer `processImage.ts` ll. 86–107 y `render.ts` ll. 40–47/73; comparar con los hooks de `antiBomb.test.ts` ll. 22–27 y `processImage.test.ts` ll. 74–78. |
| **3. Causa** | **Estado:** `DEMOSTRADA` para el acoplamiento; `HIPÓTESIS` para un mal uso futuro. **Evidencia:** código citado + declaración `WorkerHooks.render` (`processImage.ts` l. 24, "inyectable en pruebas"). **Alternativas descartadas:** que el flag se fije antes del render (no: se fija después); que la verificación falle en silencio (no: `assertMetadataStripped` lanza y `processImage` captura → `RENDER_FAILED` con `exifStripped: false`, ll. 92–95). |
| **4. Solución** | **Cambios aplicados:** ninguno (el Auditor no implementa). **Motivo técnico:** mover/duplicar `assertMetadataStripped` a `processImage` después del render, o exigir al contrato `ImageRenderer` la garantía de verificación, haría que el flag dependa siempre del resultado, no del proveedor. **Intentos fallidos relevantes:** N/A. **Disposición propuesta:** recomendación al Developer/Architect; **no se concede G-10**. |
| **5. Verificación** | **Verificador independiente:** `Auditor` · **Comando/procedimiento:** inspección estática de `processImage.ts`, `render.ts` y tests con hooks; sin reejecutar `vitest` · **Resultado y evidencia:** acoplamiento confirmado por código; ninguna ruta de producto inyecta hooks (`F02-T03-developer.md` §1/§7 confirma uso de hooks solo en pruebas) · **Regresión comprobada:** N/A (no se reejecutó la suite) · **Límites:** no se auditan consumidores futuros de T04/T06, fuera de este encargo. |
| **6. Pendientes** | **Riesgo residual:** certificación dependiente del renderizador si se reutiliza el hook fuera de pruebas · **Cobertura ausente:** prueba donde un render inyectado con metadatos intentara certificar `exifStripped` · **Responsable y siguiente paso:** Developer/Architect de F02 — endurecer el flag o documentar el hook como estrictamente de prueba. |
| **7. Aprendizaje** | **Prevención propuesta:** los flags de privacidad se emiten tras verificar el resultado, nunca en el punto donde se invoca una dependencia inyectable · **Ámbito candidato:** `PROPUESTA_GLOBAL` · **Estado:** `PENDIENTE_DE_EVALUAR`. |

**Severidad:** `LOW` · **Confianza:** `HIGH` (código) / `MEDIUM` (explotabilidad actual) · **Evidencia:** `CORROBORATED` · **Bloqueante de auditoría:** `NO`.

---

### Problema `A-02` — El barrel público exporta `renderWithSharp`, que decodifica sin guardas previas

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID: `A-02` · Tarea: `F02-T03` · Fase: `P-02` · Loop: `1/3` · Fecha: `2026-11-17` · Entorno: inspección estática |
| **2. Problema** | **Síntoma:** `backend/src/worker/index.ts` reexporta `./render`, haciendo público `renderWithSharp`, que ejecuta `sharp(bytes).raw().toBuffer()` (`render.ts` l. 51) sin invocar `preflightImage`. El orden A-05 se garantiza **dentro de `processImage`** (ll. 76–91), no en el renderizador. **Esperado:** "confirma que `checkFileSize` precede a `validateImageHeader` y a `sharp.decode` ... evalúa si queda alguna ruta que decodifique antes de validar". **Observado:** dentro de `processImage` no hay tal ruta; fuera de él, un consumidor que importe `renderWithSharp` directamente desde el barrel sí decodificaría antes de validar. **Impacto:** superficie de API que permite eludir la anti-bomba; depende de que T04/T06 usen `processImage`. No hay evidencia de que lo hagan mal hoy. **Reproducción:** leer `index.ts` ll. 1–4, `render.ts` l. 51 y `processImage.ts` ll. 75–91. |
| **3. Causa** | **Estado:** `DEMOSTRADA` para la exposición; `HIPÓTESIS` para un consumidor indebido. **Evidencia:** archivos citados. **Alternativas descartadas:** que `renderWithSharp` llame a preflight (no: solo recibe `bytes/format/preset`); que el barrel solo exporte `processImage` (no: exporta los tres módulos). |
| **4. Solución** | **Cambios aplicados:** ninguno. **Motivo técnico:** el renderizador es una pieza pura y necesita formatos ya validados; exponerlo invita a saltarse el pipeline. **Intentos fallidos relevantes:** N/A. **Disposición propuesta:** que T04/T06 consuman exclusivamente `processImage` y que Architect valore ocultar `renderWithSharp` del barrel público o documentar su contrato "post-preflight". **No se concede G-10.** |
| **5. Verificación** | **Verificador independiente:** `Auditor` · **Comando/procedimiento:** lectura del barrel y del pipeline; cotejo con los spies de `antiBomb.test.ts` ll. 39–71, que demuestran que, vía `processImage`, ni el escaneo ni el render se invocan si la guarda de tamaño falla · **Resultado y evidencia:** ruta alternativa confirmada solo por inspección · **Regresión comprobada:** N/A · **Límites:** no se inspecciona `backend/src/{api,storage}/**` ni T04 (fuera de alcance). |
| **6. Pendientes** | **Riesgo residual:** orden A-05 dependiente del punto de entrada usado · **Cobertura ausente:** consumo real del worker en T04/T06 · **Responsable y siguiente paso:** Architect — verificar el cableado en T04; Developer — acotar la exportación si procede. |
| **7. Aprendizaje** | **Prevención propuesta:** exponer solo la función compuesta que impone el orden de guardas; las piezas internas no deben ser importables desde la puerta pública · **Ámbito candidato:** `PROPUESTA_GLOBAL` · **Estado:** `PENDIENTE_DE_EVALUAR`. |

**Severidad:** `LOW` · **Confianza:** `HIGH` · **Evidencia:** `CORROBORATED` (código) / `INDICATIVE` (mal uso hipotético) · **Bloqueante de auditoría:** `NO`.

---

### Problema `A-03` — Verificación de metadatos en producción usa solo `sharp.metadata()`; el marcador byte-level queda en tests

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID: `A-03` · Tarea: `F02-T03` · Fase: `P-02` · Loop: `1/3` · Fecha: `2026-11-17` · Entorno: inspección estática |
| **2. Problema** | **Síntoma:** `assertMetadataStripped()` (`render.ts` ll. 40–47) comprueba `metadata.exif/xmp/iptc` de cada salida; la búsqueda de marcadores ASCII `hasMetadataMarker()` existe solo en `tests/unit/worker/fixtures.ts` ll. 109–113 y se usa en `metadata.test.ts`. **Esperado:** defensa en profundidad también en la ruta de producto. **Observado:** la reconstrucción desde RAW (`render.ts` ll. 51–57) elimina los metadatos **por construcción**, por lo que la comprobación en caliente es un seguro adicional, no la única barrera. **Impacto:** ninguna fuga demostrada; si `sharp.metadata()` no expusiera un tipo exótico de metadato, la verificación no lo detectaría, pero la salida seguiría sin carrying metadatos porque se genera desde píxeles. **Reproducción:** comparar `render.ts` ll. 40–47 con `metadata.test.ts` ll. 20–26 y `fixtures.ts` ll. 109–113. |
| **3. Causa** | **Estado:** `DEMOSTRADA` para la diferencia de mecanismos; `DESCONOCIDA`/no demostrada para cualquier filtración. **Evidencia:** código citado. **Alternativas descartadas:** que la salida copie metadatos del input (no existe `withMetadata`/`keepMetadata`/`toBuffer` con opciones en `backend/src/worker/**`, salvo mención en comentarios de `render.ts` l. 5). |
| **4. Solución** | **Cambios aplicados:** ninguno. **Motivo técnico:** añadir la comprobación byte-level en producción reforzaria la defensa sin coste relevante. **Intentos fallidos relevantes:** N/A. **Disposición propuesta:** recomendación opcional al Developer; **no se concede G-10**. |
| **5. Verificación** | **Verificador independiente:** `Auditor` · **Comando/procedimiento:** inspección de `render.ts`, `metadata.test.ts` y `fixtures.ts` · **Resultado y evidencia:** mecanismo de producción confirmado; `F02-T03-metadata.txt` acredita 3/3 pruebas de integración con `exifStripped: true` · **Regresión comprobada:** N/A · **Límites:** no se ejecutaron las pruebas. |
| **6. Pendientes** | **Riesgo residual:** informativo; dependencia de la superficie `metadata()` para el seguro adicional · **Cobertura ausente:** ninguna para la barrera principal (RAW) · **Responsable y siguiente paso:** Developer — valorar defensa en profundidad; sin acción obligatoria. |
| **7. Aprendizaje** | **Prevención propuesta:** mantener la comprobación byte-level también en el camino de producto cuando la privacidad es requisito crítico · **Ámbito candidato:** `SOLO_LOCAL` · **Estado:** `PENDIENTE_DE_EVALUAR`. |

**Severidad:** `INFO` · **Confianza:** `HIGH` · **Evidencia:** `CORROBORATED` · **Bloqueante de auditoría:** `NO`.

---

### Problema `A-04` — Escaneo de buffer completo en `isAnimatedGif` (heredado de `F01-T05` A-05), mitigado solo dentro de este worker

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID: `A-04` (heredado `F01-T05-A-05`) · Tarea: `F02-T03` · Fase: `P-02` · Loop: `1/3` · Fecha: `2026-11-17` · Entorno: inspección estática |
| **2. Problema** | **Síntoma:** `backend/src/domain/imageHeader.ts` ll. 115–117 convierte todo el buffer a `latin1` para buscar `NETSCAPE2.0` dentro de `validateImageHeader`. **Esperado:** A-05 pedía "acotar el escaneo de GIF" además del orden de guardas. **Observado:** en `preflightImage` (`preflight.ts` ll. 67–77) `checkFileSize` se ejecuta antes que `validateImageHeader`, de modo que un archivo sobredimensionado se rechaza antes de ese escaneo; pero una llamada directa a `validateImageHeader` desde otro módulo seguiría escaneando el buffer completo. **Impacto:** la parte de "orden" de A-05 queda cerrada en T03; la parte de "ventana de escaneo" no se modificó y compete a la regla pura de F01 (fuera del ámbito de escritura de T03). **Reproducción:** leer `imageHeader.ts` ll. 115–117 y `preflight.ts` ll. 65–77; contrastar con `F01-T05-auditor.md` A-05. |
| **3. Causa** | **Estado:** `DEMOSTRADA` para la ventana y para el orden; el riesgo residual depende de llamadas fuera de `processImage`. **Evidencia:** fuentes citadas. **Alternativas descartadas:** que el escaneo ocurra antes del control de tamaño en el worker (no: `antiBomb.test.ts` ll. 39–54 demuestra con spies que `scanHeader` no se invoca). |
| **4. Solución** | **Cambios aplicados:** ninguno. **Motivo técnico:** `backend/src/domain/**` es propiedad de F01, no reescribible en T03 ("sin redefinir reglas de F01"). **Intentos fallidos relevantes:** N/A. **Disposición propuesta:** que Architect registre A-05 como **parcialmente cerrado** (orden sí, ventana no) y lo derive al propietario de `domain/**` si lo considera necesario. **No se concede G-10.** |
| **5. Verificación** | **Verificador independiente:** `Auditor` · **Comando/procedimiento:** inspección estática y cotejo con `F01-T05-auditor.md` A-05 y `F02-T03-anti-bomb.txt` (7/7) · **Resultado y evidencia:** orden correcto en el worker; ventana sin acotar en la regla pura · **Regresión comprobada:** N/A · **Límites:** no se inspeccionan otros consumidores de `validateImageHeader`. |
| **6. Pendientes** | **Riesgo residual:** INFO; acotación de la ventana de GIF fuera de T03 · **Cobertura ausente:** llamada directa a `validateImageHeader` con buffer mayor que `MAX_FILE_SIZE_MB` fuera del worker · **Responsable y siguiente paso:** Architect — decidir si se deriva al propietario de `domain/**`. |
| **7. Aprendizaje** | **Prevención propuesta:** al heredarse un follow-up con dos partes, registrar explícitamente cuál se cierra y cuál queda pendiente · **Ámbito candidato:** `SOLO_LOCAL` · **Estado:** `PENDIENTE_DE_EVALUAR`. |

**Severidad:** `INFO` · **Confianza:** `HIGH` · **Evidencia:** `CORROBORATED` · **Bloqueante de auditoría:** `NO`.

---

### Problema `A-05` — Fallo global de `lint` por trabajo concurrente de F03 (clasificado como ajeno)

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID: `A-05` (heredado `F02-T03-P5`) · Tarea: `F02-T03` · Fase: `P-02` · Loop: `1/3` · Fecha: `2026-11-17` · Entorno: `npm run lint` (Vitest/ESLint en workspace paralelo) |
| **2. Problema** | **Síntoma:** `npm run lint` global terminó en exit 1 por `'Theme' is defined but never used` en `tests/unit/frontend/core.test.ts` l. 6. **Esperado:** gate limpio para el cierre de fase. **Observado:** `F02-T03-lint.txt` registra `EXIT_GLOBAL=1` y `EXIT_SCOPE=0` para `npx eslint backend/src/worker tests/unit/worker tests/integration/worker --ext .ts`; la ruta con el hallazgo pertenece a `tests/unit/frontend/**`, fuera del ámbito exclusivo de `P-02` (`P-02` §3 asigna a F03 el frontend; sus pruebas propias son `tests/unit/{api,worker}/**` e `tests/integration/{api,worker}/**`). **Impacto:** ninguno sobre la privacidad, anti-bomba, ahorro o formatos de T03; el gate global de lint queda roto por otra fase en ejecución. **Reproducción:** leer `F02-T03-lint.txt` ll. 1–21 y `P-02` §3. |
| **3. Causa** | **Estado:** `DEMOSTRADA` para la procedencia del hallazgo; `CORROBORATED` para la titularidad por el contrato de ámbitos. **Evidencia:** evidencia de lint + `P-02` §3 + `STATE.md` §1 (F02/F03 paralelas). **Alternativas descartadas:** que el hallazgo señale `backend/src/worker/**` o `tests/{unit,integration}/worker/**` (no: salida aislada limpia). |
| **4. Solución** | **Cambios aplicados:** ninguno; **clasificado como ajeno a F02-T03, no aceptado como riesgo de F02**. **Motivo técnico:** el Developer no tocó el archivo de F03 y acompañó el comando global con una ejecución acotada. **Intentos fallidos relevantes:** N/A. **Disposición propuesta:** que el propietario de F03 resuelva su hallazgo antes del cierre de fase y que Architect/Tester contrasten con su propia ejecución. **No se concede G-10.** |
| **5. Verificación** | **Verificador independiente:** `Auditor` · **Comando/procedimiento:** lectura de `F02-T03-lint.txt` y del contrato de ámbitos; sin reejecutar `lint` · **Resultado y evidencia:** único hallazgo global ajeno; alcance T03 limpio · **Regresión comprobada:** N/A · **Límites:** no se verificó el estado actual del archivo de F03 (propiedad ajena). |
| **6. Pendientes** | **Riesgo residual:** ninguno para F02-T03; gate global de fase pendiente de F03 · **Cobertura ausente:** resolución del hallazgo de F03 · **Responsable y siguiente paso:** F03/Architect — cerrar antes del `F02/F03-architect.md`. |
| **7. Aprendizaje** | **Prevención propuesta:** en fases paralelas, todo comando global debe ir acompañado de una ejecución acotada al ámbito propio para no atribuir fallos ajenos · **Ámbito candidato:** `PROPUESTA_GLOBAL` · **Estado:** `PENDIENTE_DE_EVALUAR`. |

**Severidad:** `INFO` (ajena) · **Confianza:** `HIGH` · **Evidencia:** `CORROBORATED` · **Bloqueante de auditoría:** `NO` para `F02-T03`.

---

## 2. Verificaciones sin hallazgo (evidencia de cobertura)

| # | Verificación | Resultado | Clasificación |
|---|---|---|---|
| **V-1** | **Decisión `withMetadata` correcta y corroborada por la dependencia.** `node_modules/sharp/lib/output.js` ll. 359–361: `withMetadata(options)` llama a `keepMetadata()`; l. 331 fija `keepMetadata = 0b11111` (conserva EXIF/XMP/IPTC); `withExif` también activa bits (l. 182). Por tanto el `.withMetadata({})` literal sugerido en la tarea **habría filtrado** metadatos; el Developer lo descartó con evidencia (P3 del reporte) sin necesitar G-10. En `backend/src/worker/**` **no hay** `withMetadata`, `keepMetadata`, `withExif` ni `toBuffer` con opciones de metadata: la única mención es un comentario en `render.ts` l. 5. | `CORROBORATED` (código de la dependencia + greps) |
| **V-2** | **Strip por reconstrucción desde RAW.** `render.ts` l. 51 decodifica una vez a píxeles (`sharp(bytes).raw().toBuffer({ resolveWithObject: true })`); las tres salidas se generan desde `sharp(decoded.data, { raw })` (l. 57) con `.webp()`, `.avif()` y `.resize().webp()`; ninguna añade metadata. No existe ruta de copia del input a la salida. | `REPRODUCED` (estático) |
| **V-3** | **Verificación real antes del flag.** `assertMetadataStripped()` consulta `.metadata()` de **las tres** salidas (webp/avif/miniatura) y lanza si aparece `exif`, `xmp` o `iptc`; `processImage` captura el fallo y devuelve `RENDER_FAILED` con `exifStripped: false` (ll. 92–95). GPS queda cubierto porque reside dentro de EXIF. | `CORROBORATED` |
| **V-4** | **Control negativo concluyente.** `metadata.test.ts` l. 29–37 verifica que la fixture tiene EXIF (con IFD GPS), XMP e IPTC (`assertFixtureHasMetadata`) y que `sharp(fixture).withMetadata({}).webp()` **sí conserva** los marcadores (`hasMetadataMarker(leaking) === true`); los tests ll. 39–57 y 59–78 exigen las tres salidas limpias también para PNG con EXIF. La limpieza observada es consecuencia de la configuración, no de una fixture inerte. | `CORROBORATED` (código + `F02-T03-metadata.txt` 3/3) |
| **V-5** | **Orden A-05 y límites desde config.** `preflightImage` aplica `limitsFromConfig(config)` → `checkFileSize` → `validateImageHeader`/`scanHeader` → `checkDimensions` (`preflight.ts` ll. 65–82); `processImage` lo invoca antes del render (ll. 75–91). `limitsFromConfig` proyecta `config.limits.maxFileSizeMb/maxPixels` (`antiBomb.ts` ll. 35–40), que provienen de `loadConfig()` (`config/index.ts` ll. 293–297). No hay literales de límite en `backend/src/worker/**`. Los spies de `antiBomb.test.ts` ll. 39–71 prueban que ni `scanHeader` ni `render` se invocan si el tamaño excede el límite, y que el límite es el de config (MAX_FILE_SIZE_MB=1 vs 2). | `REPRODUCED` (estático + evidencia 7/7) |
| **V-6** | **Ahorro honesto (PR-12).** `processImage` calcula `bytesBefore = bytes.byteLength` y `bytesAfter = webp + avif + miniatura` (ll. 97–100) y delega en la regla pura `computeSavings` (`savings.ts` ll. 28–40), sin recorte: 0 % y negativos se reportan tal cual. `processImage.test.ts` ll. 52–90 verifica el valor exacto, el caso negativo y la coherencia con `schemas.JobMetrics` congelado. | `CORROBORATED` |
| **V-7** | **Formatos y PR-06.** `render.ts` produce exactamente WebP, AVIF y miniatura WebP (`fit: inside`, `withoutEnlargement`, tope 256 px), sin formatos nuevos; `PRESET_QUALITY` y `THUMBNAIL_MAX_EDGE` son detalles de implementación, no decisiones de producto. `processImage.test.ts` ll. 36–49 y `pipeline.test.ts` ll. 30–41 validan las tres salidas con la regla pura `validateImageHeader`, sin comparaciones propias de magic bytes. A-04 (miniatura WebP) respetado; IN-12 (polling) no compete al worker. | `REPRODUCED` |
| **V-8** | **Reutilización y alcance.** El worker importa `checkFileSize`, `checkDimensions`, `limitsFromConfig`, `validateImageHeader`, `computeSavings`, `resolveBatchStatus`, `JobMetrics` y `Preset` de `backend/src/{domain,contracts,config}/**` y no reimplementa ninguna regla (lectura de los 4 archivos de `backend/src/worker/**`). Según `F02-T03-developer.md` §1 no se escribieron manifiestos, `backend/src/{api,storage,db}/**`, frontend, IaC, `STATE.md` ni `tasks.md`; sin Docker/AWS/Git/push. | `CORROBORATED` para el contenido de código y el reporte; **`LIMITED`** para el historial real (Git prohibido) |
| **V-9** | **Trazabilidad TDD y secretos.** `F02-T03-{red,green,refactor,formats,metadata,anti-bomb,typecheck,regression}.txt` existen y registran 17 fallos conductuales en RED, 18/18 en GREEN/REFACTOR, 4/4 formatos, 3/3 metadata, 7/7 anti-bomba y 193/193 regresión; las líneas `RUN` están normalizadas a `<PROJECT_ROOT>` y los valores de config son marcadores locales (`REPLACE_WITH_LOCAL_DEV_SECRET`, `000000000000`, endpoint del emulador). | `CORROBORATED` (cotejo de evidencia, sin reejecución) |

---

## 3. Conclusión y disposición

**`READY_WITH_CONCERNS` — 0 `CRITICAL`, 0 `HIGH`, 0 bloqueantes de auditoría.**

El núcleo de `CA-03` queda demostrado por inspección directa:

- **Privacidad (PR-01/IN-10):** el hallazgo del Developer sobre `withMetadata({})` es **correcto y está corroborado por el propio código de `sharp 0.33`**: esa opción activa `keepMetadata()` y conservaría EXIF/XMP. La decisión de decodificar a RAW y recodificar elimina metadatos **por construcción** en las tres salidas; no hay llamadas a `withMetadata`/`keepMetadata`, ni opciones de metadata en `toBuffer`, ni copia del input. El control negativo es concluyente: la fixture tiene EXIF+GPS/XMP/IPTC "vivos" y se demuestra que `withMetadata({})` los retiene, mientras el pipeline los elimina. `exifStripped: true` se emite solo tras la verificación en caliente de las tres salidas, y cualquier fallo de esa verificación degrada a `RENDER_FAILED`/`false`.
- **Anti-bomba (A-05/IN-10):** en `processImage` el orden `checkFileSize → validateImageHeader → checkDimensions → sharp.decode` es estricto y los límites vienen de `loadConfig()`; ninguna ruta de la función de producto decodifica antes de validar.
- **Ahorro (PR-12) y formatos (IN-01/A-04/PR-06):** bytes reales de las tres salidas, 0 %/negativos sin recorte, WebP+AVIF+miniatura WebP validados con reglas puras de F01, sin formatos inventados ni redefinición de reglas.

**Concerns (ninguno bloqueante; ninguno aceptado como riesgo):**

1. `A-01` (`LOW`): el flag `exifStripped` depende del renderizador por defecto; si se usan hooks fuera de pruebas, la certificación quedaría sin verificación. Recomendación: ligar el flag al resultado de la comprobación.
2. `A-02` (`LOW`): `renderWithSharp` se exporta desde el barrel público y decodifica sin guardas; el orden A-05 solo se impone en `processImage`. Recomendación: verificar que T04/T06 usen `processImage` y acotar la exportación.
3. `A-03` (`INFO`): verificación byte-level de marcadores solo en tests; defensa en profundidad opcional en producción (sin fuga demostrada).
4. `A-04` (`INFO`): A-05 queda **parcialmente cerrado**: el orden sí, la ventana de escaneo de GIF en `domain/**` no (fuera del ámbito de T03).
5. `A-05` (`INFO`, ajena): el `lint` global está en rojo por `tests/unit/frontend/core.test.ts` (F03). **Clasificado como ajeno; no se acepta como riesgo de F02.** El alcance de T03 está limpio (`EXIT_SCOPE=0`).

**Cobertura y límites:** `SUFFICIENT` para la revisión de riesgos de privacidad, anti-bomba, ahorro, formatos y ámbito mediante inspección estática de código, tests, dependencia y evidencia; `LIMITED` para ejecución funcional (competencia exclusiva del Tester, no repetida) y para historial Git (prohibido). No se ejecutaron `vitest`, `typecheck` ni `lint` propios; no se usaron Docker/AWS/Git; no se emitió dictamen funcional de verificación; **no se concedió G-10**. V-1…V-9 son verificaciones de inspección y cotejo de evidencia existente, sin modificar archivos de producto.

**Registro:** append-only. Los addenda futuros se agregarán aquí sin borrar estos hallazgos ni las verificaciones.
