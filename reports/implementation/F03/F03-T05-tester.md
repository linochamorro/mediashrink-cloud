# F03-T05 — Dictamen Tester

- **Criterio CA-05:** NO-PASSED.
- **Evidencia propia:** `evidence/F03-T01-T06-tester-run.md`; el spec contiene fixtures con ahorro negativo (-20 %) y `exifStripped: true`, y aserciones planeadas para esos textos; unitarias, typecheck y build pasan.
- **Cobertura:** spec no concluyó. No se acreditaron visualización de comparativa original/optimizada, métricas por imagen/lote, valores cero, ni badge dependiente de EXIF false/true.
- **Problema (7 campos):**
  1. **ID:** F03-T05-P01.
  2. **Título:** comparativa y métricas honestas sin verificación de navegador completada.
  3. **Contexto:** el mock E2E incluye negativo y EXIF limpio pero no llegó a resultado; no fixture de ahorro cero/EXIF false.
  4. **Resultado esperado:** observar comparación y valores reales, sin ocultar negativos o cero, con badge condicionado por exifStripped.
  5. **Resultado observado:** existían aserciones planeadas para negativo/EXIF; no hay resultado exitoso ni cobertura de cero/false.
  6. **Impacto:** CA-05 no acreditado.
  7. **Resolución/seguimiento:** completar ejecución y agregar escenarios de ahorro cero y EXIF no limpio en el mock E2E.
- **Resultado:** NO-PASSED.

## Addendum Tester — Loop 2 (2026-11-17)
- No se obtuvo nueva evidencia de comparativa/métricas/EXIF: el caso que contiene esos flujos no inició por colisión de 43991, exit 1 previo al test. CA-05 conserva `NO-PASSED`. Evidencia: `evidence/F03-loop2-tester-playwright.txt`.

## Dictamen Tester — Loop 3 final (2026-11-17)
- **CA-01..CA-06: NO-PASSED.** Se inició una corrida nueva con puerto 44237 libre y comando `npx playwright test --config=tests/e2e/playwright.config.ts --reporter=line --workers=1`. Playwright anunció los tres casos y llegó al tercero (`validación de drag & drop, teclado y errores de archivos`), donde quedó sin salida ni resumen durante más de ocho minutos. Se detuvo únicamente la sesión propia al cumplirse el límite solicitado; el proceso terminó por interrupción (código de la sesión 1), por lo que **no se atribuye un exit code final de Playwright ni un resultado de casos**. Log con stdout/stderr disponible en `evidence/F03-loop3-tester-final-playwright.txt`.
- **Causa observada:** bloqueo/espera indefinida dentro del tercer caso E2E; no se obtuvo traza interna ni error funcional que permita precisar el paso. El wrapper no dejó listener en `127.0.0.1:44237` (`LISTENER_AFTER=NO`). La prueba no concluyó limpiamente.
- **Hallazgo (7 campos):** 1) ID `F03-LOOP3-E2E-01`; 2) título: suite Playwright no finaliza en ocho minutos; 3) contexto: corrida limpia única, puerto 44237 previamente libre, wrapper vigente; 4) esperado: los tres casos finalizan y Playwright retorna exit 0; 5) observado: los tres casos iniciaron, el tercero no produjo avance/salida final, sesión detenida al límite, sin listener residual; 6) impacto: gates browser CA-01..CA-06 no quedan certificados por esta corrida; 7) seguimiento: Architect registra NO-PASSED/BLOCKED conforme al último loop, Designer/propietario investiga hang del tercer caso en una autorización posterior. No se cambiaron código, tests ni configuración.
- **Interoperabilidad:** F02 permanece bloqueada por decisión de Lino; no se accedió a API real ni Docker y el mock no certifica integración real.
- **Verificaciones npm:** esta continuación fue interrumpida por el usuario antes de completar la secuencia; no se afirma resultado nuevo de typecheck, build ni unitarias.
- **Estado global:** NO-PASSED. No procede declarar la suite PASSED ni cerrar la interoperabilidad.
