# `F05-T04` — Dictamen Tester (capturas reales y `README.md` público)

| Campo | Valor |
|---|---|
| **Tarea / Criterio** | `F05-T04` · `CA-04` (Fase Final, riesgo 1) |
| **Versión / Loop** | `v1 — Loop 1/3` (dictamen propio; no activo loops) |
| **Rol / Harness** | Tester independiente · OpenCode |
| **Fuente de verdad** | `reports/implementation/F05/F05-T04-task.md` y `docs/sdd/packages/P-05-final-integration-and-delivery.md` (CA-04) |
| **Otras fuentes leídas** | `.agents/roles/tester.md`, `AGENTS.md`, `STATE.md`, `docs/templates/readme-github.md` (LAB_ROOT), `F05-T04-designer.md`, `README.md`, `LICENSE`, `package.json`, `backend/package.json`, `.github/workflows/ci.yml`, `tests/e2e/playwright.screenshots.config.ts`, `tests/e2e/screenshots.spec.ts`, 18 PNG de `docs/images/`, 7 evidencias `F05-T04-*` del Designer |
| **Veredicto global** | **`NO-PASSED`** — 1 hallazgo MEDIUM de fidelidad documental (conteo de pruebas unitarias) |
| **Evidencia propia** | `reports/implementation/F05/evidence/F05-T04-tester-{png,readme,license,traces,scope,pipeline-and-count}.txt` (6 archivos) |

> No edité `README.md`, `LICENSE`, capturas, código, reportes ajenos, `STATE.md` ni `tasks.md`. No ejecuté `G-11` ni `G-12`. Sin secretos ni rutas Windows absolutas en mis artefactos.

---

## 1. Dictamen por verificación

| # | Verificación (según encargo) | Resultado | Evidencia propia |
|---|---|---|---|
| 1 | **18 PNG (9 flujos × claro/oscuro)**, PNG válidos por parser de chunks, sin metadatos con rutas locales | **PASSED** | `tester-png.txt`: 18/18 con `IHDR+IDAT+IEND`, `METADATA_CHUNKS=0`, `MISSING_EXPECTED=none`. Inspección visual de 6 capturas: UI real del producto, temas Claro/Oscuro diferenciados, comparativa con píxeles decodificados, métricas y estados de progreso/ZIP coherentes. |
| 1b | **Capturas del stack real, sin mocks** | **PASSED** | `tester-pipeline-and-count.txt`: `playwright --list` propio descubre 2 tests (Claro/Oscuro); el spec usa un único `context.route()` de relay S3 hacia el emulador real (URL firmada y cuerpo reales, CA real), sin `page.route()` sobre la API ni fixtures. Evidencia del Designer de emulador + `terraform apply` (11 recursos) + backend + SPA y `2 passed (18.8s)`. No repetí la corrida completa: no hubo cambios desde ella y la proporcionalidad (METHODOLOGY §3.1) evita duplicarla. |
| 2 | **Orden exacto de la plantilla** | **PASSED** | `tester-readme.txt`: portada en línea 1, 5 badges antes del título, nota de portafolio antes del primer `##`, `H2_ORDER_EXACT=true` (Funcionalidades → Tecnología y estructura → Inicio local → Comandos del proyecto → Imágenes → Documentación → Licencia), dos tablas, `<details>/<summary>Otras vistas</summary>`, CI step line. |
| 2 | **24 enlaces relativos existentes** | **PASSED** | `LINKS_RELATIVOS=24`, `LINKS_MISSING=[]`, 19 referencias de imagen → 18 únicas (la portada se reutiliza). |
| 2 | **7 scripts documentados presentes en `package.json`** | **PASSED** | `DOCUMENTED_SCRIPTS` = los 7 del manifiesto raíz; `BOGUS=[]` (no se documenta `npm run dev`/`npm test` inexistentes); `npm start --workspace=@mediashrink/backend` verificado en `backend/package.json`. |
| 2 | **Badges coherentes con el repo público** | **PASSED** | CI badge apunta a `linochamorro/mediashrink-cloud/actions/workflows/ci.yml`; badge MIT enlaza `LICENSE`; 5 badges. |
| 3 | **Cero rastros internos** en README/LICENSE/capturas | **PASSED** | `tester-traces.txt`: P1 rutas de host=0, P2 herramientas=0, P3 roles=0, P4 docs excluidas=0, P5 identificadores=0, P6 coordinación=0, P7 chunks de texto/EXIF en PNG=0, P8 secretos=0. La única ruta `/home/emulator/...` aparece en comandos `docker cp` (ruta de contenedor, aceptable). |
| 4 | **`LICENSE` MIT coherente** | **PASSED** | `tester-license.txt`: cabecera MIT, copyright 2026 `linochamorro`, grant y warranty, enlace y badge en README. |
| 5 | **Ámbito: `temporary/` intacto, sin G-11/G-12, Docker apagado, sin secretos** | **PASSED** | `tester-scope.txt`: `temporary/` con 67 entradas/71 archivos (G-11 no ejecutado); entregables aún sin commitear (G-12 no ejecutado); `docker ps -a` → solo `dazzling_edison` (ajeno), 0 contenedores del proyecto; `TRACKED_FORBIDDEN=[]`. |
| 2 (fidelidad) | **Conteo exacto de pruebas unitarias exigido por la plantilla (línea 71)** | **`NO-PASSED`** | `tester-pipeline-and-count.txt`: dos ejecuciones propias dan **32 archivos / 303/303**; el README afirma **277**. F05-T02 ya documentaba 303/303 antes de redactarse el README. Ver hallazgo `F05T04-T-01`. |

