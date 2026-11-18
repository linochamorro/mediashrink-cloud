
--- Tester independiente reapertura — 2026-11-18 ---
Comando lint: npm run lint
EXIT_CODE lint: 1
Diagnóstico: tests/unit/frontend/core.test.ts:6:37 — @typescript-eslint/no-unused-vars: Theme is defined but never used. Evidencia: evidence/F03-reopen-lint.txt.
Comando Playwright: npx playwright test --config=tests/e2e/playwright.config.ts --reporter=list --workers=1; puerto dinámico 50440, libre antes de iniciar.
Salida parcial: 3/3 casos `ok` (tema 9.8s; flujo registro/refresh/upload/polling/resultados/descargas/logout 25.7s; validación/teclado 961ms). No hubo resumen final.
Cierre: el proceso no terminó tras más de 120s, excediendo gracefulShutdown=5000ms. Se interrumpió únicamente la sesión propia 94664; el wrapper de shell retornó 1 por interrupción, NO es EXIT_CODE final de Playwright. PID de webServer anunciado 18136; PID worker Playwright 20248. Consulta sistema de PID/puerto denegada; no se terminó ningún proceso ajeno.
Dictamen: NO-PASSED para gate Playwright de reapertura, porque falta salida limpia y exit code 0 pese a 3 casos ok. Evidencia de stdout parcial: evidence/F03-reopen-playwright.txt. Config dirige outputDir a reports/implementation/F03/evidence/playwright-results.

--- Tester independiente reapertura — corrida posterior — 2026-11-18 ---
Config confirmada por lectura: chromium con channel msedge; gracefulShutdown SIGTERM/8000ms; wrapper con cierre de conexiones y fallback de salida a 7s. Lint corregido: evidence/F03-reopen-lint-2.txt, EXIT_CODE=0.
Playwright usó el puerto aleatorio 50929, sin listener antes de iniciar. Los 3 casos reportaron `ok` (1.4s, 28.4s y 1.0s), pero en 120s después del tercer caso no llegó el resumen ni un EXIT_CODE de Playwright. La sesión propia se interrumpió; el shell devolvió 1, que no representa el exit code de Playwright.
El PID 20396 seguía escuchando en 127.0.0.1:50929: el fallback no había comenzado, pues no se había entregado una señal de shutdown al wrapper. Windows denegó consultar la línea de comandos del proceso; queda sin determinar qué espera impidió que el runner pidiera el cierre. Tras interrumpir la sesión propia, se gestionó únicamente el webServer de esta corrida (PID 20396); el puerto quedó sin listener.
Dictamen: NO-PASSED para cierre limpio/EXIT_CODE=0. Tres casos funcionales `ok` no bastan para aprobar el gate de proceso. Evidencia: evidence/F03-reopen-playwright-2.txt.

---

## Addendum final de reapertura — Tester independiente (2026-11-18)

### Playwright

- Comando: `npx playwright test --config=tests/e2e/playwright.config.ts --reporter=list --workers=1`.
- Edge local (`channel: msedge`), `workers=1`, puerto por corrida `48585`; listener ausente antes de arrancar.
- Los tres casos E2E mostraron `ok` (1.5 s, 25.9 s, 1.1 s).
- Global teardown intentó `POST /__f03_internal/shutdown` y falló con `F03 webServer rejected teardown (HTTP 404)` en `global-teardown.mjs:22`. La sesión siguió abierta sin resumen final. Se interrumpió únicamente la sesión de esta corrida tras confirmar el fallo. El harness devolvió `EXIT_CODE=1`; **no es un código natural de Playwright**, por lo que EXIT_CODE natural y resumen completo quedan sin evidencia.
- Estado posterior: `Get-NetTCPConnection` no encontró listener en `127.0.0.1:48585`; POST al endpoint devolvió HTTP 404. No se detuvieron procesos ajenos.
- Evidencia íntegra de salida y comprobación: `evidence/F03-reopen-final-playwright.txt`.

### Lint global

- Comando `npm run lint`: `EXIT_CODE=0`, sin diagnósticos. Evidencia vigente: `evidence/F03-reopen-final-lint.txt`.

### Dictamen

- Lint: **PASSED**.
- Playwright: **NO-PASSED** para cierre limpio y código natural 0. Los tres casos funcionales pasan, pero el teardown autenticado no recibió el 204 esperado y el runner no imprimió resumen ni finalizó naturalmente.
- No se implementó código ni se afectaron procesos ajenos.

### Addendum diagnóstico solicitado — HTTP 404 de teardown

Se comprobó el endpoint con un proceso propio iniciado desde `tests/e2e/vite-webserver.mjs`, puerto aleatorio y token válido generado solo para esa corrida. `POST /__f03_internal/shutdown` devolvió HTTP 404, cabeceras `vary: Origin`, `content-length: 0`, conexión keep-alive y cuerpo vacío; no incluyó `x-f03-server-shutdown: accepted`. El servidor no salió naturalmente durante 10 s y seguía sin completar el cierre; se envió SIGTERM únicamente al hijo de diagnóstico, tras lo cual el listener quedó ausente. Datos completos: `evidence/F03-reopen-final-endpoint.txt`.

En la corrida Playwright `48585`, los tres tests terminaron `ok`, globalTeardown falló con HTTP 404, el listener se observó ausente al comprobar después y el endpoint posterior respondió 404. La sesión Playwright quedó colgada; su wrapper de ejecución se cerró con 1 al interrumpir la sesión propia. **No hay EXIT_CODE natural de Playwright ni resumen completo**, por lo que el gate solicitado sigue NO-PASSED. La distinción entre listener posterior ausente y el 404 con listener durante la comprobación aislada queda registrada explícitamente.
