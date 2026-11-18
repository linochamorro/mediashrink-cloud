# F03-T04 — Designer

## Registro documental de reapertura acotada — 2026-11-18

- **Estado Designer:** `DONE_WITH_CONCERNS` como registro de evidencia; el criterio de aceptación no se declara satisfecho.
- **Criterio CA-04:** polling de `GET /jobs/:id` aproximadamente cada 2 s mientras el trabajo no sea terminal; cese al llegar a estado terminal, desmontaje o error controlado; representación de `PENDING`, `PROCESSING`, `COMPLETED`, `PARTIAL` y `FAILED`.
- **Artefactos revisados:** `F03-T04-task.md`, `F03-T04-tester.md`, `evidence/F03-loop3-tester-final-playwright.txt`, `evidence/F03-loop3-playwright-rerun.txt` y `F03-loop3-dispatch.md`.
- **Hallazgo sustentado:** los dictámenes Tester disponibles registran que el mock existente no acreditó secuencias de polling, frecuencia, cese ni los cinco estados. La última corrida registrada se detuvo sin resumen Playwright; véase `evidence/F03-loop3-tester-final-playwright.txt`.
- **Límite de este registro:** no se aportó evidencia nueva de una corrida de reapertura ni una inspección visual/funcional Designer verificable. Por tanto, no se afirma que el polling se haya corregido o validado. No se ejecutaron pruebas ni se modificó código al crear este reporte.
- **Resultado de rol:** `DONE_WITH_CONCERNS` únicamente para documentar el estado comprobable; CA-04 permanece pendiente de dictamen Tester independiente con corrida concluida.

## Addendum append-only — reapertura final (2026-11-18)

- **Evidencia nueva revisada:** `F03-final-tester.md` y `evidence/F03-final-reopen-playwright.txt` registran la corrida final con 3 passed y `EXIT_CODE=0` natural. El segundo escenario incluye polling y el Tester emitió `PASSED` para Playwright/cierre.
- **Actualización Designer:** `DONE` respecto al registro de CA-04 en esta reapertura según la corrida independiente concluida. El `NO-PASSED` de Loop 3 permanece intacto como dictamen histórico de una corrida anterior.
- **Alcance:** no se infieren del resumen agregado intervalos aproximados de 2 s ni estados intermedios concretos que el reporte Tester no enumera.
- **Límite:** build, typecheck y pruebas unitarias no se reejecutaron en esta reapertura; no se declara interoperabilidad real con backend desde el mock. No se ejecutaron comandos de verificación ni se modificó código al redactar este addendum.