**Resultado global: `NO-PASSED`.** Diez verificaciones pasan; la undécima —fidelidad estricta del README a la evidencia real, requerida por la plantilla— falla. El defecto es documental y de severidad MEDIUM (no afecta producto, capturas ni gobernanza), pero es material al criterio CA-04 y debe corregirse antes del cierre.

---

## 2. Registro de problemas (7 campos)

### F05T04-T-01 — Conteo de pruebas unitarias desactualizado en la línea de CI del README

1. **Identificación:** `F05T04-T-01` · `CA-04` · riesgo 1 · severidad **MEDIUM** · `README.md:81`.
2. **Problema:** la línea de CI del README afirma `npm run test:unit (277 pruebas unitarias aisladas)`, pero el comando real del repositorio produce **303 pruebas en 32 archivos**. La plantilla exige en su línea 71 «lista exacta de pasos y conteo de pruebas unitarias aisladas» y fidelidad estricta con la evidencia real.
3. **Causa:** **DEMOSTRADA** — el Designer reutilizó la cifra de `F05-T01` (277/277, 31 archivos, estado previo a `F05-T02`) en lugar de la vigente. `F05-T02` añadió `tests/unit/frontend/secure-url.test.ts` (26 pruebas nuevas) y su propio reporte del Tester ya registraba `32 archivos / 303/303` antes de que se escribiera el README. Diferencia exacta: 303 − 277 = 26.
4. **Solución e intentos fallidos:** corregir `README.md:81` a `303 pruebas unitarias aisladas` (32 archivos) y re-verificar con `npm run test:unit`. No se intentó ninguna corrección: el contrato de Tester prohíbe editar el README. No hay soluciones fallidas propias; mi primer escanéo tuvo dos falsos positivos (regex de enlaces anidados y de esquemas `https://` como unidades de disco), corregidos antes de emitir dictamen y documentados en la sección 4.
5. **Verificación:** dos ejecuciones propias independientes: `npm run test:unit` → `Test Files 32 passed (32); Tests 303 passed (303)` (8.32 s) y `npx vitest run tests/unit --reporter=dot` → mismo resultado (9.69 s). Contraste con `F05-T02-tester.md:20` y `F05-T02-architect.md:8` (303/303). El workflow `.github/workflows/ci.yml:48` ejecuta exactamente `npm run test:unit`, sin filtros.
6. **Pendientes:** que el Designer/Developer actualice únicamente esa cifra y el Tester re-verifique en el siguiente loop. No debe interpretarse como defecto de producto ni como fallo de la suite (303/303 en verde).
7. **Aprendizaje candidato:** las cifras de la documentación pública deben tomarse de la ejecución vigente de la tarea dependiente inmediata, nunca copiarse de reportes de fases anteriores; verificar siempre con el comando exacto que cita el README.

---

## 3. Notas de ejecución propia

- **Tiempo/alcance:** verificación estática y binaria de 18 PNG, lectura estructural del README frente a la plantilla, escaneo de rastros, verificación de ámbito/gates, descubrimiento de tests de capturas y dos corridas unitarias. Duración total aproximada: 4 min. Procesos propios: `node` (3 scripts de verificación alojados fuera de `<PROJECT_ROOT>`), `npx playwright --list`, `npx vitest`/`npm run test:unit`, `git status`/`git ls-files`/`git log`, `docker ps -a`.
- **No presenté evidencia ajena como propia:** las 7 evidencias del Designer se usaron solo como contraste; todo dictamen se apoya en las 6 evidencias `F05-T04-tester-*` generadas por mí.
- **Sin arranque de Docker:** no era necesario (capturas ya verificadas y pipeline descubierto); el emulador permanece apagado. No se usó AWS real, Git/GitHub fuera de lectura, ni secretos.

## 4. Correcciones a mis propios chequeos (transparencia)

