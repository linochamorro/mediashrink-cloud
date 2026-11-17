# Reporte de implementación (Developer) — `F00-T03`

| Campo | Valor |
|---|---|
| **Tarea** | `F00-T03` — `aws/aws-emulator` en Docker con límites |
| **Fase / paquete** | Fase 0 — `docs/sdd/packages/P-00-foundation-and-emulator.md` |
| **Versión / Loop** | `v1 — Loop 1/3` |
| **Rol / riesgo** | Developer · riesgo 2 (Tester + Auditor) |
| **Criterio asignado** | `CA-03` (arranque con `--memory=2g --cpus="2.0"`, HTTPS con `ca.pem`, healthcheck y apagado limpio) |
| **Estado final** | **`BLOCKED`** — entregables estáticos completos; `CA-03` **sin verificación real** por ausencia de Docker |
| **Fecha** | `2026-11-17` |
| **Dictamen propio** | No se emite `PASSED`: corresponde a Tester y Auditor |

## 1. Fuentes leídas (obligatorias)

1. `AGENTS.md` (G-3, G-6/G-6b, G-7, confinamiento).
2. `STATE.md` (F00 en curso; DoR: `docker` no está en PATH; prohibido fabricar evidencia).
3. `.agents/roles/developer.md` (contrato, 7 campos, límites de escritura).
4. `docs/sdd/packages/P-00-foundation-and-emulator.md` (`CA-03`, §3 ámbito, DoR G-7/G-8).
5. `docs/decisions/ADR-001-stack-and-aws-emulator.md` (Decisión 4: Rust, ~175 MiB, límites y apagado).
6. `docs/sdd/{constitution,spec,plan}.md` (PR-04, NFR-01/NFR-02, plan §5).
7. `docs/runbooks/development-workflow.md` (documento actualizado).
8. `reports/implementation/F00/F00-T03-task.md` (**fuente de verdad de alcance**).
9. `reports/implementation/F00/F00-T01-architect.md` (`.env.example` cerrado: `AWS_ENDPOINT_URL=https://127.0.0.1:9297`, `USE_SSL=true`, `CA_BUNDLE_PATH=./.local/aws-emulator/ca.pem`).
10. `.env.example` (solo lectura; no modificado).

## 2. Criterio y enfoque

`CA-03` exige evidencia de **integración real**: logs de arranque, healthcheck HTTPS con `ca.pem` y `docker compose down`. El enfoque fue: (a) escribir la configuración con los límites exactos y el healthcheck, (b) documentar arranque/verificación/apagado en el runbook, (c) auditar estáticamente el compose, y (d) intentar localizar o instalar Docker bajo G-7/G-8. **Sin Docker no hay arranque, healthcheck ni apagado que registrar**: no se generaron `F00-T03-up.txt`, `F00-T03-healthcheck.txt` ni `F00-T03-down.txt`.

Decisión técnica documentada: **AWS no publica imagen preconstruida** de `aws-emulator` (AWS News Blog, 11-Nov-2026: "We don't publish a ready-made image"). Se usa la imagen pública `ghcr.io/xsavikx/aws-emulator:1.0.491.1`, que empaqueta el paquete oficial AWS verificado (SHA-256 + firma), es multi-arch y trae healthcheck en `/__admin/health`. Un único endpoint HTTPS `127.0.0.1:9297` sirve S3, SQS + DLQ, DynamoDB y STS; no existe el puerto SQS `9324` que aparece en `.env.example`.

## 3. Acciones realizadas

1. **Creado `docker-compose.yml`**: imagen fijada por versión; `cpus: 2.0` + `mem_limit: 2g` + `memswap_limit: 2g` + `deploy.resources.limits` (`cpus: "2.0"`, `memory: 2g`); puerto `127.0.0.1:9297:9297`; bind mount relativo `./.local/aws-emulator:/home/emulator/.aws/emulator/9297` para exponer `ca.pem` en la ruta de `.env.example`; healthcheck `curl --cacert .../ca.pem https://127.0.0.1:9297/__admin/health`; `stop_grace_period: 10s` y `restart: "no"`. Telemetría desactivada.
2. **Actualizado `docs/runbooks/development-workflow.md`**: secciones de límites (con `docker inspect` esperado `2147483648` / `2000000000`), arranque, exportación/verificación de `ca.pem`, variables para SDK, apagado y aviso explícito de que los comandos están **declarados, no ejecutados** aquí.
3. **Auditoría estática** guardada en `evidence/F00-T03-config-audit.txt`: 12/12 checks `PASS`, `EXITCODE=0`.
4. **Registro de entorno** guardado en `evidence/F00-T03-environment.txt`: `docker` ausente, winget/choco presentes, rutas comprobadas, tres intentos de instalación, sin contenedor ni instalador en ejecución al terminar.
5. **Sin cambios laterales**: no se tocaron `infra/terraform/`, `.github/`, `frontend/`, `backend/`, `.env.example`, `.gitignore`, `STATE.md`, `tasks.md` ni reportes ajenos. No se usó cuenta AWS real. No se escribieron secretos ni rutas Windows absolutas en artefactos públicos (las rutas de la evidencia están redactadas con `<USERPROFILE>` / `<ProgramFiles>` / `<ProgramData>`).

