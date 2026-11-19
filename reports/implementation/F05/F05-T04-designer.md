# `F05-T04` — Entrega Designer (capturas reales y `README.md` público)

| Campo | Valor |
|---|---|
| **Tarea / Criterio** | `F05-T04` · `CA-04` (Fase Final, riesgo 1) |
| **Versión / Loop** | `v1 — Loop 1/3` (único loop consumido) |
| **Rol / Harness** | Designer · OpenCode |
| **Fuente de verdad** | `reports/implementation/F05/F05-T04-task.md` |
| **Otras fuentes leídas** | `AGENTS.md`, `STATE.md`, `docs/sdd/packages/P-05-final-integration-and-delivery.md`, `<LAB_ROOT>/docs/templates/readme-github.md`, `reports/implementation/F05/F05-T01-{developer,architect}.md`, `reports/implementation/F05/F05-T02-architect.md`, `reports/verification/F0{2,3,4}-architect.md`, `frontend/src/{App,theme,main}.tsx`, `frontend/src/styles.css`, `frontend/package.json`, `tests/e2e/{playwright.real.config.ts,real-stack.spec.ts,vite-webserver.mjs,global-teardown.mjs}`, `tests/unit/worker/fixtures.ts`, `package.json`, `.env.example`, `backend/package.json`, `docker-compose.yml`, `docs/runbooks/development-workflow.md`, `docs/architecture/00-overview.md`, `docs/decisions/index.md`, `tools/scripts/seed/{cli,store,demo-data}.ts`, `.github/workflows/ci.yml` |
| **Estado de entrega** | **`DONE_WITH_CONCERNS`** — entregado a Tester; **no se emite `PASSED` ni se cierra la tarea** |
| **Evidencia** | `reports/implementation/F05/evidence/F05-T04-{screens-light,screens-dark,playwright-real,readme-template-check,internal-traces-scan,license,emulator-down}.txt` (7 archivos) |

> Nota: el contrato `.agents/roles/designer.md` referido en el encargo no existe en el repositorio; se aplicaron las reglas de rol y gobernanza de `AGENTS.md` §4 y las reglas obligatorias de la plantilla de README.

---

## 1. Capturas generadas

Archivos nuevos: `tests/e2e/playwright.screenshots.config.ts` y `tests/e2e/screenshots.spec.ts` (dos flujos reales: Claro y Oscuro). No se modificaron los tests ni los reportes del Tester, ni el config del E2E de integración real.

| # | Captura (prefijo `-claro` / `-oscuro`) | Vista real |
|---|---|---|
| 01 | `01-portada-{tema}.png` | Portada / banner del producto (1440×900) |
| 02 | `02-acceso-{tema}.png` | Formulario de acceso y registro |
| 03 | `03-subida-{tema}.png` | Zona de arrastre y suelta con tres fotografías listas y presets |
| 04 | `04-progreso-{tema}.png` | Barra de progreso en estado «Procesando» con sondeo activo |
| 05 | `05-comparativa-{tema}.png` | Comparativa antes/después de tres imágenes decodificadas |
| 06 | `06-metricas-{tema}.png` | Original, optimizado, ahorro real y EXIF eliminado |
| 07 | `07-descarga-individual-{tema}.png` | Acciones de descarga original / WEBP / AVIF |
| 08 | `08-zip-{tema}.png` | Historial con descarga ZIP y borrado |
| 09 | `09-borrado-{tema}.png` | Estado vacío tras borrar el lote |

**Total: 18 PNG (9 Claro + 9 Oscuro).** Todas son `page/locator.screenshot()` de la UI real; ninguna fue inventada, retocada ni generada con mocks de API. Verificación por chunks: solo `IHDR+IDAT+IEND`, **0 chunks de texto/EXIF** → sin rutas locales incrustadas en metadatos.

### Pila utilizada (idéntica a F05-T01)
`docker compose up -d` (2 GiB / 2.0 CPUs, `user=1000:1000`) → `docker cp` de CA/config/credenciales → healthcheck `ok` → `terraform init/validate/apply -var=is_emulator=true` (**11 recursos**) → `npm run seed` (3 usuarios, 3 lotes, 6 imágenes ficticias) → Playwright (backend Hono + worker y SPA Vite gestionados por el runner) → `docker compose down`. El adaptador de relay para S3 transporta la misma URL firmada y el mismo cuerpo; **no simula la API**: los bytes llegan al bucket, el worker genera WebP/AVIF/miniatura y las vistas decodifican píxeles reales.