- Mi primer regex de enlaces no contaba el badge anidado `(LICENSE)` → 23 en lugar de 24; corregido a `/\]\(([^)]+)\)/g`.
- Mi primer regex de rutas de host confundía los esquemas `https://`/`http://` con unidades de disco → 15 falsos positivos; corregido con lookbehind/lookahead, dando 0.
- Tras ambas correcciones los veredictos de README y rastros pasaron a `OK`/`CERO_RASTROS`. Ningún hallazgo del producto se basa en esos falsos positivos.

---

**Cierre del rol:** emito **`NO-PASSED`** para `CA-04` por `F05T04-T-01`. No cierro la tarea, no activo loops y no ejecuto `G-11`/`G-12`. El Architect integra este dictamen y decide la corrección documental.

---

## Addendum — Loop 2/3 (re-verificación de `F05T04-T-01`, append-only)

El dictamen **`NO-PASSED` de v1** y su registro de 7 campos permanecen íntegros y no se modifican. Este addendum añade la re-verificación independiente del único hallazgo, sin activar más loops.

| Campo | Valor |
|---|---|
| **Loop / Rol** | `v2 — Loop 2/3` · Tester independiente · OpenCode |
| **Alcance** | Solo `F05T04-T-01` (fidelidad del conteo unitario en `README.md:81`) y no-regresión de las cinco verificaciones del encargo |
| **Veredicto del addendum** | **`PASSED`** — `CA-04` queda certificado; `F05T04-T-01` **RESUELTO** y verificado por ejecución propia |
| **Evidencia propia nueva** | `reports/implementation/F05/evidence/F05-T04-tester-loop2-{unit,reverify,scope}.txt` (3 archivos) |

### 1. Re-verificación del hallazgo

| # | Verificación del encargo | Resultado | Evidencia propia |
|---|---|---|---|
| 1 | `README.md:81` dice exactamente **303 pruebas unitarias aisladas en 32 archivos**; **0** referencias a `277` | **PASSED** | `tester-loop2-reverify.txt`: `CIFRA_EXACTA_303_32=true`, `REFERENCIAS_277_EN_README_LICENSE=0`, `P7 cifra obsoleta 277=0`. |
| 2 | `npm run test:unit` propio → 303/303 en 32 archivos | **PASSED** | `tester-loop2-unit.txt`: `UNIT_EXIT=0`, `Test Files 32 passed (32)`, `Tests 303 passed (303)` (7,98 s). Coincide con la cifra publicada. |
| 3 | Sin rutas Windows, roles/harnesses ni enlaces prohibidos en README/LICENSE/capturas | **PASSED** | `tester-loop2-reverify.txt`: P1 rutas de host=0, P2 orquestación=0, P3 roles=0, P4 docs excluidas=0, P5 IDs=0, P6 nombres internos=0, PNG con 0 chunks de texto/EXIF, 24 enlaces relativos sin rotos, portada en línea 1. |
| 4 | No se tocaron código, tests, capturas, reportes ajenos, `STATE.md`, `tasks.md` ni `temporary/` | **PASSED** | `tester-loop2-scope.txt`: tras v1 solo cambiaron `README.md` (objeto de la corrección), el addendum del Designer y su evidencia. Los 18 PNG conservan sus bytes de v1; `temporary/` 71 archivos/2 dirs, idéntico. |
| 5 | Sin `G-11` / `G-12` | **PASSED** | `tester-loop2-scope.txt`: `temporary/` presente (G-11 no ejecutado), entregables aún sin commitear y último commit `f43d903` (G-12 no ejecutado), Docker con 0 contenedores del proyecto (solo `dazzling_edison`, ajeno). |

### 2. Cierre de `F05T04-T-01`

- **Reproducción original:** el README afirmaba 277; dos ejecuciones propias de v1 daban 303/303 en 32 archivos. El Designer corrigió únicamente esa línea y documentó el cambio en su addendum con evidencia `F05-T04-loop2-unit-count.txt`.
- **No-regresión comprobada:** la corrección no alteró la estructura de la plantilla, los enlaces, los badges, las 18 capturas ni la anonimización; el resto de cifras y comandos del README se mantuvieron.
- **Causa y aprendizaje del v1 se conservan:** copiar cifras de la tarea dependiente anterior; la verificación debe usar siempre el comando exacto que el propio README cita.

**Cierre del addendum:** con `F05T04-T-01` resuelto y las cinco verificaciones en verde, emito **`PASSED` para `CA-04`**. No activo más loops, no cierro la tarea (compete al Architect), no edité artefactos ajenos y no ejecuté `G-11` ni `G-12`. El `NO-PASSED` de v1 se mantiene en el registro cronológico; el dictamen vigente es este `PASSED`.
