# Auditoría `F01-T05` — Reglas puras: privacidad, anti-bomba, ahorro y estados

| Campo | Valor |
|---|---|
| **Auditoría / tarea / fase** | `F01-T05` · Fase 1 · `P-01-critical-foundations.md` |
| **Rol** | `Auditor` (riesgo 3, según `F01-T05-task.md` y `P-01` §4/§5 `CA-05`) |
| **Fecha / loop** | `2026-11-17` · `Loop 1/3` |
| **Encargo** | Calidad y seguridad de reglas puras: rechazo fail-closed de SVG/GIF animado/no-raster (PR-01/IN-10/PR-06); límites desde `loadConfig()` (D-08); ahorro honesto (PR-12); máquina de estados (IN-08); sustantividad de la cobertura y trazabilidad TDD; clasificación de P3 y mención de P5 |
| **Conclusión** | **`READY_WITH_CONCERNS`** |
| **Cobertura** | **`SUFFICIENT`** para el alcance asignado (inspección estática de código, tests y evidencia) · **`LIMITED`** para ejecución funcional (competencia del Tester) e historial Git (prohibido por el encargo) |
| **Hallazgos** | 5 (1 `MEDIUM` formatos, 1 `MEDIUM` reproducibilidad, 2 `LOW`, 1 `INFO`) · **0 CRITICAL / 0 HIGH** · **0 bloqueantes de auditoría**; 1 condición de gobernanza (A-01) y 1 acción de reproducibilidad (A-03) antes del cierre formal |

> Frontera respetada: no se implementó código, no se emitió dictamen funcional de verificación (competencia del Tester), no se reejecutó la suite funcional, no se usaron Git/GitHub, Docker ni AWS, y **no se aceptó riesgo en nombre de Lino (G-10)**. No se escriben secretos ni rutas Windows absolutas; se usa el marcador `<PROJECT_ROOT>`. Registro append-only.

---

## 1. Hallazgos (7 campos obligatorios)

