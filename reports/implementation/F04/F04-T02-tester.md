# `F04-T02` — Reporte de Tester (verificación independiente)

| Campo | Valor |
|---|---|
| **Tarea / Fase** | `F04-T02` · Fase 4 — `docs/sdd/packages/P-04-terraform-and-ci.md` |
| **Criterio verificado** | **`CA-02`** (SQS + DLQ, `maxReceiveCount=3`, visibilidad y transporte) |
| **Versión / Loop** | `v1 — Loop 1/3` (primer dictamen de Tester; **no se activan loops**) |
| **Rol / verificador** | Tester independiente (ejecución propia, no reutiliza evidencia ajena como propia) |
| **Fecha (UTC)** | `2026-11-18` · ejecución propia `12:02:25` → `12:05:42` |
| **Duración / procesos propios** | ~4 min · Docker Compose (`ps`, `config`, `up`, `inspect`, `cp`, `down`), `curl.exe`, Terraform (`fmt`, `init`, `validate`, `plan` ×2, `apply`, `output`), `node` (probe SQS propio), `git status` |
| **Veredicto global** | **`PASSED`** — `CA-02` satisfecho con evidencia propia; 0 hallazgos bloqueantes |

## 1. Fuentes consultadas y aislamiento

- Contrato de rol `.agents/roles/tester.md`; `AGENTS.md`; `STATE.md`; paquete `P-04-terraform-and-ci.md` (CA-02, DoD).
- SDD: `spec.md` **FR-10** (encolado con DLQ) y **FR-13** (3 reintentos → DLQ, el lote continúa); `constitution.md` **IN-08** (worker reintenta 3 veces, DLQ, `FAILED` sin abortar el lote).
- Fuente de verdad de la tarea: `reports/implementation/F04/F04-T02-task.md` (CA-02, ámbito, entregables, prohibiciones).
- Entrega bajo revisión: `F04-T02-developer.md` (`DONE_WITH_CONCERNS`, P1/P2/P3); cierre previo `F04-T01-architect.md` (`PASSED`).
- Artefactos inspeccionados: `infra/terraform/{sqs,provider,variables,versions,data,outputs,s3}.tf` y `README.md`; 16 evidencias `F04-T02-*` del Developer (historial append-only).
- Entorno: único transporte `https://127.0.0.1:9297`; credenciales por `AWS_SHARED_CREDENTIALS_FILE`/`AWS_CONFIG_FILE`; CA autofirmado propio; **sin `:9324`, sin AWS real, sin secretos**. Binarios fuera de PATH (rutas resueltas en tiempo de ejecución y redactadas en evidencia como `<DOCKER_CLI_DIR>` / `<TF_BIN>`).

## 2. Dictamen por criterio — `CA-02`

