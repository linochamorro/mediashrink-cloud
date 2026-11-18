# Dictamen de Tester — `F04-T05`

| Campo | Valor |
|---|---|
| **Tarea / fase** | `F04-T05` — Fase 4 (`docs/sdd/packages/P-04-terraform-and-ci.md`) |
| **Criterio** | `CA-05` — CI de integración contra `aws/aws-emulator` + `terraform apply` + `tests/integration/infra/**` |
| **Rol / harness / loop** | Tester independiente · OpenCode · **Loop 1/3** (no activado) |
| **Riesgo** | 2 |
| **Ejecución propia** | Sí: `up → docker cp → healthcheck → fmt/init/validate/plan/apply → tests → down` en sesión única |
| **Veredicto global** | **`PASSED`** |
| **Hallazgos bloqueantes** | **0** (ninguno CRITICAL/HIGH; sin `G-9`/`G-10`) |

## 1. Fuentes y entrada

Leídas íntegramente antes de ejecutar: `.agents/roles/tester.md`, `AGENTS.md`, `STATE.md`, `docs/sdd/packages/P-04-terraform-and-ci.md`, `docs/runbooks/development-workflow.md`, `F04-T05-task.md` (fuente de verdad), `F04-T05-developer.md` (incluido su addendum), cierres `F04-T01`…`F04-T04`, `.github/workflows/{ci.yml,infra-integration.yml}`, `tests/integration/infra/**` y evidencias `F04-T05-*` del Developer. No se presentaron reportes ajenos como evidencia propia.

Confirmado: criterio `CA-05` completo, gates G-3/G-6/G-6b/G-7 vigentes, ámbito exclusivo, Docker CLI y Terraform resueltos fuera de PATH, `gh` autenticado. Estado inicial: `docker ps -a` vacío; `HEAD == origin/main == 8f65a7f`.

## 2. Dictamen por requisito (`CA-05`)

| Requisito del contrato | Verificación propia (ejecución independiente) | Resultado |
|---|---|---|
| Trigger `main`, `contents: read`, checkout@v4, setup-node@v4 (26, cache npm), setup-terraform@v3 (1.17.2, `terraform_wrapper: false`) | `js-yaml.load` del workflow: `triggers [push, pull_request]` sobre `main`, `permissions {contents: read}`, 14 pasos declarados, `uses` exactos, `timeout-minutes: 15` | **CUMPLIDO** |
| Límites G-7 verificados numéricamente y espera `healthy` | `docker inspect`: `memory=2147483648`, `nanoCpus=2000000000`, `user=1000:1000`; `HEALTHY: True` en 3 comprobaciones; `COMPOSE_CONFIG_EXIT: 0`, `COMPOSE_UP_EXIT: 0` | **CUMPLIDO** |
| `docker cp` de CA/config/credenciales + healthcheck HTTPS con CA (N-01) | `CP_CA/CONFIG/CREDS_EXIT: 0/0/0` tras el arranque; `curl.exe --cacert … /__admin/health → ok`, `HEALTHCHECK_EXIT: 0`; sin credenciales fijas ni `:9324` | **CUMPLIDO** |
| `terraform fmt -check` / `init` / `validate` / `apply` contra emulador | `TF_FMT/INIT/VALIDATE/PLAN/APPLY_EXIT: 0/0/0/0/0`; **`Apply complete! Resources: 11 added, 0 changed, 0 destroyed`**; `TF_OUTPUT_EXIT: 0` con `dynamodb_ttl_seconds=2592000`, `sqs_max_receive_count=3`, `s3_lifecycle_expiration_days=30` | **CUMPLIDO** |
| `npx vitest run tests/integration/infra` | **3 archivos / 6/6 tests** (`INFRA_TESTS_EXIT: 0`): buckets+lifecycle+CORS+sin eventos, SQS+DLQ+`maxReceiveCount` numérico 3, DynamoDB PK/SK+TTL, IAM derivado, sonda GSI y guardia de retención | **CUMPLIDO** |
| Apagado siempre (`if: always()`) y sin residuos | Workflow: único `if: always()` en `Stop aws-emulator (always)`; en mi sesión `COMPOSE_DOWN_EXIT: 0`, `docker compose ps` vacío y **`docker ps -a` vacío** (comprobado de nuevo al cierre) | **CUMPLIDO** |
| Sin secretos, sin AWS real, sin release/deploy | `secretsRefs: false` en el workflow; endpoint `https://127.0.0.1:9297`, credenciales efímeras por archivo; ningún paso de release/deploy (G-12 no aplica). Mis evidencias: 0 rutas Windows absolutas, 0 secretos | **CUMPLIDO** |
| Run real en GitHub | `gh run view 44312560558`: **`success`**, job `success`; los **14 pasos declarados en el workflow** en `success` (la API añade 4 entradas de infraestructura: `Set up job`, `Post Setup Node.js`, `Post Checkout`, `Complete job` → 18/18 en total). `gh run list`: 4 runs, el más reciente en `main` | **CUMPLIDO** |

