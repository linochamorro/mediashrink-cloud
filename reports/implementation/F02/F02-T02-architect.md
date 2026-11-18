# Cierre de tarea (Architect) — `F02-T02`

| Campo | Valor |
|---|---|
| **Tarea** | `F02-T02` — Presigned URLs S3 (raw PUT / optimized GET) |
| **Fase / paquete** | Fase 2 — `docs/sdd/packages/P-02-api-and-worker.md` |
| **Versión / Loop usado** | `v1 — Loop 1/3` |
| **Rol implementador / verificadores** | Developer / Tester + Auditor (riesgo 2) |
| **Dictamen Tester** | **`PASSED`** (`F02-T02-tester.md`: 83/83, round-trip real, claves y transporte seguros) |
| **Dictamen Auditor** | **`READY_WITH_CONCERNS`** (`F02-T02-auditor.md`: 3 LOW + 2 INFO; 0 CRITICAL/HIGH, sin bloqueantes) |
| **Estado de la tarea** | `CERRADA — PASSED` |

## 1. Revisión de aceptación reforzada (METHODOLOGY.md §3.2)

| Requisito / fuente superior | Comportamiento observable | Evidencia | Límite de cobertura | Estado |
|---|---|---|---|---|
| `CA-02` (P-02 §5) · PUT a `raw` y GET a `optimized` — FR-08/09/17 | Tester reejecutó 83/83 y comprobó PUT de fixture 342 B → 200 con bytes idénticos en `raw` y GET 38/38 idénticos | `F02-T02-tester-{api,roundtrip}.txt` | Emulador local; producción real no cubierta | **CUMPLIDO** |
| PR-07 · claves y `userId` del JWT | `userId` del token (body → 400, cabeceras ignoradas); traversal/absolutos/prefijo ajeno/NUL/%xx rechazados | `F02-T02-tester-keys.txt`; auditoría V-1…V-10 | — | **CUMPLIDO** |
| G-3/PR-08 · transporte y secretos | `https://127.0.0.1:9297`, sin `:9324`, `fromIni` + CA explícito + `forcePathStyle`, sin credenciales fijas ni secretos en evidencia | `F02-T02-tester-transport.txt` | — | **CUMPLIDO** |
| CA-02 · expiración acotada | `X-Amz-Expires` en `[60,3600]`, 900 s por defecto, 59/3601 → 400, doble validación | `F02-T02-tester-keys.txt`; auditoría (900 s aceptable para MVP) | — | **CUMPLIDO** |
| G-8 · dependencias | 3 paquetes con `integrity` en lockfile; `package.json` raíz invariante (hash `88FF7055…FE45F`); decisión CTO aplicada | `F02-T02-tester-deps.txt` | `npm install --workspace` vs `npm ci`: deuda heredada no aceptada (A-03) | **CUMPLIDO** |
| Ámbito anti-colisión | Solo storage/api/tests propios; sin tocar `backend/src/index.ts`, `worker/**`, `db/**`, manifiestos raíz, `STATE.md`, `tasks.md`; sin push; Docker apagado | `F02-T02-tester-{scope,down}.txt` | Lint/typecheck globales rojos por F03 (paralelo), interferencia externa | **CUMPLIDO** |

**Conclusión:** `CA-02` satisfecho con evidencia propia del Tester y auditoría sin bloqueantes. No hay `PASSED` condicional ni G-10.

## 2. Problemas y disposición

| ID | Clasificación | Disposición |
|---|---|---|
| `A-01` — respuesta expone `bucket`/`key` internos | LOW | **Decisión de producto para F05** (recorte de la respuesta) |
| `A-02` — PUT sin `If-None-Match` (sobreescritura intra-usuario) | LOW | **TRASPASO a T05**: objetos ajenos ya impedidos por prefijo `userId`; evaluar condición en descarga/borrado |
| `A-03` — `npm install --workspace` en lugar de `npm ci` | LOW heredada | No aceptada; mantener `npm ci` como mecanismo reproducible en CI |
| `A-04` — lint/typecheck globales F03 | INFO | Interferencia externa; alcance F02 en verde |
| `A-05` — `AWS_EC2_METADATA_DISABLED` validado pero no aplicado al cliente S3 | INFO | Mitigado por `fromIni` explícito; sin riesgo IMDS demostrado |

Cronología RED (36 fallos por comportamiento) → GREEN 47/47 → REFACTOR 47/47 revisada como registro. Sin secretos ni rutas Windows absolutas en artefactos nuevos.

## 3. Cobertura y cierre

- Servicio de storage listo para T05 (descarga/ZIP/borrado) y T06 (integración E2E).
- `F02-T02` queda **`CERRADA — PASSED`**. No se actualizan `STATE.md` ni `docs/sdd/tasks.md` (CTO consolida al retorno; regla anti-colisión). Habilita `F02-T05` y aporta el transporte a `F02-T06`.
