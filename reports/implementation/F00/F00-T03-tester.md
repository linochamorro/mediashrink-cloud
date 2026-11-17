# Dictamen de verificación independiente (Tester) — `F00-T03`

| Campo | Valor |
|---|---|
| **Tarea** | `F00-T03` — `aws/aws-emulator` en Docker con límites |
| **Fase / paquete** | Fase 0 — `P-00-foundation-and-emulator.md` |
| **Versión / Loop** | `v1 — Loop 1/3` (**no se consume loop**) |
| **Rol / riesgo** | Tester independiente · riesgo 2 (Tester + Auditor) |
| **Criterio asignado** | `CA-03` |
| **Fecha** | `2026-11-17` |
| **Estado global** | **`NEEDS_CONTEXT` para `CA-03`** |
| **Dictamen propio** | Únicamente el Tester emite dictamen; no se emite `PASSED` condicional |

## 1. Fuentes leídas y aislamiento

Contrato de rol (`.agents/roles/tester.md`), `AGENTS.md`, `STATE.md`,
`docs/sdd/packages/P-00-foundation-and-emulator.md` (CA-03),
`docs/decisions/ADR-001-stack-and-aws-emulator.md` (Decisión 4),
`docs/sdd/{constitution,spec,plan}.md` (PR-04, NFR-01/NFR-02, plan §5),
`reports/implementation/F00/F00-T03-task.md`, `F00-T03-developer.md`,
`docker-compose.yml`, `docs/runbooks/development-workflow.md` y las evidencias
`F00-T03-config-audit.txt` y `F00-T03-environment.txt`.

Nota: `docs/METHODOLOGY.md` y `docs/templates/problema-solucion.md`, citados en
el contrato de rol, **no existen** en el repositorio; se aplica la plantilla de
7 campos tal como aparece en el `task.md` y en el reporte del Developer.

No se editó ningún archivo de producto, configuración, tests, runbook,
`.env.example`, `STATE.md`, `tasks.md` ni el reporte del Developer. Solo se
escriben este dictamen y tres evidencias propias (`F00-T03-tester-*.txt`).
No se presentó evidencia ajena como propia: cada resultado se re-ejecutó por
este Tester. No se usó Docker (ausente), Git/GitHub ni AWS real.

## 2. Dictamen por criterio

