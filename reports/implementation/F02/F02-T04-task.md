# Tarea `F02-T04` — Consumidor SQS + DLQ

| Campo | Valor |
|---|---|
| **ID completo** | `F02-T04` |
| **Fase / paquete** | Fase 2 — `docs/sdd/packages/P-02-api-and-worker.md` |
| **Prioridad** | `P1` |
| **Rol implementador / verificadores** | Developer / Tester + Auditor |
| **Harness / Loop** | OpenCode · `v1 — Loop 1/3` |
| **Nivel de riesgo** | `3 (Sensible)` — resiliencia y pérdida de trabajos |
| **Estimación / hitos** | 40 min: (1) cliente SQS, (2) reintentos/DLQ, (3) fallo parcial, (4) verificación. Revisión ≥5 min; diagnóstico a 10 min o >2× estimación. |
| **Procesos** | `npx vitest run tests/integration/worker`, `npm run typecheck`, `npm run lint`. Timeout 240 s. |

## 1. Fuentes y criterio
- `spec.md` FR-10/FR-13, IN-08; `plan.md` §3.2; `constitution.md` IN-08; `P-02` §5 `CA-04`.
- **`CA-04`**: consumidor SQS con **3 reintentos**, envío a **DLQ** al agotarlos, imagen marcada `FAILED` y **el resto del lote continúa**; QueueUrls canónicas con `AWS_ENDPOINT_URL` como transporte; sin `:9324`.

## 2. Entradas y entorno
- Depende de `F02-T03` PASSED; usa `@aws-sdk/client-sqs` (declarado por T02 en `backend/package.json`). **No modificar manifiestos.**
- El emulador expone SQS en `https://127.0.0.1:9297` con QueueUrls canónicas; credenciales `fromIni`, CA del emulador. `docker compose down` obligatorio al terminar.

## 3. Ámbito exclusivo
`backend/src/worker/**` (consumidor y manejo de reintentos/DLQ), `tests/integration/worker/**`, `reports/implementation/F02/evidence/F02-T04-*`, `reports/implementation/F02/F02-T04-developer.md`.
**Prohibido:** manifiestos, frontend, IaC, `.github/`, `STATE.md`, `tasks.md`, `backend/src/index.ts`, push a `main`.

## 4. Método y entregables
- TDD con integración real: mensaje fallido 3 veces termina en DLQ; la imagen queda `FAILED` en DynamoDB; las demás imágenes del lote se procesan; mensaje válido se elimina de la cola; sin bucles infinitos.
- Evidencia: `F02-T04-{red,green,refactor,retry,dlq,partial-failure,emulator-down}.txt`.
- Dictamen `F02-T04-tester.md`; auditoría `reports/audits/F02/F02-T04-auditor.md`; cierre `F02-T04-architect.md`.
