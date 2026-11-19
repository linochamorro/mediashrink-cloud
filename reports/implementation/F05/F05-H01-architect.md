# Cierre de tarea (Architect) — `F05-H01`

| Campo | Valor |
|---|---|
| **Tarea** | `F05-H01` — Corrección H-01 Opción A (seed → `DYNAMODB_TABLE_JOBS`) + hardening defensivo |
| **Fase / paquete** | Fase Final — hallazgo `H-01` de `reports/verification/F05-qa-roadmap-architect.md` §4 |
| **Versión / Loop usado** | `v1` (`NO-PASSED`, P-01) → **`v2 — Loop 2/3`** (`PASSED`, sin loop 3) |
| **Dictamen Tester** | **`PASSED`** en addendum §7 (`F05-H01-tester.md`): logins Ana/Bruno/Carla 200 + lotes visibles, re-seed idempotente, suite 310/310 + 102/102 |
| **Dictamen Auditor** | **`READY_WITH_CONCERNS`** (`reports/audits/F05/F05-H01-auditor.md`): 0 CRITICAL/HIGH propios, 0 secretos; 2 HIGH heredados no bloquean G-6, con tracking pre-G-12 |
| **Estado** | `CERRADA — PASSED (loop 2/3)` |

## 1. Revisión de aceptación reforzada (§3.2)

| Requisito | Evidencia Tester (v1 + addendum loop 2/3) | Límite | Estado |
|---|---|---|---|
| `CA-H01.1` seed en `DYNAMODB_TABLE_JOBS` | `npm run seed` → `Tabla DynamoDB: mediashrink-jobs`; `grep` 0 coincidencias `SEED_TABLE_NAME`/`mediashrink-seed-demo` en `tools/scripts/seed/`; `ensureSeedTable` no altera la tabla Terraform existente | — | **CUMPLIDO** |
| `CA-H01.2` login demo 200 + lotes; idempotencia | Addendum: `terraform apply` 11 added → seed 3/3/6 → **login Ana/Bruno/Carla 200** + `GET /jobs` con su `demo-job-*` → 2.º seed 0 creados (12→12, mismos IDs) → logins 200 de nuevo | v1 `NO-PASSED` (P-01: faltaba índice `USER#EMAIL`) conservado append-only; corregido con `TransactWrite` perfil+índice, réplica exacta del adaptador | **CUMPLIDO (loop 2/3)** |
| `CA-H01.3a` hardening | 3 cabeceras en 7/7 clases (200/201/400/401/404/429/413); body >1 MiB → **413 `PAYLOAD_TOO_LARGE`**; bajo el límite pasa; sin oráculo; rate-limit 5/60s intacto | Sin regresión de comportamiento | **CUMPLIDO** |
| `CA-H01.3b` suite | typecheck/lint/build 0; **unit 310/310 (34 f.)**; **integración 102/102 (24 f.)** — cifras propias del Tester | 310 = 303 + 7 nuevos; 102 = 100 + 1 índice email + 1 hardening (conjunto verificado) | **CUMPLIDO** |
| Gobernanza | `temporary/` ausente; `down` exit 0, puertos cerrados; sin push por parte de los roles (lo ejecuta el Architect bajo G-6); G-12 no declarado | Contención con sesión concurrente documentada y tolerada (reintentos, sin tocar ficheros ajenos) | **CUMPLIDO** |

## 2. Cierre
`F05-H01` queda **`CERRADA — PASSED (loop 2/3)`**. El push de avances a `main` se ejecuta bajo **G-6** (autorizado) con verificación de CI; **G-12 sigue retenido** — no se declara `F05-T06` ni cierre final. Detalle del retorno: `reports/verification/F05-H01-security-architect.md`.
