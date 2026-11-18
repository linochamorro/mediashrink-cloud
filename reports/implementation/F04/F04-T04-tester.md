# `F04-T04` — Reporte de Tester (verificación independiente)

| Campo | Valor |
|---|---|
| **Tarea / Fase** | `F04-T04` · Fase 4 — `docs/sdd/packages/P-04-terraform-and-ci.md` |
| **Criterio verificado** | **`CA-04`** (IAM de mínimo privilegio, CORS explícito de SPA, flags `skip_*` condicionados y corrección `F04T03-A-04`) |
| **Versión / Loop** | `v1 — Loop 1/3` (primer dictamen de Tester; **no se activan loops**) |
| **Rol / verificador** | Tester independiente — ejecución propia; evidencia del Developer consultada solo como historial, nunca como prueba propia |
| **Fecha (UTC)** | `2026-11-18` · ejecución propia `12:52` → `13:00` aprox. |
| **Duración / procesos propios** | ~8 min · Docker Compose (`ps`, `config`, `up`, `inspect`, `cp`, `down`), `curl.exe`, Terraform (`fmt -check`, `init`, `validate`, `plan` ×2, `apply`, `output`, `validate -var=false`), `node` (sonda `GetBucketCors` propia), mini-módulo Terraform sin proveedor, `git status`/`git diff`, `Select-String` |
| **Veredicto global** | **`PASSED`** — `CA-04` satisfecho con evidencia propia; 0 hallazgos bloqueantes |

## 1. Fuentes consultadas y aislamiento

- Contrato de rol `.agents/roles/tester.md`; `AGENTS.md`; `STATE.md`; paquete `P-04-terraform-and-ci.md` (CA-04, DoD de Fase 4).
- SDD: `constitution.md` **PR-08** (secretos fuera del repositorio; G-3) y **PR-09** (transparencia IA con G-6b); `spec.md` **NFR-03** (CORS explícito, errores sin secretos ni rutas internas).
- Fuente de verdad de la tarea: `reports/implementation/F04/F04-T04-task.md` (CA-04, ámbito, entregables, prohibiciones y los 7 comandos de evidencia exigidos).
- Entrega bajo revisión: `F04-T04-developer.md` (`DONE_WITH_CONCERNS`, P1…P4 documentados); cierres previos `F04-T01-architect.md`, `F04-T02-architect.md`, `F04-T03-architect.md` (todos `PASSED`); hallazgo `F04T03-A-04` de `reports/audits/F04/F04-T03-auditor.md` §3 (LOW, corregir comentario TTL de `USER#`).
- Artefactos inspeccionados: `infra/terraform/{versions,provider,variables,data,outputs,s3,sqs,dynamodb,iam}.tf` y `README.md`; evidencias `F04-T04-*` del Developer (historial append-only, no reutilizadas como propias).
- Entorno: una sola sesión de emulador `up → cp → apply → sondas → down`; transporte único `https://127.0.0.1:9297`, CA autofirmado propio, credenciales por archivo, sin `:9324` activo, sin AWS real y sin secretos. Binarios fuera de PATH: `<DOCKER_CLI_DIR>` y `<TF_BIN>` resueltos en tiempo de ejecución y **redactados** en toda evidencia.
- Aislamiento: no se modificaron HCL, `tests/`, manifiestos, `STATE.md`, `tasks.md` ni reportes ajenos; sin commit ni push. Únicos archivos nuevos propios: 18 evidencias `F04-T04-tester-*.txt`, este reporte y scripts efímeros en `temporary/` (ignorado por Git).

## 2. Dictamen por criterio — `CA-04`

