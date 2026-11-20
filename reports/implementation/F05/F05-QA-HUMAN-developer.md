# F05-QA-HUMAN — Entrega del Developer (loop 2/3)

| Campo | Valor |
|---|---|
| **Fecha / rol** | `2026-11-20` · Developer (implementación no visual; **no soy Tester ni Architect**) |
| **Tarea** | `F05-QA-HUMAN` — corrección del hallazgo `QA-HUMAN-01` (`E1-04`) dictaminada por el CTO |
| **Loop** | `2/3` |
| **Estado** | **`DONE`** — corrección aplicada bajo TDD, verificaciones en verde, listo para re-verificación del Tester |
| **Dictamen rector del CTO (2026-11-20)** | `REGISTRATION_FAILED` es **deliberadamente genérico en backend** por anti-enumeración (`NFR-03` / `PR-08`). **No se cambia el backend ni se revela si el correo existe.** La corrección es **solo en el consumidor frontend**, bajo TDD. |
| **Gates** | Prohibidos `git commit`, `git push`, `G-12`, Docker/AWS. `G-3` / P4 aplicados a todos los artefactos. |

---

## 1. Alcance EXACTO aplicado

Solo los dos archivos autorizados por el encargo, dentro de `<PROJECT_ROOT>`:

1. **`frontend/src/api/auth.ts`** — se **añadieron** tres entradas al objeto `publicMessages` (líneas 25-27), sin quitar ni modificar ninguna existente:
   - `REGISTRATION_FAILED: 'No se pudo completar el registro. Revisa tus datos o inicia sesión si ya tienes cuenta.'`
   - `INVALID_TOKEN: 'Tu sesión no es válida. Inicia sesión otra vez.'`
   - `TOKEN_EXPIRED: 'Tu sesión ha caducado. Inicia sesión otra vez.'`
2. **`tests/unit/frontend/core.test.ts`** — se **añadieron tres tests unitarios** dentro de `describe('cliente de autenticación')` (líneas 56-90), uno por código, siguiendo el patrón existente: `createAuthClient('/api', fetcher)` con `fetcher` que devuelve `response({ error: { code: '<CODIGO>', message: 'stack secret token' } }, status)`; se comprueba `rejects.toMatchObject({ message: '<texto exacto>', status })` **y** que el mensaje **no contiene** `stack secret` (blindaje de `NFR-03`). Status usados: `409` para `REGISTRATION_FAILED`, `401` para `INVALID_TOKEN` y `TOKEN_EXPIRED`.

**No se tocó** nada más (ver §6). En particular **no se añadió `RESOURCE_NOT_FOUND`** (ver §5).

---

## 2. Evidencia TDD: RED → GREEN → REFACTOR

| Paso | Comando | Resultado real | Evidencia (relativa a `<PROJECT_ROOT>`) |
|---|---|---|---|
| **RED** | `npx vitest run tests/unit/frontend/core.test.ts` (tests nuevos, **sin** el cambio en `auth.ts`) | `14 tests \| 3 failed \| 11 passed`, `EXIT_CODE=1`. Los 3 fallos son por comportamiento (mensaje devuelto distinto del esperado), no por sintaxis: `Expected "No se pudo completar el registro…"` / `Received ApiError "No se pudo completar la solicitud…"` (y análogos para los dos códigos de token). | `reports/implementation/F05/evidence/F05-QA-HUMAN-loop2-red.txt` |
| **GREEN** | Mismo comando **tras** añadir las 3 entradas en `auth.ts` | `14 tests`, `1 passed file`, `14 passed`, `EXIT_CODE=0`. | `reports/implementation/F05/evidence/F05-QA-HUMAN-loop2-green.txt` |
| **REFACTOR** | Ajuste de tipado del helper de captura de error en los 3 tests + re-ejecución enfocada y completa | Sin cambio semántico: se conservan las mismas 3 aserciones de mensaje/status. | `reports/implementation/F05/evidence/F05-QA-HUMAN-loop2-refactor.txt` |

**Nota de transparencia sobre el REFACTOR:** la primera versión del helper usaba `const error = await request.catch((e) => e as Error);`, que ensancha el tipo a `AuthSession | Error` y producía `TS2339: Property 'message' does not exist on type 'Error | AuthSession'` en `npm run typecheck` y `npm run build` (estado intermedio, **no** un fallo de comportamiento: el test enfocado ya estaba en verde). Se sustituyó por un `.then` de dos argumentos totalmente tipado. Tras el ajuste se **regeneraron todas las evidencias** de verificación; la evidencia RED es la real capturada antes del cambio de `auth.ts` y su causa es exclusivamente el mapeo ausente (visible en el diff `Expected`/`Received`).

---

## 3. Verificación obligatoria (salidas reales, con `EXIT_CODE`)

Todos los comandos ejecutados desde `<PROJECT_ROOT>` tras el REFACTOR:

| Comando | EXIT_CODE | Resultado |
|---|---|---|
| `npm run typecheck` | **0** | `tsc --noEmit` de `backend` y `frontend` sin diagnósticos |
| `npm run lint` | **0** | `eslint . --ext .ts,.tsx` sin hallazgos |
| `npm run build` | **0** | Vite `35 modules transformed`, build backend OK (`✓ built in 1.01s`) |
| `npm run test:unit` | **0** | **37 archivos, 341/341 tests, 0 fallos** |
| `npx vitest run tests/unit/frontend/core.test.ts` | **0** | 14/14 tests |

