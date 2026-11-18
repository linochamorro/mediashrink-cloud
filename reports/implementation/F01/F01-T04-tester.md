# Dictamen Tester independiente — `F01-T04` (Script seed sintético)

| Campo | Valor |
|---|---|
| **Tarea** | `F01-T04` — Script seed sintético (usuarios demo + imágenes `100x100`) |
| **Fase / paquete** | Fase 1 — `docs/sdd/packages/P-01-critical-foundations.md` |
| **Criterio asignado** | `CA-04`: script seed crea usuarios demo e imágenes sintéticas `100x100` de forma idempotente en local/emulador, sin datos reales |
| **Versión / Loop** | `v1 — Loop 1/3` (sin activar loops: no hubo incumplimiento) |
| **Riesgo** | `2 (Relevante)` — sin Auditor según `task.md` |
| **Rol verificador** | `Tester` (ejecución propia, independiente del Developer) |
| **Fecha** | `2026-11-17` |
| **Dictamen global** | **`PASSED`** |

## 1. Verificación por criterio (ejecución propia)

| # | Criterio / gate | Método propio del Tester | Resultado observado | Evidencia (`F01-T04-tester-…`) | Estado |
|---|---|---|---|---|---|
| 1 | `--dry-run` sin escrituras ni conexión a DynamoDB, salida legible | Ejecutado **con el emulador apagado** (`docker ps -a` sin contenedores); además revisado el código: todas las operaciones DynamoDB están tras `if (!dryRun)` | exit 0; `creados=0/0/0`, sin conexión, plan legible con 3/3/6 `[SE CREARÍA]`, 3 correos `@example.com`, 6 imágenes `100x100` | `dry-run.txt` | **CUMPLIDO** |
| 2 | Idempotencia: 1.ª ejecución crea, 2.ª omite sin duplicar; conteo estable 12 | Dos ejecuciones reales de `npm run seed` contra emulador healthy; tabla previa inexistente (diagnóstico propio) | 1.ª: `3/3/6` creados, `0 → 12`. 2.ª: `0/0/0` creados, `3/3/6` omitidos, `12 → 12` | `seed-1.txt`, `seed-2.txt` | **CUMPLIDO** |
| 3 | Tests de integración del seed 6/6, sin skip/only/todo; incluye reparación de lote a medias | `npx vitest run tests/integration/seed --no-color` + búsqueda de `.skip/.only/.todo/.concurrent` | 2 archivos, **6/6**; caso «recupera un lote sembrado a medias» incluido y verde; 0 marcadores de omisión | `seed-tests.txt` + búsqueda en `tests/integration/seed/**` | **CUMPLIDO** |
| 4 | Regresión y gates: unidades, suite completa, typecheck y lint | `npm run test:unit`, `npx vitest run`, `npm run typecheck`, `npm run lint` | `test:unit` **150/150** (15 archivos); suite completa **188/188** (22 archivos); typecheck exit 0; lint exit 0 | `regression.txt` | **CUMPLIDO** |
| 5 | Datos ficticios y privacidad (PR-01/PR-02, FR-04) | Lectura de `tools/scripts/seed/**` + salida de mis propias ejecuciones | Correos `@example.com`; `hashPassword` de T03 (hash `scrypt$`, verificado con `verifyPassword`); imágenes `100x100` generadas en memoria con `sharp` y validadas por metadata; sin archivos personales; `exifStripped: true`; `ttl = computeTtl(now)` (30 d) | `data.txt`, `seed-tests.txt` (DB-CHECK `3/3/6/12`) | **CUMPLIDO** |
| 6 | Ámbito restringido y sin nuevas dependencias | `git status`/`git diff` + lectura de manifiestos | `package.json` raíz: **solo** el script `seed`; scripts y devDependencies sin otros cambios; `tsx` ya disponible desde T01; cambios en `backend/`, `frontend/`, `STATE.md`, `tasks.md` e IaC corresponden a T01/T02/T03, no a T04; el Tester no editó código, tests, manifiestos ni reportes ajenos | `scope.txt` | **CUMPLIDO** |
| 7 | Cronología `RED → GREEN → REFACTOR` revisada como registro | Lectura de `evidence/F01-T04-red.txt` y del reporte del Developer; **sin reejecutar invirtiendo código** | RED: 4/4 fallos por comportamiento con stub (plan vacío, `dryRun=false`, 0 creados, 0 omitidos); GREEN 6/6; REFACTOR con prueba de lote a medias; trazas coherentes y append-only | `F01-T04-red.txt` (registro del Developer, citado como registro, no como evidencia propia) | **REVISADO** |
| 8 | G-7: contenedor apagado y sin red residual | `docker compose down`, `docker ps -a`, `docker network ls` | `down` exit 0; sin contenedores; sin red `mediashrink-cloud_default`; límites verificados en arranque (`2147483648` B, `2000000000` nanoCpus, `user=1000:1000`) | `down.txt`, `emulator-up.txt` | **CUMPLIDO** |

## 2. Observaciones transparentes (no bloqueantes)

- **Cifra de regresión:** la instrucción de verificación citaba `npm run test:unit → 188/188`. En ejecución real, `test:unit` (definido en F00 como `vitest run tests/unit`) cubre **150/150**; los **188/188** corresponden a la **suite completa** (`npx vitest run`, 22 archivos), que incluye los tests de integración. Se aportan ambas cifras con evidencia propia. No es un incumplimiento de `CA-04`: la regresión integral y los gates están en verde.
- **`package-lock.json`:** aparece modificado en el árbol de trabajo, pero el diff corresponde a dependencias de T01/T02 (`@aws-sdk/*`, `zod`, `@vitest/coverage-v8`, `tsx` en el workspace `backend`). `tsx` ya estaba instalado; el script `seed` no añadió ningún paquete. G-8 satisfecho por T04.
- **Estado Git:** toda P-01 permanece sin confirmar (baseline = cierre de F00), por lo que no existe un `git diff` comparativo por tarea. El alcance se verificó por la forma de los cambios y por las rutas creadas, no por comparación entre commits.
- **Incidente P-01 del Developer** (colisión de tablas en paralelo) fue resuelto en el mismo loop derivando tablas por archivo; el Tester lo comprobó al ejecutar la suite.seed 6/6 sin colisiones.

## 3. Problemas

No se encontraron incumplimientos de `CA-04`, ni hallazgos `CRITICAL`/`HIGH`, ni bloqueantes. No proceden entradas con los 7 campos obligatorios. No se activa ningún loop (1/3).

## 4. Dictamen global

**`PASSED`.** `CA-04` queda satisfecho con evidencia propia del Tester: seed idempotente verificado por doble ejecución (`0 → 12` y `12 → 12`), `6/6` tests de integración (incluida la reparación de lote a medias), datos 100 % ficticios y `100x100`, sin escrituras en `--dry-run`, regresión y gates en verde, ámbito respetado, sin nuevas dependencias y contenedor apagado sin red residual.

Se recomienda al Architect integrar este dictamen y proceder al cierre de `F01-T04` y de `P-01`, sin iniciar F02/F03/F04.
