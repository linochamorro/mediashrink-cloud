# Coordinación de Fase `P-04` — MediaShrink Cloud (F04)

| Campo | Valor |
|---|---|
| **Fecha** | `2026-11-18` |
| **Fase / Paquete** | Fase 4 — `docs/sdd/packages/P-04-terraform-and-ci.md` |
| **Harness** | OpenCode (único en esta sesión) |
| **Rol remitente** | Architect de fase (coordinación; **no implementa código ni ejecuta pruebas**, PR-10) |
| **Autorización de fase** | `G-2`: instrucción expresa de Lino en esta sesión para coordinar `P-04` y retornar al CTO. STATE.md listaba `G-2` pendiente de Lino; esta instrucción sirve como go-ahead expreso para la sesión. |
| **Ámbito de escritura (exclusivo)** | `infra/terraform/**`, `.github/workflows/**`, `tests/integration/infra/**`, `reports/implementation/F04/**`, `reports/audits/F04/**`, `reports/verification/F04-architect.md` |
| **PROHIBIDO (anti-colisión)** | `frontend/`, `backend/`, `package.json`/`package-lock.json` raíz, `STATE.md`, `docs/sdd/tasks.md`; cuenta AWS real; `terraform apply` contra AWS real |
| **Gates vigentes** | G-3 (solo `.env.example`; sin secretos), G-6/G-6b (repo público, archivos IA visibles), G-7 (Docker `--memory=2g --cpus="2.0"`, encendido solo en pruebas y apagado al terminar), G-2 (apertura de fase) |
| **Riesgo** | 2–3 → Auditor según resultados (IAM, CORS, DLQ, retención, aislamiento `userId`) |

---

## 1. Estado de entrada (revisado documentalmente, sin ejecución)

| Área | Estado actual | ¿Producto F04 presente? |
|---|---|---|
| `infra/terraform/` | Solo bootstrap F00: `versions.tf` (proveedor `hashicorp/aws ~> 5.0`, backend local) y `provider.tf` (apunta al emulador `:9297`, credenciales por archivo, `skip_*` justificados para emulador, CA propio). | **No.** Buckets S3, SQS+DLQ, DynamoDB e IAM de producto son alcance F04. |
| `.github/workflows/` | `ci.yml` base F00 (install, typecheck, lint, test:unit → 4/4 pasos, run `44184037945` success). | **No.** Job de integración contra emulador + `terraform apply` es alcance F04-T05. |
| `tests/integration/infra/` | No existe. | **No.** Pendiente F04-T05. |
| `reports/` | Sin evidencias F04. | — |

Referencias de configuración (`.env.example`, G-3, sin secretos): `RETENTION_DAYS=30`, `SQS_MAX_RETRIES=3`, `S3_BUCKET_RAW=mediashrink-raw-local`, `S3_BUCKET_OPTIMIZED=mediashrink-optimized-local`, `SQS_QUEUE_URL`/…`-dlq`, `DYNAMODB_TABLE_JOBS=mediashrink-jobs`, `AWS_ENDPOINT_URL=https://127.0.0.1:9297`, `CORS_ORIGIN=http://localhost:5173`, `CA_BUNDLE_PATH=./.local/aws-emulator/ca.pem`.

Seguimientos heredados a F04 (STATE §2, P-01): `T02-A-01` alinear retención S3 ↔ TTL DynamoDB (30 días); `T03-A-04` adaptador DynamoDB para `UserStore`; `T04-A-03` no heredar flags `skip_*` del bootstrap a entorno real.

---

## 2. Tareas de la fase y condiciones de aceptación (DoD)

| ID | Tarea | Depende de | Criterio verificable (CA) | DoD mínimo |
|---|---|---|---|---|
| `F04-T01` | Buckets S3 `raw` y `optimized` con ciclo de vida 30 días (`RETENTION_DAYS`, `T02-A-01`) y sin bucles de eventos | `F00-T04` | `CA-01` | `terraform plan` contra emulador; ambos buckets; regla de expiración 30 d; sin notificación/rule que genere bucle de eventos S3→SQS→S3 |
| `F04-T02` | Cola SQS + DLQ (`maxReceiveCount = 3`) y visibility timeout | `F04-T01` | `CA-02` | DLQ creada y enlazada a la cola principal; `maxReceiveCount = 3`; visibility timeout definido |
| `F04-T03` | Tabla DynamoDB `mediashrink-jobs` (`userId`/`jobId`, TTL 30 días) + tabla usuarios si aplica | `F04-T01` | `CA-03` | Tabla con PK `userId` / SK `jobId`; `TimeToLiveSpecification` habilitada (ttl, 30 días = 2.592.000 s); aislamiento por `userId` |
| `F04-T04` | Políticas IAM de mínimo privilegio, CORS explícito para SPA, separación/condicionamiento de flags `skip_*` (`T04-A-03`) | `F04-T01` | `CA-04` | IAM con menor privilegio por recurso; CORS explícito para `http://localhost:5173`; flags `skip_*` solo para emulador, no heredados a entorno real |
| `F04-T05` | Workflow CI de integración contra `aws/aws-emulator` + `terraform apply` + `tests/integration/infra/` | `F00-T06`, `F04-T02`, `F04-T03` | `CA-05` | Job CI levanta emulador, ejecuta `terraform apply` y pruebas de integración, apaga contenedor; sin coste ni AWS real |

