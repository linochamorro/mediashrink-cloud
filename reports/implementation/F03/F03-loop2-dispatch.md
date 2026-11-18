# F03 — Despacho de corrección Loop 2/3

- Fecha: 2026-11-17
- Motivo: Tester emitió `NO-PASSED` en CA-01…CA-06 (dictámenes `F03-T01..T06-tester.md`).
- Baseline: `reports/implementation/F03/evidence/F03-T01-T06-tester-run.md`.
- Salidas iniciales confirmadas por Tester: typecheck PASSED, build PASSED, 12/12 unitarias PASSED; Playwright NO-PASSED (1) puerto 4181 ocupado; (2) config temporal ejecutó npm desde `%TEMP%` sin `package.json`; (3) el spec no comprueba todos los flujos requeridos.
- Regla de independencia: Designer corrige código y tests; Tester reejecuta sin cambios en producto/tests; Auditor reevalúa hallazgos pertinentes. Architect no implementa ni ejecuta pruebas.

## Acciones requeridas al Designer (Loop 2/3)

1. Corregir `tests/e2e/playwright.config.ts` en el ámbito permitido para usar puerto aislado estable y `webServer.cwd` de la raíz del repo; evitar config temporal cuyo `cwd` dependa del directorio temporal.
2. Completar suite Playwright mock server: tema Claro inicial/Dark persistente; registro/login/refresh y errores; validación MIME/tamaño/cantidad + preset; POST/upload/confirm; polling con transición y estados terminales; comparativa lado a lado; ahorro negativo y cero; badge EXIF basado en respuesta; descarga individual y ZIP; borrado confirmado/rechazado; estados de error y retry.
3. Mantener el doble HTTP determinista y sin Docker/API real; fixtures de imagen válidos para el formato que se afirma visualizar. El mock acredita interacción UI, no privacidad efectiva EXIF ni interoperabilidad F02.
4. Resolver concerns locales del reporte Auditor que afectan confidencialidad en logout/expiración, refresh consistente, URL presignada (validación de HTTPS/origen acorde a configuración disponible) y errores públicos seguros; documentar límites fuera del alcance F03 sin cambiar contratos congelados.
5. Mantener el flujo TDD y generar reporte Designer Loop 2 append-only, evidencias por ejecución, lista de archivos y temas no resueltos. No modificar `types.generated.ts`, backend, STATE/tasks ni manifiestos raíz.

## Bloqueo de integración entre fases

F02 observado implementa POST `/jobs` con forma `images` y respuesta `{job}`; el cliente F03 sigue el acuerdo `files` y `{job, uploads}` para presigned PUT. Esto se mantiene fuera del loop correctivo local porque backend/** es ámbito F02. El equipo F02 debe confirmar/adoptar el contrato acordado; hasta entonces CA de interoperabilidad real permanece sin certificar. La prueba mock F03 no puede cerrar esta divergencia.

## Decisión posterior de Lino

2026-11-17: Lino eligió que **F02 adopte el acuerdo F03** y F03 quede pendiente hasta confirmación de F02. No se cambia el alcance ni se toca backend desde este harness. El bloqueo HIGH de interoperabilidad exige evidencia/confirmación del propietario F02.

## Checkpoint de implementación Loop 2

El Designer ejecutó Playwright con la suite ampliada. El caso 2 falló al esperar la imagen original antes de que la vista lazy entrara en viewport; el caso 3 quedó incompleto por interrupción del proceso propio. Hubo colisión de puertos en 4187 y luego se cambió config a 4201 sin corrida final. En esta iteración aún no hay reporte Designer final ni salidas build/typecheck/unitarias. Continuación pendiente: reparar la navegación/espera de preview y completar corrida limpia de toda la suite antes de handoff a Tester.

## Diagnóstico adicional de Playwright — puerto aislado

- Las corridas anteriores encontraron listeners en `127.0.0.1:4201` (PID 18456) y `:4202` (PID 12504), ajenos/no atribuibles con seguridad al agente; no se terminaron.
- A fecha del chequeo 2026-11-17, `127.0.0.1:43817` no tenía listener (`Get-NetTCPConnection`/`netstat` sin resultado). Loop 2 debe usar `F03_E2E_PORT=43817` para una sola ejecución y registrar el exit code de Playwright en la misma evidencia. No matar los listeners 4201/4202.