## 4. Comandos ejecutados y exit codes reales

| Comando / acción | Exit code real | Resultado / evidencia |
|---|---:|---|
| `Get-Command docker` | sin salida (no encontrado) | Confirmación inicial de ausencia |
| `cmd /c where docker` | `1` | `F00-T03-environment.txt` §1 |
| `Get-Command winget, choco` | `0` | Ambos disponibles; rutas redactadas en §2 |
| `winget install --id Docker.DockerDesktop … --silent --skip-dependency` | `-1978335230` | Parámetro `--silent` no válido para `install`; §5 |
| `winget install --id Docker.DockerDesktop --accept-source-agreements --accept-package-agreements --disable-interactivity` | `143` (SIGTERM) | Timeout de 180 s del harness; sin exit code propio de winget; §6 |
| `choco install docker-desktop --yes --no-progress --limit-output` | `1` | `Acceso denegado … <ProgramData>\chocolatey\lib-bad`; `0/0 packages`; §7 |
| `Stop-Process -Id <pid huerfano> -Force` | n/a (sin error) | `still_running=False`; §6 y §8 |
| Auditoría estática (1ª ejecución) | `1` | 11 PASS / 1 FAIL: C08 falso positivo |
| Auditoría estática (patrón corregido) | `0` | **12 PASS / 0 FAIL**; `config-audit.txt` |
| `docker compose up -d` / healthcheck / `down` | **NO EJECUTADOS** | Docker no disponible; evidencia deliberadamente no fabricada |

## 5. Archivos creados / modificados

| Archivo | Acción | Ámbito |
|---|---|---|
| `docker-compose.yml` | Creado | Autorizado |
| `docs/runbooks/development-workflow.md` | Modificado | Autorizado |
| `reports/implementation/F00/evidence/F00-T03-config-audit.txt` | Creado | Autorizado |
| `reports/implementation/F00/evidence/F00-T03-environment.txt` | Creado | Autorizado |
| `reports/implementation/F00/F00-T03-developer.md` | Creado | Autorizado |

No se crearon `F00-T03-up.txt`, `F00-T03-healthcheck.txt` ni `F00-T03-down.txt`: su contenido habría sido simulado. Los scripts auxiliares usados para generar las evidencias se eliminaron tras producirlas.

## 6. Problemas registrados (7 campos obligatorios)

### `F00-T03-P1` — Docker no disponible; instalación inviable sin administrador

1. **Identificación:** `F00-T03-P1` (bloqueante de `CA-03`).
2. **Problema:** `docker` no está en PATH ni en las cinco rutas habituales comprobadas; `winget` y `choco` existen pero el usuario no es administrador. No es posible arrancar el emulador, verificar el healthcheck ni ejecutar `docker compose down` en este entorno.
3. **Causa:** **DEMOSTRADA** — `where docker` → EXITCODE=1; cinco `Test-Path` → `Exists=False`; `IsInRole(Administrator)=False`; `choco` → "Acceso denegado" sobre `<ProgramData>`; `winget` con sintaxis válida colgó 180 s y dejó un proceso huérfano que hubo que detener.
4. **Solución e intentos fallidos:** Intentos (1) winget con `--silent --skip-dependency` → error de parámetro (`-1978335230`); (2) winget con sintaxis válida → timeout 180 s, SIGTERM `143`, proceso huérfano detenido; (3) Chocolatey → EXITCODE=1 por permisos. Solución aplicada: no fabricar evidencia; escribir compose + runbook, auditar estáticamente y documentar el bloqueo. No se intentó elevar privilegios (fuera de G-7/G-8 y sin consentimiento de Lino).
5. **Verificación:** `evidence/F00-T03-environment.txt` §§1–8; estado final `docker en PATH: NO`, `procesos winget/Docker activos: NINGUNO`.
6. **Pendientes:** Tester debe emitir `NEEDS_CONTEXT` (no `PASSED`) para `CA-03`; Architect/CTO decide si se habilita un entorno con Docker o si Lino autoriza otra vía. `F00-T04` (Terraform) no depende de arrancar el contenedor para `terraform validate`, pero sí de este entorno para `plan` contra el emulador.
7. **Aprendizaje candidato:** `PROPUESTA_GLOBAL` — reforzar la DoR de paquetes con criterio `CA-03`: comprobar disponibilidad real de Docker y permisos de instalación **antes** de despachar tareas que exigen arranque, para no comprometer hitos.