| Requisito / fuente | Comportamiento observable | Evidencia (propia) | Límite de cobertura | Estado |
|---|---|---|---|---|
| Límites `--memory=2g --cpus="2.0"` (G-7, NFR-02, CA-03) | `docker-compose.yml` declara `cpus: 2.0`, `mem_limit: 2g`, `memswap_limit: 2g` y `deploy.resources.limits` (`cpus: "2.0"`, `memory: 2g`) | `F00-T03-tester-config.txt` C02–C06 | Textual; no se verificó el valor efectivo con `docker inspect` | **PASSED (estático)** |
| HTTPS local en `127.0.0.1:9297` (CA-03, ADR-001 D4) | `"127.0.0.1:9297:9297"`; sin exposición a la red | `F00-T03-tester-config.txt` C07 | No se comprobó el socket en vivo | **PASSED (estático)** |
| `ca.pem` vía bind mount relativo (CA-03, `.env.example` G-3) | `./.local/aws-emulator:/home/emulator/.aws/emulator/9297` | `F00-T03-tester-config.txt` C08 | No se comprobó la generación real del certificado | **PASSED (estático)** |
| Healthcheck HTTPS con `--cacert` (CA-03, P-00 §5) | `healthcheck` con `CMD-SHELL`, `curl --cacert .../ca.pem https://127.0.0.1:9297/__admin/health`, interval/timeout/retries/start_period | `F00-T03-tester-config.txt` C09 | No se ejecutó el healthcheck; no se validó esquema YAML por CLI | **PASSED (estático)** |
| Apagado limpio (G-7, CA-03) | `stop_grace_period: 10s`, `restart: "no"`; sin contenedor ni instalador en ejecución | `F00-T03-tester-config.txt` C10–C11 · `F00-T03-tester-processes.txt` §1–2 | No se ejecutó `docker compose down` | **PASSED (estático)** |
| Imagen fijada y sin secretos/rutas absolutas (ADR-001 D4, G-3) | `ghcr.io/xsavikx/aws-emulator:1.0.491.1` (tag concreto); sin credenciales reales ni rutas Windows absolutas | `F00-T03-tester-config.txt` C01, C12–C15 | No se verificó el digest remoto de la imagen | **PASSED (estático)** |
| **Arranque real** (`docker compose up -d`) + healthcheck HTTPS en vivo + `docker compose down` (CA-03, `task.md` §4) | **No ejecutable**: `docker` ausente en PATH y en seis rutas habituales; `where docker` EXITCODE=1, `docker --version` EXITCODE=1, `IsInRole(Administrator)=False` | `F00-T03-tester-environment.txt` §1–5 | Recurso imprescindible ausente; no hay logs de arranque, healthcheck ni apagado. No se fabricaron | **NEEDS_CONTEXT** |
| Integridad de evidencias y ámbito (contrato de rol, `task.md` §3) | No existen `F00-T03-up.txt`/`healthcheck.txt`/`down.txt`; ningún proceso Docker/winget/choco; escrituras del Developer confinadas a archivos autorizados | `F00-T03-tester-processes.txt` §3–5 | mtimes no prueban autoría absoluta en ausencia de Git; coherent con la ventana temporal | **PASSED** |
| Reporte del Developer (7 campos, sin `PASSED` propio) | 5 problemas `F00-T03-P1..P5` con 7 campos cada uno; declara `BLOCKED` y "No se emite `PASSED`"; exit codes reales documentados | `F00-T03-tester-processes.txt` §5 | Contraste documental, no re-ejecución de los intentos de instalación (sin autorización para instalar) | **PASSED** |

## 3. Veredicto global

**`NEEDS_CONTEXT` para `CA-03`.** La configuración declarada (`docker-compose.yml`
y runbook) es correcta y supera la auditoría estática independiente (15/15
comprobaciones), pero la parte de **integración real** exigida por CA-03 —logs
de arranque, healthcheck HTTPS con `ca.pem` y `docker compose down`— **no puede
ejecutarse** porque no existe Docker en el entorno y el usuario carece de
privilegios de administrador para instalarlo. Se trata de un recurso/gate
imprescindible ausente, **no de un fallo de código**, por lo que:

- No se emite `PASSED` ni `PASSED` condicional.
- No se emite `NO-PASSED`: no hay incumplimiento atribuible a la entrega.
- No se consume loop (se mantiene `v1 — Loop 1/3`).
- No se fabrican `F00-T03-up.txt`, `F00-T03-healthcheck.txt` ni
  `F00-T03-down.txt`.

## 4. Hallazgos registrados (7 campos obligatorios)

### `F00-T03-T1` — Docker ausente: verificación en vivo de CA-03 imposible