### Problema `A-01` — Aceptación de AVIF animado (`avis` / `.avifs` / `image/avif-sequence`) sin respaldo en el SDD (PR-06 / IN-10 / D-11)

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID: `A-01` · Tarea: `F01-T05` · Fase: `P-01` · Loop: `1/3` · Fecha: `2026-11-17` · Entorno: inspección estática, Node/TypeScript, sin AWS |
| **2. Problema** | **Síntoma:** `backend/src/domain/imageHeader.ts` acepta la marca `ftyp/avis` (l. 133), la extensión `avifs` (l. 52) y el MIME `image/avif-sequence` (l. 60) como `avif` raster válido, con test explícito que celebra ese comportamiento (`tests/unit/domain/imageHeader.test.ts` l. 46–60). **Esperado:** PR-06 prohíbe escribir lo no acordado; `spec.md` FR-07/FR-11 solo autoriza WebP/AVIF como formatos de *salida* y exige rechazo de "formatos peligrosos"; `reports/intake/intake-mediashrink.md` D-11 acuerda "rechazo de SVG/GIF animados/formatos peligrosos"; `constitution.md` IN-10 dice "rechazo de SVG y **animados**". **Observado:** en ninguna fuente aprobada aparece el formato AVIF *animado* (secuencia AVIF/AVIS) ni sus tres aliases. **Impacto:** decisión de producto/privacidad no escrita que amplía la lista de magic bytes/MIME/extensiones más allá de lo aprobado y contradice la lectura genérica de IN-10 ("animados"); además introduce un formatos con múltiples fotogramas que el pipeline de F02 tratamiento como imagen estática. No se ha demostrado una ruta que filtre metadatos: la extracción de dimensiones y el saneamiento posterior siguen aplicando. **Reproducción:** comparar `imageHeader.ts` ll. 52/60/133 y `imageHeader.test.ts` l. 46 contra `spec.md` FR-07/FR-11, `plan.md` §4, `intake-mediashrink.md` D-11 e `IN-10`; búsqueda sin coincidencias de `avis|avif-sequence|avifs` en `docs/sdd/**`, `reports/intake/**` y `backend/src/contracts/**`. |
| **3. Causa** | **Estado:** `DEMOSTRADA` para la ausencia documental y la presencia en código; **`HIPÓTESIS`** para la intención (probable soporte de secuencias AVIF del equipo de implementación). **Evidencia:** cinco fuentes citadas · **Alternativas descartadas:** que provenga del contrato congelado (el catálogo solo fija `OUTPUT_FORMAT_VALUES = ['webp','avif']`, sin aliases de secuencia), de la configuración (no hay clave de formatos en `ALL_ENV_KEYS`) o del intake (D-01…D-16 no mencionan AVIF animado). |
| **4. Solución** | **Cambios aplicados:** ninguno (el Auditor no implementa). **Motivo técnico:** no es un defecto de código detectable por tests, sino una decisión de alcance/privacidad; corregirla supone decidir si se eliminan los tres aliases o si se aprueban por escrito. **Intentos fallidos relevantes:** N/A. **Disposición propuesta:** que **CTO/Lino se pronuncie (NEEDS_CONTEXT)** — (a) eliminar `avis`, `avifs` y `image/avif-sequence` y su test, o (b) aprobarlos y registrarlo en SDD/ADR como decisión de producto antes del cierre de `F01-T05`. **No se concede G-10.** |
| **5. Verificación** | **Verificador independiente:** `Auditor` · **Comando/procedimiento:** lectura y contraste de código, tests y fuentes aprobadas; sin ejecución de `vitest` · **Resultado y evidencia:** aliases presentes en `backend/src/domain/imageHeader.ts` y firmados por test; ausentes en SDD/intake/catalog · **Regresión comprobada:** N/A (hallazgo documental) · **Límites:** no se evalúa si AVIS es técnicamente deseable, solo si está acordado; tampoco se afirma una filtración de metadatos (el saneamiento es responsabilidad de F02). |
| **6. Pendientes** | **Riesgo residual:** ampliación de superficie de formatos sin acta; ambigüedad entre "GIF animados" (D-11) y "animados" (IN-10) · **Cobertura ausente:** decisión escrita y, si se aprueba, criterio de aceptación en `CA-05` · **Responsable y siguiente paso:** CTO/Lino — decidir; Architect — registrar la decisión y, si procede, devolver al Developer con control de cambios. |
| **7. Aprendizaje** | **Prevención propuesta:** antes de añadir cualquier magic byte, MIME o extensión, verificar que aparece literalmente en el SDD aprobado o en un acta de decisión; tratar "animados" como lista cerrada, no como categoría interpretable · **Ámbito candidato:** `PROPUESTA_GLOBAL` · **Estado:** `PENDIENTE_DE_EVALUAR`. |

**Severidad:** `MEDIUM` · **Confianza:** `HIGH` en el hecho (código/test vs. fuentes) · `MEDIUM` en la calificación de IN-10 por ambigüedad documental · **Evidencia:** `CORROBORATED` (documental directa) · **Bloqueante de auditoría:** `NO` (sí condición de gobernanza antes del cierre formal).

---