**Condición de cierre de fase (DoD, P-04 §5):** `F04-T01`…`F04-T05` con `PASSED` de Tester (`terraform fmt`/`validate`/`apply` contra emulador + CI verde); auditorías en `reports/audits/F04/` sin `CRITICAL`/`HIGH`; Docker apagado tras pruebas; `reports/verification/F04-architect.md` entregado al CTO.

---

## 3. Evidencia requerida para cierre `PASSED`

| Rol | Acción | Artefacto de evidencia |
|---|---|---|
| **Developer** | Implementar `F04-T01`…`F04-T04` en `infra/terraform/` (HCL) sin tocar rutas prohibidas | `infra/terraform/**` (buckets, ciclo de vida, SQS+DLQ, DynamoDB TTL, IAM, CORS) |
| **Developer** | Implementar `F04-T05`: job de CI y pruebas de integración | `.github/workflows/**`, `tests/integration/infra/**` |
| **Tester** | Ejecutar `terraform fmt`/`validate`/`apply` contra `aws/aws-emulator` + `tests/integration/infra/`; emitir `PASSED`/`NO-PASSED` (máx 3 loops) | `reports/implementation/F04/F04-T0x-tester.md` + `evidence/` |
| **Auditor** | Revisar IAM, CORS, `skip_*`, DLQ, retención/TTL, aislamiento; sin `CRITICAL`/`HIGH` | `reports/audits/F04/F04-T0x-auditor.md` |
| **G-7** | Levantar emulador solo durante pruebas con límites; `docker compose down` al finalizar | Evidencia de Tester; contenedor apagado |

---

## 4. Veredicto de este Architect (coordinación, sin ejecución)

- **Revisión documental:** alcance definido, `DoR` satisfecha (F00 y F01 cerradas, bootstrap Terraform listo), gates identificados, `DoD` por tarea, sin colisiones con `F02`/`F03` (ámbitos de archivo excluyentes).
- **Ejecución (`terraform validate`/`apply`/tests/CI):** **no realizada por este rol** (PR-10: el Architect no ejecuta pruebas; además este entorno de sesión no dispone de `bash` para ejecutar terraform/docker/npm). Por tanto **no se puede emitir veredicto `PASSED`** sobre `terraform validate`/`apply`/tests/CI en este momento.
- **Auditoría:** pendiente de evidencia de ejecución. En la revisión documental no se identifican hallazgos `CRITICAL`/`HIGH`, pero la auditoría no está firmada hasta que exista evidencia de ejecución.

---

## 5. Retorno al CTO

Se entrega `reports/verification/F04-architect.md`. La fase `P-04` queda **coordinada**: alcance, gates, `DoD` y evidencia requerida quedan definidos. El veredicto `PASSED` requiere que el **Developer** implemente `F04-T01`…`F04-T05`, el **Tester** ejecute contra `aws/aws-emulator` y emita `PASSED`, y el **Auditor** firme sin `CRITICAL`/`HIGH`. Tras ello se emite el cierre de fase y se retorna definitivamente al CTO.

---

## 6. CIERRE DE FASE — `FASE_COMPLETA` (2026-11-18)

| Campo | Valor |
|---|---|
| **Veredicto** | **`FASE_COMPLETA`** |
| **Tareas** | `F04-T01`…`F04-T05` con `PASSED` de Tester (Loop 1/3, sin loops correctivos) |
| **Auditorías** | `READY_WITH_CONCERNS` en las cinco tareas; **0 `CRITICAL`/`HIGH`**, 0 bloqueantes, sin G-9 ni G-10 |
| **Criterios** | `CA-01`…`CA-05` en `PASSED` (detalle en `reports/verification/F04-architect.md`) |
| **Ejecución** | `terraform fmt`/`validate`/`apply` contra `aws/aws-emulator` en sesión única; tests de infra 6/6; CI real run `44312560558` `success` (14/14 pasos) |
| **Seguimientos cerrados** | `T02-A-01` (retención S3 ↔ TTL DynamoDB), `T04-A-03` (flags `skip_*`), `F04T01-A-01`/`F04T03-A-01` (guardia CI) |
| **Seguimientos a F05/CTO** | P4 ampliado ( rutas en G-6b + banner de Vitest en evidencias T05), `--no-save` de SDKs hasta publicar manifiestos F02, rol IAM por función, `cors_origin`, default `is_emulator=true`, billing 5/5, acciones `@v4/@v3` |
| **Confinamiento** | Sin `frontend/`, `backend/`, manifiestos raíz, `STATE.md` ni `tasks.md` tocados por este rol; sin AWS real; Docker apagado (`docker ps -a` vacío); `HEAD == origin/main` sin force push |

El párrafo de la sección 4 que afirmaba que "este entorno de sesión no dispone de `bash`" quedó **superado**: en la ejecución real se dispuso de Terraform 1.17.2 y Docker 29.9.3 (binarios fuera de PATH, rutas documentadas en `AGENTS.md` §6), por lo que sí se emitieron veredictos `PASSED` con evidencia propia de Tester. Este addendum es **append-only** y no reescribe el registro de coordinación inicial. Se retorna definitivamente al CTO.