1. **Identificación:** `F00-T03-T1` (bloqueante de la parte de integración de `CA-03`; causa del `NEEDS_CONTEXT`).
2. **Problema:** No hay ejecutable `docker` en PATH ni en seis rutas habituales, y el usuario no es administrador. No se pueden ejecutar `docker compose config`, `up -d`, el healthcheck HTTPS ni `down`.
3. **Causa:** **DEMOSTRADA** por este Tester: `Get-Command docker` sin salida; `cmd /c where docker` EXITCODE=1; `docker --version` EXITCODE=1 ("not recognized"); seis `Test-Path` → `Exists=False`; `IsInRole(Administrator)=False`. Coherente con `F00-T03-environment.txt` del Developer.
4. **Solución e intentos fallidos:** Como Tester no se intentó instalar nada (sin autorización de sistema). El Developer documentó tres intentos fallidos (winget con parámetro inválido `-1978335230`, winget con sintaxis válida timeout/SIGTERM `143`, choco EXITCODE=1 por permisos). Acción propia: verificar de forma independiente, auditar estáticamente y emitir `NEEDS_CONTEXT` sin fabricar evidencia.
5. **Verificación:** `evidence/F00-T03-tester-environment.txt` §§1–5; `evidence/F00-T03-tester-processes.txt` §§1–3.
6. **Pendientes:** CTO/Lino debe habilitar Docker (instalación con privilegios de administrador o entorno con Docker Desktop activo) **o** decidir expresamente (gate `G-9`, nuevo) aceptar la verificación estática como sustituta de la integración. Hasta entonces CA-03 permanece `NEEDS_CONTEXT`.
7. **Aprendizaje candidato:** `PROPUESTA_GLOBAL` — reforzar la DoR de los paquetes con comprobación real de Docker y permisos de instalación antes de despachar tareas `CA-03`/`CA-04`; coincide con `F00-T03-P1`.

### `F00-T03-T2` — Coverage limitada: `docker compose config` y arranque no ejecutados

1. **Identificación:** `F00-T03-T2` (limitación de cobertura, derivada de `T1`; no bloqueante adicional).
2. **Problema:** La auditoría es textual: no valida el esquema YAML mediante `docker compose config` ni demuestra que Compose acepte el archivo o que el contenedor arranque con los límites efectivos.
3. **Causa:** **DEMOSTRADA** — misma causa que `T1` (Docker ausente; ver `F00-T03-tester-environment.txt`).
4. **Solución e intentos fallidos:** Se sustituyó por 15 comprobaciones textuales independientes sobre el compose (`F00-T03-tester-config.txt`) y se declaró explícitamente el límite. No se suplantó el comando con un parser propio que simulase validación de Compose.
5. **Verificación:** `evidence/F00-T03-tester-config.txt` (C01–C15 y sección "Limitacion").
6. **Pendientes:** El Tester con Docker debe ejecutar `docker compose config`, `up -d`, healthcheck con `ca.pem`, `docker inspect` (memoria `2147483648`, nanoCpus `2000000000`) y `down`, y adjuntar los tres evidenciales del `task.md`.
7. **Aprendizaje candidato:** `SOLO_LOCAL` — sin Docker, toda evidencia de compose es documental y no debe presentarse como verificación de integración; coincide con `F00-T03-P5`.

### Observación heredada (no hallazgo propio de este Tester)

`F00-T03-P3` del Developer: `.env.example` declara `AWS_ACCESS_KEY_ID=test` y SQS en `:9324`, mientras el emulador genera credenciales y sirve todo por `https://127.0.0.1:9297`. Está **fuera del ámbito de escritura de F00-T03** (propiedad de `F00-T01`, ya cerrada). No bloquea la parte estática de CA-03, pero **debe resolverse antes de la prueba en vivo**: el healthcheck/SDK deberán usar los archivos generados (`AWS_SHARED_CREDENTIALS_FILE`, `AWS_CONFIG_FILE`) y no credenciales fijas. Se traslada a Architect para su tarea propietaria; el Tester de `F00-T04` debe verificar que Terraform no herede `:9324`.

## 5. Qué necesita el CTO/Lino para desbloquear

1. **Opción A (recomendada para cerrar CA-03 con evidencia real):**instalar Docker Desktop con privilegios de administrador (o habilitar un entorno/runner con Docker), levantar el contenedor solo durante la prueba (G-7) y apagarlo al terminar. Entonces este Tester ejecutará `docker compose config`, `up -d`, healthcheck HTTPS con `ca.pem`, `docker inspect` y `down`, y emitirá dictamen final.
2. **Opción B (decisión explicita):** aprobar un **gate `G-9` (nuevo)** que acepte la verificación estática documental como sustituta de la integración para CA-03 en este entorno, con el reconocimiento expreso de que quedaría sin cubrir el comportamiento real del contenedor. Sin esa decisión, no se puede emitir `PASSED`.