### Problema `A-02` — Conducta `avis` introducida en GREEN sin prueba RED previa (trazabilidad TDD)

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID: `A-02` · Tarea: `F01-T05` · Fase: `P-01` · Loop: `1/3` · Fecha: `2026-11-17` · Entorno: evidencia `evidence/F01-T05-*.txt` |
| **2. Problema** | **Síntoma:** el RED (`F01-T05-red.txt`) registra **14** pruebas en `imageHeader.test.ts` (13 fallidas + 1 acertada; en total 40 fallos / 6 aciertos sobre 46); GREEN/cobertura registran **15**. El único test añadido es `acepta la marca avis de secuencia AVIF y rechaza otras marcas ftyp`. **Esperado:** `METHODOLOGY.md` §3 y `NFR-04` exigen RED por comportamiento antes del cambio productivo. **Observado:** la rama `brand === 'avis'` y sus aliases no tuvieron RED; el test se escribió después para cubrir la rama añadida. **Impacto:** la cobertura 100 % de `imageHeader.ts` incluye una rama no nacida de RED; la afirmación "RED por familia" del reporte Developer queda matizada para esta familia. La lógica sí está probada y las aserciones son sustantivas. **Reproducción:** contar los `it` de `imageHeader.test.ts` en `red.txt` (ll. 63–90) vs. el archivo actual (15 `it`) y comparar nombres. |
| **3. Causa** | **Estado:** `DEMOSTRADA` · **Evidencia:** `evidence/F01-T05-red.txt`, `evidence/F01-T05-green.txt`, `evidence/F01-T05-coverage.txt`, `tests/unit/domain/imageHeader.test.ts` · **Alternativas descartadas:** que el test faltante sea otro (los otros 14 nombres coinciden uno a uno) o que el RED incluyera 15 pruebas con una no listada (el total 46 y el desglose 40+6 cierran con 14 en esa familia). |
| **4. Solución** | **Cambios aplicados:** ninguno. **Motivo técnico:** la corrección adecuada es documental si se decide conservar el formato (A-01), o eliminar rama+test si se decide retirarlo; en ambos casos con addendum append-only. **Intentos fallidos relevantes:** N/A. **Disposición propuesta:** que el Developer registre en addendum cuándo se añadió la rama y el test, y que cualquier ampliación futura de formatos arranque con RED. |
| **5. Verificación** | **Verificador independiente:** `Auditor` · **Comando/procedimiento:** conteo y cotejo nominal de pruebas entre evidencias y archivo fuente · **Resultado y evidencia:** delta 14→15 localizado en el test `avis` · **Regresión comprobada:** no aplica (no se reejecutó la suite) · **Límites:** no se reconstruyó el historial de edición (Git prohibido); la inferencia es de evidencia comparada, no de cronología de commits. |
| **6. Pendientes** | **Riesgo residual:** trazabilidad TDD incompleta para una rama · **Cobertura ausente:** RED de la rama `avis` · **Responsable y siguiente paso:** Developer — addendum de trazabilidad; Architect — verificar junto con la decisión de A-01. |
| **7. Aprendizaje** | **Prevención propuesta:** toda rama nueva de detección debe tener su prueba RED antes de escribir el código, aunque se descubra durante GREEN · **Ámbito candidato:** `PROPUESTA_GLOBAL` · **Estado:** `PENDIENTE_DE_EVALUAR`. |

**Severidad:** `LOW` · **Confianza:** `HIGH` · **Evidencia:** `CORROBORATED` · **Bloqueante de auditoría:** `NO`.

---

