# F05-QA-HUMAN — Developer (micro-ciclo excepcional: `QA-HUMAN-03` / `E7-01`)

| Campo | Valor |
|---|---|
| **Tarea** | `F05-QA-HUMAN` — micro-ciclo excepcional autorizado por CTO/Lino, **fuera del límite de 3 loops**, para cerrar `QA-HUMAN-03` (`E7-01`) |
| **Fecha** | `2026-11-20` |
| **Rol** | Developer (no Tester, no Architect) |
| **Decisión aplicada** | **Opción A** del CTO/Lino: no pedir la variante optimizada de imágenes `FAILED` |
| **Estado** | `DONE` — pendiente de verificación independiente del Tester |
| **Defecto corregido** | `App.tsx` montaba `<ImageComparison />` para **todas** las imágenes; para las de estado `FAILED` (E5-01/E5-02) `loadImageSources()` pedía una variante optimizada inexistente → **2×404** y 2 errores de consola. `E7-01` exige 0 4xx inesperadas (solo excluye 401/429). |

---

## 1. Alcance (exclusivo)

| Archivo | Cambio |
|---|---|
| `frontend/src/api/image-availability.ts` | **Nuevo.** Dos helpers puros exportados: `shouldLoadOptimized` y `failedImageMessage`. |
| `frontend/src/App.tsx` | Importa ambos helpers. En el `.map` de `jobDetail.images`: `const failed = !shouldLoadOptimized(image);`; si `failed`, **no monta `<ImageComparison />`** y muestra `<p className="preview-error" role="status">{failedImageMessage(image)}</p>`; los botones generados por `jobDetail.job.formats.map(...)` llevan `disabled={failed}`. «Descargar original» se mantiene sin cambios. |
| `frontend/src/styles.css` | Una regla **mínima** usando variables de tema ya definidas: `.result-actions .text-button:disabled{opacity:.5;cursor:not-allowed;color:var(--muted)}`. Sin colores fijos nuevos. |
| `tests/unit/frontend/core.test.ts` | +5 tests de regresión (`describe('disponibilidad de la variante optimizada (QA-HUMAN-03, E7-01)')`) y 2 imports nuevos. |

**Sin tocar:** backend, `infra/`, contratos Zod, tipos generados, `tests/e2e/**`, `STATE.md`, reportes ajenos. Lógica de descarga ZIP, borrado, polling, auth y contratos: intacta.

## 2. Contrato de los helpers

- `shouldLoadOptimized(image: Pick<ImageRecord, 'status' | 'failureReason'>): boolean`
  → `false` **solo** cuando `image.status === 'FAILED'`; `true` en caso contrario. **Total**: un `status` ausente/desconocido devuelve `true` de forma segura (`image.status !== 'FAILED'`), sin alterar el comportamiento de lotes `COMPLETED`/`PARTIAL`. Un `failureReason` presente **no altera el booleano**.
- `failedImageMessage(image: Pick<ImageRecord, 'status' | 'failureReason'>): string`
  → `'Imagen no procesada.'` cuando no hay motivo; `'Imagen no procesada. Motivo: <razón>.'` cuando `failureReason` está presente (se recorta whitespace). Texto en español, sin secretos. El backend emite `failureReason` como mensaje legible controlado (`backend/src/worker/*`: `RENDER_FAILED`, «No se pudo procesar la imagen con sharp»), nunca credenciales ni rutas.

## 3. TDD: RED → GREEN → REFACTOR

### RED
- Comando: `npx vitest run tests/unit/frontend/core.test.ts`
- Resultado: `EXIT_CODE=1` · **1 failed suite / 0 tests** — `Failed to load url ../../../frontend/src/api/image-availability … Does the file exist?`. Fallo real por módulo/helper ausente, no por sintaxis del test.
- Evidencia: `reports/implementation/F05/evidence/F05-QA-HUMAN-except-red.txt`

### GREEN
- Mismo comando: `EXIT_CODE=0` · **22/22 passed** en `core.test.ts` (17 preexistentes + 5 nuevos).
- Implementados los helpers, el cambio condicional en `App.tsx` y la regla CSS mínima.
- Evidencia: `reports/implementation/F05/evidence/F05-QA-HUMAN-except-green.txt`

### REFACTOR
- Extraída la cadena base del aviso a la constante `UNPROCESSED_BASE_MESSAGE` para evitar duplicación. Sin cambio de comportamiento: `EXIT_CODE=0` · **22/22 passed**.
- Evidencia: `reports/implementation/F05/evidence/F05-QA-HUMAN-except-refactor.txt`

## 4. Tabla de comandos (evidencia con `EXIT_CODE=` real)

