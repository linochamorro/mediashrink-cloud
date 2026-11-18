# Cierre de tarea (Architect) — `F01-T03`

| Campo | Valor |
|---|---|
| **Tarea** | `F01-T03` — Autenticación JWT propia |
| **Fase / paquete** | Fase 1 — `docs/sdd/packages/P-01-critical-foundations.md` |
| **Versión / Loop usado** | `v1 — Loop 1/3` |
| **Rol implementador / verificadores** | Developer / Tester + Auditor (riesgo 3 sensible) |
| **Dictamen Tester** | **`PASSED`** (`F01-T03-tester.md`: 44/44 auth, 150/150 suite, typecheck/lint 0) |
| **Dictamen Auditor** | **`READY_WITH_CONCERNS`** (`F01-T03-auditor.md`: 2 MEDIUM, 3 LOW, 2 INFO; 0 CRITICAL/HIGH, sin bloqueantes) |
| **Estado de la tarea** | `CERRADA — PASSED` |

## 1. Revisión de aceptación reforzada (METHODOLOGY.md §3.2)

| Requisito / fuente superior | Comportamiento observable | Evidencia | Límite de cobertura | Estado |
|---|---|---|---|---|
| `CA-03` (P-01 §5) · register/login/refresh — FR-01/02/03 | Tester reejecutó 44/44 auth (7 archivos), suite 150/150, sin skip/only | `F01-T03-tester-{auth,unit}.txt` | Sin暴露 HTTP `/auth/*` en producción (F02) | **CUMPLIDO** |
| Seguridad de hash (A-02, PR-08) | scrypt con sal por usuario, `timingSafeEqual`, rechazo de hash manipulado, anti-enumeración, contraseña 8–128 según decisión CTO | `F01-T03-tester-security.txt`; auditoría | Coste scrypt en piso recomendado (T03-A-06, INFO) | **CUMPLIDO** |
| JWT y secretos (IN-05, G-3) | HS256 `hono/jwt`, firma/`exp`/`iat`/`typ`/`sub`, secretos y TTLs desde `loadConfig`, access/refresh separados, sin alg-confusion | `F01-T03-tester-security.txt`; auditoría | Marcadores idénticos en `.env.example` sin longitud mínima (T03-A-03, LOW) | **CUMPLIDO** (con seguimiento) |
| Aislamiento 401/404 (FR-21, PR-07) | `requireAuth` fail-closed con `userId` del token; `assertOwnership` → 404 con cuerpo idéntico para ajeno e inexistente | `F01-T03-tester-security.txt` | — | **CUMPLIDO** |
| Rate limiting configurable (A-06) | Ventana fija desde config, 429 + `Retry-After`, reloj inyectable | `F01-T03-tester-security.txt` | Clave derivada de cabeceras suplantables (T03-A-01, MEDIUM) → **resolver antes de F02** | **CUMPLIDO** (con traspaso) |
| `task.md` §3 · ámbito | Solo `backend/src/auth/**`, tests auth, evidence y reporte; manifiestos/lockfile sin cambios (`hono/jwt` ya disponible); sin rutas `/jobs` | `F01-T03-tester-scope.txt` | Sin `git diff` en esta tarea | **CUMPLIDO** |

**Conclusión:** `CA-03` satisfecho con evidencia propia del Tester y auditoría sin `CRITICAL`/`HIGH` ni bloqueantes. Los dos MEDIUM son recomendaciones con fase de destino, no riesgos aceptados (sin G-10).

## 2. Problemas y disposición

| ID | Clasificación | Disposición |
|---|---|---|
| `T03-A-01` — clave de rate limit con `x-forwarded-for`/`x-real-ip` suplantables | MEDIUM | **TRASPASO a F02**: resolver antes de exponer `/auth/login` |
| `T03-A-04` — `UserStore` en memoria (concern P6) | MEDIUM | **TRASPASO a F04**: adaptador DynamoDB coordinado con T04; aceptable solo en F01 |
| `T03-A-02` — limitador por proceso | LOW | Recomendación de diseño; no bloquea el MVP |
| `T03-A-03` — marcadores JWT idénticos y sin longitud mínima en `.env.example` | LOW | **SEGUIMIENTO CTO** con control de cambios (G-3 intacto: no son secretos reales) |
| `T03-A-05` — `LoginInput.password` sin tope (asimetría con registro 8–128) | LOW | **SEGUIMIENTO CTO** con control de cambios |
| `T03-A-06` / `T03-A-07` | INFO | Coste scrypt y frontera de roles del Auditor; sin acción |

## 3. Cobertura y cierre

- Autenticación lista para ser expuesta por la API de F02; sin frontend, rutas `/jobs` ni IaC en esta tarea.
- Sin Git/GitHub, Docker ni AWS real; sin secretos ni rutas Windows absolutas en artefactos nuevos (P4 no ampliado).
- `F01-T03` queda **`CERRADA — PASSED`**. Se actualizan `docs/sdd/tasks.md` y `STATE.md`. Se habilita `F01-T04` (seed), última tarea de P-01.