### Problema `A-03` — P3: `@vitest/coverage-v8` instalado con `--no-save`; `CA-05` no reproducible en CI limpio

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID: `A-03` (heredado de `F01-T05-P3`) · Tarea: `F01-T05` · Fase: `P-01` · Loop: `1/3` · Fecha: `2026-11-17` · Entorno: npm / Vitest 2.1.9 |
| **2. Problema** | **Síntoma:** el proveedor de cobertura se instaló con `npm install --no-save --package-lock=false @vitest/coverage-v8@2.1.9`; no figura en `backend/package.json` ni en `package-lock.json`. **Esperado:** `CA-05` exige 100 % de cobertura "verificable con `--coverage`" y `NFR-07` exige trazabilidad reproducible. **Observado:** en un checkout limpio con `npm ci`, `--coverage` no puede ejecutarse; la evidencia `F01-T05-coverage.txt` depende de un estado local no versionado. **Impacto:** deuda de reproducibilidad en CI, no de corrección de la lógica: la cobertura 100 % de `backend/src/domain/**` está acreditada en la sesión, pero un verificador limpio no puede regenerarla. **Reproducción:** comparar comando de la tabla §4 del reporte Developer con las dependencias declaradas en el manifiesto backend y el lockfile. |
| **3. Causa** | **Estado:** `DEMOSTRADA` · **Evidencia:** `F01-T05-developer.md` §4 y §7 P3 · **Alternativas descartadas:** que el paquete sea transitivo de `vitest` (la comprobación inicial `require.resolve` devolvió `NO coverage-v8`), o que el Developer debiera escribir el manifiesto (está fuera de su ámbito exclusivo y P5 documenta propietario concurrente). |
| **4. Solución** | **Cambios aplicados:** ninguno por el Auditor. **Motivo técnico:** resolverlo requiere editar un manifiesto ajeno a este encargo. **Intentos fallidos relevantes:** N/A. **Disposición propuesta:** que la tarea propietaria de `backend/package.json` declare `@vitest/coverage-v8@2.1.9` como `devDependency` con entrada íntegra en `package-lock.json`, y que CI ejecute el comando con filtro `--coverage.include='backend/src/domain/**' --coverage.all` para reproducir el 100 %. **No se acepta el riesgo en nombre de Lino; no se concede G-10.** |
| **5. Verificación** | **Verificador independiente:** `Auditor` · **Comando/procedimiento:** lectura del reporte, del comando de instalación y del bloque de cobertura `F01-T05-coverage.txt` · **Resultado y evidencia:** cobertura 100 % en 4 métricas para los 6 archivos del módulo; proveedor ausente del manifiesto · **Regresión comprobada:** no procede (no se reejecutó CI) · **Límites:** no se verificó el contenido actual de `backend/package.json` por estar en modificación concurrente (P5); se toma por válida la declaración del Developer, contrastada con el hecho de que la cobertura se generó. |
| **6. Pendientes** | **Riesgo residual:** `CA-05` no reproducible en CI limpio mientras no se declare la dependencia · **Cobertura ausente:** verified en entorno virgen · **Responsable y siguiente paso:** Architect — asignar la declaración al propietario de `backend/package.json`; CTO — decidir si se registra como deuda formal antes de `F05`/`G-12`. |
| **7. Aprendizaje** | **Prevención propuesta:** toda herramienta necesaria para ejecutar un criterio de aceptación debe estar en el manifiesto y el lockfile antes de cerrar la tarea; `--no-save` solo para experimentos · **Ámbito candidato:** `PROPUESTA_GLOBAL` · **Estado:** `PENDIENTE_DE_EVALUAR`. |

**Severidad:** `MEDIUM` · **Confianza:** `HIGH` · **Evidencia:** `CORROBORATED` (reporte + evidencia de cobertura) · **Bloqueante de auditoría:** `NO` para la corrección de la lógica; **sí acción requerida** para dar por reproducible `CA-05` en CI.

---

### Problema `A-04` — P5: manifiestos con cambios concurrentes (observación de alcance, ajena a T05)

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID: `A-04` (heredado de `F01-T05-P5`) · Tarea: `F01-T05` · Fase: `P-01` · Loop: `1/3` · Fecha: `2026-11-17` · Entorno: workspace paralelo |
| **2. Problema** | **Síntoma:** `F01-T05-developer.md` §7 P5 registra hashes distintos al cierre para `package-lock.json` y `backend/package.json`, atribuidos a `F01-T02` / roles superiores. **Esperado:** propiedad exclusiva de archivos según `P-01` §3 y `F01-T05-task.md` §3. **Observado:** el Developer verificó que justo tras su instalación `--no-save` los hashes seguían siendo los iniciales y no escribió esos archivos. **Impacto:** ninguno sobre las reglas puras; riesgo de atribución si no se documenta. **Reproducción:** comparar hashes de P5 con `git status` de solo lectura citado en el reporte. |
| **3. Causa** | **Estado:** `DEMOSTRADA` para la discrepancia de hashes; `HIPÓTESIS` razonable para el origen concurrente · **Evidencia:** `F01-T05-developer.md` §7 P5 y §4/§6 · **Alternativas descartadas:** escritura por T05 (negada por el propio registro de hashes y por el ámbito). |
| **4. Solución** | **Cambios aplicados:** ninguno; asunto ajeno a esta auditoría y a T05. **Motivo técnico:** se menciona solo para que el Architect confirme la procedencia. **Intentos fallidos relevantes:** N/A. **Disposición propuesta:** que Architect confirme que los cambios provienen de `F01-T02` y cierre la observación en el reporte de cierre de fase. |
| **5. Verificación** | **Verificador independiente:** `Auditor` · **Comando/procedimiento:** lectura del registro P5 · **Resultado y evidencia:** conducta del Developer correcta (verificación de hashes, sin revertir trabajo ajeno) · **Regresión comprobada:** N/A · **Límites:** no se usó Git (prohibido), por lo que no se contrasta el historial real. |
| **6. Pendientes** | **Riesgo residual:** ninguno para T05 · **Cobertura ausente:** confirmación de origen · **Responsable y siguiente paso:** Architect (fuera de esta auditoría). |
| **7. Aprendizaje** | **Prevención propuesta:** registrar hashes de manifiestos al inicio y al final en trabajo paralelo · **Ámbito candidato:** `PROPUESTA_GLOBAL` · **Estado:** `PENDIENTE_DE_EVALUAR`. |

