# F03-T03 — Dictamen Tester

- **Criterio CA-03:** NO-PASSED.
- **Evidencia propia:** `evidence/F03-T01-T06-tester-run.md`; unitarias cubren MIME/tamaño/cantidad y los metadatos del cliente; typecheck/build pasan.
- **Cobertura:** no se observó drag & drop, selector de tres presets ni rechazo visible antes de solicitud. El spec usa el file picker y pretende cargar un PNG, pero no terminó; límites UI predeterminados (15 MB/20 imágenes) no cubren overrides configurados.
- **Problema (7 campos):**
  1. **ID:** F03-T03-P01.
  2. **Título:** validación previa visible y flujo de carga no verificados en navegador.
  3. **Contexto:** E2E sin resultado; validación unitaria aislada sí ejecutada. El reporte Designer declara defaults locales.
  4. **Resultado esperado:** demostrar rechazo visible de MIME, tamaño y cantidad antes de POST, además de selector/presets y drop.
  5. **Resultado observado:** solo helpers unitarios pasan; no hay evidencia browser. Los defaults no reflejan necesariamente límites por despliegue.
  6. **Impacto:** CA-03 parcialmente cubierto; riesgo de discrepancia de límites.
  7. **Resolución/seguimiento:** completar casos E2E de validación/drag-drop/presets y acordar fuente runtime de límites; sin cambios Tester.
- **Resultado:** NO-PASSED.

## Addendum Tester — Loop 2 (2026-11-17)
- El caso de drag & drop, teclado y validaciones no llegó a iniciar por la misma colisión del puerto 43991; exit 1 antes del test. CA-03 conserva `NO-PASSED`. El caso 2 que también contenía selección/preset tampoco inició. Evidencia: `evidence/F03-loop2-tester-playwright.txt`.

## Dictamen Tester — Loop 3 final (2026-11-17)
- **CA-01..CA-06: NO-PASSED.** Se inició una corrida nueva con puerto 44237 libre y comando `npx playwright test --config=tests/e2e/playwright.config.ts --reporter=line --workers=1`. Playwright anunció los tres casos y llegó al tercero (`validación de drag & drop, teclado y errores de archivos`), donde quedó sin salida ni resumen durante más de ocho minutos. Se detuvo únicamente la sesión propia al cumplirse el límite solicitado; el proceso terminó por interrupción (código de la sesión 1), por lo que **no se atribuye un exit code final de Playwright ni un resultado de casos**. Log con stdout/stderr disponible en `evidence/F03-loop3-tester-final-playwright.txt`.
- **Causa observada:** bloqueo/espera indefinida dentro del tercer caso E2E; no se obtuvo traza interna ni error funcional que permita precisar el paso. El wrapper no dejó listener en `127.0.0.1:44237` (`LISTENER_AFTER=NO`). La prueba no concluyó limpiamente.
- **Hallazgo (7 campos):** 1) ID `F03-LOOP3-E2E-01`; 2) título: suite Playwright no finaliza en ocho minutos; 3) contexto: corrida limpia única, puerto 44237 previamente libre, wrapper vigente; 4) esperado: los tres casos finalizan y Playwright retorna exit 0; 5) observado: los tres casos iniciaron, el tercero no produjo avance/salida final, sesión detenida al límite, sin listener residual; 6) impacto: gates browser CA-01..CA-06 no quedan certificados por esta corrida; 7) seguimiento: Architect registra NO-PASSED/BLOCKED conforme al último loop, Designer/propietario investiga hang del tercer caso en una autorización posterior. No se cambiaron código, tests ni configuración.
- **Interoperabilidad:** F02 permanece bloqueada por decisión de Lino; no se accedió a API real ni Docker y el mock no certifica integración real.
- **Verificaciones npm:** esta continuación fue interrumpida por el usuario antes de completar la secuencia; no se afirma resultado nuevo de typecheck, build ni unitarias.
- **Estado global:** NO-PASSED. No procede declarar la suite PASSED ni cerrar la interoperabilidad.
