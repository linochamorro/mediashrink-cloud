# Retorno de Fase `P-04` — MediaShrink Cloud

| Campo | Valor |
|---|---|
| **Fecha** | `2026-11-18` |
| **Fase / Paquete** | Fase 4 — `docs/sdd/packages/P-04-terraform-and-ci.md` |
| **Harness** | OpenCode |
| **Motivo de retorno** | **`FASE_COMPLETA`** — `F04-T01`…`F04-T05` con `PASSED` de Tester, `terraform validate/apply`/tests/CI en verde y auditorías sin `CRITICAL`/`HIGH` |
| **Estado de `tasks.md` y `STATE.md`** | **NO actualizados** por este rol: el CTO consolida al retorno (regla anti-colisión) |
| **Push** | Realizado por el Developer de T05 con `pull --ff-only`, sin force push; `HEAD == origin/main` |

---

## 1. Resumen de tareas ejecutadas

| ID | Resultado | Loops | Tester | Auditor | Cierre |
|---|---|---|---|---|---|
| `F04-T01` — Buckets S3 + lifecycle 30 d | `PASSED` | `1/3` | `PASSED` (4 recursos, lifecycle 30 d, sin eventos) | `READY_WITH_CONCERNS` | `F04-T01-architect.md` |
| `F04-T02` — SQS + DLQ | `PASSED` | `1/3` | `PASSED` (9/9, `maxReceiveCount` numérico 3) | `READY_WITH_CONCERNS` | `F04-T02-architect.md` |
| `F04-T03` — DynamoDB + TTL | `PASSED` | `1/3` | `PASSED` (7/7, keys/TTL, `T02-A-01` cerrado) | `READY_WITH_CONCERNS` | `F04-T03-architect.md` |
| `F04-T04` — IAM/CORS/`skip_*` | `PASSED` | `1/3` | `PASSED` (7/7, 0 comodines, CORS exacto) | `READY_WITH_CONCERNS` (0 CRIT/HIGH/MEDIUM) | `F04-T04-architect.md` |
| `F04-T05` — CI de integración | `PASSED` | `1/3` | `PASSED` (6/6 tests, CI success, guardias no vacuas) | `READY_WITH_CONCERNS` | `F04-T05-architect.md` |

Ninguna tarea consumió loop correctivo. No hubo `NO-PASSED`, `BLOCKED` ni `NEEDS_CONTEXT`. Todas las auditorías sostienen conclusión `READY_WITH_CONCERNS` con **0 `CRITICAL`/`HIGH`** y 0 bloqueantes. No se concedió G-9 ni G-10: ningún riesgo fue aceptado en nombre de Lino.

## 2. Verificación de criterios de aceptación

| Criterio | Estado | Evidencia verificada por Tester |
|---|---|---|
| `CA-01` — Buckets `raw`/`optimized`, lifecycle 30 d, sin bucles de eventos | **`PASSED`** | `apply` 4 recursos; `ListBuckets` COUNT 2; `GetBucketLifecycleConfiguration` Enabled/30 d en ambos; `GetBucketNotificationConfiguration` sin claves; 0 declaraciones de eventos en HCL |
| `CA-02` — SQS + DLQ, `maxReceiveCount=3`, visibility | **`PASSED`** | 6 recursos; ARN real de DLQ en RedrivePolicy; `MAX_RECEIVE_COUNT_JS_TYPE: number`, `EQ_3: true`; VisibilityTimeout 120 s en ambas; sin redrive de vuelta; plan incremental 0 destroy |
| `CA-03` — DynamoDB `userId`/`jobId`, TTL 30 d | **`PASSED`** | `DescribeTable` ACTIVE HASH `userId`/RANGE `jobId` tipo S, 0 GSI; `DescribeTimeToLive` ENABLED sobre `ttl`; `T02_A_01_CLOSED: true` con fuente única `retention_days` |
| `CA-04` — IAM mínimo privilegio, CORS, `skip_*` | **`PASSED`** | 5 statements, 0 `"Action":"*"` / `"Resource":"*"`, ARNs derivados, confianza solo Lambda, `data.aws_iam_role` en vivo; `GetBucketCors` exacto `http://localhost:5173` en ambos buckets; `is_emulator` gobierna 3/3 flags con `validate -var=false` exit 0 |
| `CA-05` — CI integración con `apply` y tests | **`PASSED`** | Sesión única `up→cp→apply→tests→down`; 6/6 tests de infra; guardias no vacuas (7/7 divergencias de retención detectadas, 2/2 GSI>0 rechazadas); run `44312560558` `success` 14/14 pasos |