**Severidad:** `INFO` · **Confianza:** `HIGH` (hecho registrado) · **Evidencia:** `INDICATIVE` (no se pudo contrastar con Git) · **Bloqueante de auditoría:** `NO`.

---

### Problema `A-05` — El rechazo por tamaño no está compuesto dentro de la API pura; `isAnimatedGif` escanea el buffer completo

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID: `A-05` · Tarea: `F01-T05` (handoff a F02) · Fase: `P-01` · Loop: `1/3` · Fecha: `2026-11-17` · Entorno: inspección estática |
| **2. Problema** | **Síntoma:** `checkFileSize()` y `validateImageHeader()`/`assertValidImageHeader()` son funciones independientes; ninguna garantiza por sí sola que el tamaño se rechace *antes* de cualquier procesamiento. Además, `isAnimatedGif()` (`imageHeader.ts` l. 115–117) ejecuta `Buffer.from(bytes).toString('latin1').includes('NETSCAPE2.0')` sobre todo el buffer. **Esperado:** el encargo pide "rechazo antes de cualquier procesamiento" (task.md §4c, IN-10, D-08). **Observado:** dentro de T05 no hay I/O ni pipeline, y la composición `config → anti-bomba` sí se demuestra en `tests/unit/domain/index.test.ts`; pero el orden real lo decidirá el worker de F02, fuera de este ámbito. **Impacto:** si F02 invoca la validación de cabecera antes del control de tamaño, un archivo hostil muy grande se convertiría por completo a cadena antes de ser rechazado; es un riesgo de anti-bomba por ordenación, no de omisión de la regla. **Reproducción:** leer `antiBomb.ts` ll. 47–56, `imageHeader.ts` ll. 115–117 y `index.ts` (solo re-exports); confrontar con `plan.md` §4 "Tamaño … rechazo antes de presignar". |
| **3. Causa** | **Estado:** `DEMOSTRADA` para la separación de API y el escaneo completo; `HIPÓTESIS` para el orden que finalmente adopte F02 · **Evidencia:** fuentes citadas · **Alternativas descartadas:** que la anti-bomba esté hardcoded o sea contradictoria (no: V-4); que la detección de GIF sea fail-open (no: V-1). |
| **4. Solución** | **Cambios aplicados:** ninguno. **Motivo técnico:** F02 es el propietario del pipeline. **Intentos fallidos relevantes:** N/A. **Disposición propuesta:** que F02 aplique `limitsFromConfig(loadConfig()) → checkFileSize() → validateImageHeader() → checkDimensions()` en ese orden, o que el dominio ofrezca una guarda compuesta; y que la detección de GIF se limite a una ventana acotada si el buffer puede ser grande. |
| **5. Verificación** | **Verificador independiente:** `Auditor` · **Comando/procedimiento:** inspección estática del módulo `backend/src/domain/**` · **Resultado y evidencia:** reglas correctas pero orden no impuesto por la API · **Regresión comprobada:** N/A · **Límites:** no se evaluó código de F02 (no existe en esta fase). |
| **6. Pendientes** | **Riesgo residual:** dependiente del diseño de F02 · **Cobertura ausente:** prueba de orden en el worker · **Responsable y siguiente paso:** Developer de F02 — respetar el orden; Architect — incluirlo en el contrato de esa tarea. |
| **7. Aprendizaje** | **Prevención propuesta:** hacer explícito el orden de las guardas en la frontera del pipeline, o exponer una única función compuesta que lo garantice · **Ámbito candidato:** `PROPUESTA_GLOBAL` · **Estado:** `PENDIENTE_DE_EVALUAR`. |