### `F00-T03-P2` — AWS no publica imagen oficial de `aws-emulator`

1. **Identificación:** `F00-T03-P2` (decisión de implementación, no bloqueante).
2. **Problema:** El encargo pedía "imagen pública oficial", pero AWS no distribuye una imagen preconstruida; solo RPM/DEB y un Dockerfile corto documentado.
3. **Causa:** **DEMOSTRADA** — AWS News Blog (11-Nov-2026), literal: "On macOS and Windows, you build a Docker image from the short Dockerfile in the documentation… We don't publish a ready-made image." Confirmado además por el proyecto `xSAVIKx/aws-emulator-docker`.
4. **Solución e intentos fallidos:** Se descartó instalar un RPM en cada arranque (más frágil y dependiente de red) y se fijó `ghcr.io/xsavikx/aws-emulator:1.0.491.1`: mismo upstream oficial, paquetes verificados por SHA-256/firma de AWS, multi-arch, `HEALTHCHECK` propio y pin de versión (no `latest`). Queda documentado el build exacto y su digest en el compose.
5. **Verificación:** `config-audit.txt` C01 (`PASS`); compose líneas 3–18; fuentes oficiales citadas en el compose.
6. **Pendientes:** Auditor debe confirmar que el uso de imagen comunitaria verificada satisface ADR-001 Decisión 4 / PR-04 sin reabrir decisión de producto; si Lino prefiere imagen 100 % AWS, se construye desde el Dockerfile oficial (cambio de ámbito: añadir `Dockerfile`).
7. **Aprendizaje candidato:** `PROPUESTA_GLOBAL` — añadir a `ADR-001` una nota: "AWS no publica imagen; se usa imagen comunitaria pinchada y verificada, o build propio desde RPM oficial", para evitar ambigüedad en Fase 1/CI.

### `F00-T03-P3` — `.env.example` no coincide con el emulador real (credenciales y puerto SQS)

1. **Identificación:** `F00-T03-P3` (pendiente de alineación, fuera de ámbito de escritura).
2. **Problema:** `.env.example` declara `AWS_ACCESS_KEY_ID=test` / `AWS_SECRET_ACCESS_KEY=test` y colas SQS en `http://127.0.0.1:9324/...`. `aws-emulator` genera credenciales nuevas en cada arranque (prefijo `EMULATOR`) y sirve SQS en el mismo HTTPS `9297`; rechaza firmas con otras claves. `CA_BUNDLE_PATH=./.local/aws-emulator/ca.pem` **sí** coincide con el bind mount del compose.
3. **Causa:** **DEMOSTRADA** — documentación oficial del emulador y del blog de AWS; comprobación literal de `.env.example` (solo lectura).
4. **Solución e intentos fallidos:** No se modificó `.env.example` (propiedad de `F00-T01`, ya cerrada; prohibido por el alcance de esta tarea). Se documentó en el runbook §1.3 cómo usar `AWS_SHARED_CREDENTIALS_FILE` / `AWS_CONFIG_FILE` generados y por qué no definir `AWS_ACCESS_KEY_ID`; se señaló el puerto `9324` como pendiente.
5. **Verificación:** `runbook` líneas 49–63; `config-audit.txt` C10 (`PASS`, coherencia de endpoint y CA). Sin verificación en vivo (P1).
6. **Pendientes:** Architect/CTO asignan la corrección de esas variables en su tarea propietaria, antes de consumirlas en Fase 1; el Tester de `F00-T04` debe verificar que Terraform no herede `:9324`.
7. **Aprendizaje candidato:** `PROPUESTA_GLOBAL` — cuando un `.env.example` se cierra antes de fijar el emulador, añadir una prueba documental de coherencia endpoint/credenciales en la tarea que fija el contenedor.

### `F00-T03-P4` — Falso positivo en el escáner estático de secretos

