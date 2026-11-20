# F05-QA-HUMAN-04 — Developer (fix acotado al 404 transitorio en `E5-01`)

| Campo | Valor |
|---|---|
| **Tarea** | `QA-HUMAN-04` — 404 transitorio durante `PROCESANDO` en `E5-01` / `E7-01` |
| **Fecha** | `2026-11-20` |
| **Rol** | Developer (no Tester, no Architect) |
| **Mandato** | Fix de alcance **EXACTO** dictado por el CTO; sin ampliación |
| **Estado** | `DONE` — pendiente de verificación independiente del Tester |
| **Evidencia de entrada** | `reports/implementation/F05/evidence/qa-human-roadmap/except/QA-HUMAN-04-E5-01-transient-404-evidence.json`; informe `F05-qa-human-tester.md` §M.4 |

---

## 1. Alcance (exclusivo)

| Archivo | Cambio |
|---|---|
| `frontend/src/api/image-availability.ts` | `shouldLoadOptimized` pasa a exigir estrictamente `image.status === 'COMPLETED'` (antes `!== 'FAILED'`). JSDoc actualizado. Se añade el helper puro `pendingImageMessage(image): string` con aviso de espera en español. `failedImageMessage` **sin cambios**. |
| `frontend/src/App.tsx` | Importa `pendingImageMessage`. En el `.map` de `jobDetail.images`, la rama `failed ? …` muestra el aviso de espera para `PENDING`/`PROCESSING` y `failedImageMessage(image)` para `FAILED` u otro estado terminal no completado. Sin tocar los botones: «Descargar original» sigue activo y WEBP/AVIF mantienen `disabled={failed}`. |
| `tests/unit/frontend/core.test.ts` | +1 import; nueva `it.each` de la matriz completa de estados; +2 tests de mensajes (espera en español, `failureReason` condicional). Se ajustan **2 aserciones preexistentes** que codificaban la regla antigua (`PARTIAL`/desconocido → `true`) a la nueva regla canónica (`false`). |

**Sin tocar:** backend, `infra/`, contratos Zod, tipos generados, `tests/e2e/**`, `STATE.md`, reportes ajenos, `G-12`. Sin `git commit` ni `git push`. Sin Docker/AWS.

## 2. Contrato resultante

- `shouldLoadOptimized(image): boolean` → `true` **solo** si `image.status === 'COMPLETED'`; `false` para `PENDING`, `PROCESSING`, `FAILED`, `PARTIAL` y cualquier estado ausente/desconocido. Total y pura; `failureReason` no altera el booleano.
- `pendingImageMessage(image): string` → para `PENDING`/`PROCESSING`, texto exacto: *«Imagen en procesamiento. La comparativa estará disponible al completarse.»* Para cualquier otro estado delega en `failedImageMessage`. Sin secretos, sin `failureReason`.
- `failedImageMessage(image): string` → intacto: `'Imagen no procesada.'` o `'Imagen no procesada. Motivo: <razón>.'` cuando hay motivo.

**Nota de alcance para el Architect/Tester:** los tests preexistentes afirmaban `PARTIAL → true` y `UNKNOWN → true` (regla anterior `!== 'FAILED'`). El dictamen del CTO exige `=== 'COMPLETED'` («cualquier otro estado» → `false`), por lo que esas dos aserciones se actualizaron a la nueva regla. **No son relajaciones**: son más estrictas y reflejan el contrato autorizado. Efecto colateral esperado y declarado: en lotes `PARTIAL` la comparativa y los botones WEBP/AVIF también quedan deshabilitados hasta `COMPLETED`.

## 3. TDD: RED → GREEN → REFACTOR

### RED
- Comando: `npx vitest run tests/unit/frontend/core.test.ts` con la `it.each` añadida y el helper aún sin cambiar.
- Resultado: `EXIT_CODE=1` · **2 failed | 24 passed (26)**. Fallos **por comportamiento**, no por sintaxis: `estado PENDING → … false` y `estado PROCESSING → … false` → `AssertionError: expected true to be false // Object.is equality` (la guarda antigua devuelve `true`). `FAILED → false` y `COMPLETED → true` ya pasaban.
- Evidencia: `reports/implementation/F05/evidence/F05-QA-HUMAN-04-red.txt`