| Requisito verificado | Resultado propio | Evidencia Tester | Estado |
|---|---|---|---|
| 1. `fmt -check`, `validate`, `plan`, `apply` exit 0; plan posterior `No changes` | `fmt=0` (sin salida, HCL formateado), `init=0`, `validate=0` (`Success! The configuration is valid.`), `plan=0` (`Plan: 11 to add, 0 to change, **0 to destroy**`), `apply=0` (`Apply complete! Resources: 11 added, 0 changed, 0 destroyed`), `plan-post-apply=0` → `No changes. Your infrastructure matches the configuration.` El `11 to add` es la recreación esperada de T01…T03 + IAM/CORS al reiniciar el emulador (P2), con **0 destroy** | `F04-T04-tester-{fmt,init,validate,plan,apply,plan-post-apply}.txt` | **CUMPLIDO** |
| 2. IAM mínimo privilegio: rol `mediashrink-app-role`, política inline con 5 statements (S3 `raw`/`optimized`, SQS+DLQ, DynamoDB), 0 `"Action":"*"` / 0 `"Resource":"*"`, ARNs derivados y checks de guarda | `ROLE_NAME_EXACT: true`; `STATEMENT_COUNT: 5` (`S3RawObjectsReadWrite`, `S3OptimizedObjectsReadWrite`, `S3ListOnlyNamedBuckets`, `SqsJobsAndDlqMessaging`, `DynamoDbJobsTableCrud`); `BROAD_ACTION_STAR_COUNT: 0`, `BROAD_RESOURCE_STAR_COUNT: 0`; `DERIVED_ARN_COUNT: 7/7`; `TRUST_ONLY_LAMBDA: true`; 3 `check` presentes; lectura viva `data.aws_iam_role.app: Read complete`. Sonda SigV4 artesanal (`SignatureDoesNotMatch`) **documentada** por el Developer (P1, `support-probe.txt`, README §IAM); verificación apoyada en el proveedor oficial (crea/lee IAM en vivo) + representación declarativa (`locals`/outputs/`check`), **sin simular PASSED** de la sonda cruda | `F04-T04-tester-{iam,apply,output}.txt`, `iam.tf`, `developer.md`, `README.md`, `support-probe.txt` | **CUMPLIDO** |
| 3. CORS explícito en **ambos** buckets: origen exacto `http://localhost:5173`, `GET`/`PUT`, cabeceros explícitos sin `*` | `GetBucketCors` en vivo con mi propia sonda: en `mediashrink-raw-local` y `mediashrink-optimized-local` → `CORS_RULE_COUNT: 1`, `ALLOWED_ORIGINS: ["http://localhost:5173"]`, `ALLOWED_METHODS: ["GET","PUT"]`, 8 `ALLOWED_HEADERS` sin `*`, `ORIGIN_EXACT: true`, `METHODS_EXACT: true`, `HEADERS_NO_WILDCARD: true`, `ONE_RULE_ONLY: true`, `ALL_BUCKETS_OK: true` | `F04-T04-tester-cors.txt`, `s3.tf` | **CUMPLIDO** |
| 4. `skip_*` condicionados: `is_emulator` default `true` gobierna 3 flags + endpoint/CA/credenciales; con `false` → flags `false`, sin endpoint forzado, credenciales `[]`; procedimiento AWS real documentado **sin ejecutarlo** | Estático: `SKIP_ASSIGN_EQUAL_VAR_IS_EMULATOR: 3`, `SKIP_ASSIGN_EQUAL_LITERAL_TRUE: 0`. Mini-módulo propio sin proveedor: `true` → flags `True`, `forced_endpoint=https://127.0.0.1:9297`, `credential_files_count=1`, `custom_ca_bundle` propio, `endpoints_block_count=1`; `false` → flags `False`, `forced_endpoint` vacío, `credential_files_count=0`, `custom_ca_bundle` vacío, `endpoints_block_count=0`. `validate -var='is_emulator=false'` exit 0 sin red. README documenta `TF_VAR_is_emulator='false'` y gatea `apply` a G-12; **no se ejecutó** `plan`/`apply` en modo real | `F04-T04-tester-skip-flags.txt`, `provider.tf`, `variables.tf`, `README.md` | **CUMPLIDO** |
| 5. Corrección `F04T03-A-04`: comentario sin afirmar TTL en perfiles `USER#`, `check user_profiles_not_expiring`, sin cambio de comportamiento | `OLD_FALSE_CLAIM_PRESENT: false`; `CHECK_user_profiles_not_expiring_PRESENT: true`; `OUTPUT_dynamodb_ttl_item_policy_PRESENT: true`; `ADAPTER_TTL_OCCURRENCES: 0` (el adaptador no escribe `ttl` en `USER#`). TTL intacto: `attribute_name="ttl"`, `enabled=true`, output `dynamodb_ttl_attribute=ttl`, `dynamodb_ttl_seconds=2592000`, `user_profile_items_carry_ttl=false`, `user_accounts_expire=false` | `F04-T04-tester-comment-fix.txt`, `dynamodb.tf`, `user-store-adapter.ts` (solo lectura), `F04-T04-tester-output.txt` | **CUMPLIDO** |
| 6. Transporte y G-7: `:9297`, CA propio, sin `:9324`, sin secretos; `down` y `ps -a` vacíos | `HITS_9324_ASIGNACION_ACTIVA: 0`, `HITS_9324_EN_EVIDENCIAS_TESTER: 0` (8 menciones en HCL son solo comentarios/validación que lo **rechazan**); `HITS_RUTA_WINDOWS_ABSOLUTA: 0`, `HITS_PATRON_CLAVE_AWS: 0`, `HITS_CREDENCIAL_FIJA: 0`; `ENDPOINT_DEFAULT_9297: true`, `VALIDATION_RECHAZA_9324: true`, `CA_PROPIO: true`. Healthcheck con CA → `ok`, exit 0; `up`: `memory=2147483648`, `nanoCpus=2000000000`, `user=1000:1000`, `HEALTHY: True`; `down=0`, `CONTAINERS_REMAINING: 0`, `NETWORK_REMAINING: 0` | `F04-T04-tester-{transport,healthcheck,up,cp,down→emulator-down}.txt`, `variables.tf`, `provider.tf` | **CUMPLIDO** |
| 7. Ámbito: solo `infra/terraform/**` y reportes/evidencias propios; sin tocar `frontend/`, `backend/`, manifiestos, `STATE.md`, `tasks.md`; sin push | `git status --short --untracked-files=all` tras la ejecución muestra **solo** mis 18 evidencias `F04-T04-tester-*.txt` como archivos nuevos. `git diff --name-only` reproduce exactamente los 10 archivos modificados del baseline (preexistentes de otras fases): ninguno fue tocado por mí. Sin commit, sin push | `git status --short --untracked-files=all` y `git diff --name-only` (lectura, §3) | **CUMPLIDO** |

