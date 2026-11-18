# Cierre de tarea (Architect) — `F02-T06`

| Campo | Valor |
|---|---|
| **Tarea** | `F02-T06` — Métricas reales e integración backend completa |
| **Fase / paquete** | Fase 2 — `docs/sdd/packages/P-02-api-and-worker.md` |
| **Versión / Loop usado** | `v1` (PASSED) → **`v2 — Loop 2/3`** (correctivo por decisión CTO, sin loop 3) |
| **Rol implementador / verificadores** | Developer / Tester + Auditor (riesgo 2) |
| **Dictamen Tester** | **`PASSED`** en v1 (47/47) y addendum loop 2 (50/50) |
| **Dictamen Auditor** | **`READY_WITH_CONCERNS`** en v1 y addendum: A-01 cerrado por corrección, 0 CRITICAL/HIGH, sin bloqueantes |
| **Estado de la tarea** | `CERRADA — PASSED (loop 2/3)` |

## 1. Revisión de aceptación reforzada (METHODOLOGY.md §3.2)

| Requisito / fuente superior | Comportamiento observable | Evidencia | Límite de cobertura | Estado |
|---|---|---|---|---|
| `CA-06` (P-02 §5) · métricas reales — PR-12/FR-12 | `bytesBefore=768` frente a `declaredBytes=1` (`HeadObject` real), `bytesAfter` = suma de salidas, `savingsPct=33.85`, 0 % y −50 % sin recorte, validados con `savings-coherence` | `F02-T06-tester-{metrics,metrics-probe}.txt` | — | **CUMPLIDO** |
| IN-08 · estados coherentes | `COMPLETED`, `PARTIAL` (imagen `FAILED` sin abortar), `FAILED`, con máquina de estados congelada, sin reapertura de terminales | `F02-T06-tester-integration.txt` | — | **CUMPLIDO** |
| E2E backend y cableado | register → create → presign/upload → confirm → `publishJob` real → SQS → `processImage` → DynamoDB → `GET /jobs/:id` (5/5); `publish()` no usado | `F02-T06-tester-integration.txt` | Sin UI (F03) ni Terraform completo (F04) | **CUMPLIDO** |
| Observabilidad y T01 | `dlqFailures`/`dlqDeliveryFailed`/`skippedAsDuplicate` expuestos; `CONFIRM_INCONSISTENT` 503 → 200 `confirmed:true`, `publishCalls=1` (at-most-once) | `F02-T06-tester-observability.txt` | Sin marcador duradero de reconciliación (A-03, sin G-10) | **CUMPLIDO** |
| A-01 (Auditor, decisión CTO) · persistencia de optimized | `writeOptimizedVariants()` hace `PutObject`+`HeadObject`, falla cerrado si el tamaño difiere; consumidor re-deriva `bytesAfter`/`savingsPct` de bytes persistidos; sonda del Tester `98+304+98=500 == bytesAfter=500`; descarga y ZIP byte-idénticos | `F02-T06-tester-loop2-{persist,headobject,download,e2e}.txt`; auditoría addendum | A-02 (`bytesBefore` desde buffer del sobre, `HeadObject` en fixture) sigue como seguimiento | **CUMPLIDO (loop 2/3)** |
| Ámbito anti-colisión | Sin manifiestos, `db/**`, `index.ts`, frontend, IaC, `STATE.md`/`tasks.md`, push; Docker apagado y `:9297` cerrado | `F02-T06-tester-{scope,down}.txt` | Lint global rojo por F03 (paralelo), interferencia externa | **CUMPLIDO** |

**Conclusión:** `CA-06` satisfecho. El CTO autorizó corregir A-01 en este loop; la corrección fue verificada por Tester y Auditor. No quedan MEDIUM abiertos de F02-T06 ni riesgos aceptados (sin G-10).

## 2. Problemas y disposición

| ID | Disposición |
|---|---|
| `A-01` | **CERRADO por corrección** en loop 2/3 (persistencia real + bytes derivados de `HeadObject`) |
| `A-02` — `bytesBefore` desde buffer del sobre | LOW documentado; reforzar `HeadObject` de `raw` en consumo → seguimiento F05 |
| `A-03` — `CONFIRM_INCONSISTENT` at-most-once | INFO documentado; marcador duradero a decisión de CTO/Lino (sin G-10) |
| `A-04` — doble sin `publishJob` en rama de fallo | INFO; límite de cobertura, sugerencia al Tester (no aplicada, sin impacto en CA-06) |
| `A-05` — lint global F03 | Interferencia externa; alcance F02 en verde |
| `A-06` — `UnprocessedItems`, 204→404, sobreescritura presign | Solo documentados, no regresiones |

## 3. Cobertura y cierre

- `F02-T06` queda **`CERRADA — PASSED (loop 2/3)`**. No se actualizan `STATE.md` ni `docs/sdd/tasks.md` (CTO consolida al retorno; regla anti-colisión). Fase 2 completa: las seis tareas están `PASSED`.
