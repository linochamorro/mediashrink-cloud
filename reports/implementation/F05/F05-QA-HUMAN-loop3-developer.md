# F05-QA-HUMAN — Developer (Loop 3/3)

| Campo | Valor |
|---|---|
| **Tarea** | `F05-QA-HUMAN` — corrección de `QA-HUMAN-02` (`E2-04`, selección mixta) |
| **Fecha** | `2026-11-20` |
| **Rol** | Developer (no Tester, no Architect) |
| **Loop** | `3/3` (último permitido) |
| **Estado** | `DONE` — pendiente de verificación independiente del Tester |
| **Defecto corregido** | Al seleccionar `valida.jpg` + `malo.txt` se descartaba **toda** la selección (`setFiles([])`): no aparecía «1 imágenes listas», `Optimizar` quedaba deshabilitado y se emitían 0 `POST /jobs`. |

---

## 1. Alcance (exclusivo)

| Archivo | Cambio |
|---|---|
| `frontend/src/upload/validation.ts` | Añadido el helper puro exportado `selectValidFiles`. **`validateFiles` intacto**: misma firma y mismo comportamiento; sus tests actuales siguen pasando. |
| `frontend/src/App.tsx` | `acceptFiles` usa el helper (`const { accepted, errors } = selectValidFiles(chosen, limits); …`). Se retira `validateFiles` del import (quedaba sin usar) para mantener `lint` en 0. Ninguna otra parte del componente. |
| `tests/unit/frontend/core.test.ts` | +3 tests de regresión del helper. |

**Nota de diffs:** el diff de `core.test.ts` frente a `HEAD` también muestra los 3 tests de `QA-HUMAN-01` del Loop 2 (siguen sin commit). Mi delta real se limita a la línea de import (`selectValidFiles`) y al nuevo bloque `describe('selección de archivos válidos (QA-HUMAN-02, E2-04)')`. No modifiqué esos 3 tests.

## 2. Contrato del helper

`selectValidFiles(files, limits) -> { accepted, errors }`, con `T extends Pick<File,'name'|'type'|'size'>` para conservar el tipo concreto sin casteos:

- **Tope de lote estricto:** si `files.length > limits.maxImagesPerBatch` → `accepted: []` y únicamente `El máximo es N imágenes por lote.` (comprobado **antes** del filtrado por archivo, para no relajar `E2-03`).
- **Colección vacía:** `accepted: []` y `Selecciona al menos una imagen.` (coherente con `validateFiles`).
- **En caso contrario:** validación archivo a archivo mediante `validateFiles([file], limits)`; los válidos se conservan en `accepted` con su referencia original; los inválidos aportan sus mensajes a `errors` (p. ej. `malo.txt: formato no permitido…`). No se duplica la lógica de mensajes: `validateFiles` sigue siendo la única fuente.

## 3. TDD: RED → GREEN → REFACTOR

### RED
- Comando: `npx vitest run tests/unit/frontend/core.test.ts`
- Resultado: `EXIT_CODE=1` · **3 failed / 14 passed (17)**.
- Los 3 fallos son `TypeError: selectValidFiles is not a function` en las líneas de llamada de los tests nuevos: **fallo por función/helper ausente**, no por error de sintaxis del test ni por importación de módulo rota. Los 14 tests preexistentes del archivo pasaron, confirmando que no se rompió comportamiento previo.
- Evidencia: `reports/implementation/F05/evidence/F05-QA-HUMAN-loop3-red.txt`

### GREEN
- Mismo comando: `EXIT_CODE=0` · **17/17 passed**.
- Implementado el helper en `validation.ts` y sustituido el cuerpo de `acceptFiles` en `App.tsx`.
- Evidencia: `reports/implementation/F05/evidence/F05-QA-HUMAN-loop3-green.txt`

### REFACTOR
- **No aplica.** El helper es una única función pura que delega en `validateFiles` (sin lógica duplicada de validación ni de mensajes) y los tests son directos; no había deuda que eliminar sin ampliar el alcance. Por ello **no se genera** `F05-QA-HUMAN-loop3-refactor.txt`.

## 4. Tabla de comandos (evidencia con `EXIT_CODE=` real)

| Comando | EXIT_CODE | Resultado | Evidencia (`reports/implementation/F05/evidence/`) |
|---|---|---|---|
| `npx vitest run tests/unit/frontend/core.test.ts` (RED) | `1` | 3 failed / 14 passed · helper ausente | `F05-QA-HUMAN-loop3-red.txt` |
| `npx vitest run tests/unit/frontend/core.test.ts` (GREEN) | `0` | 17/17 passed | `F05-QA-HUMAN-loop3-green.txt` |
| `npm run typecheck` | `0` | Sin diagnósticos | `F05-QA-HUMAN-loop3-typecheck.txt` |
| `npm run lint` | `0` | Sin hallazgos (0 variables sin usar) | `F05-QA-HUMAN-loop3-lint.txt` |
| `npm run build` | `0` | Build frontend + backend correcto | `F05-QA-HUMAN-loop3-build.txt` |
| `npm run test:unit` | `0` | **344/344**, 37 archivos, 0 fallos | `F05-QA-HUMAN-loop3-test-unit.txt` |

**Conteo final:** 344/344 = 341 (baseline Loop 2) + 3 tests nuevos. Cumple el requisito `> 341`.

## 5. Las 3 aserciones nuevas

1. **Selección mixta** (`valida.jpg` + `malo.txt`): `accepted.map(name) === ['valida.jpg']`, `errors` tiene longitud 1 y contiene `malo.txt` y `formato no permitido`. → `E2-04` queda cubierto: el válido sigue listo.
2. **Todos inválidos** (`malo.txt` + `vector.svg`): `accepted === []`, `errors` tiene longitud 2 con un mensaje por cada nombre. → no se pierde ningún diagnóstico.
3. **Tope de 20** (21 imágenes válidas, `maxImagesPerBatch: 20`): `accepted === []` y `errors === ['El máximo es 20 imágenes por lote.']`. → **`E2-03` no se relaja**: sigue rechazando el lote completo y `Optimizar` permanece deshabilitado.

## 6. Confirmaciones de no-invasión

- **No** modifiqué backend, `infra/`, contratos, `tests/e2e/**`, `STATE.md` ni reportes ajenos (incluido el informe del Loop 2 y la spec E2E, que recrea el Tester).
- **No** hice `git commit` ni `git push`; `G-12` sigue retenido. **No** usé Docker ni AWS.
- **No** ejecuté pruebas E2E: compete al Tester independiente.
- El cambio en `App.tsx` se limita al import y al cuerpo de `acceptFiles`; el resto del componente (polling, descargas, auth, UI) está sin tocar.

## 7. Higiene P4 / G-3

- Todo el trabajo y los borrados se limitaron a `<PROJECT_ROOT>`.
- Las salidas de herramientas se capturaron anonimizando la raíz real a `<PROJECT_ROOT>` (mismo criterio que la evidencia del Loop 2). Escaneo de los 6 archivos de evidencia del Loop 3: **0 coincidencias** de ruta real, identificador de cuenta ni patrones de credenciales.
- Sin secretos en código, reportes ni logs; no se publicó `.env` ni material `.local/`.

---

**Retorno al Architect:** corrección lista para que el Tester reejecute el roadmap, con especial atención a `E2-04` (mixto válido+inválido) y a la no regresión de `E2-03` (21 archivos).