1. **Identificación:** `F00-T03-P4` (resuelto en este loop).
2. **Problema:** El check C08 marcó `FAIL` porque su regex detectó la mención en prosa del runbook a `AWS_ACCESS_KEY_ID=test` (valor dummy citado del `.env.example`), no una credencial real.
3. **Causa:** **DEMOSTRADA** — patrón `AWS_ACCESS_KEY_ID\s*=\s*\S` sin anclaje a inicio de línea ni lista de valores dummy.
4. **Solución e intentos fallidos:** Se ancló el patrón a `(?m)^\s*(AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY)\s*[:=]\s*(?!test\b|REPLACE_WITH)\S+` y se re-ejecutó la auditoría. Sin otros intentos fallidos.
5. **Verificación:** `config-audit.txt`: 1ª ejecución 11 PASS/1 FAIL (`EXITCODE=1`); 2ª ejecución 12 PASS/0 FAIL (`EXITCODE=0`). No se debilitó ningún check: se corrigió el falso positivo.
6. **Pendientes:** Ninguno.
7. **Aprendizaje candidato:** `PROPUESTA_GLOBAL` — los escáneres de secretos deben anclarse a sintaxis de asignación y excluir valores dummy; coherente con `F00-T01-P2` (falsos positivos por patrones demasiado amplios).

### `F00-T03-P5` — Sin validación de esquema YAML por CLI

1. **Identificación:** `F00-T03-P5` (limitación de cobertura).
2. **Problema:** No se pudo ejecutar `docker compose config` para validar el esquema del compose; la auditoría es textual (12 checks) y no demuestra que Compose acepte el archivo.
3. **Causa:** **DEMOSTRADA** — misma causa que P1 (Docker ausente).
4. **Solución e intentos fallidos:** Se sustituyó por comprobación textual de claves, valores, unicidad de servicio, ausencia de TAB y coherencia de rutas; se declaró explícitamente la limitación dentro de la evidencia. No se suplantó el comando con un parser propio.
5. **Verificación:** `config-audit.txt` línea de "Limitacion" y checks C01–C12.
6. **Pendientes:** El Tester con Docker debe ejecutar `docker compose config` además de `up -d`, healthcheck y `down`.
7. **Aprendizaje candidato:** `SOLO_LOCAL` — en entornos sin Docker, toda evidencia de compose es documental; no debe presentarse como verificación de integración.

## 7. Estado final y handoff

- **Estado: `BLOCKED`.** Los entregables estáticos (`docker-compose.yml`, runbook y dos evidencias) están completos y auditados; `CA-03` **no está verificado** porque no existe Docker en el entorno y la instalación no interactiva fracasó sin privilegios administrativos.
- No se emite `PASSED`, no se cierra la tarea y no se actualizan `STATE.md`, `tasks.md` ni `AGENTS.md` (fuera de ámbito).
- No queda ningún contenedor ni instalador en ejecución; no se usó AWS real; no hay secretos ni rutas Windows absolutas en los artefactos públicos.
- Handoff: **Tester** → `NEEDS_CONTEXT` para `CA-03` según el `task.md`; **Auditor** → revisar P2 y P3 (riesgo 2); **Architect** → decidir con CTO/Lino si se habilita Docker o se reprograma la verificación de integración.

---

# Addendum v2 — Reanudación en vivo de `F00-T03` (append-only)

| Campo | Valor |
|---|---|
| **Versión / Loop** | `v2 — Loop 1/3` (el loop v1 NO se consumió: `NEEDS_CONTEXT` por recurso ausente) |
| **Fecha** | `2026-11-17` |
| **Rol / riesgo** | Developer · riesgo 2 (Tester + Auditor) |
| **Autorización** | CTO — Opción A (Docker Desktop + Terraform instalados por Lino), **sin G-9 ni G-10** |
| **Motivo** | Docker Desktop 4.99.0 / engine 29.9.3, Compose v5.7.0 disponibles en `<PROJECT_ROOT>` (binarios fuera de PATH; se anteponen rutas al PATH de la sesión). Se cierra el bloqueo `F00-T03-P1` y se ejecuta `CA-03` en vivo |
| **Estado final** | **`DONE`** (entrega completa con evidencia real; Tester debe emitir dictamen propio y Auditor cerrar A-01/A-02/A-04) |

## A. Cambios aplicados en esta reanudación