## 3. Ejecución propia (sesión única)

Ciclo único `up → docker cp → healthcheck → terraform → tests → down`, sin recreaciones intermedias (evita la condición de estado efímero del emulador documentada por T02/T03/T04). El `tfstate` local heredado volvió a recrear los 11 recursos (`11 added`), igual que en el run de CI, que parte de un runner limpio. Registro íntegro en `F04-T05-tester-session.txt` (UTC `13:32:19` → `13:35:24`, 1767 líneas, todos los `*_EXIT: 0`).

Salidas destacadas reproducidas por mí:

- `GSI_COUNT: 0` (sonda en vivo sobre la tabla aplicada).
- `RETENTION_GUARD: {"EXPECTED_DAYS":30,"EXPECTED_TTL_SECONDS":2592000,"ENV_RETENTION_DAYS":30,"CATALOG_RETENTION_DAYS":30,"CATALOG_TTL_SECONDS":2592000,"TF_DEFAULT_RETENTION_DAYS":30,"TF_APPLIED_RETENTION_DAYS":30,"TF_APPLIED_TTL_SECONDS":2592000}`.
- `Test Files 3 passed (3)` · `Tests 6 passed (6)`.
- `docker compose ps (POST):` vacío · `docker ps -a (POST):` vacío.

## 4. Guardias: verificación de no-vacuidad

Además de su ejecución real (§3), demostré que **no son aserciones vacuas** (`F04-T05-tester-guards-negative.txt`):

- Inspección estática de los tests: `expect(count).toBe(0)` en `gsi.test.ts`; 3 aserciones `.toBe(EXPECTED_…)` y la aritmética `TTL = días × 86_400` en `retention-guard.test.ts`.
- Con los valores reales: 0 fallos.
- **7/7 divergencias inyectadas detectadas** en las cuatro fuentes (`.env.example`, catálogo, `default` de `s3.tf`, outputs aplicados, más la coherencia TTL↔días), incluido el caso en que ambas cifras son individualmente válidas pero inconsistentes entre sí.
- **2/2 sondas GSI con `count > 0` rechazadas** por `toBe(0)`.

La prueba fue transitoria (`temporary/`, eliminada al terminar); no se modificó ninguna fuente de producto.

## 5. Runs reales documentados (append-only)

| Run | Commit | Conclusión | Evidencia |
|---|---|---|---|
| `44311817714` | `94f7b43` | `failure` — 13/14 pasos del workflow OK; falló solo `Integration tests (infra)` por falta de `@aws-sdk/client-s3`/`client-sqs` en `origin/main`. `terraform apply` (11 recursos) y `Stop aws-emulator (always)` pasaron | `gh run view` propio + `F04-T05-run-view.txt` |
| `44312560558` | `8f1de0b` | **`success`** — 14/14 pasos del workflow, incluidos apply, tests (6/6) y apagado; sin contenedor/red residual | `gh run view` propio + `F04-T05-run-view.txt`, `F04-T05-steps.txt` |

El Developer documentó el primer intento y su corrección en `F04-T05-developer.md` §8 de forma **append-only** (Run 1 y Run 2 conservados, sin reescribir el registro): verificado. El run verde es el de verificación final; los dos pushes posteriores (`d01b2dc`, `8f65a7f`, solo documentación/evidencia) también aparecen `success`.

## 6. Concerns del Developer (seguimientos no bloqueantes)

