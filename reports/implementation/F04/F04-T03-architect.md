# Cierre de tarea (Architect) — `F04-T03`

| Campo | Valor |
|---|---|
| **Tarea** | `F04-T03` — Tabla DynamoDB `mediashrink-jobs` con TTL |
| **Fase / paquete** | Fase 4 — `docs/sdd/packages/P-04-terraform-and-ci.md` |
| **Versión / Loop usado** | `v1 — Loop 1/3` |
| **Dictamen Tester** | **`PASSED`** (`F04-T03-tester.md`: 7/7, DescribeTable + DescribeTimeToLive propios) |
| **Dictamen Auditor** | **`READY_WITH_CONCERNS`** (`F04-T03-auditor.md`: 1 MEDIUM + LOW/INFO, 0 CRITICAL/HIGH) |
| **Estado** | `CERRADA — PASSED` · **`T02-A-01` CERRADO** |

## 1. Revisión de aceptación reforzada (§3.2)

| Requisito | Evidencia Tester | Límite | Estado |
|---|---|---|---|
| `CA-03` tabla PK `userId` / SK `jobId` | `DescribeTable` ACTIVE, HASH/RANGE tipo S, 0 GSI | — | **CUMPLIDO** |
| TTL 30 días sobre `ttl` | `DescribeTimeToLive ENABLED`, `dynamodb_ttl_seconds=2592000` derivado de `retention_days` | TTL DynamoDB asíncrono (comportamiento del emulador) | **CUMPLIDO** |
| `T02-A-01` retención S3 ↔ TTL | lifecycle Enabled/30 d en ambos buckets + TTL 30 d, `T02_A_01_CLOSED: true`, `TOTAL_CODE_RETENTION_LITERALS: 1` | Fuentes fuera de Terraform (.env.example, config, catálogo) → guardia CI en T05 | **CUMPLIDO** |
| Decisión tabla usuarios | No creada; `UserStore` comparte tabla con prefijos `USER#`, justificada en HCL/README | Matiz `USER#EMAIL` con PK=correo documentar en arquitectura | **CUMPLIDO** |
| Ámbito y G-7 | 19 hashes sin cambios, solo estado runtime y evidencias; `down` + `ps -a` vacío | Advertencia de estado efímero del emulador entre sesiones | **CUMPLIDO** |

Hallazgos: `F04T03-A-03` MEDIUM (guardia CI de retención en T05, **no aceptado** sin G-10), `A-04` LOW (comentario `dynamodb.tf` sobre TTL en perfiles `USER#`, a corregir en T04), `A-05` LOW (PROVISIONED 5/5 revisar antes de producción real), `A-01/A-02/A-06` INFO.

## 2. Cierre
`F04-T03` queda **`CERRADA — PASSED`** y el seguimiento heredado **`T02-A-01` queda cerrado por verificación**. No se actualizan `STATE.md` ni `tasks.md` (CTO consolida al retorno). Habilita `F04-T04` (IAM/CORS/skip flags) y aporta a `F04-T05` (guardia CI y sesión única).