1. **Fix del fallo de arranque (Tarea 0, transferida del addendum A-03).** `docker compose up -d` terminaba con `emulator serve failed: server I/O error: Operation not permitted (os error 1)`. La causa es el **bind mount** `./.local/aws-emulator:/home/emulator/.aws/emulator/9297` sobre el filesystem 9p/virtiofs de Docker Desktop en Windows: el emulador (Rust) no puede crear sus archivos allí. Aplicado: (a) se sustituye el bind mount por el **volumen named** `aws-emulator-data` montado en `/home/emulator/.aws/emulator`; (b) se **elimina la directiva `user: "${UID_GID:-1000:1000}"`**. Esta última no debilita la seguridad: `docker image inspect` confirma que la imagen ya declara `USER 1000:1000`, y `docker inspect` del contenedor en vivo devuelve `user=1000:1000`. (c) Los archivos `ca.pem`, `config` y `emulator_credentials` se exportan a `./.local/aws-emulator/` con `docker cp` (runbook §1.3), satisfaciendo las rutas de `.env.example` sin rutas Windows absolutas ni secretos versionados. Se descartó conservar el bind mount porque la prueba empírica previa (A-03) y el diagnóstico demuestran que es la causa del error; se descartó elevar privilegios o montar en modos alternativos por no aportar garantías y quedar fuera de G-7.
2. **A-01 — digest inmutable.** `image: ghcr.io/xsavikx/aws-emulator@sha256:9cd91ae8a722eaf518a26135955d4b8f2a5a4c6c60062278740ec59f68368376`. Verificado con `docker buildx imagetools inspect` (campo `Digest:` del índice OCI multi-arch) y con `docker pull` + `docker image inspect` (`RepoDigests`). Se fija el digest del **índice** (no el de una arquitectura) para conservar amd64/arm64. Evidencia: `evidence/F00-T03-a01-digest.txt`.
3. **A-02 — procedencia en el runbook.** Añadida la sección `## 3. Proveniencia de la imagen (A-02)` al final de `docs/runbooks/development-workflow.md`: AWS no publica imagen oficial, se usa `ghcr.io/xsavikx/aws-emulator` (tercero), tag `1.0.491.1`, digest verificado, comandos de comprobación y responsable de actualización. Además se actualizó §1.3 (volumen named + `docker cp`), §1.4 (persistencia del volumen) y la nota de verificación v1 → v2. Evidencia: `evidence/F00-T03-a02-runbook.txt` (fragmento literal, sin rutas Windows absolutas).

## B. Comandos ejecutados y exit codes reales

| # | Comando / acción | Exit code | Resultado / evidencia |
|---:|---|---:|---|
| 1 | `docker buildx imagetools inspect ghcr.io/xsavikx/aws-emulator:1.0.491.1` | `0` | Digest `9cd91ae8…68376` resuelto · `a01-digest.txt` |
| 2 | `docker pull ghcr.io/xsavikx/aws-emulator@sha256:9cd91ae8…68376` | `0` | `Image is up to date` · `a01-digest.txt` |
| 3 | `docker image inspect --format '{{json .RepoDigests}}' <digest>` | `0` | `RepoDigests` coincide · `a01-digest.txt` |
| 4 | `docker image inspect --format 'User=...' <digest>` | `0` | `User=1000:1000` (justifica quitar `user:`) · reporte §A.1 |
| 5 | Prueba empírica `docker run` con volumen named + `user 1000:1000` | `0` | `health=healthy`, archivos generados · diagnóstico previo al cambio |
| 6 | `docker rm -f <test>` / `docker volume rm <test>` | `0` / `0` | Contenedor y volumen de prueba eliminados |
| 7 | `docker compose config` | `0` | Esquema válido: `memory=2147483648`, `cpus=2`, `host_ip=127.0.0.1`, digest y volumen named · `config.txt` |
| 8 | `docker compose up -d` | `0` | Contenedor creado e iniciado · `up.txt` |
| 9 | Poll `docker inspect .State.Health.Status` (3 polls) | `0` | `starting → starting → healthy` (≈9 s, < 180 s) · `up.txt` |
| 10 | `docker compose ps` | `0` | `Up (healthy)`, `127.0.0.1:9297->9297/tcp`, imagen por digest · `up.txt` |
| 11 | `docker compose logs --tail=25 aws-emulator` | `0` | Logs reales; `ca_file=…/9297/ca.pem`, telemetría off · `up.txt` |
| 12 | `docker inspect --format memory/nanoCpus/memorySwap` | `0` | `memory=2147483648 nanoCpus=2000000000 memorySwap=2147483648` · `inspect.txt` |
| 13 | `docker inspect --format user/image/status/health` | `0` | `user=1000:1000`, `status=running`, `health=healthy` · `inspect.txt` |
| 14 | `docker inspect --format ports/mounts` | `0` | `HostIp=127.0.0.1`, `Type=volume` · `inspect.txt` |
| 15 | `docker cp …/{ca.pem,config,emulator_credentials} ./.local/aws-emulator/` | `0` × 3 | 566 / 152 / 116 bytes; contenidos **no impresos** · `healthcheck.txt` |
| 16 | `curl.exe --fail --cacert ./.local/aws-emulator/ca.pem https://127.0.0.1:9297/__admin/health` | `0` | Cuerpo `ok` — HTTPS autenticado con CA real · `healthcheck.txt` |
| 17 | `curl.exe --fail https://127.0.0.1:9297/__admin/health` (control negativo, sin CA) | `60` | Rechazo TLS esperado: confirma que el CA es necesario · `healthcheck.txt` |
| 18 | `docker compose down` | `0` | Contenedor y red `mediashrink-cloud_default` eliminados · `down.txt` |
| 19 | `docker ps -a` | `0` | Sin contenedores · `down.txt` |
| 20 | `docker network ls` | `0` | Sin red del compose (solo `bridge`/`host`/`none`) · `down.txt` |
| 21 | `docker inspect mediashrink-aws-emulator` (tras `down`) | `1` | `no such object` — confirma apagado · `down.txt` |
| 22 | `docker volume ls` | `0` | Persiste `mediashrink-cloud_aws-emulator-data` (no es contenedor/red; documentado) · `down.txt` |

