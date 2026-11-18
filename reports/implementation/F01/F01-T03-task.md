# Tarea `F01-T03` — Autenticación JWT propia

| Campo | Valor |
|---|---|
| **ID completo** | `F01-T03` |
| **Fase y paquete** | Fase 1 — `docs/sdd/packages/P-01-critical-foundations.md` |
| **Prioridad** | `P0` |
| **Rol implementador** | `Developer` |
| **Rol verificador** | `Tester` + `Auditor` |
| **Harness** | OpenCode |
| **Versión / Loop actual** | `v1 — Loop 1/3` |
| **Nivel de riesgo** | `3 (Sensible)` — autenticación, secretos y aislamiento |
| **Excepción metodológica** | `Ninguna` |
| **Estimación / hitos / seguimiento** | Estimación 45 min. Hitos: (1) tests RED de auth, (2) hash + JWT + refresh, (3) middleware `userId` y rate limit, (4) verificación. Revisión ≥5 min; diagnóstico a 10 min sin progreso o >2× estimación. |
| **Procesos y verificación proporcional** | `npx vitest run tests/unit/auth tests/integration/auth`, `npm run typecheck`. Timeout 240 s. Tester reejecuta; Auditor revisa secretos, hash, 401/404 y rate limiting. |

## 1. Fuentes aprobadas y criterios de aceptación
- **Requisitos:** `spec.md` FR-01/FR-02/FR-03/FR-21, NFR-03; `plan.md` §3.1; `constitution.md` IN-05/IN-13, PR-08; A-02 (`scrypt`/`bcryptjs`), A-06 (rate limit configurable); `P-01` §5 `CA-03`.
- **Criterio asignado:** `CA-03`: `register`/`login`/`refresh` con contraseñas hasheadas (nunca en claro), JWT firmado verificado, middleware que extrae `userId`, aislamiento `401`/`404` y rate limiting configurable desde `.env`, sin hallazgos críticos/altos.

## 2. Entradas, contratos y entorno
- **Revisión previa:** `F01-T01` PASSED; consumir contratos congelados. `F01-T02` puede ejecutarse en paralelo (no depende de auth). Se permiten rutas `/auth/*` en Hono; **prohibido** implementar rutas `/jobs` (F02).
- **Secretos:** usar las variables `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET`, TTLs y `RATE_LIMIT_AUTH_*` del loader (`backend/src/config/index.ts`). En tests, valores de prueba explícitos; **nunca secretos reales ni valores de `.env` en reportes/logs**.
- **Gates:** G-3 resuelto, G-6/G-6b, G-8 para dependencias JWT/bcryptjs si aplica.

## 3. Ámbito exclusivo de archivos y límites
- **Escritura permitida:** `backend/src/auth/**`, `backend/package.json` (dependencias), `tests/unit/auth/**`, `tests/integration/auth/**`, `reports/implementation/F01/evidence/F01-T03-*`, `reports/implementation/F01/F01-T03-developer.md`.
- **Prohibido tocar:** `backend/src/{contracts,db,domain}/**`, `frontend/**`, `package.json` raíz, `infra/terraform/**`, `.env.example`, `STATE.md`, `tasks.md`, reportes ajenos. Sin OAuth/Cognito ni servicios externos.

## 4. Método exigido y entregables
- **Método:** `RED → GREEN → REFACTOR`: registro duplicado, contraseña débil, hash verificable (nunca claro), login inválido, refresh inválido/expirado, token manipulado, acceso sin token (`401`), acceso a recurso ajeno (`404`, sin filtrar existencia), y rate limit configurable (configuración de prueba con umbral bajo).
- **Seguridad:** algoritmo de hash `scrypt` nativo (`node:crypto`) o `bcryptjs` (A-02); comparación en tiempo constante; errores sin exponer rutas internas ni secretos.
- **Reporte:** `F01-T03-developer.md` (7 campos). **Evidencia:** `evidence/F01-T03-{red,green,refactor,jwt,hash,isolation,rate-limit}.txt`.
- **Dictamen:** `F01-T03-tester.md`. **Auditoría:** `reports/audits/F01/F01-T03-auditor.md`. **Cierre:** `F01-T03-architect.md`.
