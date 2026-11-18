# F03-T05 — Designer

## Registro documental de reapertura acotada — 2026-11-18

- **Estado Designer:** `DONE_WITH_CONCERNS` como registro de evidencia; el criterio de aceptación no se declara satisfecho.
- **Criterio CA-05:** comparativa antes/después; métricas reales por lote e imagen que muestren ahorro positivo, cero y negativo; badge de EXIF condicionado por `exifStripped`.
- **Artefactos revisados:** `F03-T05-task.md`, `F03-T05-tester.md`, `evidence/F03-loop3-tester-final-playwright.txt` y `evidence/F03-loop3-playwright-rerun.txt`.
- **Hallazgo sustentado:** el dictamen Tester previo describe fixtures con ahorro negativo y EXIF limpio, pero indica que la prueba no concluyó y que no hay evidencia de escenarios de ahorro cero ni EXIF no limpio. La corrida final disponible no contiene resumen de casos.
- **Límite de este registro:** no hay evidencia nueva de reapertura que permita confirmar visualización, datos reales o resultado de navegador. La presencia de un fixture/aserción planeada no se trata como comprobación de comportamiento. No se ejecutaron pruebas ni se modificó código al crear este reporte.
- **Resultado de rol:** `DONE_WITH_CONCERNS` únicamente para documentar el estado comprobable; CA-05 requiere evidencia Tester independiente concluida.

## Addendum append-only — reapertura final (2026-11-18)

- **Evidencia nueva revisada:** `F03-final-tester.md` y `evidence/F03-final-reopen-playwright.txt` documentan 3 escenarios completados y `EXIT_CODE=0` natural; el escenario de resultados/métricas concluyó en la corrida final.
- **Actualización Designer:** `DONE` respecto al registro de CA-05 en esta reapertura, conforme al dictamen Tester final `PASSED` de Playwright. Se conserva el `NO-PASSED` de Loop 3 como historial, sin sustituirlo ni borrarlo.
- **Alcance:** no se atribuye al resumen agregado una lista de valores EXIF/ahorro que no conste en la evidencia citada, ni se infiere procesamiento real de imágenes desde el mock.
- **Límite:** build, typecheck y pruebas unitarias no se reejecutaron en esta reapertura. No se ejecutaron comandos de verificación ni se modificó código al redactar este addendum.
