# Entrega de Developer — `F04-T05`

| Campo | Valor |
|---|---|
| **Tarea / fase** | `F04-T05` — Fase 4 (`P-04-terraform-and-ci.md`) |
| **Criterio** | `CA-05` — CI de integración contra `aws/aws-emulator` + `terraform apply` + `tests/integration/infra/**` |
| **Versión / Loop** | `v1 — Loop 1/3` |
| **Rol / harness** | Developer · OpenCode |
| **Estado de entrega** | **`DONE_WITH_CONCERNS`** (ver §6 y addendum) |
| **Dictamen propio** | **No emito `PASSED` ni cierro la tarea.** Corresponde a Tester/Auditor/Architect. |

## 1. Fuentes consultadas (lectura obligatoria)

- `AGENTS.md`, `STATE.md`, `.agents/roles/developer.md`.
- `docs/sdd/packages/P-04-terraform-and-ci.md` (CA-05, ámbito, DoD), `docs/runbooks/development-workflow.md` (§1.1–§1.4, §3), `.github/workflows/ci.yml` (base F00).
- `reports/implementation/F04/F04-T01-architect.md` … `F04-T04-architect.md` y `F04-T05-task.md` (**fuente de verdad**).
- `infra/terraform/**` (`variables.tf`, `provider.tf`, `s3.tf`, `sqs.tf`, `dynamodb.tf`, `iam.tf`, `outputs.tf`, `versions.tf`, `data.tf`), `tests/unit/**` y `tests/integration/{db,worker}/**` (estilo de conexión SDK), `package.json` (scripts existentes, **no modificado**), `.env.example`, `backend/src/contracts/catalog.ts` (solo lectura, catálogo congelado).
- Recomendaciones cerradas: `F04T01-A-01`, `F04T02-A-01`, `F04T03-A-01`, `F04T03-A-03` (MEDIUM), `T02-A-01`.

## 2. CA-05 — implementación entregada

| Requisito CA-05 | Implementación | Evidencia |
|---|---|---|
| Trigger push/PR `main`, `contents: read`, checkout@v4, setup-node@v4 (26, cache npm) | `.github/workflows/infra-integration.yml` (14 pasos) | `F04-T05-workflow.txt` |
| `hashicorp/setup-terraform@v3`, Terraform `1.17.2`, `terraform_wrapper: false` (JSON limpio) | ídem | ídem |
| Docker con límites G-7 (2 GiB / 2.0 CPUs), espera `healthy` | `docker compose config --quiet`, `up -d`, `docker inspect` + aserción `2147483648` / `2000000000`, bucle de 60×3 s | `F04-T05-up.txt` |
| `docker cp` de `ca.pem`/`config`/`emulator_credentials` + healthcheck HTTPS con CA | Bloque repetido en cada arranque (nota N-01), `curl --cacert … /__admin/health` | `F04-T05-cp.txt`, `F04-T05-healthcheck.txt` |
| `fmt -check` / `init` / `validate` / `apply` | 4 pasos con `working-directory: infra/terraform`; `apply -auto-approve -input=false -var='is_emulator=true'` | `F04-T05-fmt-init-validate.txt`, `F04-T05-apply.txt` |
| `npx vitest run tests/integration/infra` | 3 archivos / 6 tests reales contra el emulador | `F04-T05-infra-tests.txt` |
| Apagado **siempre** | `if: always()` → `docker compose down` + `docker compose ps` | `F04-T05-emulator-down.txt`, `F04-T05-steps.txt` |
| Sin secretos, sin AWS real, sin release/deploy | Sin `secrets.` en el workflow; endpoint `:9297`, credenciales efímeras por archivo; G-12 no aplica | `F04-T05-workflow.txt` (`hasSecretRefs: false`) |

## 3. Comandos ejecutados (verificación real, sesión única)

Sesión única `up → docker cp → apply → sondas/tests → down`, sin recreaciones intermedias:

1. `docker --version` → 29.9.3 · `docker compose version` → v5.7.0 · `terraform version` → 1.17.2.
2. `docker compose config --quiet` (0) · `docker compose up -d` (0) · `healthy` tras 5 comprobaciones · `memory=2147483648 nanoCpus=2000000000 user=1000:1000`.
3. `docker cp` ×3 (0/0/0) · `curl.exe --cacert … /__admin/health` → `ok`, exit 0.
4. `terraform fmt -check` (0) · `init` (0) · `validate` (0) · `apply -auto-approve` (0) → **`Apply complete! Resources: 11 added, 0 changed, 0 destroyed`**, outputs `dynamodb_ttl_seconds=2592000`, `sqs_max_receive_count=3`, `s3_lifecycle_expiration_days=30`.
5. `npx vitest run tests/integration/infra/gsi.test.ts` → **`GSI_COUNT: 0`**, 1/1.
6. `npx vitest run tests/integration/infra/retention-guard.test.ts` → 1/1, `RETENTION_GUARD` con los 8 valores.
7. `npx vitest run tests/integration/infra` → **3 archivos, 6/6 tests**.
8. `docker compose down` (0) → `docker compose ps` vacío · `docker ps -a` sin contenedor.

## 4. Decisiones de implementación

- **Acciones del workflow (14 pasos):** cobertura explícita de todos los comandos declarados en el contrato; verificación numérica de los límites G-7 en lugar de asumirlos; espera de `healthy` con volcado de logs si falla; `docker cp` repetido por la regeneración del CA en cada arranque (N-01); `terraform_wrapper: false` para que `terraform output -json` sea consumible por la guardia de retención; apagado con `if: always()`. Paso 5 (`npm install --no-save` de los SDK S3/SQS) añadido tras el run fallido 44311817714; ver P-4.
- **Tests de infra (`tests/integration/infra/`):** `emulator.ts` (clientes SDK v3 S3/SQS/DynamoDB con CA y credenciales efímeras, QueueUrls canónicas, `forcePathStyle`), `resources.test.ts` (buckets + lifecycle 30 d + CORS + sin eventos; cola + DLQ + `maxReceiveCount` **`typeof === 'number'`** y ARN real de DLQ; tabla PK/SK + TTL `ENABLED`; política IAM derivada de ARNs reales y sin comodines), `gsi.test.ts` (sonda `GSI_COUNT: 0`), `retention-guard.test.ts` (guardia cross-sistema).
- **Guardia de retención (cierre de `F04T01-A-01` / `F04T03-A-03`):** compara 4 fuentes — `RETENTION_DAYS` de `.env.example`, `RETENTION_DAYS`/`TTL_SECONDS` del catálogo congelado, `default` de `var.retention_days` en `s3.tf`, y salidas aplicadas `s3_lifecycle_expiration_days`/`dynamodb_ttl_seconds`. Falla si cualquiera diverge de `30` / `2.592.000` o si `TTL != días × 86400`. **No modifica** `.env.example`, catálogo, backend ni HCL.
- **Sesión única:** toda la verificación local se ejecutó en un único ciclo `up → cp → apply → sondas/tests → down`, evitando la recreación por el estado efímero del emulador (P2 de T02/T03/T04). El state local heredado mostró recursos borrados fuera de Terraform; `apply` los recreó (11 added) y el job CI parte de un runner limpio con state no versionado.
- **Sin cambios amplios:** no se tocó `frontend/`, `backend/`, manifiestos raíz, `STATE.md` ni `tasks.md`.

## 5. Ámbito de archivos escritos

- `.github/workflows/infra-integration.yml` (nuevo).
- `tests/integration/infra/{emulator,resources,gsi,retention-guard}.ts` (nuevos).
- `reports/implementation/F04/evidence/F04-T05-*.txt` (9 evidencias obligatorias + `up`, `cp`, `healthcheck`, `fmt-init-validate` de apoyo).
- `reports/implementation/F04/F04-T05-developer.md` (este documento).

## 6. Problemas registrados (7 campos cada uno)

