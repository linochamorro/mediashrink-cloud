# Cierre de tarea (Architect) — `F00-T04`

| Campo | Valor |
|---|---|
| **Tarea** | `F00-T04` — Bootstrap Terraform contra `aws/aws-emulator` |
| **Fase / paquete** | Fase 0 — `docs/sdd/packages/P-00-foundation-and-emulator.md` |
| **Versión / Loop usado** | `v1 — Loop 1/3` |
| **Rol implementador / verificadores** | Developer / Tester + Auditor (riesgo 2) |
| **Dictamen Tester** | **`PASSED`** (`F00-T04-tester.md`: `fmt`/`init`/`validate`/`plan` propios, exit 0) |
| **Dictamen Auditor** | **`READY_WITH_CONCERNS`** (`F00-T04-auditor.md`: 4 LOW + 1 INFO, sin bloqueantes) |
| **Estado de la tarea** | `CERRADA — PASSED` |
| **Fecha de cierre** | `2026-11-17` |

## 1. Revisión de aceptación reforzada (METHODOLOGY.md §3.2)

| Requisito / fuente superior | Comportamiento observable | Evidencia | Límite de cobertura | Estado |
|---|---|---|---|---|
| `CA-04` (P-00 §5) · `init`/`validate`/`plan` sin AWS real — PR-04, ADR-001 D4 | Tester reejecutó los tres con exit 0; provider `hashicorp/aws v5.100.0`, backend local | `F00-T04-tester-{init,validate,plan}.txt` | Sin `apply`; no se creó `*.tfstate*`; cobertura de planeamiento, no de aprovisionamiento | **CUMPLIDO** |
| `CA-04` · provider apunta al emulador `:9297` | Endpoint en los 4 servicios (s3/sqs/dynamodb/sts), `custom_ca_bundle`, credenciales por archivos; `plan` leyó STS en vivo `id=000000000000` | `F00-T04-tester-{config,plan}.txt`, `F00-T04-emulator.txt` | Requiere emulador en vivo para la sonda; apagado al terminar | **CUMPLIDO** |
| A-03 (T01) · sin `:9324` ni QueueUrls inventadas | 0 usos activos de `:9324` (6 menciones, todas de prohibición/validación); 0 QueueUrls con `:9297` | `F00-T04-tester-config.txt`; addendum A-03 de T01 | SQS/DLQreal se verifica en F04 (fase posterior) | **CUMPLIDO** |
| Seguridad (PR-08/G-3) · sin secretos ni credenciales fijas | 0 secretos y 0 rutas Windows absolutas; `emulator_credentials` copiado sin imprimir contenidos | `F00-T04-tester-config.txt`; auditoría T04-A | Análisis estático; el archivo de credenciales es efímero del emulador | **CUMPLIDO** |
| `task.md` §3 · ámbito y sin `apply` | Solo `infra/terraform/**`, evidence y reporte; sin tocar `.env.example`, compose, código, `STATE.md`, `tasks.md` ni reportes ajenos | `F00-T04-tester-scope.txt` | Sin `git diff` (repo aún no creado) | **CUMPLIDO** |
| G-7 · emulador apagado | `docker ps -a` vacío, sin red `mediashrink-cloud_default`; límites efectivos `2147483648`/`2000000000` durante la prueba | `F00-T04-tester-{plan,down}.txt` | Persiste volumen named documentado en T03 | **CUMPLIDO** |

**Conclusión:** criterio satisfecho con evidencia propia del Tester; sin contradicción SDD/`task.md` ni reducción de aceptación.

## 2. Problemas y disposición (auditoría riesgo 2)

| ID | Severidad | Disposición |
|---|---|---|
| `T04-A-01` — inventario inexacto del `*.tfstate*` de arranque | LOW | **SEGUIMIENTO → T05**: `.gitignore` debe cubrir `*.tfstate*`; no bloquea |
| `T04-A-02` — decisión pendiente sobre `.terraform.lock.hcl` en T05 | LOW | **SEGUIMIENTO → T05**: decidir inclusión/exclusión y documentar |
| `T04-A-03` — flags `skip_*` justificados pero no condicionados al emulador | LOW | **SEGUIMIENTO → F04 (fase posterior)**: no heredarlos en entorno real; no bloquea |
| `T04-A-04` — validación anti-`:9324` acotada y `aws_account_id` no consumido | INFO | Reconocido; sin acción en F00 |
| `A-05` (heredado de T03) — `.gitignore` ausente, `.local/` con credenciales efímeras | LOW | **ABIERTO → T05** (debe cerrarse antes del push) |

Auditoría `READY_WITH_CONCERNS`, sin `CRITICAL`/`HIGH`. Ningún riesgo aceptado: no se concedió G-10 ni G-9; las concerns son recomendaciones con responsable y fase de destino.

## 3. Cobertura y cierre

- El bootstrap queda deliberadamente acotado a provider/backend/variables/sonda STS de solo lectura: **no** crea buckets, colas ni tablas (propiedad de la Fase 4 del roadmap). `plan` con 0 cambios de infraestructura es el resultado esperado y suficiente para `CA-04`.
- Sin Git/GitHub (propiedad de T05), sin AWS real, sin `apply`, sin secretos en artefactos. Contenedor apagado.
- `F00-T04` queda **`CERRADA — PASSED`**. Se actualizan `docs/sdd/tasks.md` y `STATE.md`; se habilita `F00-T05`, que debe cerrar A-05 y las concerns T04-A-01/A-02 antes del primer commit/push (G-6/G-6b).