**Estado final del contenedor: APAGADO.** Verificado de forma independiente tras el último comando (`docker ps -a` vacío; `docker network ls` sin red del compose).

## C. Problemas registrados en esta reanudación (7 campos obligatorios)

### `F00-T03-P6` — Bind mount de Windows provoca `Operation not permitted (os error 1)`

1. **Identificación:** `F00-T03-P6` (bloqueante del arranque; transferido de la sonda A-03) · v2 · Loop 1/3 · 2026-11-17.
2. **Problema:** `docker compose up -d` terminaba con `emulator serve failed: server I/O error: Operation not permitted (os error 1)` antes de crear `ca.pem`; `CA-03` no podía verificarse.
3. **Causa:** **DEMOSTRADA** — el bind mount `./.local/aws-emulator:/home/emulator/.aws/emulator/9297` usa el filesystem 9p/virtiofs de Docker Desktop en Windows, que no admite las operaciones de archivo del emulador Rust; la sonda A-03 ya había reproducido el fallo y había arrancado correctamente con un volumen named. La directiva `user:` no era la causa (la imagen ya es `1000:1000`), pero se retiró para eliminar la dependencia de `${UID_GID}`.
4. **Solución e intentos fallidos:** Se intentó diagnosticar el montaje enlazado (fallo reproducido en v1 y en la sonda A-03); se descartó conservarlo y se sustituyó por el volumen named `aws-emulator-data` en `/home/emulator/.aws/emulator`, más `docker cp` de los tres archivos a `./.local/aws-emulator/`. Sin intentos adicionales: la prueba empírica previa y la prueba local con `user 1000:1000` confirmaron la solución antes de editar el compose.
5. **Verificación:** Comandos 5–16 de la tabla §B: `up -d` exit `0`, `health=healthy` en 3 polls (≈9 s), `inspect` con `user=1000:1000`, `docker cp` 3/3 exit `0`, healthcheck HTTPS `ok` exit `0`. Evidencias `up.txt`, `inspect.txt`, `healthcheck.txt`.
6. **Pendientes:** El volumen named persiste tras `down` y los archivos exportados en `./.local/aws-emulator/` deben seguir excluidos de Git (A-05, responsabilidad de `F00-T05`). Ninguno bloquea `CA-03`.
7. **Aprendizaje candidato:** `PROPUESTA_GLOBAL` — en entornos Windows con Docker Desktop, preferir volúmenes named para servicios que escriben en su directorio de datos y exportar artefactos con `docker cp`; anotarlo en la DoR de tareas con `CA` de integración.

### `F00-T03-P7` — Imagen de tercero fijada por tag mutable (A-01)

