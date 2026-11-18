# F03-T01 — Designer

## Loop 1 — handoff

- **Estado:** `DONE_WITH_CONCERNS`; listo para revisión independiente de Tester.
- **Dirección visual:** “Taller editorial”, indicada como aprobada por Lino: fondo cálido claro, panel amplio, acento verde; modo claro predeterminado y alternador persistente claro/oscuro.
- **Implementación:** SPA en español con navegación semántica, jerarquía editorial, controles de teclado/foco, responsive en móvil y preferencia `prefers-reduced-motion`.
- **Archivos:** `frontend/src/App.tsx`, `frontend/src/theme.ts`, `frontend/src/styles.css`, `frontend/index.html`.
- **TDD:** la prueba inicial RED falló al importar el módulo aún inexistente `api/auth`; suite GREEN actual en `tests/unit/frontend/core.test.ts` incluye defecto de tema no válido y persistencia claro/oscuro.
- **Evidencia/verificación:** ver `evidence/F03-T01-verification.txt`; build/typecheck y prueba unitaria focal pasan.
- **Cobertura pendiente:** revisión visual en navegador/contraste con Tester; Vitest se ejecuta sin DOM/RTL disponible en los manifiestos autorizados.

### Problema relevante (7 campos)

1. **ID:** F03-T01-P01.
2. **Título:** falta prueba de renderizado React en entorno DOM.
3. **Contexto:** dependencias permitidas no incluyen Testing Library ni jsdom; manifiesto raíz está fuera del ámbito.
4. **Resultado esperado:** comprobar foco, selección de tema y layout mediante renderizado automatizado.
5. **Resultado observado:** pruebas unitarias cubren persistencia/contratos puros; no montan React.
6. **Impacto:** riesgo visual residual; comportamiento DOM queda pendiente de Tester/navegador.
7. **Resolución/seguimiento:** no añadir dependencias fuera de autorización; Tester debe ejecutar revisión visual y teclado en su entorno.

## Addendum append-only — evidencia E2E compartida

- El escenario Playwright de `tests/e2e/frontend-flow.spec.ts` mostró `ok 1` en navegador Edge/Chromium contra rutas simuladas. El proceso runner no terminó limpiamente en la envoltura PowerShell; se interrumpió tras el PASS del escenario y se confirmó sin listener en 4182. Ver `evidence/F03-playwright.txt`; cierre formal del proceso queda por repetir por Tester.
