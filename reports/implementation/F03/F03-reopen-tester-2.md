
---

## Addendum de reapertura 2 — Tester independiente (2026-11-18)

### Lint global

- Comando: `npm run lint`
- `EXIT_CODE=0`
- Resultado: ESLint global terminó sin diagnósticos. Evidencia: `evidence/F03-reopen-lint-2.txt`.

### Playwright completo

- Comando: `npx playwright test --config=tests/e2e/playwright.config.ts --reporter=list --workers=1`
- Puerto independiente comprobado disponible antes del arranque: `50704` (`F03_E2E_PORT=50704`).
- Resultado observable: se enumeraron los 3 casos, pero los tres fallaron en ~3 ms al no existir el ejecutable Chromium configurado (`chrome-headless-shell.exe` bajo el directorio runtime de Playwright). Cada `error-context.md` identifica `browserType.launch: Executable doesn't exist`.
- No hubo resumen final ni `EXIT_CODE` final de Playwright. El proceso de esta sesión Tester quedó ejecutándose >120 s; se interrumpió únicamente la sesión de prueba propia para limitar el cuelgue. El wrapper de sesión reportó `EXIT_CODE=1` tras la interrupción; **no se presenta como código final de Playwright**. No se intentó terminar procesos externos o ajenos. La consulta de inventario de procesos fue denegada por el entorno.
- Evidencia de salida y limitación: `evidence/F03-reopen-playwright-2.txt`.
- Evidencia de fallo por caso: `evidence/playwright-results/frontend-flow-*/error-context.md`.

### Artefactos de raíz

- `test-results/` no se generó en la raíz; Playwright configura su `outputDir` en `reports/implementation/F03/evidence/playwright-results`.

### Dictamen

- Lint: PASSED.
- Playwright cierre limpio: NO-PASSED / inconcluso en código de salida; los tres casos no ejecutaron su contenido porque falta Chromium y el proceso no emitió resumen antes de interrumpir la sesión propia.
- Para reintentar hace falta que el entorno proporcione/instale el Chromium requerido para la versión Playwright configurada y luego volver a correr el comando completo. No se modificó código ni se usó Docker.

### Addendum de seguimiento — corrida con Chromium disponible (2026-11-18)

- Chromium instalado para Playwright: `npx playwright install chromium`, `EXIT_CODE=0`.
- Corrida completa solicitada: `npx playwright test --config=tests/e2e/playwright.config.ts --reporter=list --workers=1`; puerto propio `50820`.
- Los tres casos ejecutaron y mostraron `ok` (1.5 s, 25.3 s y 1.0 s). Sin embargo, tras >180 s no apareció el resumen final ni el `EXIT_CODE` de Playwright. Se interrumpió únicamente la sesión Tester propia al alcanzar el plazo razonable; el wrapper devolvió 1 por la interrupción y no se atribuye como resultado de Playwright.
- Tras la interrupción se comprobó que el PID del webServer anunciado (`14832`), el worker (`16960`) y el puerto `50820` ya no estaban activos; por tanto no queda runner/listener de esta corrida. Esto verifica limpieza posterior a la interrupción, pero **no demuestra teardown natural**.
- Salida completa capturada hasta el bloqueo, más limitación: `evidence/F03-reopen-playwright-3.txt`.
- Error de la corrida anterior antes de instalar Chromium, íntegro en `evidence/playwright-results/frontend-flow-*/error-context.md`: `browserType.launch: Executable doesn't exist at ...chrome-headless-shell.exe`. Con Chromium instalado, ese error queda eliminado.

**Estado final Tester:** lint `EXIT_CODE=0`; casos E2E `3/3 ok`; gate de runner/teardown natural sigue NO-PASSED porque no se obtiene resumen final ni código de salida dentro de 180 s. No se tocaron procesos ajenos ni código de producto.

--- Addendum reapertura loop 3 — Tester independiente (2026-11-18) ---

### Ejecución

- Lint global: `npm run lint`, **EXIT_CODE=0**, sin diagnósticos. Evidencia íntegra: `evidence/F03-reopen-loop3-lint.txt`.
- Playwright: `npx playwright test --config=tests/e2e/playwright.config.ts --reporter=list --workers=1`; navegador Microsoft Edge (`channel: msedge`), un worker, puerto aislado `51744` (sin listener previo). **EXIT_CODE=1** natural, con finalización `2026-11-18T06:27:13.1249559-05:00`; evidencia íntegra stdout/stderr y código: `evidence/F03-reopen-loop3-playwright.txt`.
- Resumen Playwright: `3 passed (36.7s)`; los tres escenarios (tema persistente, flujo de registro a logout, y validación/teclado) mostraron `ok`.
- El cierre global falló después de las pruebas: `Error: tests\e2e\global-teardown.mjs: file must export a single function.` A continuación el webServer informó error interno de Vite `ERR_STREAM_WRITE_AFTER_END` / `Cannot set headers after they are sent to the client`, y terminó Node.js. El runner reportó un error fuera de los tests y código 1. Por tanto los casos funcionales pasan, pero el gate de ejecución Playwright queda **NO-PASSED**.
- Limpieza observable posterior: para `127.0.0.1:51744`, `Get-NetTCPConnection` reportó cero listeners y la sonda TCP no pudo conectar (conexión rechazada/timeout). Evidencia: `evidence/F03-reopen-loop3-endpoint.txt`.
- La ruta exacta del teardown está escrita como `POST /__f03_internal/shutdown` y remite el token `x-f03-shutdown-token`. Esta ejecución no obtuvo respuesta HTTP de teardown: Playwright rechazó el módulo de global-teardown antes de invocarlo. No inferir 204/404 de esta corrida.

### Problema relevante (7 campos)

1. **Identificación:** F03 reapertura loop 3, gate de cierre Playwright.
2. **Problema:** los tres tests pasan, pero la etapa de global teardown no acepta el módulo `global-teardown.mjs`; la ejecución acaba con código 1. El webServer también emite errores `ERR_STREAM_WRITE_AFTER_END` durante su cierre.
3. **Causa:** demostrada para el fallo principal por mensaje explícito del runner: el archivo debe exportar una única función; el archivo inspeccionado contiene lógica ejecutada a nivel de módulo y no un export de función. Relación causal del error de Vite con el teardown: hipótesis, no aislada por esta verificación.
4. **Solución/intentos:** no se modificó código ni configuración, por independencia y alcance del encargo.
5. **Verificación independiente:** corrida completa contra Microsoft Edge, 1 worker; 3/3 casos `ok`; salida natural `EXIT_CODE=1`; puerto comprobado cerrado después. Evidencia indicada arriba.
6. **Pendientes:** corregir la forma de exportación del global teardown y volver a ejecutar esta suite completa; investigar el error de respuesta Vite si persiste.
7. **Aprendizaje candidato:** `SOLO_LOCAL` — validar el formato de exportación del global teardown de Playwright antes de atribuir un HTTP 404 a la ruta o al token.

### Dictamen

- Lint: **PASSED**.
- Playwright y cierre limpio: **NO-PASSED** (EXIT_CODE=1), aunque la suite funcional produjo 3/3 `passed`.
- Confirmación solicitada: endpoint/puerto de esta corrida ya no escucha; no hubo respuesta HTTP del endpoint en el cierre fallido.
- No se editó código, configuración ni pruebas. No se identificaron ni detuvieron procesos ajenos.
