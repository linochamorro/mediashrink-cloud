# Cierre de tarea (Architect) — `F02-T04`

| Campo | Valor |
|---|---|
| **Tarea** | `F02-T04` — Consumidor SQS + DLQ y publicador real |
| **Fase / paquete** | Fase 2 — `docs/sdd/packages/P-02-api-and-worker.md` |
| **Versión / Loop usado** | `v1` (PASSED) → **`v2 — Loop 2/3`** (correctivo, sin loop 3) |
| **Rol implementador / verificadores** | Developer / Tester + Auditor (riesgo 3 sensible) |
| **Dictamen Tester** | **`PASSED`** en v1 (18/18) y en addendum de loop 2 (21/21, idempotencia y fallo DLQ) |
| **Dictamen Auditor** | **`READY_WITH_CONCERNS`** en v1 y addendum: A-01/A-02/A-03 cerrados por corrección, 0 CRITICAL/HIGH, sin bloqueantes |
| **Estado de la tarea** | `CERRADA — PASSED (loop 2/3)` |

## 1. Revisión de aceptación reforzada (METHODOLOGY.md §3.2)

| Requisito / fuente superior | Comportamiento observable | Evidencia | Límite de cobertura | Estado |
|---|---|---|---|---|
| `CA-04` (P-02 §5) · 3 reintentos y DLQ — FR-10/FR-13, IN-08 | `sqsMaxRetries` desde config; transitorio 2 fallos → éxito sin DLQ; agotados → DLQ canónica + imagen `FAILED` con `failureReason` | `F02-T04-tester-{worker,retry,dlq}.txt` | Inyección de fallos de infraestructura limitada en auditoría | **CUMPLIDO** |
| IN-08 · fallo parcial sin abortar lote | 1 `FAILED` + DLQ, otras 2 `COMPLETED`, job `PARTIAL` con métricas coherentes | `F02-T04-tester-partial.txt` | — | **CUMPLIDO** |
| G-3 · transporte SQS | `useQueueUrlAsEndpoint:false`, `fromIni`+CA, QueueUrls canónicas, sin `:9324` ni credenciales fijas | `F02-T04-tester-transport.txt` | — | **CUMPLIDO** |
| A-02 de T03 · uso del worker | Consumidor usa siempre `processImage` (nunca `renderWithSharp`): guarda A-05 y strip reales garantizados | `F02-T04-tester-transport.txt`; auditoría | — | **CUMPLIDO** |
| A-01 (Auditor) · idempotencia ante redelivery | `ALLOWED_TRANSITIONS`/`nextStatus` del catálogo congelado; terminal → `skippedAsDuplicate` sin escrituras; DLQ solo si `!alreadyFailed`; 2 entregas → **1 sola** entrada DLQ | `F02-T04-tester-loop2-idempotency.txt`; auditoría addendum | — | **CUMPLIDO (loop 2/3)** |
| A-02 (Auditor) · DLQ aislada | `dlqClient` inyectable + `try/catch`; fallo → `dlqFailures=1`, `dlqDeliveryFailed=true`, imagen `FAILED`, lote continúa, mensaje borrado | `F02-T04-tester-loop2-dlq-failure.txt`; auditoría addendum | La prueba no afirma explícitamente `DeleteMessage` bajo fallo (verificado por composición + prueba de drenaje de v1) | **CUMPLIDO (loop 2/3)** |
| A-03 (Auditor) · precondición `ImageRecord` | `ensureImageRecord()` usa `getImage`/`putImage` de la API pública de F01; `backend/src/db/**` intacto | `F02-T04-tester-loop2-precondition.txt` | — | **CUMPLIDO (loop 2/3)** |
| Publicador y ámbito | `SqsJobQueuePublisher` en `worker/**`, `api/**` intacto; sin manifiestos, frontend, IaC, `STATE.md`/`tasks.md`, push; Docker apagado | `F02-T04-tester-{publisher,scope,down}.txt` | Lint global rojo por F03 (paralelo), interferencia externa | **CUMPLIDO** |

**Conclusión:** `CA-04` satisfecho. Los tres hallazgos del Auditor se corrigieron en el loop 2 y fueron reverificados; no quedan MEDIUM abiertos de F02-T04. Sin `PASSED` condicional ni G-10.

## 2. Problemas y disposición

| ID | Disposición |
|---|---|
| `A-01` / `A-02` / `A-03` | **CERRADOS por corrección** en loop 2/3; transiciones con máquina de estados congelada, DLQ aislada y precondición materializada |
| `A-04` — sobre sin `images` si se usa `publish()` | **SEGUIMIENTO a T06**: usar `publishJob()` (no `publish()`) para el sobre enriquecido |
| `A-05` — lint global F03 | Interferencia externa; alcance F02 en verde |
| Heredado T01 — `CONFIRM_INCONSISTENT` | Sigue abierto (at-most-once en reintento); marcador duradero a decidir, sin G-10 |

Cronología v1 RED (11 fallos) → GREEN 18/18 → REFACTOR; loop 2 RED (3 fallos) → GREEN 21/21 → REFACTOR 21/21, revisadas como registro.

## 3. Cobertura y cierre

- Registro para T06: cablear `publishJob()` (no `publish()`) en `createApiApp()` y exponer `dlqFailures`/`dlqDeliveryFailed`/`skippedAsDuplicate` en la observabilidad E2E.
- `F02-T04` queda **`CERRADA — PASSED (loop 2/3)`**. No se actualizan `STATE.md` ni `docs/sdd/tasks.md` (CTO consolida al retorno). Habilita `F02-T06` y complementa `F02-T05`.