## 6. Evidencias propias

- `reports/implementation/F00/evidence/F00-T03-tester-environment.txt`
- `reports/implementation/F00/evidence/F00-T03-tester-config.txt`
- `reports/implementation/F00/evidence/F00-T03-tester-processes.txt`

**Handoff:** Architect → integrar `NEEDS_CONTEXT`; CTO/Lino → decidir Opción A u Opción B (G-9). Auditor → revisar `F00-T03-P2`/`P3` (riesgo 2) según lo previsto. No se cierra la tarea ni se actualizan `STATE.md`/`tasks.md`.

---

# Addendum v2 — Re-verificación en vivo de `F00-T03` (append-only)

| Campo | Valor |
|---|---|
| **Versión / Loop** | `v2 — Loop 1/3` (el loop v1 NO se consumió: `NEEDS_CONTEXT` por recurso ausente) |
| **Fecha** | `2026-11-17` |
| **Rol / riesgo** | Tester independiente · riesgo 2 (Tester + Auditor) |
| **Criterio asignado** | `CA-03` + verificación de `A-01`/`A-02` y coherencia `A-03` |
| **Autorización** | Opción A del CTO: Docker Desktop / engine `29.9.3` y Compose `v5.7.0` disponibles (binarios fuera de PATH; se antepuso el directorio en cada comando). **Sin `G-9` ni `G-10`** |
| **Estado global** | **`PASSED`** |
| **Condición** | Toda la evidencia de este addendum fue **reejecutada por este Tester**; no se presenta como propia la evidencia del Developer ni la auditoría estática v1 |

## A. Ejecución propia e independencia

Se repitieron, con salidas capturadas en `evidence/F00-T03-tester-v2-*.txt`, todos los comandos exigidos en el `task.md` §5 y en el encargo: `docker compose config`, `docker compose up -d` (con polling de salud y timeout justificado de 180 s), `docker inspect` de valores efectivos, healthcheck HTTPS con `ca.pem` y control negativo TLS, `docker compose down` con verificación de residuos, resolución del digest (`docker buildx imagetools inspect` + `docker image inspect`), y comprobaciones documentales de runbook, `.env.example` y alcance de archivos. No se editaron `docker-compose.yml`, runbook, `.env.example`, código, tests, `STATE.md`, `tasks.md` ni el reporte del Developer; solo se añadió este addendum y las nueve evidencias propias listadas en §F. No se usaron Git/GitHub ni AWS reales; no se imprimieron secretos ni rutas Windows absolutas.

## B. Dictamen por criterio

