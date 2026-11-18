# Dictamen Tester — `F02-T03`

| Campo | Valor |
|---|---|
| **Tarea** | `F02-T03` — Worker `sharp` (WebP + AVIF + miniatura, privacidad) |
| **Fase / paquete / criterio** | Fase 2 — `P-02` — **`CA-03`** |
| **Rol / Loop** | Tester independiente / `v1 — Loop 1/3` (no se activan loops) |
| **Harness / fecha** | OpenCode · `2026-11-17` · verificación propia `~21:00–21:03` |
| **Riesgo** | `3 (Sensible)` — privacidad EXIF/GPS y procesamiento |
| **Dictamen global** | **`PASSED`** |
| **Reporte del implementador** | `F02-T03-developer.md` (`DONE`, sin dictamen propio) |

---

## 1. Fuentes leídas y método

Leídas íntegramente: `.agents/roles/tester.md`, `AGENTS.md`, `STATE.md`, `docs/sdd/packages/P-02-api-and-worker.md` (§5 `CA-03`), `docs/sdd/spec.md` (FR-11/FR-12, NFR-05), `docs/sdd/plan.md` §4, `docs/sdd/constitution.md` (PR-01, IN-01, IN-10, IN-12), `reports/verification/F01-architect.md` (`A-05`), `F02-T03-task.md`, `F02-T03-developer.md`, `backend/src/worker/**`, `tests/unit/worker/**`, `tests/integration/worker/**`, `backend/src/domain/**`, `backend/src/contracts/index.ts` y la evidencia del Developer (`F02-T03-{red,green,refactor,formats,metadata,anti-bomb,typecheck,lint,regression}.txt`).

**Ejecución propia**, no presentada ajena como mía: reejecuté la suite del worker, las tres familias focalizadas, la regresión unitaria, `typecheck`, lint global y acotado, más dos sondas efímeras de privacidad sobre las fixtures del repo (en `temporary/`, eliminadas). La cronología RED→GREEN→REFACTOR se **revisó como registro cronológico**, sin reejecutar ni invertir código.

---

## 2. Ejecución propia y evidencia

| Verificación (comando) | Resultado observado | Evidencia propia |
|---|---|---|
| `npx vitest run tests/unit/worker tests/integration/worker` | 4 archivos, **18/18**, exit 0 | `F02-T03-tester-worker.txt` |
| `npx vitest run tests/unit/worker/processImage.test.ts` | **4/4**, exit 0 | `F02-T03-tester-formats.txt` |
| `npx vitest run tests/integration/worker/metadata.test.ts` | **3/3**, exit 0 | `F02-T03-tester-metadata.txt` |
| `npx vitest run tests/unit/worker/antiBomb.test.ts` | **7/7**, exit 0 | `F02-T03-tester-anti-bomb.txt` |
| Contraste de privacidad (sonda propia sobre fixtures) | ver §3 | `F02-T03-tester-privacy-probe.txt` |
| `npx vitest run tests/unit` | 22 archivos, **194/194**, exit 0 | `F02-T03-tester-unit.txt` |
| `npm run typecheck` | exit 0, sin diagnósticos | `F02-T03-tester-typecheck.txt` |
| `npm run lint` / `npx eslint <alcance>` | global exit **1** (3 hallazgos, todos F03) / acotado exit **0** | `F02-T03-tester-lint.txt` |
| Ámbito y confinamiento | conforme | `F02-T03-tester-scope.txt` |

**Ausencia de `skip/only/todo`:** búsqueda en `tests/**/*worker*` sin coincidencias. El worker tiene exactamente 18 tests (4 formatos/métricas + 7 anti-bomba + 3 metadata + 4 pipeline), acordes con el 18/18 observado.

---

## 3. Contraste de privacidad (comprobaciones propias)

Sonda independiente (`npx tsx`, sondas eliminadas después) sobre `createJpegWithMetadata()` del repo, más inspección de código:

- **Fixture significativa:** JPEG 100×100 con `exif=262 B`, `xmp=82 B`, `iptc=40 B` y marcadores ASCII `GPS-TEST`, `XMP-TEST`, `IPTC-TEST`, `PRIVATE-EXIF`.
- **Control negativo:** `sharp(fixture).withMetadata({}).webp()` conserva `exif=262 B`, `xmp=82 B` y marcadores ASCII → la fixture **sí podría filtrar**; la limpieza observada es consecuencia del pipeline, no de una fixture inerte.
- **Salidas del pipeline** (`processImage`): `webp`, `avif` y `thumbnail` con `exif=0`, `xmp=0`, `iptc=0` y `asciiMarkers=false` en las tres. **Ningún `exif`/`xmp`/`iptc` ni marcador ASCII de la fixture**. `exifStripped=true` y el renderizador directo `renderWithSharp` produce las tres salidas igualmente limpias.
- **Sin `withMetadata()`:** `grep` sobre `backend/src/worker/**` → única coincidencia es un **comentario** en `render.ts`; **ninguna invocación**. El pipeline decodifica a RAW (`sharp(bytes).raw().toBuffer({resolveWithObject:true})`) y recodifica desde esos píxeles; no hay ruta de metadatos de entrada a salida. `assertMetadataStripped()` consulta `.metadata()` de las tres salidas y solo entonces `processImage` emite `exifStripped: true` (en rechazos, `false`).
- **Métricas:** `bytesAfter=532` coincide con la suma real de las tres salidas (`match=true`); el test de ahorro negativo confirma que 0 % y negativos se reportan sin recorte.

**Observación no bloqueante (INFO, para el Auditor de riesgo 3):** el volcado hex del bloque EXIF de la fixture muestra el TIFF `II*` con `ImageDescription` ASCII `GPS-TEST-LAT-40.4168-LON-3.7038` y `Copyright`, además de XMP/IPTC, pero **no contiene el puntero de IFD GPS `0x8825`** que el reporte del Developer afirma en su `P4` (sharp 0.33 no declara la clave `GPS` en su tipo `Exif` y aparentemente no la escribe). Esto **no afecta a CA-03**: el pipeline elimina **todo** el EXIF (verificado `exif=0` en salida), luego cualquier dato GPS —como IFD o como ASCII— queda eliminado, y el control negativo sigue demostrando que el strip es real. Se recomienda al Auditor corregir la redacción de `P4` si lo considera oportuno; no es un incumplimiento del criterio.

---

## 4. Guardas (A-05) y reutilización

- **Orden de guardas (anti-bomb 7/7, spies):** con un buffer de `1 MB+1` y `MAX_FILE_SIZE_MB=1`, `processImage` devuelve `FILE_TOO_LARGE`, `exifStripped=false`, y los spies de `scanHeader` y `render` **no se invocan**. Al subir el límite a `MAX_FILE_SIZE_MB=2`, **sí se invoca** `scanHeader` (la rellena simula JPEG sin SOF → `DIMENSIONS_UNAVAILABLE`). Con `MAX_PIXELS=100`, `TOO_MANY_PIXELS` y `render` no se invoca; con límite suficiente, el render se invoca 1 vez. SVG, GIF animado y MIME/extensión incoherente se rechazan sin decodificar.
- **Límites desde configuración:** `preflightImage` usa `limitsFromConfig(config)` → `checkFileSize` → `scanHeader` (`validateImageHeader`) → `checkDimensions`; no hay literales propios de tamaño/píxeles en el worker. El test con `MAX_FILE_SIZE_MB=2` demuestra que el valor de `loadConfig()` gobierna la guarda.
- **Reutilización (inspección de fuentes):** `backend/src/worker/**` importa `checkFileSize`, `checkDimensions`, `limitsFromConfig`, `validateImageHeader`, `computeSavings` y `resolveBatchStatus` desde `backend/src/domain/index.ts`, y `JobMetrics`/`Preset` desde `backend/src/contracts/index.ts`. **No se reimplementa ninguna regla ni máquina de estados**; el worker compone y devuelve resultados tipados. `THUMBNAIL_MAX_EDGE=256` y las calidades por preset son detalles de implementación documentados, sin decidir formatos ni strip.

---

## 5. Cronología TDD (revisada como registro)

