# F03 — Despacho de corrección Loop 3/3 (último intento)

- Fecha: 2026-11-17
- Motivo: Tester Loop 2 emitió `NO-PASSED` CA-01…CA-06. Evidencia: `reports/implementation/F03/evidence/F03-loop2-tester-playwright.txt`.
- Resultado del Loop 2: el caso de tema terminó funcionalmente `1 passed`, pero Playwright cerró con error de teardown del plugin `webServer` tras 45 s. El listener propio persistió y bloqueó los demás tests; Tester detuvo solo el PID atribuido a su propia ejecución y verificó que el listener desapareció. Casos 2/3 y suite no iniciaron.
- DoD local restante: suite Playwright completa, salida final exit 0, sin proceso de servidor huérfano; build/typecheck/unitarias en verde; reporte Designer Loop 3 con pruebas y problemas obligatorios.

## Corrección final requerida al Designer

1. Resolver de forma determinista el teardown del servidor Vite mock en Windows, sin cambiar manifiestos raíz ni afectar procesos ajenos. Preferencia: wrapper de servidor en `tests/e2e/**` que propague SIGTERM a su hijo, o mecanismo equivalente aislado y verificable.
2. Ejecutar por separado solo si ayuda a diagnosticar; después completar una corrida única de los tres casos y registrar comando, puerto libre, exit code Playwright y confirmación de no listener residual.
3. No ampliar requisitos; revisar las aserciones de interacción existentes y corregir solo fallos reproducidos. Mantener TDD, conservar historial append-only y entregar reportes de Designer para las tareas afectadas.
4. Si el Loop 3 termina `NO-PASSED`, no se abre un cuarto loop: Architect devuelve `BLOCKED` con causa/evidencia.

## Bloqueo externo vigente

Lino decidió que F02 adopte `F03-api-contract-agreement.md` y F03 permanezca pendiente hasta confirmación de F02. No modificar `backend/**`. Aunque mocks/browser pasen, la interoperabilidad real sigue sin certificar y el Auditor HIGH no se puede retirar sin confirmación/evidencia F02.

## Checkpoint del wrapper (2026-11-17)

- `tests/e2e/vite-webserver.mjs` inicia Vite por API y registra cierre en SIGINT/SIGTERM; `playwright.config.ts` lo usa como `webServer`.
- La suite completa inició los tres casos; caso 1 y 2 avanzaron y caso 3 quedó activo cuando el Architect solicitó checkpoint. El proceso propio se interrumpió antes del resumen, exit 1 por interrupción. No hay resultado final ni se atribuye un fallo funcional.
- No se encontró listener residual en los puertos aislados comprobados por Designer. Sigue pendiente una corrida sin interrupción, reporte/evidencia Designer Loop 3, y Tester independiente.