| Requisito / fuente | Comportamiento observable | Evidencia (propia) | Límite de cobertura | Estado |
|---|---|---|---|---|
| Límites declarados `--memory=2g --cpus="2.0"` (G-7, NFR-02, CA-03) | `docker compose config` → `cpus: 2`, `memory: "2147483648"`, `mem_limit`/`memswap_limit: "2147483648"`, `deploy.resources.limits` coherentes; `EXITCODE_CONFIG=0` | `F00-T03-tester-v2-config.txt` (7/7 checks) | Valores declarados; los efectivos se verifican aparte | **PASSED** |
| Arranque real y salud (CA-03, `task.md` §4) | `docker compose up -d` → `EXITCODE_UP=0`; polling `starting → starting → healthy` en 3 polls (≈9 s, muy por debajo de 180 s); `docker compose ps`: `Up (healthy)`, `127.0.0.1:9297->9297/tcp`; imagen por digest | `F00-T03-tester-v2-up.txt` | No se re-ejecutó un segundo ciclo de arranque (sin cambios desde el primero) | **PASSED** |
| Límites **efectivos** y usuario (CA-03, G-7) | `docker inspect`: `memory=2147483648`, `nanoCpus=2000000000`, `memorySwap=2147483648`, `user=1000:1000`, `status=running`, `health=healthy`, imagen por digest, `HostIp=127.0.0.1`, volumen `aws-emulator-data` | `F00-T03-tester-v2-inspect.txt` (5/5 checks) | Valores del contenedor en vivo; se capturaron tras el arranque propio | **PASSED** |
| HTTPS con `ca.pem` y healthcheck real (CA-03, ADR-001 D4) | `docker cp` del `ca.pem` generado (566 bytes); `curl.exe --cacert ...ca.pem https://127.0.0.1:9297/__admin/health` → cuerpo `ok`, `EXITCODE_CON_CA=0`; control sin CA → `EXITCODE_SIN_CA=60` (rechazo TLS) | `F00-T03-tester-v2-healthcheck.txt` | El control negativo usa `--silent` (solo exit code); el exit `60` demuestra TLS real, no un ping HTTP | **PASSED** |
| Apagado limpio (G-7, CA-03) | `docker compose down` → `EXITCODE_DOWN=0`; `docker ps -a` sin contenedores; `docker network ls` sin `mediashrink-cloud_default`; `docker inspect <contenedor>` → `no such object`, exit `1` | `F00-T03-tester-v2-down.txt` + comprobación final de estado | El volumen named persiste por diseño (no contenedor/red; A-05 se cierra en `F00-T05`) | **PASSED** |
| `A-01` — imagen fijada por digest inmutable | Compose referencia `@sha256:9cd91ae8…68376`; `docker buildx imagetools inspect ghcr.io/xsavikx/aws-emulator:1.0.491.1` resuelve el mismo digest (índice OCI multi-arch); `docker image inspect .RepoDigests` de la imagen arrancada coincide | `F00-T03-tester-v2-a01.txt` (3/3 checks, exit `0` en todos) | Se verifica correspondencia tag↔digest y RepoDigests locales; no se audita la firma del paquete (fuera de alcance) | **PASSED** |
| `A-02` — procedencia en el runbook | Sección `## 3. Proveniencia de la imagen`: terceros/no oficial de AWS, registro `ghcr.io/xsavikx`, tag `1.0.491.1`, digest fijado, comandos `docker buildx imagetools inspect` y `docker image inspect ... RepoDigests`, y `### Responsable de la actualización` con procedimiento | `F00-T03-tester-v2-a02.txt` (8/8 checks) | Comprobación documental; no reabre la decisión de producto de `ADR-001` D4 | **PASSED** |
| Coherencia `.env.example` (addendum `A-03` de T01) | **0 líneas activas** con `:9324` (la única mención es el comentario "No existe el puerto 9324"); `AWS_ENDPOINT_URL=https://127.0.0.1:9297` como transporte; `SQS_QUEUE_URL`/`SQS_DLQ_URL` en host AWS canónico `sqs.us-east-1.amazonaws.com` con cuenta fija; credenciales por `AWS_SHARED_CREDENTIALS_FILE`/`AWS_CONFIG_FILE`; sin credenciales fijas; `CA_BUNDLE_PATH` coherente | `F00-T03-tester-v2-env-coherence.txt` (7/7 checks) | Coherencia documental; el consumo real de SQS/DLQ se verifica en `F00-T04` | **PASSED** |
| Alcance de escritura del Developer (`task.md` §3, contrato de rol) | Modificados `docker-compose.yml` (digest A-01 + volumen named) y runbook (sección 3 A-02 + notas v2). Sin cambios atribuibles en `.env.example` (mtime `16:03:23`, previo al v2), `STATE.md` (`15:44:58`), `docs/sdd/tasks.md` (`10:55:27`), `AGENTS.md` (`06:51:54`); `infra/terraform/` y `.github/` no existen en el árbol; reportes ajenos sin mtimes en la ventana v2 | `F00-T03-tester-v2-scope.txt` | Sin Git, los mtimes son **indicativos**, no prueba de autoría absoluta; contenido comprobado además de mtimes | **PASSED** (con límite documentado) |