`RED` `20:50:37` → **17 fallos por aserción de comportamiento + 1 acierto** (0 `MODULE_NOT_FOUND`, 0 `SyntaxError`); `GREEN` `20:52:43` → **18/18**; `REFACTOR` `20:53:26` → **18/18** (extracción de `fail()`/`rejected()`, conducta idéntica). No se reejecutó ni se invirtió código; se acepta como registro cronológico íntegro del implementador, contrastado con la evidencia `F02-T03-{red,green,refactor}.txt`.

---

## 6. Dictamen por criterio

| # | Criterio (`CA-03` / fuente) | Resultado | Evidencia propia | Veredicto |
|---|---|---|---|---|
| 1 | WebP + AVIF + miniatura WebP con bytes reales, validados por `validateImageHeader` (IN-01, FR-11) | 4/4 formatos; cabeceras `webp`, `avif`, `webp`; miniatura ≤256 px | `tester-formats.txt`, `tester-worker.txt` | **PASSED** |
| 2 | Strip total EXIF/GPS/XMP/IPTC; `exifStripped: true` solo tras verificación en caliente (PR-01, IN-10, FR-11/12) | 3/3 metadata + sonda: salidas `exif/xmp/iptc=0`, sin marcadores; control negativo filtra; sin `withMetadata()` invocado | `tester-metadata.txt`, `tester-privacy-probe.txt` | **PASSED** |
| 3 | Guarda de tamaño **antes** de escanear/decodificar (`A-05`), límites de `loadConfig()` (IN-10) | 7/7 anti-bomba; spies no invocados con límite bajo; sí invocados al subirlo | `tester-anti-bomb.txt` | **PASSED** |
| 4 | Reutilización de reglas puras y contratos congelados, sin redefinirlas | Importaciones confirmadas por inspección de fuentes | código `backend/src/worker/**` + `domain/**` | **PASSED** |
| 5 | `bytesAfter` = suma real de 3 salidas; 0 % y negativos sin recorte (FR-12) | `match=true`; test de ahorro negativo y coherencia Zod | `tester-privacy-probe.txt`, `tester-formats.txt` | **PASSED** |
| 6 | Regresión unitaria y typecheck | 194/194, exit 0; typecheck exit 0 | `tester-unit.txt`, `tester-typecheck.txt` | **PASSED** |
| 7 | Gates de calidad del alcance | lint acotado exit 0; global exit 1 **ajeno a F02-T03** (F03) | `tester-lint.txt` | **PASSED** |
| 8 | Ámbito, confinamiento y cronología TDD | rutas propias únicamente; sondas eliminadas; RED→GREEN→REFACTOR íntegro | `tester-scope.txt`, registro RED/GREEN/REFACTOR | **PASSED** |

### Veredicto global: **`PASSED`**

`CA-03` se cumple íntegramente con evidencia de ejecución propia: formatos, strip total de metadatos con `exifStripped` verificable, guarda `A-05` antes de escanear, límites de configuración, reutilización de reglas puras y métricas honestas. No hay hallazgos bloqueantes CRITICAL/HIGH ni revisiones obligatorias de Auditor pendientes que impidan el dictamen (la auditoría de riesgo 3 es paso siguiente del Architect).

**Interferencia externa no bloqueante (registrada, no corregida por mí):**
- La regresión unitaria observada es **194/194**, frente a **193/193** del reporte del Developer: el harness paralelo F03 añadió un test en `tests/unit/frontend/**` durante la ventana. Todos pasan; el delta es externo y no es regresión de F02-T03.
- `npm run lint` global falla con **3** hallazgos (2 en `frontend/src/App.tsx`, 1 en `tests/unit/frontend/core.test.ts`), frente al único del reporte del Developer: todos pertenecen a **F03** (fase paralela). El lint **acotado a `backend/src/worker/**` y `tests/{unit,integration}/worker/**` pasa (exit 0)**. No se corrigió nada fuera de alcance. No bloquea `CA-03`.

**Sin Docker, sin AWS, sin Git/GitHub, sin secretos reales, sin rutas Windows absolutas en artefactos (normalizadas a `<PROJECT_ROOT>`), sin G-9/G-10, sin activación de loops.** No se emitieron `NEEDS_CONTEXT` ni `NO-PASSED`: no falta contexto ni recurso imprescindible.
