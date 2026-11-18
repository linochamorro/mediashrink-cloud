# `F01-T03` — Dictamen del Tester independiente

| Campo | Valor |
|---|---|
| **Tarea / paquete** | `F01-T03` · Fase 1 · `docs/sdd/packages/P-01-critical-foundations.md` |
| **Rol** | `Tester` independiente (harness OpenCode) |
| **Versión / Loop** | `v1 — Loop 1/3` (sin activar loops; verificación única) |
| **Riesgo** | `3 (Sensible)` — autenticación, secretos y aislamiento |
| **Criterio asignado** | `CA-03`: `register`/`login`/`refresh`, contraseñas hasheadas (nunca en claro), JWT verificado, middleware que extrae `userId`, aislamiento `401`/`404` y rate limiting configurable desde configuración, sin hallazgos críticos/altos |
| **Fecha** | `2026-11-17` |
| **Dictamen global** | **`PASSED`** |

## 1. Fuentes leídas

`.agents/roles/tester.md`, `AGENTS.md`, `STATE.md`, `docs/sdd/packages/P-01-critical-foundations.md` (CA-03, §3–§5), `docs/sdd/spec.md` (FR-01/FR-02/FR-03/FR-21, NFR-03, §2–§3), `docs/sdd/plan.md` §3.1, `docs/sdd/constitution.md` (IN-05, IN-13, PR-08), `reports/implementation/F01/F01-T01-architect.md` (contratos v1, decisión CTO 8–128), `F01-T03-task.md`, `F01-T03-developer.md` (concern P6); `backend/src/auth/**`, `backend/src/config/index.ts`, `backend/src/contracts/**` (consumo), `tests/unit/auth/**`, `tests/integration/auth/**` y evidencias `F01-T03-*.txt` del Developer (solo como registro cronológico).

## 2. Verificaciones propias (reejecución independiente)

| Comando | Exit | Resultado | Evidencia propia |
|---|---|---|---|
| `npx vitest run tests/unit/auth tests/integration/auth` | 0 | 7 archivos, **44/44**, 0 omitidos | `evidence/F01-T03-tester-auth.txt` |
| `npm run test:unit` | 0 | 15 archivos, **150/150** (119 previas + 31 nuevas de auth) | `evidence/F01-T03-tester-unit.txt` |
| `npm run typecheck` | 0 | sin diagnósticos | `evidence/F01-T03-tester-typecheck.txt` |
| `npm run lint` | 0 | sin hallazgos | `evidence/F01-T03-tester-lint.txt` |
| Búsqueda de `.skip`/`.only`/`.todo`/`xit`/`xdescribe` en `tests/**` | — | **0 coincidencias**; los 44 tests se ejecutaron | `evidence/F01-T03-tester-auth.txt` (nota final) |
| Contraste de comportamiento por lectura de código y tests | — | todos los subcriterios cubiertos | `evidence/F01-T03-tester-security.txt` |
| Alcance, manifiestos/lockfile, secretos y P6 | — | sin cambios laterales; sin secretos reales | `evidence/F01-T03-tester-scope.txt` |

Los secretos de prueba son marcadores `REPLACE_WITH_…`; la raíz del proyecto se normalizó a `<PROJECT_ROOT>` en las salidas. No se usaron Git/GitHub ni Docker/AWS.

## 3. Dictamen por criterio