**Conteo final `npm run test:unit`: 341/341 pasados en 37 archivos** (baseline `338/338` en 37 archivos + 3 tests nuevos = `341`). Sin tests omitidos ni relajados.

Evidencias: `reports/implementation/F05/evidence/F05-QA-HUMAN-loop2-{typecheck,lint,build,test-unit}.txt`.

---

## 4. Registro de problemas (7 campos obligatorios)

**1. Identificación:** `QA-HUMAN-01` · caso `E1-04` · complejidad `MEDIA-ALTA` (UX/funcional del registro; sin exposición de datos ni secretos) · componente: consumidor frontend de errores de auth.

**2. Problema:** El registro con correo duplicado devuelve HTTP `409` con `code: REGISTRATION_FAILED`, pero la SPA mostraba el texto genérico *«No se pudo completar la solicitud. Inténtalo de nuevo.»*, que no informa de la causa e invita a reintentar una operación que siempre falla. El mapeo `EMAIL_ALREADY_EXISTS` previsto en el frontend estaba muerto.

**3. Causa (demostrada):** Desajuste productor/consumidor del contrato de errores. `backend/src/auth/errors.ts` emite `REGISTRATION_FAILED`/409 (política anti-enumeración deliberada, confirmada por el CTO) y `publicMessages` no contenía esa clave → `request()` caía al mensaje por defecto. Verificada por el Tester en `F05-qa-human-tester.md §4` y por el Architect en `F05-qa-human-architect.md §2`.

**4. Solución e intentos fallidos:** Solución — añadir los tres mapeos autorizados en `frontend/src/api/auth.ts` (Opción A del CTO: consumidor, nunca backend). Intento fallido — el primer helper de pruebas tipado con `.catch(...)` superó Vitest pero rompió `typecheck`/`build` con `TS2339`; corregido con `.then` de dos argumentos sin alterar las aserciones (§2). No se relajó ninguna expectativa ni se eliminó ningún test.

**5. Verificación:** RED 3 fallos reales por comportamiento → GREEN 14/14 → `341/341` en unit; typecheck/lint/build en `EXIT_CODE=0`. Los tests comprueban además que el texto hostil del backend (`stack secret`) **no** llega al mensaje público (`NFR-03`).

**6. Pendientes:** El Tester independiente debe reejecutar **todo** el roadmap `E0-01`…`E7-03` en loop 2 y actualizar la spec E2E transitoria con el texto exacto de `E1-04` (lo hace el Tester; yo **no** toqué `tests/e2e/**`). El mensaje exacto que debe esperarse es: `No se pudo completar el registro. Revisa tus datos o inicia sesión si ya tienes cuenta.`

**7. Aprendizaje candidato:** Un `code` válido en el productor sin mapeo en el consumidor degrada una respuesta 409 correcta en un mensaje inútil. Conviene que las pruebas unitarias del cliente de API afirmen el **texto visible**, no solo el status; y que un helper de captura de errores se tipado de forma que no ensanche el tipo de retorno de la petición.

---

## 5. Observación para el CTO: `RESOURCE_NOT_FOUND`

`AuthErrorCode` también contiene `RESOURCE_NOT_FOUND`, pero **no se ha añadido** a `publicMessages`: el CTO no lo enumeró en el alcance y su gestión corresponde a la capa de jobs, no al alert de autenticación. No se inventaron mensajes fuera de los tres especificados. Se registra esta observación para que el CTO confirme, si lo considera, su tratamiento en su capa correspondiente (fuera de este alcance).

---

## 6. Declaración de alcance e higiene

- **No se modificó** `backend/`, `infra/`, `tests/e2e/**`, `docs/sdd/`, `STATE.md`, `playwright*.config.ts` ni reportes ajenos. El único test permanente tocado es `tests/unit/frontend/core.test.ts`.
- **No se hizo** `git commit` ni `git push`. **No** se ejecutó `G-12`. **No** se levantó Docker ni el emulador (lo hace el Tester en la reejecución del roadmap).
- **P4 / G-3:** todos los artefactos usan `<PROJECT_ROOT>` en lugar de rutas de host; las salidas de Vitest se sanearon (el encabezado `RUN` imprimía la raíz absoluta, sustituida por el marcador). No hay secretos, tokens ni valores de `.env` en código, evidencias ni en este informe; la cadena `stack secret token` aparece **solo** como señuelo hostil dentro de los tests, no como valor real ni en los mensajes públicos.

---

## 7. Retorno al Architect

- (a) `npm run test:unit` → **exit 0, 341/341 en 37 archivos**; `typecheck` / `lint` / `build` → **exit 0**.
- (b) Evidencias RED/GREEN (y REFACTOR): `reports/implementation/F05/evidence/F05-QA-HUMAN-loop2-{red,green,refactor}.txt`, más `{typecheck,lint,build,test-unit}.txt`.
- (c) El mensaje que debe esperar la spec E2E transitoria para `E1-04` es **exactamente**: `No se pudo completar el registro. Revisa tus datos o inicia sesión si ya tienes cuenta.`
- (d) Alcance respetado (solo `frontend/src/api/auth.ts` y `tests/unit/frontend/core.test.ts`); **sin commit, sin push**, sin tocar backend/E2E/STATE.