| Requisito CA-02 | Resultado propio | Evidencia Tester | Estado |
|---|---|---|---|
| Cola principal `mediashrink-jobs` y DLQ `mediashrink-jobs-dlq` | `ListQueues` → `COUNT_EQ_2: true`, `JOBS_PRESENT: true`, `DLQ_PRESENT: true`; `DLQ_EXISTS: true` (ARN real vía `GetQueueAttributes`) | `F04-T02-tester-probe.txt` | **CUMPLIDO** |
| `redrive_policy` apuntando a la DLQ con `maxReceiveCount = 3` (IN-08/FR-13) | `REDRIVE_POLICY_RAW: {"deadLetterTargetArn":"arn:aws:sqs:us-east-1:000000000000:mediashrink-jobs-dlq","maxReceiveCount":3}`; `DLQ_ARN_IN_POLICY_MATCHES_DLQ: true`; **`MAX_RECEIVE_COUNT_JS_TYPE: number`**, `MAX_RECEIVE_COUNT_IS_NUMBER: true`, `MAX_RECEIVE_COUNT_EQ_3: true` | `F04-T02-tester-probe.txt` | **CUMPLIDO** |
| Visibility timeout definido y coherente con el reintento | `VISIBILITY_TIMEOUT_SECONDS: 120` en **ambas** colas; `VISIBILITY_EQ_120_mediashrink-jobs: true` y `VISIBILITY_EQ_120_mediashrink-jobs-dlq: true`. Declarado en `sqs.tf` (variable numérica validada 0..43200) y justificado frente a `POLL_INTERVAL_MS=2000` y lotes de 20 imágenes | `F04-T02-tester-probe.txt`, `sqs.tf` | **CUMPLIDO** |
| QueueUrls canónicas (host AWS como id lógico), `:9297` como transporte, nunca `:9324` | `CANONICAL_HOST_ONLY: true`, `NO_9324_IN_QUEUE_URLS: true`; outputs `sqs_queue_url`/`sqs_dlq_url` = `https://sqs.us-east-1.amazonaws.com/000000000000/...`; `emulator_endpoint = "https://127.0.0.1:9297"` | `F04-T02-tester-probe.txt`, `F04-T02-tester-output.txt` | **CUMPLIDO** |
| Credenciales por archivo, CA propio, `bootstrap skip_*` intacto | Probe con `CREDENTIALS_FROM_FILE: true`, `CONFIG_FROM_FILE: true`, `CA_BUNDLE_FROM_FILE: true`; TLS con CA → `BODY: ok`, exit `0`; sin CA → exit `60` (esperado). `provider.tf` conserva `shared_credentials_files`, `shared_config_files`, `custom_ca_bundle`, endpoint único y las tres `skip_*` sin modificar | `F04-T02-tester-probe.txt`, `F04-T02-tester-transport.txt`, `provider.tf` | **CUMPLIDO** |
| `fmt` / `validate` / `plan` / `apply` (exit 0) y plan posterior `No changes` | `fmt=0`, `validate=0`, `plan=0`, `apply=0` (`6 added, 0 changed, 0 destroyed`), `plan-post-apply=0` → `No changes. Your infrastructure matches the configuration.` | `F04-T02-tester-{fmt,validate,plan,apply,plan-post-apply}.txt` | **CUMPLIDO** |
| Plan incremental: no destruir los buckets de T01 | `Plan: 6 to add, 0 to change, **0 to destroy**`; el refresh advierte «has been deleted» por el reinicio del emulador (P2), pero `s3.tf` y los outputs de buckets quedan idénticos. `apply`: `0 destroyed` | `F04-T02-tester-{plan,apply}.txt` | **CUMPLIDO** |
| G-7: límites, `docker cp`, apagado y `docker ps -a` vacío | `memory=2147483648`, `nanoCpus=2000000000`, `user=1000:1000`; `HEALTHY: True`; tres `docker cp` exit `0`; `compose down` + `ps -a` (solo cabecera) + red `mediashrink-cloud_default` sin entradas, verificado de nuevo tras el script | `F04-T02-tester-{compose-config,up,cp,emulator-down}.txt` + comprobación final en vivo | **CUMPLIDO** |
| Ámbito y secretos | Solo se escribieron `reports/implementation/F04/evidence/F04-T02-tester-*.txt`, este reporte y scripts efímeros en `temporary/` (ignorado). Sin HCL, tests, manifiestos, `STATE.md`, `tasks.md`, reportes ajenos ni push. Sin ruta Windows absoluta ni secreto en artefactos (búsqueda de prefijos de unidad, ID de clave AWS y asignaciones de clave secreta → 0 coincidencias) | `F04-T02-tester-scope.txt` + verificación final | **CUMPLIDO** |

**Resultado: 9/9 requisitos CUMPLIDOS.**

## 3. Ejecución propia (registro cronológico)

Todas las corridas se hicieron desde la raíz del proyecto, en una sola sesión de emulador, con mise en place previo de `AWS_ENDPOINT_URL`, `AWS_REGION`, archivos de credenciales/config, `AWS_CA_BUNDLE`, `NODE_EXTRA_CA_CERTS` y `AWS_EC2_METADATA_DISABLED=true` (sin `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`/`AWS_PROFILE`).

| # | Evidencia (`F04-T02-tester-…`) | Acción | Exit |
|---|---|---|---|
| 1 | `pre-docker-state.txt` | `docker ps -a` + red (baseline limpio) | 0 |
| 2 | `compose-config.txt` | `docker compose config` (esquema y límites declarados) | 0 |
| 3 | `up.txt` | `compose up -d` → `healthy=True`; `inspect` de límites | 0 |
| 4 | `cp.txt` | `docker cp` de `ca.pem`, `config`, `emulator_credentials` | 0 |
| 5 | `transport.txt` | `curl` con CA (`ok`, exit 0) y sin CA (exit 60, esperado) | 60 (*) |
| 6 | `fmt.txt` / `init.txt` / `validate.txt` | Terraform format, init y validate | 0 / 0 / 0 |
| 7 | `plan.txt` | Plan incremental: `6 to add, 0 to change, 0 to destroy` | 0 |
| 8 | `apply.txt` | Apply: `6 added, 0 changed, 0 destroyed`; outputs canónicos | 0 |
| 9 | `plan-post-apply.txt` | Idempotencia: `No changes` | 0 |
| 10 | `output.txt` | Outputs SQS (URLs/ARNs canónicos, 3, 120) | 0 |
| 11 | `probe.txt` | Probe SQS propio (`ListQueues` + `GetQueueAttributes` ×3) | 0 |
| 12 | `scope.txt` | Verificación de alcance Git | 0 |
| 13 | `emulator-down.txt` | `compose down` + `ps -a` + red (ejecutado en `finally`) | 0 |