**Cierre de seguimientos heredados:**
- **`T02-A-01`** (alineación retención S3 ↔ TTL DynamoDB): **CERRADO** por verificación en T03 (lifecycle 30 d + TTL ENABLED + derivación `2592000` compartida).
- **`T04-A-03`** (no heredar `skip_*`): **CERRADO** por la variable `is_emulator` en T04.
- **`F04T01-A-01` / `F04T03-A-01`**: **CERRADOS** por la guardia CI de retención y la sonda `GSI_COUNT: 0` en T05.

## 3. Gobernanza, seguimientos y confinamiento

| Tema | Disposición |
|---|---|
| SigV4 `SignatureDoesNotMatch` (T04) | Clasificado por el Auditor como limitación de la sonda artesanal, **no riesgo real**: mismas credenciales funcionan con SDK/proveedor e IAM se creó/leyó en vivo. Cobertura `LIMITED`, sin G-10 |
| P-4 — `npm install --no-save` de SDKs S3/SQS en CI (T05) | LOW, temporal: publicar manifiestos del harness F02 y retirar el paso. **No aceptado como riesgo de fase** |
| P-2 — `.tf` de T01–T04 incluidos en el commit de T05 | Confirmado por Tester: mismos blob-hashes, contenido sin cambios, necesarios para el `apply` de 11 recursos |
| `F04T03-A-03` — retención cross-sistema | Cerrado **parcialmente**: faltan el default runtime de `backend/src/config/index.ts` y el control de cambios del catálogo (competencia CTO, fuera de alcance) |
| Inventario a F05 / CTO | P4 (rutas en artefactos G-6b, **ampliado** por 3 evidencias T05 con banner `<PROJECT_ROOT>/...`), rol IAM único para API+worker, `cors_origin` parametrizado, default `is_emulator=true`, perfiles `USER#` sin `ttl`, billing PROVISIONED 5/5, acciones `@v4/@v3` por tag mutable |
| Gates | G-2 (autorización de fase), G-3 (sin secretos), G-6/G-6b (repo público, archivos IA), G-7 (2 GiB/2.0 con `if: always()` en CI), G-8 (lockfile F00). **G-11/G-12 no ejecutados** (Fase Final). Sin AWS real |

**Confinamiento:** no se modificaron `frontend/`, `backend/`, manifiestos raíz, `STATE.md` ni `docs/sdd/tasks.md`; sin `terraform apply` contra AWS real; Docker apagado tras cada prueba y al cierre (`docker ps -a` vacío, red eliminada); `temporary/` intacto; sin secretos versionados.

## 4. Aprendizajes candidatos

| Aprendizaje | Ámbito | Evidencia |
|---|---|---|
| Un único emulador efímero exige sesión única `up→cp→apply→sondas→down`: dividirla provoca recreación de recursos por el state en memoria | `SOLO_LOCAL` | P2 de T02/T03/T04, confirmado por Tester en T05 |
| La retención debe tener una sola fuente y una guardia CI que contraste HCL, `.env.example` y catálogo congelado | `PROPUESTA_GLOBAL` | Guardia de T05, cierre de `F04T01-A-01`/`F04T03-A-03` |
| Los `skip_*` del bootstrap nunca deben heredarse a entorno real: gobernarlos con `is_emulator` | `PROPUESTA_GLOBAL` | Cierre de `T04-A-03` |
| Los chequeos de mínimo privilegio por igualdad exacta no detectan comodines parciales (`s3:*`, ARNs con substring) | `PROPUESTA_GLOBAL` | `F04T04-A-02` |
| La anonimización de rutas en evidencias debe aplicarse al banner de Vitest, no solo al cuerpo del reporte | `PROPUESTA_GLOBAL` | `F04T05-A-06` (P4 ampliado) |

Tiempo observado: ejecución secuencial de cinco tareas con Tester y Auditor por cada una, en una sola sesión Docker por verificación; esperas de herramienta/harness no cuantificadas, no reconstruidas solo desde fechas de archivo.

---

**Retorno final:** `FASE_COMPLETA` — P-04 cerrada con `CA-01`…`CA-05` en `PASSED` y auditorías sin `CRITICAL`/`HIGH`. `reports/implementation/F04/F04-coordination.md` se cierra con `FASE_COMPLETA`. Se detiene la ejecución del Architect y se entrega al CTO para revisión, consolidación de `STATE.md`/`tasks.md` y autorización de la Fase Final.

---

## Addendum de anonimización P4 (F05-T02, 2026-11-18)

En el marco de la tarea `F05-T02` (política P4 / G-6b) se sustituyeron las rutas
absolutas del entorno de desarrollo por marcadores: `<PROJECT_ROOT>`,
`<LAB_ROOT>`, `<DOCKER_CLI_DIR>`, `<TF_CLI_DIR>`, `<NPM_CACHE_DIR>` y
`<USER_HOME>`. La sustitución fue **mecánica y exclusiva de esas rutas**: no se
modificaron hallazgos, severidades, cifras, conclusiones ni el historial
append-only. Este addendum conserva la trazabilidad del reemplazo.