**Severidad:** `LOW` · **Confianza:** `HIGH` (código) / `MEDIUM` (impacto real dependerá de F02) · **Evidencia:** `CORROBORATED` para el código, `INDICATIVE` para el efecto · **Bloqueante de auditoría:** `NO`.

---

## 2. Verificaciones sin hallazgo (evidencia de cobertura)

| # | Verificación | Resultado | Clasificación |
|---|---|---|---|
| V-1 | Rechazo fail-closed de `SVG` (con declaración XML y con BOM), GIF animado (`NETSCAPE2.0`), GIF estático, ZIP, `RIFF/JUNK`, texto y entrada vacía. | `detectFormat()` devuelve `rejected` con motivo específico en todos los casos; `validateImageHeader` propaga el rechazo **antes** de mirar MIME/extensión (test de propagación). Sin ruta que acepte SVG o GIF. | `REPRODUCED` (estático) |
| V-2 | Coherencia magic byte ↔ MIME ↔ extensión y polimorfismo. | `MIME_FORMAT` y `EXTENSION_FORMAT` son tablas cerradas; normalización de mayúsculas y parámetros (`IMAGE/WEBP; charset=binary`); rechazo de `foto.jpg`, `foto.svg`, `foto.gif`, `foto.txt`, sin extensión y con punto final sobre bytes PNG. `MIME_MISMATCH`/`EXTENSION_MISMATCH` son sustantivos, no mocks. | `REPRODUCED` (estático) |
| V-3 | Fail-closed de dimensiones en las cinco variantes. | `pngDimensions`/`jpegDimensions`/`webpDimensions` (VP8X, VP8, VP8L)/`avifDimensions` devuelven `null` si la cabecera está truncada; `validateImageHeader` rechaza con `DIMENSIONS_UNAVAILABLE` o `INVALID_DIMENSIONS` (0/negativo/no entero) usando `isPositiveSafeInt`. | `REPRODUCED` (estático) |
| V-4 | Límites anti-bomba desde `loadConfig()` (D-08). | `limitsFromConfig()` proyecta `config.limits.maxFileSizeMb`/`maxPixels`; sin números de límite embebidos en `backend/src/domain/**` (`BYTES_PER_MB` es solo unidad). Defaults de `config/index.ts` (15 MB / 25.000.000 px) coinciden con `.env.example`; test con `MAX_FILE_SIZE_MB=7`, `MAX_PIXELS=4000000` y con bomba `5000×5000` / 10 MB demuestra que no hay constantes contradictorias. | `REPRODUCED` (estático + evidencia) |
| V-5 | Ahorro honesto (PR-12 / FR-12). | `computeSavings` guarda enteros seguros no negativos, calcula `bytesSaved = before − after` sin recorte; 0 % y −20 % se reportan tal cual; `savingsPct` conserva precisión (33,3333); división por cero controlada (`before === 0 → 0`). Coherente con la refinación `savings-coherence` del contrato congelado (`zod-schemas.ts` l. 121: `expected = before === 0 ? 0 : …`, tolerancia 0,01). | `CORROBORATED` |
| V-6 | Máquina de estados (IN-08) y terminales. | `ALLOWED_TRANSITIONS` es exhaustiva sobre los 5 estados: `PENDING → {PROCESSING, FAILED}`, `PROCESSING → {COMPLETED, PARTIAL, FAILED}`, terminales sin salida; `PARTIAL` exige `completed > 0 && failed > 0`; `COMPLETED` rechaza `failed > 0`; `FAILED` rechaza `completed > 0`; resumen vacío cierra en `FAILED` (P2 del Developer); `nextStatus` lanza `DomainError`. Test recorre los 3 terminales contra los 5 destinos. | `REPRODUCED` (estático) |
| V-7 | Sustantividad de la cobertura 100 %. | `F01-T05-coverage.txt` y `F01-T05-refactor.txt` acreditan 100 % en sentencias/ramas/funciones/líneas para los 6 archivos de `backend/src/domain/**` con `47/47`. No hay `vi.fn`, `vi.mock`, `vi.spyOn`, `as any` en `tests/unit/domain/**` ni directivas `/* istanbul ignore */` o `v8 ignore` en el módulo. El REFACTOR unificó `hasAscii`/`hasHex` sin tocar expectativas; P4 del Developer **añadió** el caso `[0,500]` en lugar de relajar una aserción. `index.ts` es solo re-export, pero su 100 % no se contabiliza como lógica de producto. | `REPRODUCED` |
| V-8 | Cronología RED → GREEN → REFACTOR. | `red.txt`: 40 fallos de aserción, 0 errores de resolución, start `18:14:17`, exit 1; `green.txt`: 47/47, exit 0; `refactor.txt`: 47/47 + 100 %, exit 0. Matización: una prueba se añadió tras el RED (A-02). | `CORROBORATED` |
| V-9 | G-3 (secretos y rutas). | Solo marcadores `REPLACE_WITH_LOCAL_DEV_SECRET`, cuenta dummy `000000000000` y endpoint de emulador; sin patrones de credencial real; líneas `RUN` normalizadas a `<PROJECT_ROOT>` en las seis evidencias. | `REPRODUCED` |
| V-10 | Límites de ámbito y secretos en el propio reporte Developer. | No se escribieron `backend/package.json`, `package-lock.json`, manifiesto raíz, `.env.example`, `STATE.md`, `tasks.md`, `backend/src/{contracts,db,auth,config}/**` ni `frontend/**`; sin Docker/AWS/Git de escritura. Afirmación de contenido, no de historial (Git prohibido). | `CORROBORATED` |