1. **Identificación:** `F00-T03-P7` (= hallazgo `A-01`) · v2 · Loop 1/3 · 2026-11-17.
2. **Problema:** `image: ghcr.io/xsavikx/aws-emulator:1.0.491.1` permitía la republicación silenciosa del tag; el digest solo figuraba en un comentario y no estaba verificado.
3. **Causa:** **DEMOSTRADA** — inspección del compose v1 y del runbook (sin digest); el Auditor lo clasificó `LOW`/`ALTA` con correspondencia tag↔digest `INDICATIVE` por falta de Docker.
4. **Solución e intentos fallidos:** Resuelto el tag con `docker buildx imagetools inspect` y confirmado con `docker pull` + `docker image inspect`; se aplicó `ghcr.io/xsavikx/aws-emulator@sha256:9cd91ae8a722eaf518a26135955d4b8f2a5a4c6c60062278740ec59f68368376` (digest del índice multi-arch). No se conservó el tag por hardening expreso del CTO.
5. **Verificación:** `compose config` y `docker compose ps` muestran la referencia por digest; `RepoDigests` locales coinciden. Evidencia `a01-digest.txt`, `config.txt`, `up.txt`, `inspect.txt`.
6. **Pendientes:** El Tester debe contrastar el digest con evidencia propia; el Auditor cierra A-01 en su addendum §6. Cualquier actualización futura requiere nueva verificación (runbook §3).
7. **Aprendizaje candidato:** `PROPUESTA_GLOBAL` — fijar por digest todo artefacto de tercero ejecutado y registrar procedencia en compose **y** runbook; incluir el contraste tag↔digest en la checklist de cierre.

### `F00-T03-P8` — Runbook sin procedencia de la imagen (A-02)

1. **Identificación:** `F00-T03-P8` (= hallazgo `A-02`) · v2 · Loop 1/3 · 2026-11-17.
2. **Problema:** El runbook no declaraba que la imagen es de un tercero, ni tag, ni digest, ni responsable de actualización; solo lo hacían el compose y el reporte v1.
3. **Causa:** **DEMOSTRADA** — el runbook v1 documentaba límites, arranque, `ca.pem` y apagado, pero no la dependencia de imagen comunitaria (0 coincidencias según el Auditor).
4. **Solución e intentos fallidos:** Añadida la sección §3 "Proveniencia de la imagen (A-02)" con tabla de registro/tag/digest, comandos de comprobación y responsable; se actualizaron además §1.3, §1.4 y la nota de verificación para reflejar el volumen named y la ejecución real v2. Sin intentos fallidos.
5. **Verificación:** `evidence/F00-T03-a02-runbook.txt` contiene el fragmento literal extraído del runbook; sin rutas Windows absolutas ni secretos. Revisión directa de `docs/runbooks/development-workflow.md`.
6. **Pendientes:** El Auditor cierra A-02 en su addendum; `ADR-001` Decisión 4 queda como fuente de la decisión de producto (no se reabre).
7. **Aprendizaje candidato:** `SOLO_LOCAL` (reforzable como `PROPUESTA_GLOBAL`) — incluir "procedencia declarada en compose + runbook + reporte" en la checklist de cierre de tareas con dependencias externas.

### `F00-T03-P9` — Artefactos de evidencia con codificación inconsistente

1. **Identificación:** `F00-T03-P9` (incidente menor de presentación, resuelto) · v2 · Loop 1/3 · 2026-11-17.
2. **Problema:** La primera captura de `docker compose ps` mostró el COMMAND con caracteres corruptos (`0.0…`/mojibake), la línea `EXITCODE_MKDIR=` quedó vacía (un cmdlet no fija `$LASTEXITCODE`) y el control negativo sin CA mostró un mensaje localizado ilegible.
3. **Causa:** **DEMOSTRADA** — codificación de consola distinta de UTF-8 al capturar la salida nativa de Docker/curl en PowerShell, y uso de `$LASTEXITCODE` tras `New-Item` (cmdlet, no ejecutable nativo).
4. **Solución e intentos fallidos:** Se fijó `[Console]::OutputEncoding` y `$OutputEncoding` a UTF-8, se regeneró `up.txt` con un ciclo limpio `down`→`up` y se regeneró `healthcheck.txt` sustituyendo la línea vacía por una nota y usando `curl --silent` en el control negativo (solo exit code `60`). Sin otros intentos.
5. **Verificación:** Relectura de `up.txt` y `healthcheck.txt`: COMMAND legible, sin líneas vacías de exit code y control negativo con `EXITCODE_SIN_CA=60`.
6. **Pendientes:** Ninguno.
7. **Aprendizaje candidato:** `SOLO_LOCAL` — fijar la codificación UTF-8 de consola antes de capturar salidas de binarios nativos en Windows y no usar `$LASTEXITCODE` después de cmdlets de PowerShell.