Corrida final: `npx playwright test --config=tests/e2e/playwright.screenshots.config.ts --reporter=line` → **2 passed (18.8 s)**, `EXIT=0`. Tooling: Node `v26.13.0`, Playwright `1.65.1`, Edge (canal `msedge`), Docker `29.9.3`/Compose `v5.7.0`, Terraform `1.17.2`.

## 2. Decisiones del `README.md`

- **Fidelidad de plantilla:** portada en línea 1, fila de 5 badges (CI, React, TypeScript, DynamoDB, MIT), título, descripción de dos líneas, nota de alcance para portafolio, `Funcionalidades` → `Tecnología y estructura` (tabla de rutas reales) → `Inicio local` → `Comandos del proyecto` (tabla de scripts reales) → `Imágenes` agrupadas por flujo con `<details><summary>Otras vistas</summary>` → `Documentación` → `Licencia`.
- **Comandos reales:** el manifiesto raíz no define `dev`/`start`; se documentaron `npm run dev:backend` y `npm run dev:frontend` (y `npm start --workspace=@mediashrink/backend`, que sí existe en el workspace backend). Se omitió `npm test` porque no existe como script raíz. La línea de CI refleja checkout, Node 26, `npm ci --no-audit --no-fund`, typecheck, lint y `test:unit` (277 pruebas).
- **Arranque local:** `npm ci`, `cp .env.example .env`, `docker compose up -d`, los tres `docker cp` del runbook, `terraform init/apply -var=is_emulator=true`, `npm run seed` y los dos scripts `dev:*`. Se aclara que las credenciales son efímeras y se renuevan en cada arranque.
- **Enlaces permitidos:** solo `docs/images/…`, `docs/architecture/00-overview.md`, `docs/decisions/index.md`, `LICENSE`, `.github/workflows/ci.yml` y URLs públicas de badges/repositorio. Los 24 enlaces relativos existen; 0 rotos.
- **Nota de alcance:** datos de demostración ficticios y documentación que describe código/configuración del repositorio, sin acreditar despliegues externos activos.
- **`LICENSE`:** MIT estándar, creado en este task (`Copyright (c) 2026 linochamorro`, coherente con el repositorio público).

## 3. Estado final y gobernanza

- `typecheck` y `lint` con exit 0 sobre el snapshot final (los archivos nuevos de `tests/e2e/` están incluidos en la comprobación de tipos del workspace backend).
- Contenedor del emulador apagado, `0` contenedores y `0` redes del proyecto, puertos `3001` y `9297` sin escuchas. Queda `dazzling_edison`, contenedor ajeno preexistente, intacto.
- Sin secretos, sin rutas Windows absolutas y sin referencias a roles/herramientas de orquestación en `README.md`, `LICENSE`, capturas ni evidencia de esta tarea.
- `temporary/` intacto; reportes del Tester y del Auditor, `STATE.md` y `tasks.md` **no tocados**. No se ejecutaron el borrado efímero (`G-11`) ni la publicación (`G-12`). Sin AWS real.

## 4. Registro de problemas (7 campos cada uno)

### F05T04-01 — Secuencias octales rechazadas por TypeScript/ESLint
1. **Identificación:** `F05T04-01` (CA-04, riesgo 1).
2. **Problema:** el spec nuevo no pasaba `npm run typecheck` ni `npm run lint` (`TS1487`/error de parseo).
3. **Causa:** **DEMOSTRADA** — los literales `\0` en los marcadores XMP/IPTC de la foto sintética son secuencias octales prohibidas en el modo estricto del compilador.
4. **Solución e intentos fallidos:** sustituir `\0` por `\x00` en ambos literales. Sin intentos fallidos adicionales.
5. **Verificación:** `typecheck` y `lint` exit 0; comprobado de nuevo tras cada cambio del spec.
6. **Pendientes:** ninguno.
7. **Aprendizaje candidato:** los marcadores binarios de fixtures deben escribirse con escapes hexadecimales para sobrevivir al parser de TS.

### F05T04-02 — Falta la captura de progreso en la primera corrida
1. **Identificación:** `F05T04-02`.
2. **Problema:** `04-progreso-{tema}.png` no se generó: el helper solo capturaba cuando el valor de `<progress>` era `> 0` y `< max`, y el lote de tres imágenes pasó demasiado rápido por ese intervalo.
3. **Causa:** **DEMOSTRADA** — `capturePartialProgress` devolvía `false` sin escribir archivo; `docs/images/` tenía 16 PNG en lugar de 18.
4. **Solución e intentos fallidos:** capturar en la primera observación de la barra (`value < max`) y añadir un fallback que captura el estado real de la barra si el lote ya completó. Intento fallido previo: ampliar condición sin fallback seguía sin garantizar el archivo.
5. **Verificación:** listado final de `docs/images/`: 18 PNG; `04-progreso-claro.png` y `04-progreso-oscuro.png` muestran el estado «Procesando» real.
6. **Pendientes:** ninguno.
7. **Aprendizaje candidato:** toda captura obligatoria debe tener un camino de escritura incondicional sobre el estado real, nunca condicionado a ganar una carrera de timing.