---

## 3. Conclusión y disposición

**`READY_WITH_CONCERNS`.** No hay hallazgos `CRITICAL`/`HIGH` ni bloqueantes de auditoría. El núcleo de `CA-05` está demostrado por inspección directa: el rechazo de SVG, GIF (animado y estático) y no-raster es fail-closed y precede a cualquier verificación de MIME/extensión; no hay ruta en el dominio que permita metadatos o formatos peligrosos; los límites anti-bomba se proyectan de `loadConfig()` sin valores contradictorios; el 0 % y el ahorro negativo se reportan sin recorte y con bytes enteros; la máquina de estados es exhaustiva, exigente con `PARTIAL` y cerrada en terminales. La cobertura 100 % proviene de aserciones sustantivas, sin mocks ni directivas de exclusión, y el REFACTOR no debilitó expectativas.

**Concerns para Architect / CTO:**

1. **`A-01` (MEDIUM) — condición de gobernanza.** Requiere pronunciamiento expreso de CTO/Lino sobre `avis`/`.avifs`/`image/avif-sequence` (PR-06, IN-10, D-11) antes del cierre formal de `F01-T05`: retirar los tres aliases o aprobarlos por escrito. El Auditor **no acepta este riesgo en nombre de Lino**; sin G-10.
2. **`A-03` (MEDIUM) — acción de reproducibilidad.** Declarar `@vitest/coverage-v8@2.1.9` en el manifiesto propio y el lockfile para que `CA-05` sea reproducible con `npm ci` en CI. Clasificado como deuda de reproducibilidad, **no aceptado** por este rol.
3. **`A-02` (LOW).** Addendum de trazabilidad sobre el test `avis` añadido tras el RED; toda rama nueva debe nacer de una prueba RED.
4. **`A-05` (LOW).** Trasladar a `F02` la obligación de comprobar tamaño antes de cualquier procesamiento de cabecera y acotar el escaneo de GIF.
5. **`A-04` (INFO).** Confirmar que los cambios concurrentes de manifiestos provienen de `F01-T02`; ajeno a T05.

**Cobertura y límites:** `SUFFICIENT` para el alcance asignado (calidad y seguridad de reglas puras por inspección estática de código, tests y evidencia); `LIMITED` para la ejecución funcional (competencia del Tester, no repetida) y para el historial Git (prohibido por el encargo). No se ejecutaron `vitest`, `typecheck` ni `lint` propios, no se usaron Docker/AWS/Git y no se emitió dictamen funcional de verificación. Las verificaciones V-1…V-10 son de inspección y cotejo de evidencia existente, sin modificar archivos del proyecto.