### GREEN
- Mismo comando: `EXIT_CODE=0` · **28/28 passed** en `core.test.ts`.
- Aplicados: guarda estricta + JSDoc, helper `pendingImageMessage`, condicional en `App.tsx`, ajuste de las 2 aserciones heredadas y los 2 tests de mensajes.
- Evidencia: `reports/implementation/F05/evidence/F05-QA-HUMAN-04-green.txt`

### REFACTOR
- Revisión: el cambio es ya mínimo y auditable (sin abstracciones nuevas fuera del helper autorizado), por lo que **no hubo refactor de código**. Se registra reejecución de estabilidad: `EXIT_CODE=0` · **28/28 passed**.
- Evidencia: `reports/implementation/F05/evidence/F05-QA-HUMAN-04-refactor.txt`

## 4. Tabla de comandos (con `EXIT_CODE=` real)

| Comando | EXIT_CODE | Resultado | Evidencia (`reports/implementation/F05/evidence/`) |
|---|---|---|---|
| `npx vitest run tests/unit/frontend/core.test.ts` (RED) | `1` | 2 fallos reales (PENDING, PROCESSING) · 24 passed | `F05-QA-HUMAN-04-red.txt` |
| `npx vitest run tests/unit/frontend/core.test.ts` (GREEN) | `0` | 28/28 passed | `F05-QA-HUMAN-04-green.txt` |
| `npx vitest run tests/unit/frontend/core.test.ts` (REFACTOR) | `0` | 28/28 passed | `F05-QA-HUMAN-04-refactor.txt` |
| `npm run typecheck` | `0` | Sin diagnósticos (backend + frontend) | `F05-QA-HUMAN-04-typecheck.txt` |
| `npm run lint` | `0` | Sin hallazgos | `F05-QA-HUMAN-04-lint.txt` |
| `npm run build` | `0` | Vite + backend `tsc --noEmit` | `F05-QA-HUMAN-04-build.txt` |
| `npm run test:unit` | `0` | **355/355**, **37 archivos**, 0 fallos | `F05-QA-HUMAN-04-test-unit.txt` |

**Conteo final exacto: 355/355 en 37 archivos de test.** Baseline autorizado 349/349 → **+6**: 4 casos de la `it.each` de matriz + 1 test de mensaje de espera + 1 test de `failedImageMessage`/`failureReason`. No se crearon archivos de test nuevos (sigue siendo 37).

## 5. Confirmaciones de comportamiento

- **Matriz verificada:** `PENDING → false`, `PROCESSING → false`, `FAILED → false`, `COMPLETED → true`. Las tres primeras no montan `<ImageComparison>` → `loadImageSources()` no pide la variante optimizada inexistente → se elimina el 404 transitorio de `E5-01` sin falsear respuestas ni relajar `E7-01`.
- **Aviso de espera:** visible en español para `PENDING`/`PROCESSING` (*«Imagen en procesamiento. La comparativa estará disponible al completarse.»*), con `role="status"` y la clase ya existente `.preview-error`. Para `FAILED`/otros estados terminales se conserva `failedImageMessage` (con `failureReason` solo si está).
- **Descargas:** «Descargar WEBP»/«Descargar AVIF» quedan `disabled={failed}` → deshabilitados hasta `COMPLETED` (incluye `PENDING`/`PROCESSING`, antes habilitados). «Descargar original» sigue sin `disabled` → activo. Sin cambios en ZIP, borrado, polling ni auth.
- **No ejecuté E2E**: compete al Tester independiente (deberá confirmar 0×404 en `E5-01`, aviso de espera durante `PROCESANDO` y no regresión en `E4-01`/`E4-02`/`E5-02`).

## 6. Higiene P4 / G-3

- Todo el trabajo y la escritura se limitaron a `<PROJECT_ROOT>`.
- Las salidas de herramientas se anonimizaron sustituyendo la raíz real por `<PROJECT_ROOT>`; escaneo de los 7 archivos de evidencia: **0 rutas de host, 0 secretos, 0 firmas/query strings**.
- Ningún secreto ni valor de `.env` en código, reportes o logs; no se publicó material `.local/`. Sin `G-10`, sin `G-12`, sin commit/push.

---

**Retorno al Architect:** fix entregado con RED→GREEN real y verificación completa en verde. Foco del Tester: `E5-01` con **0×404** desde el primer render, aviso de espera visible durante `PROCESANDO`, WEBP/AVIF deshabilitados hasta `COMPLETED`, y 355/355 sin regresión.