**Resultado: 7/7 requisitos CUMPLIDOS.**

## 3. Ejecución propia (registro cronológico)

Todas las corridas desde la raíz del proyecto, en una sola sesión de emulador, con `AWS_ENDPOINT_URL`, `AWS_REGION`, archivos de credenciales/config, `AWS_CA_BUNDLE`, `NODE_EXTRA_CA_CERTS` (apuntando al CA propio) y `AWS_EC2_METADATA_DISABLED=true`; **sin** `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`/`AWS_PROFILE`.

| # | Evidencia (`F04-T04-tester-…`) | Acción | Exit |
|---|---|---|---|
| 1 | `compose-config.txt` | `docker compose config` (esquema, límites, `host_ip=127.0.0.1`) | 0 |
| 2 | `up.txt` | `compose up -d` → `healthy=True`; `inspect` de límites y usuario | 0 |
| 3 | `cp.txt` | `docker cp` de `ca.pem`, `config`, `emulator_credentials` en esta sesión | 0 |
| 4 | `healthcheck.txt` | `curl.exe --cacert` propio → `ok` | 0 |
| 5 | `fmt.txt` / `init.txt` / `validate.txt` | Terraform format, init y validate | 0 / 0 / 0 |
| 6 | `plan.txt` | `11 to add, 0 to change, 0 to destroy` (recreación esperada, P2) | 0 |
| 7 | `apply.txt` | `11 added, 0 changed, 0 destroyed`; IAM creado + leído en vivo; CORS creado en ambos buckets | 0 |
| 8 | `output.txt` | Outputs JSON: política IAM, trust, CORS, TTL, endpoint | 0 |
| 9 | `plan-post-apply.txt` | Idempotencia: `No changes` | 0 |
| 10 | `iam.txt` | Parseo propio de `output -json` + grep de guardas + contraste documental del matiz SigV4 | 0 |
| 11 | `cors.txt` | Sonda propia `GetBucketCors` en `raw` + `optimized` | 0 |
| 12 | `skip-flags.txt` | Grep estático + mini-módulo sin proveedor (`true`/`false`) + `validate -var=false` | 0 |
| 13 | `comment-fix.txt` | Grep `dynamodb.tf` + adaptador (solo lectura) + outputs TTL | 0 |
| 14 | `transport.txt` | Escaneo de `:9324` activo, secretos y rutas absolutas | 0 |
| 15 | `emulator-down.txt` | `compose down` + `ps -a` + red (ejecutado al cierre) | 0 |
| 16 | `harness-notes.txt` | Correcciones de mi propio arnes (§4.1), append-only | 0 |

