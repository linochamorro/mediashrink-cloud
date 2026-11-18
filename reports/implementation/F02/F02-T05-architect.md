# Cierre de tarea (Architect) — `F02-T05`

| Campo | Valor |
|---|---|
| **Tarea** | `F02-T05` — Descarga individual/ZIP y borrado de lote |
| **Fase / paquete** | Fase 2 — `docs/sdd/packages/P-02-api-and-worker.md` |
| **Versión / Loop usado** | `v1` (PASSED) → **`v2 — Loop 2/3`** (correctivo, sin loop 3) |
| **Rol implementador / verificadores** | Developer / Tester + Auditor (riesgo 2) |
| **Dictamen Tester** | **`PASSED`** en v1 (105/105) y addendum loop 2 (112/112) |
| **Dictamen Auditor** | **`READY_WITH_CONCERNS`** en v1 y addendum: A-01/A-02 cerrados, 0 CRITICAL/HIGH, sin bloqueantes |
| **Estado de la tarea** | `CERRADA — PASSED (loop 2/3)` |

## 1. Revisión de aceptación reforzada (METHODOLOGY.md §3.2)

| Requisito / fuente superior | Comportamiento observable | Evidencia | Límite de cobertura | Estado |
|---|---|---|---|---|
| `CA-05` (P-02 §5) · descarga individual | 4 variantes (`webp`/`avif`/`thumbnail`/`original`), URL HTTPS 900 s, `userId` del JWT, 404 indistinto | `F02-T05-tester-{integration,focused}.txt` | — | **CUMPLIDO** |
| IN-03/A-05 · ZIP con optimizadas + miniaturas | Entradas planas `<imageId>.webp/.avif/_thumb.webp`, verificado con lector externo (`CRC_TEST=None`, bytes correctos), sin temporales | `F02-T05-tester-zip-external.txt` | — | **CUMPLIDO** |
| IN-04/PR-07 · DELETE completo y aislado | `204`, `raw`/`optimized` vacíos, fila e imágenes borradas, segundo `404`, lotes ajenos intactos | `F02-T05-tester-delete-probe.txt` | — | **CUMPLIDO** |
| T02-A-02 · `If-None-Match` | Descartado con razón documentada (solo GET/DeleteObjects); refuerzo `assertKeyWithinPrefix` en 23 puntos | `F02-T05-tester-keys.txt`; auditoría | Sobreescritura sigue siendo competencia de `/presign/upload` | **CUMPLIDO** |
| A-01 (Auditor) · tope de ZIP | `ZipLimits` derivado de config (256 MiB/60 entradas por defecto); rechazo `413 ZIP_TOO_LARGE` **antes** de materializar (`materializations=0`), un solo `Buffer` | `F02-T05-tester-loop2-zip.txt`; auditoría addendum | — | **CUMPLIDO (loop 2/3)** |
| A-02 (Auditor) · `Errors[]` en DeleteObjects | Cuenta solo `Deleted[]`, reintenta claves fallidas hasta 3, `502 PARTIAL_DELETE_FAILED` sin userId/claves; fila DynamoDB conservada para reintento | `F02-T05-tester-loop2-delete.txt`; auditoría addendum | Fallo transitorio reintentado con éxito (2 llamadas) | **CUMPLIDO (loop 2/3)** |
| Ámbito anti-colisión | Sin manifiestos, `worker/**`, `db/**`, `index.ts`, frontend, IaC, `STATE.md`/`tasks.md`, push; Docker apagado | `F02-T05-tester-{scope,down}.txt` | Lint global rojo por F03 (paralelo), interferencia externa | **CUMPLIDO** |

**Conclusión:** `CA-05` satisfecho. Los dos MEDIUM del Auditor se corrigieron y reverificaron; no quedan MEDIUM abiertos de F02-T05. Sin `PASSED` condicional ni G-10.

## 2. Problemas y disposición

| ID | Disposición |
|---|---|
| `A-01` / `A-02` | **CERRADOS por corrección** en loop 2/3 |
| `A-03` — `UnprocessedItems` en `db/**` (F01) | LOW documentado, código de F01 fuera de ámbito; sin G-10 |
| `A-04` — semántica 204 → 404 | LOW documentado, coherente con spec §6 |
| Lint global F03 | Interferencia externa; alcance F02 en verde |

Cronología v1 RED (15 fallos) → GREEN 18/18 → REFACTOR; loop 2 RED (5 fallos) → GREEN 7/7 → 112/112, revisadas como registro.

## 3. Cobertura y cierre

- `F02-T05` queda **`CERRADA — PASSED (loop 2/3)`**. No se actualizan `STATE.md` ni `docs/sdd/tasks.md` (CTO consolida al retorno). Habilita `F02-T06` (métricas reales e integración backend E2E).