## D. Estado final y handoff

- **Estado: `DONE`.** `CA-03` queda verificado con evidencia real de ejecución: `docker compose config` (exit `0`), `up -d` (exit `0`, `healthy`), `docker inspect` (`2147483648` / `2000000000`, exit `0`), healthcheck HTTPS con `ca.pem` (`ok`, exit `0`; control sin CA exit `60`) y `down` (exit `0`, sin contenedor ni red). A-01 y A-02 cerrados en la entrega; fix de montaje aplicado y justificado.
- **No se emite `PASSED`:** corresponde al Tester, que debe repetir los comandos con evidencia propia. El Auditor debe añadir su addendum §6 (cerrar A-01/A-02/A-04; A-05 se cierra en `F00-T05`).
- **Contenedor APAGADO** al terminar: `docker ps -a` vacío y `docker network ls` sin red del compose (verificado de nuevo tras el último comando). No se usó Git/GitHub, AWS real ni cuenta externa. No se modificaron `.env.example`, `infra/terraform/`, `.github/`, `frontend/`, `backend/`, `STATE.md`, `tasks.md` ni reportes de Tester/Auditor.
- **Ámbito de escritura respetado:** `docker-compose.yml`, `docs/runbooks/development-workflow.md`, `evidence/F00-T03-{a01-digest,a02-runbook,config,up,inspect,healthcheck,down}.txt` y este addendum (append-only; el historial v1 se conserva íntegro).
- Rutas Windows absolutas redactadas como `<PROJECT_ROOT>`; ningún secreto impreso ni versionado (solo se listaron tamaños de archivos generados).

---

## Addendum v2b — Cierre documental N-01/N-02 (append-only)

| Campo | Valor |
|---|---|
| **Versión / Loop** | `v2b — Loop 1/3` (addendum documental corto; sin cambios de compose ni código) |
| **Fecha** | `2026-11-17` |
| **Motivo** | Auditoría v2 `READY_WITH_CONCERNS` sin bloqueantes: dos hallazgos LOW de documentación (N-02 y N-01) a resolver antes del cierre de la tarea |
| **Estado final** | **`DONE`** |

**Líneas corregidas y añadidas en `docs/runbooks/development-workflow.md`:**

| Línea | Cambio | Hallazgo |
|---:|---|---|
| `L69` (antes L67) | Sustituida la nota obsoleta "Pendiente de alineación" por el estado real de `.env.example` tras el addendum A-03 de `F00-T01`: ya no usa el puerto SQS alternativo; QueueUrls canónicas `https://sqs.us-east-1.amazonaws.com/000000000000/<cola>` con `AWS_ENDPOINT_URL=https://127.0.0.1:9297` como **transporte**; credenciales vía `AWS_SHARED_CREDENTIALS_FILE` / `AWS_CONFIG_FILE`. Se mantiene íntegra la advertencia de **no escribir `:9297` en la QueueUrl** y el uso de `useQueueUrlAsEndpoint: false`. | `N-02` |
| `L53` | Añadida nota en §1.3: con volumen named los archivos generados no se reflejan solos en `./.local/aws-emulator/`; el `docker cp` de `ca.pem` / `config` / `emulator_credentials` debe **repetirse en cada arranque** tras `up -d`. | `N-01` |
| `L99` | Añadida nota en §3: el usuario efectivo procede del `USER 1000:1000` declarado por la imagen (verificado con `docker image inspect` e `inspect` en vivo); por eso se retiró `user:` del compose — no cambia el usuario ni debilita la seguridad. | `N-01` |

**Verificación documental:** `evidence/F00-T03-doc-audit.txt` incluye los tres fragmentos y comprobaciones reales sobre el runbook: `:9324` → `0` coincidencias, `test/test` → `0` coincidencias, y `7/7` checks de contenido exigido en `PASS`. La mención de L34 ("no hay puerto SQS 9324") es una afirmación correcta y se conserva.

**Ámbito respetado:** únicamente `docs/runbooks/development-workflow.md` y la evidencia nueva. No se tocaron `docker-compose.yml`, `.env.example`, `infra/`, `.github/`, código, tests, `STATE.md`, `tasks.md` ni reportes de Tester/Auditor. No se usaron Docker ni Git. Sin secretos ni rutas Windows absolutas.

**Estado: `DONE`.** Sin impacto en `CA-03` (ya verificado en vivo en el addendum v2); el contenedor continúa apagado. Queda al Tester emitir su dictamen y al Auditor/Architect el cierre formal de la tarea.