**Registro:** append-only. Addenda futuras se agregan aquí sin borrar estos hallazgos.

---

## Addendum A — Decisión de CTO/Lino sobre `A-01` y disposición final (2026-11-17)

> Append-only: este addendum cierra `A-01` y actualiza la conclusión **sin modificar** los hallazgos `A-01`…`A-05` ni las verificaciones `V-1`…`V-10`. No se implementó código, no se reejecutó la suite funcional, no se usaron Git/Docker/AWS, no se emitió dictamen funcional de verificación y **no se aceptó riesgo en nombre de Lino (G-10)**. Sin secretos ni rutas Windows absolutas; se usa el marcador `<PROJECT_ROOT>`.

| Campo | Detalle |
|---|---|
| **Decisión de producto** | CTO/Lino aprueba por escrito los aliases de AVIF animado (`avis`, `.avifs`, `image/avif-sequence`) como decisión de producto, **sin cambios de código**. Quedan así dentro del conjunto de formatos admitidos por `backend/src/domain/imageHeader.ts`. |
| **`A-01`** | **CERRADO** por decisión expresa de CTO/Lino de `2026-11-17`. **No es aceptación de riesgo: no es G-10.** PR-06 queda satisfecho. |
| **`A-02` (LOW)** | Se mantiene el addendum de trazabilidad TDD sobre la rama `avis` (test incorporado tras el RED). **No bloquea.** |
| **`A-03` (MEDIUM)** | `@vitest/coverage-v8` será declarado por el propietario del manifiesto backend (`F01-T02`). Mientras tanto **sigue como deuda de reproducibilidad, no aceptada** por este rol. |
| **`A-04` (INFO) / `A-05` (LOW)** | Seguimientos sin cambios: procedencia de manifiestos concurrentes (`A-04`) y orden de las guardas en `F02` (`A-05`). |
| **Conclusión final** | **`READY_WITH_CONCERNS`** — **sin bloqueantes de auditoría para cerrar `F01-T05`**. |

**Registro de los cinco puntos del follow-up:**

1. **`A-01` — CERRADO.** La decisión de CTO/Lino de `2026-11-17` aprueba los tres aliases como decisión de producto escrita, sin cambios de código. No constituye aceptación de riesgo: **no se concede G-10**, y PR-06 queda satisfecho al existir acta de aprobación para la ampliación de la lista de magic bytes/MIME/extensiones. El hallazgo original se conserva arriba por trazabilidad; su disposición queda resuelta aquí.
2. **`A-02` (LOW) — trazabilidad TDD.** Se mantiene el registro sobre la rama `avis` y su test añadido tras el RED, ahora como addendum de trazabilidad del Developer. **No bloquea** el cierre de `F01-T05`; toda rama futura debe nacer de una prueba RED.
3. **`A-03` (MEDIUM) — reproducibilidad.** La declaración de `@vitest/coverage-v8@2.1.9` se asigna al propietario del manifiesto backend (`F01-T02`). Hasta que se ejecute, la cobertura 100 % de `backend/src/domain/**` sigue siendo **deuda de reproducibilidad en CI limpio**, y **no está aceptada** por el Auditor ni por Lino. Sin G-10.
4. **`A-04` (INFO) y `A-05` (LOW) — sin cambios.** `A-04` continúa como confirmación de procedencia de manifiestos concurrentes, ajena a T05. `A-05` continúa como handoff a `F02` para imponer el orden `checkFileSize() → validateImageHeader() → checkDimensions()` y acotar el escaneo de GIF. Ninguno bloquea.
5. **Conclusión final actualizada.** **`READY_WITH_CONCERNS`** — **sin bloqueantes de auditoría para cerrar `F01-T05`**. El núcleo de `CA-05` permanece demostrado (rechazo fail-closed, límites desde `loadConfig()`, ahorro honesto, máquina de estados exhaustiva y cobertura sustantiva 100 %). No se emite dictamen funcional de verificación: corresponde al Tester. No se ha aceptado riesgo en nombre de Lino.

**Registro:** append-only. Este addendum no invalida los hallazgos ni las verificaciones previos; cualquier seguimiento posterior se agregará como addendum nuevo.