(*) El `EXIT_CODE: 60` del archivo 5 corresponde al **último** comando del paso (el `curl` **sin** CA, que debe fallar precisamente para demostrar que el CA propio es obligatorio). El `curl` **con** CA devolvió `ok` con exit `0` (líneas 13–14 del archivo). No es un fallo de la verificación.

## 4. Verificación del P1 del Developer (historial append-only)

El reporte del Developer documenta el fallo inicial del primer `apply` y su corrección dentro del mismo Loop 1/3 (sin consumir loop de Tester). Revisado con los 7 campos obligatorios:

1. **Identificación:** `F04-T02-P1` — `redrive_policy` de `aws_sqs_queue.jobs` en `infra/terraform/sqs.tf`.
2. **Problema:** primer `apply` exit `1`, `waiting for SQS Queue (.../mediashrink-jobs) attributes create: timeout while waiting for state to become 'equal' (last state: 'notequal', timeout: 2m59.9632133s)`.
3. **Causa (demostrada):** la versión inicial usaba `maxReceiveCount = tostring(var.sqs_max_receive_count)` → `"3"` (string), mientras el emulador devuelve `maxReceiveCount: 3` (número); el waiter del provider nunca alcanza `'equal'`. La política sí estaba aplicada (`DLQ_ARN_PRESENT_IN_POLICY: true`, `MAX_RECEIVE_COUNT_EQ_3: true` en la sonda de diagnóstico UTC 11:55). No es una API no soportada.
4. **Solución e intentos fallidos:** el único intento fallido fue `tostring(...)` (3 min de timeout); en lugar de reintentar a ciegas se sondeó la API en vivo para ver el tipo exacto. Corrección: `maxReceiveCount = var.sqs_max_receive_count` (número), con documentación de la particularidad en `sqs.tf` y `README.md`. El recurso quedó *tainted* y el segundo `apply` hizo `1 added, 0 changed, 1 destroyed` (exit 0).
5. **Verificación propia:** el fallo real sigue conservado en `F04-T02-apply-inline-string-timeout.txt` (EXIT_CODE: 1, línea 283; timestamp original 11:55:21). La declaración final en `sqs.tf` es numérica: variable `type = number`, `default = 3` (validada 1..1000) y `maxReceiveCount = var.sqs_max_receive_count` sin `tostring`. Mi ejecución independiente confirma `MAX_RECEIVE_COUNT_JS_TYPE: number`, `MAX_RECEIVE_COUNT_EQ_3: true` y `plan-post-apply → No changes` (sin diffs perpetuos).
6. **Pendientes:** ninguno bloqueante. El Auditor puede registrarlo como INFO; no es G-9 ni G-10.
7. **Aprendizaje candidato:** declarar atributos JSON de SQS con los tipos exactos que devuelve `GetQueueAttributes`; si un waiter agota el timeout, sondear la API antes de cambiar de recurso.

**Historial append-only conservado:** los 16 artefactos del Developer mantienen sus timestamps originales (11:51–11:58 UTC), anteriores a mis evidencias (12:02–12:05 UTC). No se sobrescribió, editó ni eliminó ninguno.

**P2 (INFO, heredado):** el refresh advierte que los recursos del emulador «han sido eliminados» entre sesiones (estado en memoria + volumen named que solo conserva CA/config/credenciales). Mi plan refleja `0 to destroy` y mi `apply` `0 destroyed`, con la misma configuración de T01/T02. Es comportamiento esperado del entorno, no regresión; `F04-T05` deberá ejecutar `up → apply → sondas → down` en una sola sesión de CI.

## 5. Conclusión

Con ejecución propia e independiente se verifican la declaración y el comportamiento en vivo de ambas colas: existencia de la DLQ, redrive apuntando a su ARN, `maxReceiveCount` **numérico igual a 3**, visibilidad de 120 s en ambas, QueueUrls canónicas sin `:9324`, transporte `:9297` con CA propio y credenciales por archivo, `skip_*` intactos, `apply` limpio e idempotente, y apagado completo del emulador. El P1 del Developer quedó demostrado, corregido y re-verificado; el P2 es inherente al emulador y no bloquea.

**Veredicto: `PASSED` (Loop 1/3, primer dictamen).** Sin hallazgos CRITICAL/HIGH ni bloqueantes; sin activación de loops; sin cambios fuera de `infra/terraform/**` (solo lectura) y de mis propios reportes/evidencias. Architect puede integrar este dictamen y proceder con la auditoría y el cierre de la tarea.