### F05T04-03 — Comparativa sin decodificar tras la captura de progreso
1. **Identificación:** `F05T04-03`.
2. **Problema:** la corrida de reintento falló en el tema Claro: `naturalWidth > 0` nunca se cumplió en una de las dos `<img>`; el flujo Oscuro pasó.
3. **Causa:** **HIPÓTESIS CONFIRMADA POR EVIDENCIA** — al capturar el progreso se acerca la comparativa al viewport y el `IntersectionObserver` de `ImageComparison` solicita las vistas antes de que el worker escriba los optimizados; el `onError` deja el placeholder sin reintento. `04-progreso-claro.png` mostraba «Cargando vista…» y `0 B`, coherente con esa secuencia. No se simuló respuesta alguna.
4. **Solución e intentos fallidos:** tras la finalización, recargar la sesión real (token de `sessionStorage`, sin mocks), pulsar «Actualizar historial» y reabrir el lote para que `ImageComparison` se monte de nuevo con los objetos ya existentes; timeout de decodificación ampliado a 30 s. Intento fallido previo: solo ampliar el timeout no resolvía el mount anticipado.
5. **Verificación:** corrida final `2 passed (18.8s)`, `PLAYWRIGHT_EXIT=0`; `05-comparativa-{tema}.png` muestra seis imágenes reales decodificadas con ahorro y EXIF limpio.
6. **Pendientes:** el Tester debe repetir con la variable `F05_E2E_RATE_LIMIT_MAX=1000` documentada; no se acepta como defecto de producto.
7. **Aprendizaje candidato:** capturar un estado transitorio puede cambiar el comportamiento observado; reabrir la vista real tras la estabilización es más fiable que reintentar una aserción.

### F05T04-04 — Falsos positivos al escanear bytes PNG
1. **Identificación:** `F05T04-04`.
2. **Problema:** un escaneo byte a byte marcó cuatro PNG con un supuesto patrón de ruta de host.
3. **Causa:** **DEMOSTRADA** — coincidencias aleatorias de bytes dentro de los datos `IDAT` comprimidos; no había chunks de texto ni EXIF.
4. **Solución e intentos fallidos:** sustituir el escaneo de bytes crudos por un parser de chunks PNG (`IHDR`/`IDAT`/`IEND`), con recuento explícito de `tEXt`/`iTXt`/`zTXt`/`eXIf`. Intentos fallidos: el regex crudo inicial.
5. **Verificación:** 18/18 PNG con `CHUNKS=IHDR+IDAT+IEND` y `METADATA_CHUNKS=0`.
6. **Pendientes:** ninguno.
7. **Aprendizaje candidato:** la anonimización de imágenes se verifica por estructura de metadatos, no por búsqueda de texto en datos comprimidos.

### F05T04-05 — Fidelidad de comandos de arranque
1. **Identificación:** `F05T04-05`.
2. **Problema:** el encargo sugería `npm run start o dev`, pero el manifiesto raíz no define esos scripts y la plantilla incluye un `npm test` inexistente.
3. **Causa:** **DEMOSTRADA** — inspección de `package.json` raíz y de `backend/package.json`.
4. **Solución e intentos fallidos:** documentar `npm run dev:backend` / `npm run dev:frontend` y `npm start --workspace=@mediashrink/backend`; omitir `npm test`. Sin intentos fallidos.
5. **Verificación:** `F05-T04-readme-template-check.txt`: 7/7 scripts raíz verificados, `BACKEND_START=true`, `BACKEND_DEV=true`, 0 enlaces rotos.
6. **Pendientes:** ninguno.
7. **Aprendizaje candidato:** la plantilla es una estructura, no una lista de scripts: se conserva el orden y se sustituyen los ejemplos por los comandos reales.