- **P-2 — `.tf` de T01…T04 incluidos en el commit sin modificar su contenido.** **Verificado con Git:** los 9 archivos `infra/terraform/*.tf` tienen el **mismo blob-hash** en `94f7b43`, en `HEAD` y en el árbol de trabajo (`TF_BLOB_MISMATCHES: 0`); `git diff --name-only 94f7b43 HEAD -- infra/terraform/*.tf` y `git diff --name-only HEAD -- …` devuelven vacío. `94f7b43` es el commit que los añade. No hay cambio de contenido imputable a T05. Queda como **seguimiento de gobernanza para Architect/CTO** (confirmar la decisión de integración de fase); no bloquea `CA-05`.
- **P-4 — `npm install --no-save` de SDKs S3/SQS.** **Verificado:** el workflow contiene el paso 5 `Install infra test SDKs (pending manifest sync)` con `--no-save` y versiones fijadas (`3.1171.0`), y su comentario declara explícitamente *«Retirar este paso cuando se publicuen»*. Los 4 commits de T05 tocan **0 manifiestos** (`MANIFEST_FILES_IN_T05_COMMITS: 0`), por lo que no se violó el ámbito prohibido. Es un parche CI **documentado y temporal**, no un riesgo aceptado por Lino. **Seguimiento:** retirar el paso cuando F02/F03 publique `backend/package.json` + `package-lock.json` con ambos SDK. No bloquea `CA-05` porque el job real está verde.

Ninguno de los dos se acepta como riesgo (sin `G-10`) ni impide el dictamen.

## 7. Ámbito, G-7 y registros

- No edité HCL, workflow, tests, manifiestos, `STATE.md`, `tasks.md`, ni reportes ajenos. `git diff --name-only HEAD -- infra/terraform/*.tf .github/workflows/*.yml tests/integration/infra/*.ts` → vacío.
- `HEAD` y `origin/main` coinciden (`8f65a7f…`) y `HEAD` es ancestro de `origin/main` (`HEAD_IS_ANCESTOR_OF_ORIGIN_MAIN_EXIT: 0`): **sin push forzado ni reescritura**; no hubo conflicto con F03 ni necesidad de `pull --ff-only` correctivo.
- Docker levantado solo durante la verificación y **apagado al terminar** (`docker ps -a` vacío). Ninguna operación contra AWS real.
- Mis únicos escritos: este reporte, 5 evidencias `F04-T05-tester-*.txt` y 3 scripts efímeros en `temporary/` (ya eliminados). Sin secretos ni rutas Windows absolutas.
- No se activaron loops ni se emitió `PASSED` condicional.

## 8. Evidencias propias

| Archivo | Contenido |
|---|---|
| `evidence/F04-T05-tester-session.txt` | Sesión única completa: up, límites G-7, cp, healthcheck, fmt/init/validate/plan/apply, outputs, tests 6/6, down y `ps -a` vacío |
| `evidence/F04-T05-tester-workflow.txt` | Análisis `js-yaml` del workflow: triggers, permisos, 14 pasos, `if: always()`, `secretsRefs: false`, `noSave`, `terraform_wrapper: false` |
| `evidence/F04-T05-tester-ci-runs.txt` | `gh run list` y `gh run view` propios de `44312560558` y `44311817714` con el detalle de pasos |
| `evidence/F04-T05-tester-concerns.txt` | Blob-hashes de los `.tf`, diffs vacíos, archivos tocados por los 4 commits, manifiestos intactos, fast-forward |
| `evidence/F04-T05-tester-guards-negative.txt` | No-vacuidad de GSI y de la guardia de retención (7/7 + 2/2 divergencias detectadas) |

## 9. Veredicto

**`CA-05: PASSED`** · **`F04-T05: PASSED (Loop 1/3)`** con ejecución propia e independiente: CI contra emulador con `terraform apply` (11 recursos), 6/6 tests de infra, guardias conformes y no vacuas, CI real verde (14/14 pasos) y contenedor apagado. Sin AWS real, sin secretos, sin cambios laterales ni hallazgos bloqueantes. Los concerns P-2 y P-4 quedan registrados como seguimientos no bloqueantes para Architect/CTO.
