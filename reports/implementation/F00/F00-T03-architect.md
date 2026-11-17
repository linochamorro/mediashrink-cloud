# Cierre de tarea (Architect) — `F00-T03`

| Campo | Valor |
|---|---|
| **Tarea** | `F00-T03` — `aws/aws-emulator` en Docker con límites |
| **Fase / paquete** | Fase 0 — `docs/sdd/packages/P-00-foundation-and-emulator.md` |
| **Versión / Loop usado** | `v1` `NEEDS_CONTEXT` (**loop no consumido**) → `v2` `PASSED` en Loop 1/3 (addenda documental `v2b`) |
| **Rol implementador / verificadores** | Developer / Tester + Auditor (riesgo 2) |
| **Dictamen Tester** | **`PASSED`** (`F00-T03-tester.md`, addendum v2: ejecución propia; `CA-03` en vivo) |
| **Dictamen Auditor** | **`READY_WITH_CONCERNS`** (`F00-T03-auditor.md` §6, con A-05 como único seguimiento) |
| **Estado de la tarea** | `CERRADA — PASSED` |
| **Fecha de cierre** | `2026-11-17` |

## 1. Revisión de aceptación reforzada (METHODOLOGY.md §3.2)

Contraste con SDD/paquete aprobado y decisión CTO (Opción A, sin G-9). Architect no ejecutó Docker ni pruebas: revisó reportes y evidencias de Tester/Auditor.

| Requisito / fuente superior | Comportamiento observable | Evidencia / versionado | Límite de cobertura | Estado |
|---|---|---|---|---|
| `CA-03` (P-00 §5) · arranque con `--memory=2g --cpus="2.0"` — G-7, NFR-02 | `docker compose config` exit 0 (7/7 checks); `up -d` exit 0, `healthy` en ~9 s; `docker inspect`: `memory=2147483648`, `nanoCpus=2000000000`, `memorySwap=2147483648`, `user=1000:1000` | `F00-T03-tester-v2-{config,up,inspect}.txt` | Valores efectivos verificados en el contenedor real; no se cubre rendimiento bajo carga | **CUMPLIDO** |
| `CA-03` · HTTPS local con `ca.pem` | `curl --cacert …ca.pem https://127.0.0.1:9297/__admin/health` → cuerpo `ok`, exit 0; control sin CA → exit 60 (TLS real) | `F00-T03-tester-v2-healthcheck.txt` | No se audita el contenido de la imagen ni su firma criptográfica | **CUMPLIDO** |
| `CA-03` · apagado limpio | `docker compose down` exit 0; `docker ps -a` vacío; sin red `mediashrink-cloud_default`; `docker inspect` → `no such object` | `F00-T03-tester-v2-down.txt` | Persiste el volumen named `aws-emulator-data` (fuera de G-7; documentado) | **CUMPLIDO** |
| A-01 (Auditor) · imagen inmutable | Compose usa `ghcr.io/xsavikx/aws-emulator@sha256:9cd91ae8…68376`; `buildx imagetools inspect` y `RepoDigests` coinciden | `F00-T03-{a01-digest,tester-v2-a01}.txt` | Digest del índice multi-arch; no se verifica firma del paquete | **CUMPLIDO** |
| A-02 (Auditor) · procedencia documentada | Runbook §3 declara tercero, tag, digest, comandos de comprobación y responsable | `F00-T03-{a02-runbook,tester-v2-a02}.txt` | Documental | **CUMPLIDO** |
| A-03 (Auditor, cerrado en T01) · coherencia `.env.example` | 0 usos de `:9324`; QueueUrls canónicas con `AWS_ENDPOINT_URL=:9297` como transporte; credenciales por archivos generados | `F00-T03-tester-v2-env-coherence.txt`; addendum A-03 de T01 | Sin consumo desde Terraform/Fase 1 (se verifica en T04) | **CUMPLIDO** |
| N-01 / N-02 (Auditor v2) · documentación runbook | L53 (`docker cp` en cada arranque), L69 (estado real post-A-03), L99 (`USER 1000:1000`); 0 coincidencias de `:9324`/`test:test` vigentes, 7/7 checks | `F00-T03-doc-audit.txt`; addendum v2b del Auditor | Corrección documental; sin impacto funcional | **CUMPLIDO** |
| `task.md` §3 · ámbito y honestidad de evidencia | Sin tocar `.env.example`, `infra/`, `.github/`, código, `STATE.md`, `tasks.md` ni reportes ajenos; historial v1/v2 conservado; sin `PASSED` autoemitido | `F00-T03-tester-v2-scope.txt`; addenda append-only | Sin `git diff` (repo aún no creado) | **CUMPLIDO** |

**Conclusión de la revisión:** no hay reducción de aceptación, contradicción SDD/`task.md` ni criterio sin evidencia propia del Tester. La auditoría no tiene hallazgos bloqueantes; su único seguimiento (A-05) se transfiere formalmente a `F00-T05`.

## 2. Problemas y disposición

| ID | Causa | Solución | Verificación | Disposición |
|---|---|---|---|---|
| `F00-T03-P1/T1` (v1) | **DEMOSTRADA** — Docker ausente, sin admin | Config escrita, sin evidencia falsa | `NEEDS_CONTEXT`, loop no consumido | **SUPERADO** por Opción A (Lino instaló Docker/Terraform) |
| Montaje bind (P6) | **DEMOSTRADA** — FS 9p/virtiofs de Docker Desktop en Windows rechaza el bind mount con `user: 1000:1000` | Volumen named + `docker cp`; retirada de `user:` (imagen ya declara `USER 1000:1000`) | `up` exit 0, `user=1000:1000` en vivo | **CERRADO**; sin riesgo de seguridad añadido (Auditor N-01) |
| A-01 / A-02 / A-04 | **DEMOSTRADAS** | Digest pinned, runbook con procedencia, verificación en vivo | Evidencias v2 del Tester y addenda del Auditor | **CERRADOS por corrección** |
| N-01 / N-02 | **DEMOSTRADAS** | Correcciones documentales v2b | `F00-T03-doc-audit.txt` 7/7; Auditor v2b | **CERRADOS por corrección** |
| A-05 | **DEMOSTRADA** — no existe `.gitignore`, `.local/` recibe credenciales efímeras | Sin corrección aquí (fuera de ámbito) | Auditor confirma abierto | **ABIERTO → `F00-T05`** (requiere G-10 si se quisiera conservar) |

No se concedió G-9 ni G-10. Ningún riesgo se dio por aceptado en nombre de Lino.

## 3. Cobertura y cierre

- `CA-03` queda cubierto con evidencia real de integración (arranque, límites efectivos, TLS con CA, apagado), no solo documental. Contenedor dejado **apagado**; el volumen named documentado en el runbook no forma parte de G-7.
- Auditoría: `READY_WITH_CONCERNS`, sin `CRITICAL`/`HIGH`, con A-05 como único seguimiento transferido a `F00-T05`.
- Sin Git/GitHub ni AWS real; sin secretos ni rutas Windows absolutas en artefactos públicos.
- `F00-T03` queda **`CERRADA — PASSED`**. Se actualizan `docs/sdd/tasks.md` y `STATE.md`; se habilita `F00-T04` (Terraform) con `terraform.exe` en ruta explícita y `.env.example` ya coherente (sin `:9324`).
