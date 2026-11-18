# Cierre de tarea (Architect) — `F04-T04`

| Campo | Valor |
|---|---|
| **Tarea** | `F04-T04` — IAM mínimo privilegio, CORS y flags `skip_*` |
| **Fase / paquete** | Fase 4 — `docs/sdd/packages/P-04-terraform-and-ci.md` |
| **Versión / Loop usado** | `v1 — Loop 1/3` |
| **Dictamen Tester** | **`PASSED`** (`F04-T04-tester.md`: 7/7, IAM/CORS/skip_* verificados) |
| **Dictamen Auditor** | **`READY_WITH_CONCERNS`** (`F04-T04-auditor.md`: 0 CRITICAL/HIGH/MEDIUM, 3 LOW + 4 INFO) |
| **Estado** | `CERRADA — PASSED` · **`T04-A-03` CERRADO** |

## 1. Revisión de aceptación reforzada (§3.2)

| Requisito | Evidencia Tester | Límite | Estado |
|---|---|---|---|
| `CA-04` IAM mínimo privilegio | Rol + política 5 statements, 0 `"Action":"*"` / `"Resource":"*"`, 7/7 ARNs derivados, confianza solo Lambda, `data.aws_iam_role` en vivo | Un único rol para API+worker: mínimo por rol, no por función (A-01 INFO → F05) | **CUMPLIDO** |
| CORS explícito SPA | `GetBucketCors` en ambos buckets: origen exacto `http://localhost:5173`, GET/PUT, 8 headers sin `*` | `cors_origin` parametrizado (A-04 LOW) | **CUMPLIDO** |
| Flags `skip_*` (T04-A-03) | 3 asignaciones a `var.is_emulator`, 0 literales `true`; mini-módulo `true`→flags `:9297`, `false`→flags/endpoint/credenciales vacíos; `validate -var=false` exit 0 | Default `true` requiere disciplina en AWS real (A-05 LOW, sin G-10) | **CUMPLIDO** |
| Comentario `USER#` TTL (F04T03-A-04) | Corregido + `check user_profiles_not_expiring`; `ADAPTER_TTL_OCCURRENCES: 0`; TTL intacto | — | **CUMPLIDO** |
| Transporte y G-7 | `:9297`, CA propio, 0 `:9324` activo, 0 secretos/rutas, `down` + `ps -a` vacío | — | **CUMPLIDO** |

El matiz `SignatureDoesNotMatch` de la sonda SigV4 artesanal fue clasificado por el Auditor como limitación del verificador, **no riesgo real** (mismas credenciales funcionan con SDK/proveedor; IAM creado y leído en vivo). Cobertura `LIMITED` por la ausencia de `GetRolePolicy` crudo, sin G-10. Seguimientos LOW a F05: detección de comodines parciales en `check`s, validación estricta de `cors_origin`, default `is_emulator=true`, rol único por función.

## 2. Cierre
`F04-T04` queda **`CERRADA — PASSED`** y **`T04-A-03` cerrado**. No se actualizan `STATE.md` ni `tasks.md` (CTO consolida al retorno). Habilita `F04-T05`, que debe usar **sesión única** `up → apply → sondas/tests → down` (P2 del emulador) y añadir la guardia CI de retención pedida por T01/T03.
