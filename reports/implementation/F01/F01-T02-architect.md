# Cierre de tarea (Architect) — `F01-T02`

| Campo | Valor |
|---|---|
| **Tarea** | `F01-T02` — Cliente DynamoDB y modelo de datos |
| **Fase / paquete** | Fase 1 — `docs/sdd/packages/P-01-critical-foundations.md` |
| **Versión / Loop usado** | `v1 — Loop 1/3` (addendum documental del Developer, sin nuevo loop) |
| **Rol implementador / verificadores** | Developer / Tester + Auditor (riesgo 3) |
| **Dictamen Tester** | **`PASSED`** (`F01-T02-tester.md`: 19/19 integración, typecheck global 0, `npm ci` + cobertura 100 %) |
| **Dictamen Auditor** | **`READY_WITH_CONCERNS`** (`F01-T02-auditor.md`: 4 INFO/LOW, sin bloqueantes) |
| **Estado de la tarea** | `CERRADA — PASSED` |

## 1. Revisión de aceptación reforzada (METHODOLOGY.md §3.2)

| Requisito / fuente superior | Comportamiento observable | Evidencia | Límite de cobertura | Estado |
|---|---|---|---|---|
| `CA-02` (P-01 §5) · CRUD en `aws/aws-emulator` — PR-05 | Tester reejecutó 19/19 (8 CRUD/hijos, 5 TTL, 6 aislamiento), sin skip/only | `F01-T02-tester-{integration,model}.txt` | Tablas de prueba efímeras; la tabla definitiva la crea F04 | **CUMPLIDO** |
| `CA-02` · TTL 30 días | `createdAt + 30d` en Unix seconds, `ENABLED`, herencia a hijos; coherente con `RETENTION_DAYS` (ambos 30) | `F01-T02-tester-model.txt`; auditoría T02-A-01 | Riesgo latente de desincronización futura (T02-A-01) → F04 | **CUMPLIDO** |
| `CA-02` · aislamiento estricto por `userId` | Las 10 operaciones exigen `userId`; 0 `Scan`/GSI; mismo `jobId` en A y B sin fuga; `updateImage` valida el padre antes que el hijo | `F01-T02-tester-model.txt`; auditoría | Sin `git diff`; verificación por código y ejecución | **CUMPLIDO** |
| G-3/PR-08 · credenciales y transporte | `fromIni` sobre `.local/aws-emulator/`, CA explícito, `AWS_ENDPOINT_URL` `:9297`; sin secretos, `:9324` ni volcado de credenciales | `F01-T02-tester-scope.txt`; auditoría | Sin AWS real | **CUMPLIDO** |
| G-7 · Docker con límites y apagado | 2 GiB/2.0 CPUs acreditados, `docker ps -a` vacío, `ORPHAN_COUNT=0` | `F01-T02-tester-{integration,down}.txt` | Volumen named del runbook persiste (fuera de G-7) | **CUMPLIDO** |
| G-8 · dependencias y reproducibilidad | `@aws-sdk/*` y `@vitest/coverage-v8@^2.1.9` con integridad en lockfile; `npm ci` 324 paquetes + 47/47 con 100 % cobertura; typecheck global 0 | `F01-T02-tester-{coverage-dep,typecheck}.txt` | Deuda heredada `install-scripts` (P-05) no bloqueante | **CUMPLIDO** |
| `task.md` §3 · ámbito y documentación 03 | Solo `backend/src/db/**`, tests integración, manifiesto backend, doc 03, evidence y reportes; raíz `package.json` sin cambios de esta tarea | `F01-T02-tester-scope.txt`; auditoría T02-A-04 | Sin historial Git para `diff` (contenido actual coherente) | **CUMPLIDO** |

**Conclusión:** `CA-02` satisfecho con evidencia propia del Tester y auditoría sin bloqueantes. No hay reducción de aceptación, `PASSED` condicional ni riesgos aceptados sin autoridad.

## 2. Problemas y disposición

| ID | Clasificación | Disposición |
|---|---|---|
| Concern P3 de T05 — proveedor de cobertura no declarado | MEDIUM | **CERRADO**: `@vitest/coverage-v8@^2.1.9` declarado, lockfile actualizado, `npm ci` + cobertura reproducidos |
| Concern P-06 — posible tabla huérfana | — | **CERRADO**: `ALL_TABLES=[]`, sin recursos que limpiar; contenedor apagado |
| Concern P-01 — typecheck global | — | **CERRADO**: exit 0 tras estabilizar T05 |
| `T02-A-01` — `RETENTION_DAYS` configurable vs. TTL literal 30 | INFO | **SEGUIMIENTO a F04**: alinear retención S3 con TTL DynamoDB |
| `T02-A-02` — `assertOpaqueId` no uniforme | LOW | No explotable (PK `userId`, pasa por `getJob`/`imageKeyPrefix`); recomendación de uniformidad |
| `T02-A-03` / `T02-A-04` | INFO | Frontera de roles y ausencia de historial Git; sin acción |
| P-05 — avisos `install-scripts` | LOW | Deuda heredada de F00, no bloqueante; sin G-10 |

## 3. Cobertura y cierre

- Persistencia y aislamiento listos para ser consumidos por F02 (API/worker); los contratos congelados de T01 se usan sin redefinirlos.
- Sin Git/GitHub, AWS real ni secretos en artefactos; contenedor apagado y sin tablas huérfanas.
- `F01-T02` queda **`CERRADA — PASSED`**. Se actualizan `docs/sdd/tasks.md` y `STATE.md`. Se habilita `F01-T03` (auth JWT), que consumirá los contratos y el almacén sin redefinirlos.