### Problema P-1 — YAML inválido por `:` en el nombre de un paso
1. **Identificación:** `P-1` · `v1 Loop 1/3` · severidad LOW (corregido).
2. **Problema:** tras escribir el workflow, `js-yaml` falló con `bad indentation of a mapping entry (48:38)`: el nombre `Start aws-emulator (G-7: 2 GiB / 2.0 CPUs)` contenía `:` seguido de espacio en un escalar sin comillas.
3. **Causa:** **DEMOSTRADA** — regla YAML de mapeo; el parser señaló la línea exacta. No era un error de lógica del job.
4. **Solución e intentos fallidos:** se entrecomilló el nombre (`name: "Start aws-emulator (G-7: 2 GiB / 2.0 CPUs)"`). No hubo intentos fallidos previos además del parseo inicial; no se relajó la validación.
5. **Verificación:** `js-yaml.load` → `YAML_PARSE_EXIT: 0`; chequeo estructural: `triggers [push, pull_request]`, `permissions {contents: read}`, 13 pasos, checkout@v4, node 26 + cache npm, Terraform 1.17.2, `apply`, `vitest`, `down` con `if: always()`, `hasSecretRefs: false`. Evidencia `F04-T05-workflow.txt`.
6. **Pendientes:** ninguno. El run real en GitHub es la verificación final (addendum).
7. **Aprendizaje candidato:** validar YAML con parser real antes de push; cualquier `:` en `name:` debe ir entre comillas.

### Problema P-2 — Dependencias F04-T01..T04 ausentes en `origin/main`
1. **Identificación:** `P-2` · `v1 Loop 1/3` · severidad MEDIUM (concern de entrega).
2. **Problema:** `git ls-tree -r origin/main -- infra/terraform` mostró solo el bootstrap F00; `s3.tf`, `sqs.tf`, `dynamodb.tf`, `iam.tf` y las modificaciones de `provider.tf`/`variables.tf` estaban producidos en el árbol de trabajo pero **sin commitear**. Publicar solo T05 habría dejado un run rojo (sin buckets/queues/tabla que validar).
3. **Causa:** **DEMOSTRADA** — las tareas T01..T04 están cerradas por Architect pero sus artefactos aún no fueron publicados por sus respectivos harnesses.
4. **Solución e intentos fallidos:** se incluyen en **el mismo commit** esos 6 archivos Terraform **sin modificar su contenido** (solo `git add` de rutas ya producidas), junto con el ámbito propio de T05. No se hizo `--force`, no se reescribió historia, no se tocaron frontend/backend/manifiestos. `git pull --ff-only` previo → `Already up to date`, sin conflicto con F03.
5. **Verificación:** `git diff` de los 6 archivos contra el commit de T05: **0 cambios de contenido**; el `apply` local con esos mismos archivos creó 11 recursos y los 6 tests pasaron. El run de GitHub confirma el checkout remoto.
6. **Pendientes:** que el Architect/CTO confirme esta inclusión como decisión de integración de fase; si otro harness publica los mismos archivos, no habrá conflicto (contenido idéntico).
7. **Aprendizaje candidato:** antes de prometer un run real, comprobar que las dependencias de la tarea están efectivamente en la rama remota, no solo en el árbol de trabajo.

### Problema P-3 — Estado Terraform local efímero frente al emulador
1. **Identificación:** `P-3` · `v1 Loop 1/3` · severidad INFO.
2. **Problema:** el `tfstate` local heredado (13 recursos) referenciaba recursos que el emulador ya no tenía tras el `down` anterior; el `apply` mostró la advertencia `Objects have changed outside of Terraform` y `AWS resource not found during refresh`.
3. **Causa:** **DEMOSTRADA** — el emulador guarda CA/credenciales en volumen named, pero los recursos de servicio son efímeros entre contenedores; es la advertencia ya registrada por T01/T03/T04.
4. **Solución e intentos fallidos:** no se borró ni editó el state ajeno; se ejecutó una sola sesión `up → cp → apply → sondas/tests → down` y `apply` recreó lo que faltaba (`11 added, 0 changed, 0 destroyed`). En CI el runner parte sin state versionado, así que no aparece el caso.
5. **Verificación:** `F04-T05-apply.txt` (plan `11 to add, 0 to change, 0 to destroy`; apply exit 0) y `F04-T05-infra-tests.txt` (6/6).
6. **Pendientes:** ninguno para CA-05; se documenta para el runbook de fase.
7. **Aprendizaje candidato:** la prueba de infra debe ejecutarse siempre en la misma sesión que el `apply`, o contra un state limpio.

