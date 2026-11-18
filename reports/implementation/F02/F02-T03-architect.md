# Cierre de tarea (Architect) — `F02-T03`

| Campo | Valor |
|---|---|
| **Tarea** | `F02-T03` — Worker `sharp` (WebP + AVIF + miniatura, privacidad) |
| **Fase / paquete** | Fase 2 — `docs/sdd/packages/P-02-api-and-worker.md` |
| **Versión / Loop usado** | `v1 — Loop 1/3` |
| **Rol implementador / verificadores** | Developer / Tester + Auditor (riesgo 3 sensible) |
| **Dictamen Tester** | **`PASSED`** (`F02-T03-tester.md`: 18/18 worker, 194/194 regresión, strip real verificado) |
| **Dictamen Auditor** | **`READY_WITH_CONCERNS`** (`F02-T03-auditor.md`: 2 LOW + 3 INFO; 0 CRITICAL/HIGH, sin bloqueantes) |
| **Estado de la tarea** | `CERRADA — PASSED` |

## 1. Revisión de aceptación reforzada (METHODOLOGY.md §3.2)

| Requisito / fuente superior | Comportamiento observable | Evidencia | Límite de cobertura | Estado |
|---|---|---|---|---|
| `CA-03` (P-02 §5) · WebP + AVIF + miniatura WebP — IN-01/A-04 | Tester reejecutó 18/18 (4 formatos, 3 metadata, 7 anti-bomba), sin skip/only | `F02-T03-tester-{worker,formats}.txt` | Sin S3 real todavía (T02/T06) | **CUMPLIDO** |
| PR-01/IN-10 · strip total EXIF/GPS | Decode a RAW + recodificación de las 3 salidas, sin `withMetadata()`; sonda del Tester: `exif/xmp/iptc=0` y sin marcadores ASCII; control negativo con `withMetadata({})` sí filtra (262 B EXIF, 82 B XMP) | `F02-T03-tester-metadata.txt`; auditoría (corroborado en `sharp/lib/output.js`: `withMetadata` → `keepMetadata`) | La fixture tiene GPS como ASCII, no IFD `0x8825` real (observación INFO): se elimina todo el EXIF de todos modos | **CUMPLIDO** |
| `exifStripped` honesto (PR-12) | `true` solo tras `assertMetadataStripped()` en caliente; fallo → `RENDER_FAILED`/`false` | `F02-T03-tester-metadata.txt`; auditoría A-01 | Un renderizador inyectado por hooks certificaría sin verificar (LOW; hooks son de prueba) | **CUMPLIDO** |
| A-05 · guarda de tamaño antes de escanear | Orden `limitsFromConfig → checkFileSize → validateImageHeader → checkDimensions → sharp`; con límite bajo no se invocan escaneo ni render; al subir el límite sí | `F02-T03-tester-anti-bomb.txt` | La ventana de escaneo de GIF en `domain/**` queda para su fase (A-04 INFO) | **CUMPLIDO** |
| PR-12 · ahorro real | `bytesAfter` = suma real de las 3 salidas (532 = 532 en la sonda), `computeSavings` sin recortar 0 %/negativos | `F02-T03-tester-worker.txt`; auditoría | — | **CUMPLIDO** |
| Reutilización y ámbito | Usa reglas puras y contratos de F01 sin redefinirlos; sin manifiestos, `backend/src/{api,storage}/**`, frontend, IaC ni `STATE.md`/`tasks.md` | `F02-T03-tester-scope.txt` | Sin `git diff` (sin push de F02) | **CUMPLIDO** |

**Conclusión:** `CA-03` satisfecho con evidencia propia del Tester y auditoría sin bloqueantes. Hallazgo técnico relevante: la sugerencia literal `.withMetadata({})` habría filtrado metadatos en sharp 0.33; la implementación la corrigió por construcción.

## 2. Problemas y disposición

| ID | Clasificación | Disposición |
|---|---|---|
| `A-01` — `exifStripped` certificado solo en `renderWithSharp` | LOW | Hooks de prueba; producción usa el default. Recomendación: no inyectar renderizadores en T04/T06 |
| `A-02` — barrel exporta `renderWithSharp` sin guardas | LOW | **TRASPASO a T04/T06**: usar siempre `processImage` (impone A-05), acotar exportación |
| `A-03` — comprobación byte-level solo en tests | INFO | Defensa en profundidad, sin fuga demostrada; sin acción |
| `A-04` — A-05 parcialmente cerrado (escaneo de GIF en `domain/**`) | INFO | Fuera del ámbito de T03; se registra para F02 posterior si aplica |
| `A-05` — lint global rojo por archivos F03 | INFO | Interferencia externa (harness paralelo), **no aceptada como riesgo de F02**; lint acotado a F02 en verde |

Cronología RED (17 fallos por comportamiento) → GREEN 18/18 → REFACTOR 18/18 revisada como registro. Sin Docker/AWS/Git, sin secretos ni rutas Windows absolutas en artefactos nuevos.

## 3. Cobertura y cierre

- Worker listo para ser consumido por el SQS consumer (T04) y la integración final (T06), siempre vía `processImage`.
- `F02-T03` queda **`CERRADA — PASSED`**. No se actualizan `STATE.md` ni `docs/sdd/tasks.md` (CTO consolida al retorno, regla anti-colisión). Habilita `F02-T04`.