| # | Criterio (fuente) | Comportamiento verificado | Evidencia | Veredicto |
|---|---|---|---|---|
| 1 | **FR-01** · registro con contraseña hasheada, nunca en claro | `scrypt` nativo (N=16384, r=8, p=1), sal aleatoria de 16 B, digest de 64 B, `timingSafeEqual`; parámetros del encoded fijados por código (rechaza coste manipulado); `passwordHash` no se expone en usuario/respuesta; duplicado 409 genérico; política 8–128 | `password.test.ts` 6/6, `service.test.ts`, `routes.test.ts` | **CUMPLIDO** |
| 2 | **FR-02** · login access + refresh; rutas privadas sin token → 401 | Verificación en tiempo constante; correo desconocido y contraseña errónea devuelven el **mismo** `INVALID_CREDENTIALS` (verificación dummy anti-enumeración); `requireAuth` rechaza sin token/token inválido con 401 (fail-closed) | `service.test.ts`, `jwt.test.ts`, `routes.test.ts`, `isolation.test.ts` | **CUMPLIDO** |
| 3 | **FR-03** · renovación de sesión | `RefreshInput` validado; `typ='refresh'` con secreto propio; comprueba que el usuario exista; emite par nuevo; access no sirve como refresh y viceversa; refresh expirado → `TOKEN_EXPIRED` | `service.test.ts`, `jwt.test.ts`, `routes.test.ts` | **CUMPLIDO** |
| 4 | **NFR-03 / IN-05** · JWT firmado y verificado (HS256) | `hono/jwt` con algoritmo fijo HS256; firma, `exp`, `iat`, `typ`, `sub` y `email` comprobados explícitamente; token manipulado, con otro secreto, expirado o sin `sub`/`typ` → 401; secretos y TTLs **desde `loadConfig()`**, access y refresh separados | `jwt.test.ts` 7/7, `service.test.ts`, `routes.test.ts` | **CUMPLIDO** |
| 5 | **FR-21 / plan §3.1.3** · middleware extrae `userId` e aislamiento `401`/`404` | `c.set('userId', …)` tras verificar; `assertOwnership` → 404 con cuerpo idéntico byte-a-byte para recurso ajeno e inexistente, sin identificadores; 401 precede a 404; refresh token no autoriza rutas privadas | `middleware.test.ts` 3/3, `isolation.test.ts` 4/4, `routes.test.ts` | **CUMPLIDO** |
| 6 | **A-06** · rate limit configurable → 429 + `Retry-After` | `FixedWindowRateLimiter` con `max`/`windowMs` desde `config.rateLimit` (`RATE_LIMIT_AUTH_*`), reloj inyectable, clave por proxy/`local`; al agotar → 429 `RATE_LIMITED` con `Retry-After`, renovación en la ventana siguiente | `rate-limit.test.ts` 5/5, `routes.test.ts` (umbral 2) | **CUMPLIDO** |
| 7 | **NFR-03 / PR-08 / G-3** · errores sin filtrar secretos ni rutas internas | Cuerpo homogéneo `{error:{code,message}}`, sin stack, rutas `backend/src/**`, nombres/valores de secretos ni contraseña; fixtures con marcadores; `loadConfig` rechaza secretos con aspecto real | `routes.test.ts` (lista de patrones ausentes), `security.txt` | **CUMPLIDO** |
| 8 | **IN-13 / A-02** · registro público + hash aprobado; sin dependencias nuevas | Registro público abierto; `scrypt` nativo y `hono/jwt` ya disponible; `backend/package.json` y lockfile sin cambios; sin `/jobs`, worker `sharp`, UI, IaC ni AWS real | `scope.txt`, `unit.txt`, `typecheck.txt`, `lint.txt` | **CUMPLIDO** |
| 9 | **TDD (NFR-04)** · `RED → GREEN → REFACTOR` con registro íntegro | RED conductual 43 fallos / 1 acierto (sin `MODULE_NOT_FOUND`) → GREEN 44/44 → REFACTOR 44/44; revisado como registro, **no reejecutado invirtiendo código** (acción prohibida) | `evidence/F01-T03-{red,green,refactor}.txt` del Developer; §4 | **CUMPLIDO (como registro)** |

## 4. Cronología TDD revisada como registro (no evidencia propia)

La secuencia `RED (18:41:14, 43 fallos por comportamiento y 1 acierto) → GREEN (18:44:01, 44/44) → REFACTOR (18:46:09, 44/44)` consta en las evidencias `F01-T03-{red,green,refactor}.txt` del Developer y en su reporte (§3). Este rol **la revisa como registro cronológico** y no la presenta como ejecución propia: no se recreó el RED revirtiendo la implementación, conforme al contrato de rol. El acierto aislado del RED queda transparentado en `F01-T03-P7` del reporte del Developer y no debilita la aserción en GREEN (el mensaje 404 real se compara entre recurso ajeno e inexistente).

## 5. Concern P6 — seguimiento no bloqueante

`UserStore` es una interfaz con `InMemoryUserStore` por instancia; no hay tabla DynamoDB de usuarios (F01-T02 solo modela jobs por `userId`/`jobId`) y el alcance de `task.md` §3 prohibía escribir en `backend/src/db/**` e `infra/terraform/**`. La lógica de autenticación queda acreditada con 44/44 y store aislado por prueba. Se registra como **seguimiento para F04** (adaptador DynamoDB + tabla), **no como incumplimiento de CA-03 ni como riesgo aceptado por Lino** (no se concedió `G-10`). Ítems P8 (sin dependencias nuevas) y P1–P5, P7 del Developer también quedan documentados en su reporte sin impacto en el dictamen.

## 6. Hallazgos y dictamen global

- **Hallazgos CRITICAL/HIGH: ninguno.** No hay incumplimientos; por tanto no se abren los 7 campos obligatorios de problema (no aplica) ni se activa ningún loop.
- No hay revisiones obligatorias de Auditor pendientes que bloqueen este dictamen; la auditoría de riesgo 3 es competencia posterior del Auditor y no cambia la verificación propia de CA-03.
- Límite de cobertura declarado: las pruebas HTTP usan la app Hono en memoria (`app.request`), no un servidor en escucha; acreditan la lógica de rutas y middleware de CA-03, no un despliegue real (F02).

**Veredicto global: `PASSED`.** `CA-03` se cumple con evidencia propia (44/44 auth, 150/150 suite, typecheck/lint 0) y contraste de comportamiento por lectura, sin secretos, sin cambios laterales y sin hallazgos críticos/altos. Se entrega al Architect para su integración; este rol no cierra la tarea ni modifica `STATE.md`/`tasks.md`.
