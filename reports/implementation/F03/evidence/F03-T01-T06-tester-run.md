# Evidencia propia Tester — P-03

- Fecha/hora local: 2026-11-17 (zona America/Lima).
- Alcance: frontend unit, frontend typecheck/build y Playwright mock. Sin Docker ni API real.
- Unitarias: `npx vitest run tests/unit/frontend` — exit 0, 2 archivos, 12/12 tests.
- Typecheck: `npm run typecheck --workspace=@mediashrink/frontend` — exit 0.
- Build: `npm run build --workspace=@mediashrink/frontend` — exit 0, Vite 5.4.21 produjo `frontend/dist`.
- Playwright original: `npx playwright test --config=tests/e2e/playwright.config.ts --reporter=line --output=reports/implementation/F03/evidence/playwright-artifacts` — el runner reportó 1 test/1 worker, pero la sesión no terminó ni produjo resultado; la ejecución inicial estaba bloqueada por `http://127.0.0.1:4181 already used` según el checkpoint recibido. No se atribuye PASS.
- Playwright aislado: config temporal `<USER_HOME>\AppData\Local\Temp\f03-playwright-4182.config.mjs`, mismo testDir/spec, baseURL y Vite en 4182; `cwd` del webServer apuntó a la raíz del repo. 4182 estaba libre al iniciar. El runner reportó `[1/1] ... frontend-flow.spec.ts`, pero permaneció sin resultado por más de un minuto y se interrumpió usando exclusivamente la sesión iniciada por Tester. No se terminó ningún proceso ajeno.
- Alcance de spec E2E declarado: login, subida, confirmación, métrica negativa, EXIF, botón ZIP y borrado. No incluye aserciones de registro/refresh, estados polling, descarga individual, errores ni tema. La ejecución no completó, por tanto ninguna de esas aserciones queda acreditada.
- Integración real: no ejecutada. La divergencia entre el contrato operativo F03 (`files`/`uploads`) y snapshot F02 no invalida el alcance del mock determinista, pero impide certificar interoperabilidad real en este snapshot.
- Efectos observados: Playwright generó `test-results/` en la raíz durante el primer intento; se deja intacto para no alterar archivos fuera del ámbito autorizado. Los cambios concurrentes visibles en `git status` pertenecen a otras fases y no se tocaron.