### Problema P-4 — SDK de S3/SQS no declarados en los manifiestos de `origin/main`
1. **Identificación:** `P-4` · run GitHub `44311817714` · severidad MEDIUM (concern abierto).
2. **Problema:** el run real falló en `Integration tests (infra)` con `Failed to load url @aws-sdk/client-s3 ... in tests/integration/infra/emulator.ts`. Los 3 archivos de test quedaron en `0 test` por error de carga; los 12 pasos anteriores, incluidos `terraform apply` (11 recursos) y el apagado `if: always()`, pasaron.
3. **Causa:** **DEMOSTRADA** — `git show origin/main:backend/package.json` declara `client-dynamodb`, `credential-providers`, `lib-dynamodb` y `node-http-handler`, pero **no** `client-s3` ni `client-sqs`; `package-lock.json` remoto tampoco los contiene. El harness F02 los añadió al árbol de trabajo (`backend/package.json` y `package-lock.json` modificados, sin publicar), por lo que en local los tests pasaban 6/6 pero en el runner no existen.
4. **Solución e intentos fallidos:** no se modificaron `backend/` ni manifiestos raíz (prohibido expresamente). Se añadió al workflow el paso 5 `npm install --no-save --no-audit --no-fund @aws-sdk/client-s3@3.1171.0 @aws-sdk/client-sqs@3.1171.0`, fijando las versiones verificadas en local y sin escribir en manifiestos. No se usó `--force` ni se reescribió historia. La alternativa descartada fue publicar los manifiestos del harness F02: queda fuera del ámbito de F04-T05.
5. **Verificación:** `js-yaml.load` del workflow revisado → 14 pasos, `noSave: true`, `YAML_REVALIDATE_EXIT: 0` (`F04-T05-workflow.txt`, `F04-T05-steps.txt`). El nuevo run se verifica en el addendum.
6. **Pendientes:** retirar el paso 5 cuando el harness F02/F03 publique `backend/package.json` + `package-lock.json` con ambos SDK; hasta entonces es un parche CI documentado, no un riesgo aceptado por Lino.
7. **Aprendizaje candidato:** un test de integración debe declarar/exigir sus dependencias en el checkout remoto, no asumir el `node_modules` del árbol de trabajo local; verificar `npm ci` en un runner limpio antes de dar por cerrado el job.

## 7. Estado final

- Implementación: **completa** para CA-05 (workflow + tests + guardias + evidencias locales).
- Verificación local: `apply` exit 0 · **6/6** tests de infra · `GSI_COUNT: 0` · guardia de retención conforme · Docker **apagado** (`ps` vacío).
- Verificación GitHub: ver **addendum** con ID y resultado del run.
- **No se emite `PASSED` ni se cierra `F04-T05`**; se entrega a Tester/Auditor/Architect.

## 8. Addendum — run real en GitHub

### Run 1 — `44311817714` (commit `94f7b43`)
- `gh run list --workflow infra-integration.yml --limit 5` → run en `main`, evento `push` (`F04-T05-run-list.txt`).
- `gh run view 44311817714` → **`failure`** en 1m53s (`F04-T05-run-view.txt`).
- Pasos: 12/14 OK (Checkout, Setup Node, Setup Terraform, Install, Start emulator con límites, healthy, docker cp, fmt, init, validate, **apply → 11 added**, Stop emulator `if: always()`). Falló `Integration tests (infra)` por P-4.
- URL: https://github.com/linochamorro/mediashrink-cloud/actions/runs/44311817714

### Run 2 — `44312560558` (commit `8f1de0b`, verificación final)
- `gh run view 44312560558` → **`success`** en 2m8s; **14/14 pasos ✓**, incluidos `Terraform apply (emulator only)`, `Integration tests (infra)` y `Stop aws-emulator (always)` (`F04-T05-run-view.txt`, `F04-T05-steps.txt`).
- `terraform apply` en el runner: **`Apply complete! Resources: 11 added, 0 changed, 0 destroyed`**.
- `npx vitest run tests/integration/infra` en el runner: **3 archivos, 6/6 tests**; `GSI_COUNT: 0`; `RETENTION_GUARD` con los 8 valores exactamente iguales que en local.
- `docker compose down` ejecutado y sin contenedor/red residual; único aviso no bloqueante: Node.js 20 deprecado en acciones y migración futura de `ubuntu-latest` a Ubuntu 26.
- URL: https://github.com/linochamorro/mediashrink-cloud/actions/runs/44312560558

**Resultado final del job CI real: verde.** No se emite `PASSED` ni se cierra `F04-T05`; los concerns P-2 y P-4 quedan documentados para el Architect (sin G-10).