### F05T04-06 — Ruta `/home/…` detectada como presunta ruta local
1. **Identificación:** `F05T04-06`.
2. **Problema:** el escaneo de rutas marcó los comandos `docker cp …:/home/emulator/…` del README.
3. **Causa:** **DEMOSTRADA** — es la ruta dentro del contenedor del emulador, necesaria para exportar CA y credenciales efímeras; no identifica una máquina, usuario ni directorio del host.
4. **Solución e intentos fallidos:** mantener el comando (fidelidad al runbook) y documentar la distinción en el acta de escaneo. No se eliminó por ser funcionalmente necesario.
5. **Verificación:** `F05-T04-internal-traces-scan.txt`: P1 rutas locales de host = 0; P2..P6 = 0; aclaración explícita sobre la ruta del contenedor.
6. **Pendientes:** ninguno.
7. **Aprendizaje candidato:** separar «ruta de contenedor» de «ruta de host» antes de aceptar un hallazgo de anonimización.

---

**Cierre del rol:** se entrega a **Tester** para dictamen independiente. Este reporte **no** declara `PASSED`, no cierra `F05-T04` y no ejecuta `G-11`/`G-12`.

---

## Addendum — Loop 2/3 (correctivo, F05T04-T-01)

El registro `v1 — Loop 1/3` permanece íntegro y append-only. Se incorpora únicamente la corrección documental solicitada por el dictamen `NO-PASSED` del Tester.

### Corrección aplicada

- **Fuente del hallazgo:** `reports/implementation/F05/F05-T04-tester.md`, `F05T04-T-01` (MEDIUM, `README.md:81`).
- **Cambio único en `README.md`:** `(277 pruebas unitarias aisladas)` → `(303 pruebas unitarias aisladas en 32 archivos)`. El resto del archivo no se modificó.
- **Contraste:** el Designer copió la cifra de `F05-T01` (277/277, 31 archivos) en lugar de la vigente; `F05-T02` añadió 26 pruebas (validación de URL segura) y su propio reporte ya registraba 32 archivos / 303/303 antes de redactarse el README.
- **Otras cifras revisadas:** límites de lote (20 imágenes, 15 MB), retención (30 días), Node 26 / npm 11, Terraform 1.17, React 18 y TypeScript 5.7. Todas coinciden con `.env.example`, manifiestos, workflow de CI y tooling verificado. No se encontró ninguna otra cifra desactualizada; no se inventó ningún valor.
- **Capturas, código, tests, reportes ajenos y gates:** sin cambios. `temporary/` intacto; no se ejecutaron `G-11` ni `G-12`.

### Verificación propia

- `npm run test:unit` → **exit 0**, `Test Files 32 passed (32)`, `Tests 303 passed (303)`, duración 8,33 s. Evidencia: `reports/implementation/F05/evidence/F05-T04-loop2-unit-count.txt`.
- Cotejo con `F05-T02-tester.md:20` (32/303, exit 0) y `F05-T02-architect.md:8` (303/303). El workflow de CI ejecuta exactamente `npm run test:unit` sin filtros.
- Escaneo de rastros internos tras el cambio: rutas de host **0** (la única `/home/emulator/...` es la ruta del contenedor en `docker cp`), herramientas/orquestación **0**, roles **0**, documentación excluida **0**, identificadores internos **0**, nombres internos **0**, cifra `277` **0**; 24 enlaces relativos sin rotos; portada en línea 1; 18 PNG con 0 chunks de texto/EXIF. **Resultado: 0 rastros internos.**

### Problema de este loop (7 campos)

#### F05T04-L2-01 — Conteo de pruebas copiado de un estado anterior
1. **Identificación:** `F05T04-L2-01` · `CA-04` · riesgo 1 · `README.md:81`.
2. **Problema:** la línea de CI citaba 277 pruebas cuando la ejecución vigente produce 303 en 32 archivos.
3. **Causa:** **DEMOSTRADA** — se reutilizó la cifra de `F05-T01` sin contrastarla con el reporte del Tester de `F05-T02`, que ya documentaba 303/303 antes de escribirse el README.
4. **Solución e intentos fallidos:** sustituir solo esa cifra por `303 pruebas unitarias aisladas en 32 archivos` y reejecutar el comando citado. No hubo intentos fallidos; el defecto era exclusivamente documental y la suite estaba en verde.
5. **Verificación:** ejecución propia `npm run test:unit` → 32/32 archivos y 303/303 pruebas, exit 0; escaneo posterior con 0 rastros internos.
6. **Pendientes:** re-verificación independiente del Tester en el siguiente loop; no se interpreta como defecto de producto.
7. **Aprendizaje candidato:** las cifras públicas se toman de la ejecución de la tarea dependiente inmediata y se confirman con el comando exacto que el propio README cita.

**Estado del addendum:** `DONE_WITH_CONCERNS`. No se declara `PASSED`, no se cierra `F05-T04` y no se ejecutan `G-11`/`G-12`.