| Comando | EXIT_CODE | Resultado | Evidencia (`reports/implementation/F05/evidence/`) |
|---|---|---|---|
| `npx vitest run tests/unit/frontend/core.test.ts` (RED) | `1` | 1 failed suite · helper ausente | `F05-QA-HUMAN-except-red.txt` |
| `npx vitest run tests/unit/frontend/core.test.ts` (GREEN) | `0` | 22/22 passed | `F05-QA-HUMAN-except-green.txt` |
| `npx vitest run tests/unit/frontend/core.test.ts` (REFACTOR) | `0` | 22/22 passed | `F05-QA-HUMAN-except-refactor.txt` |
| `npm run typecheck` | `0` | Sin diagnósticos (backend + frontend) | `F05-QA-HUMAN-except-typecheck.txt` |
| `npm run lint` | `0` | Sin hallazgos | `F05-QA-HUMAN-except-lint.txt` |
| `npm run build` | `0` | Vite 36 módulos + backend `tsc --noEmit` | `F05-QA-HUMAN-except-build.txt` |
| `npm run test:unit` | `0` | **349/349**, **37 archivos**, 0 fallos | `F05-QA-HUMAN-except-test-unit.txt` |

**Conteo final: 349/349 en 37 archivos de test.** Baseline del Tester en Loop 3 = 344/344; +5 tests nuevos = 349. Cumple `> 344`. El módulo `image-availability.ts` es código fuente (no un archivo de test), por lo que el número de archivos de test sigue siendo **37** (no se creó ningún archivo de test adicional). Se anota el conteo exacto según lo exigido.

## 5. Las 5 aserciones nuevas

1. **FAILED → false**: `shouldLoadOptimized({ status: 'FAILED' })` es `false`.
2. **COMPLETED → true**: `shouldLoadOptimized({ status: 'COMPLETED' })` es `true`.
3. **PARTIAL → true**: `shouldLoadOptimized({ status: 'PARTIAL' })` es `true`.
4. **Totalidad / motivo irrelevante**: `FAILED` + `failureReason: 'RENDER_FAILED'` sigue `false`; `COMPLETED` + motivo sigue `true`; un `status: 'UNKNOWN'` casteado devuelve `true`.
5. **Aviso en español y sin secretos**: con motivo contiene `Imagen no procesada` y `Motivo: RENDER_FAILED`; no contiene patrones `Bearer|AKIA|accessToken|password|secret|token`; sin motivo es exactamente `Imagen no procesada.` y no contiene `Motivo`.

## 6. Confirmaciones de alcance

- **No se monta `<ImageComparison />` para imágenes `FAILED`**: la rama `failed ? <p className="preview-error">…</p> : <ImageComparison …/>` garantiza que `loadImageSources()` nunca se llama para esas imágenes → **0 peticiones** de variante optimizada inexistente → se elimina la causa de los 2×404 de `E7-01` sin falsear respuestas ni relajar el criterio.
- **WEBP/AVIF quedan `disabled`** para imágenes `FAILED` (`disabled={failed}` en cada botón generado por `jobDetail.job.formats.map`): nunca se pide una variante optimizada inexistente. «Descargar original» permanece habilitado (el original sí existe en `raw`).
- **El aviso usa `failureReason`** solo cuando está presente, y usa clases ya existentes y tematizadas (`.preview-error`, con `.result-actions .text-button:disabled` nuevo basado en `var(--muted)`/`opacity`), legible en **Claro y Oscuro** sin colores fijos nuevos.
- **No** modifiqué backend, `infra/`, contratos, `tests/e2e/**`, `STATE.md` ni reportes ajenos. **No** hice `git commit` ni `git push`; `G-12` sigue retenido; sin `G-10`. **No** usé Docker/AWS.
- **No** ejecuté pruebas E2E: compete al Tester independiente (deberá verificar 0×404 en E5-01/E5-02 y no regresión en E4-01/E4-02).

## 7. Higiene P4 / G-3

- Todo el trabajo y la escritura se limitaron a `<PROJECT_ROOT>`.
- Las salidas de herramientas se anonimizaron sustituyendo la raíz real por `<PROJECT_ROOT>` (mismo criterio que los loops anteriores). Escaneo de los 7 archivos de evidencia y del helper nuevo: **0 rutas de host, 0 firmas/query strings, 0 valores de token, 0 secretos**.
- Ningún secreto en código, reportes ni logs; no se publicó `.env` ni material `.local/`.

---

**Retorno al Architect / CTO:** corrección lista para verificación independiente. Foco del Tester: `E7-01` con **0×404** en los lotes `E5-01`/`E5-02`, aviso visible con `Motivo` en imágenes fallidas, botones WEBP/AVIF deshabilitados, y no regresión en `E3-03`, `E4-01`, `E4-02`, `E5-02`. Sin commit ni push.
