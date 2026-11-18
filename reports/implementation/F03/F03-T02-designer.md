# F03-T02 — Designer

## Loop 1 — handoff

- **Estado:** `DONE_WITH_CONCERNS`; listo para Tester.
- **Implementación:** vistas de registro/login, validación HTML alineada a F01 (8–128 en registro), errores seguros en español, cliente HTTP tipado y renovación de sesión al recuperar la SPA. Crear/confirmar/listar reintenta una vez ante 401; si refresh falla, limpia sesión. No se presentan tokens ni se escriben en logs.
- **Formas auth verificadas en código de solo lectura:** `/auth/register`, `/auth/login`, `/auth/refresh`; respuestas `{ user, accessToken, refreshToken, tokenType, expiresIn }`; errores `{ error: { code, message } }`.
- **Archivos:** `frontend/src/App.tsx`, `frontend/src/api/auth.ts`, `frontend/src/api/jobs.ts`, `tests/unit/frontend/core.test.ts`.
- **TDD:** cobertura de petición de registro, refresh con solo `refreshToken`, mensaje HTTP seguro; evidencia en `evidence/F03-T02-verification.txt`.
- **Cobertura pendiente:** prueba de interacción de formulario con navegador por Tester; pruebas deterministas actuales cubren el cliente HTTP, no el render React.

### Problema relevante (7 campos)

1. **ID:** F03-T02-P01.
2. **Título:** renovación y reintento del cliente aún requieren validación de integración.
3. **Contexto:** sesión usa `sessionStorage`; auth HTTP tiene forma confirmada, mientras el API client privado de jobs usa el contrato operativo documentado.
4. **Resultado esperado:** ante 401, refresh una vez, repetir una vez y limpiar sesión si refresh falla.
5. **Resultado observado:** lógica UI implementada; pruebas unitarias actuales prueban refresh de auth aislado, no render ni ciclo 401 completo.
6. **Impacto:** posible regresión de interfaz/estado ante respuestas reales; requiere mock-server E2E.
7. **Resolución/seguimiento:** Tester valida recuperación, repetición única, cierre de sesión y ausencia de credenciales/tokens en pantalla/log.

## Addendum append-only — evidencia E2E compartida

- El flujo Playwright mock de login, selección/subida y acciones del lote imprimió `ok 1`. La envoltura PowerShell quedó pendiente de cierre y se interrumpió después del resultado; sin listener residual. La prueba no cubre aún un 401 seguido de refresh. Ver `evidence/F03-playwright.txt`.