## C. Veredicto global

**`PASSED` para `CA-03`.** La ejecución propia reprodujo íntegramente el ciclo exigido: esquema válido por CLI, arranque real en estado `healthy`, límites efectivos `2147483648`/`2000000000` y usuario `1000:1000`, healthcheck HTTPS autenticado con `ca.pem` (cuerpo `ok`, exit `0`) frente a rechazo TLS sin CA (exit `60`), y apagado limpio sin contenedor ni red residual. A-01 y A-02 quedan conformes con evidencia propia, y `.env.example` mantiene la coherencia del addendum `A-03` de T01. No hay hallazgos con los 7 campos que registrar: los dos únicos `FAIL` iniciales salieron de **mis propios** patrones de búsqueda y se corrigieron y documentaron antes de emitir dictamen (§D). No se activan loops: Architect gestiona el cierre de la tarea y el Auditor su addendum §6.

## D. Notas de verificación (falsos positivos del propio Tester, sin impacto en la entrega)

1. En la primera pasada de `A-02`, el patrón `responsable de la actualizacion` no toleró el acento de "actualización" y marcó `FAIL`. Comprobación directa: `### Responsable de la actualización` existe en el runbook. Se corrigió el patrón a `actualizaci[oó]n` y se re-ejecutó: `PASS`. Registrado en la cabecera de `F00-T03-tester-v2-a02.txt`.
2. En la primera pasada de coherencia, el patrón detectó `9324` y marcó `FAIL`. Comprobación directa: **0 líneas activas** con `9324`; la única mención es el comentario `.env.example` L57 "No existe el puerto 9324". Se corrigió el patrón para excluir comentarios y se re-ejecutó: `PASS`. Registrado en la cabecera de `F00-T03-tester-v2-env-coherence.txt`.
3. Ninguno de estos dos casos constituye un problema de la entrega ni abre un loop; se documentan para conservar la trazabilidad de la verificación.

## E. Estado final del contenedor

**APAGADO.** Comprobado dos veces: (1) dentro de `F00-T03-tester-v2-down.txt` (`down` exit `0`, `docker ps -a` vacío, `docker network ls` sin red del compose, `docker inspect` → `no such object` exit `1`); (2) comprobación final inmediata antes de este dictamen: `docker ps -a` sin contenedores, `docker network ls` solo `bridge`/`host`/`none`, `docker inspect mediashrink-aws-emulator` → exit `1`. Persiste únicamente el volumen named `mediashrink-cloud_aws-emulator-data`, documentado y fuera del requisito de G-7.

## F. Evidencias propias de este addendum

- `reports/implementation/F00/evidence/F00-T03-tester-v2-config.txt`
- `reports/implementation/F00/evidence/F00-T03-tester-v2-up.txt`
- `reports/implementation/F00/evidence/F00-T03-tester-v2-inspect.txt`
- `reports/implementation/F00/evidence/F00-T03-tester-v2-healthcheck.txt`
- `reports/implementation/F00/evidence/F00-T03-tester-v2-down.txt`
- `reports/implementation/F00/evidence/F00-T03-tester-v2-a01.txt`
- `reports/implementation/F00/evidence/F00-T03-tester-v2-a02.txt`
- `reports/implementation/F00/evidence/F00-T03-tester-v2-env-coherence.txt`
- `reports/implementation/F00/evidence/F00-T03-tester-v2-scope.txt`

**Handoff v2:** el dictamen v1 `NEEDS_CONTEXT` queda íntegro como historial (no se consumió loop); este addendum lo sustituye para la reanudación con veredicto **`PASSED`**. Architect integra y cierra `F00-T03`; Auditor añade su addendum §6 (cierra A-01/A-02/A-04; A-05 se cierra en `F00-T05`). No se actualizan `STATE.md` ni `tasks.md` por este rol.