**Nota sobre el dictamen 7 (alcance):** se apoya en la ejecución en vivo de `git status --short --untracked-files=all` y `git diff --name-only` de esta sesión (no se generó un archivo de evidencia separado para no duplicar); el resultado se reproduce literalmente en la fila 7 del §2.

## 4. Hallazgos y notas de integridad

### 4.1 Corrección de mi propio arnes (no es un defecto del producto)

La primera pasada tuvo cinco incidencias de **mi tooling**, documentadas en `F04-T04-tester-harness-notes.txt`: (1) `fmt -check` sin salida rechazado por mi helper; (2) sonda CORS con `self-signed certificate` hasta fijar `NODE_EXTRA_CA_CERTS` al CA propio; (3) `-out=$planFile` sin comillar creó un archivo literal y `show -json` no se pudo parsear; (4) regex con `\"` dentro de `$()` rompió el parseo de PowerShell; (5) comprobación documental sin tilde dio un falso `False`. **Ninguna** modificó `infra/terraform/**`,Tests, manifiestos ni reportes ajenos. Las evidencias finales citadas son las regeneradas.

### 4.2 P2 — Recreación de recursos al reiniciar el emulador (heredado, INFO)

Mi `plan` advirtió «AWS resource not found during refresh» para buckets, colas, tabla e IAM (el emulador mantiene los recursos en memoria; el volumen named solo conserva CA/config/credenciales). No hice `state rm`/`import` ni modifiqué HCL: el plan sigue siendo `0 to destroy`, el `apply` recreó la misma configuración y el plan posterior dio `No changes`. Es comportamiento esperado ya documentado en T01…T03, no regresión de `CA-04`. Recomendación vigente para `F04-T05`: sesión única `up → apply → sondas → down` en CI.

### 4.3 Matiz de la sonda SigV4 artesanal (heredado P1 del Developer, no bloqueante)

No **reejecuté** la sonda cruda IAM Query firmada a mano: el harness no dispone de un SDK oficial de IAM sin tocar manifiestos y CA-04 no la exige como criterio. Verifiqué que el Developer documenta el `SignatureDoesNotMatch` (P1, `F04-T04-support-probe.txt`, README §IAM) y que la aceptación se apoya en el **proveedor oficial de Terraform** —que creó `aws_iam_role.app`/`aws_iam_role_policy.app` y leyó `data.aws_iam_role.app` en vivo en **mi propio** `apply`— más la representación declarativa (`locals`/outputs/`check`). No se presenta esa sonda como `PASSED`. La ausencia de SDK oficial para IAM es una limitación del entorno, no un incumplimiento de CA-04.

### 4.4 Auditoría de riesgo 3 (pendiente, competencia del Auditor)

Este dictamen cubre únicamente los criterios de Tester. La auditoría obligatoria de riesgo 3 (IAM, CORS, flags y exposición de secretos) es competencia de `reports/audits/F04/F04-T04-auditor.md` y no ha sido emitida al momento de este reporte; no hay hallazgos CRITICAL/HIGH conocidos que bloqueen `CA-04`.

## 5. Conclusión

Con ejecución propia e independiente contra el emulador en vivo se verifica `CA-04` en su totalidad: rol `mediashrink-app-role` con política inline de 5 statements, 0 comodines amplios, ARNs derivados, 3 guardas declarativas y confianza solo Lambda; CORS en ambos buckets con origen exacto, `GET`/`PUT` y cabeceros explícitos; los tres `skip_*` y el resto de excepciones gobernados por `is_emulator` (documentación de AWS real sin ejecutarla); y la corrección de `F04T03-A-04` sin cambio de comportamiento. El ciclo `fmt`/`validate`/`plan`/`apply`/`plan-post-apply` fue limpio, incremental (`0 to destroy`) e idempotente. Transporte `:9297` con CA propio, sin secretos, emulador apagado con `docker ps -a` vacío y ámbito confinado a mis propios artefactos.

**Veredicto: `PASSED` (Loop 1/3, primer dictamen).** Sin hallazgos CRITICAL/HIGH ni bloqueantes; sin activación de loops; sin cambios fuera de mis propios reportes/evidencias y scripts efímeros en `temporary/`. Architect puede integrar este dictamen y proceder con la auditoría y el cierre de la tarea.
