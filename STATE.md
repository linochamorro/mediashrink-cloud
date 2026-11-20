# Estado operativo — MediaShrink Cloud

| Campo | Valor |
|---|---|
| **Última actualización** | `2026-11-20` (F05-AUDIT-FULL: Tester `PASSED` auditado y aprobado por CTO; cierre de `G-6` en ejecución — higiene pre-push, commit + push y CI; `G-12` retenido) |
| **Estructura del proyecto** | `Canónica completa` (`frontend/` + `backend/` + `infra/terraform/`) |
| **Fase actual** | `Fase Final — F05-AUDIT-FULL (Tester PASSED) + cierre de G-6 + tracking pre-G-12` |
| **Estado de retorno** | **`F05-AUDIT-FULL` CERRADO con Tester `PASSED` (loop 1/3), auditado y aprobado por el CTO (2026-11-20).** Developer loop 2 DONE (AUD-02 Claim Check canónico, AUD-03 contrato v1.1.0 `ab548c7f…bc52`, AUD-05 ventana API propia, AUD-06 host S3 canónico), 338/338 unit, typecheck/lint/build/E2E exit 0. Auditor loop 1 `NOT_READY` (0 `CRITICAL`/`HIGH` propios; P4 redactada → 0 rutas de host en worktree/diff; revalidación P4 ligada a commit como seguimiento). **Tester:** informe oficial `reports/implementation/F05/F05-audit-full-tester.md` con `PASSED` (338/338 con re-verificación propia, 103/103 + `f05-name-large` 1/1, E2E real 34,1 s sin muletas, rate limits en vivo, higiene P4/G-3). **G-7 cerrado:** emulador apagado, puertos 3001/5173/9297 sin listeners. Architect: `reports/verification/F05-full-review-architect.md` actualizado. **Cierre `G-6` en ejecución** por Architect (commit + push + CI sobre el nuevo `HEAD`). |
| **Única tarea o bloque autorizado** | `F05-AUDIT-FULL` (cierre real antes de `G-12`); `F02/F03/F04` no iniciadas, requieren autorización expresa (`G-2`) |
| **Último dictamen verificado** | `F05-audit-full-tester.md`: **`PASSED` (loop 1/3)** — 338/338 unit (37 archivos, re-verificación propia), 103/103 integración + `f05-name-large` 1/1, E2E 1/1 (34,1 s) + 1/1 legacy, rate limits 5/min auth vs 120/min API, `name` persistido y retrocompatible, P4=0, G-7 limpio. Contrato v1.1.0 hash `ab548c7f50c72874c18fa71d5fb4df65ff953bc43196593723002786e840bc52`. Dictamen auditado y **aprobado por el CTO** el 2026-11-20. |
| **Harness en curso** | `OpenCode → CTO (Atenea)` |
| **Gate Git (G-6) y archivos IA en GitHub (G-6b)** | `Git: Autorizado desde Fase 0 (repo público 'mediashrink-cloud') · Archivos agentes/IA en GitHub: Permitidos (G-6b abierto) · Cierre G-6: EN EJECUCIÓN por Architect (2026-11-20)` |
| **Otros gates abiertos** | `G-2 (F00 autorizada) · G-3 (.env.example) · G-4 (BD en emulador para F01) · G-8 (dependencias F00) · G-11 (borrado temporary/ en F05) · G-12 (publicación final) · G-7 Docker: Autorizado con límite --memory=2g --cpus="2.0"` |

## 1. Trabajo en curso
**Fase 1 cerrada (`FASE_COMPLETA`).** Las cinco tareas (`F01-T01`…`F01-T05`) tienen `PASSED` de Tester y auditorías `READY_WITH_CONCERNS` sin bloqueantes; CA-01…CA-05 verificados. Contratos Zod v1 congelados (hash `5d0082f8…`), DynamoDB con TTL 30 d y aislamiento en emulador, auth scrypt + JWT HS256 con 401/404 y rate limit, reglas puras al 100 % de cobertura y seed idempotente con datos ficticios. Dos decisiones de producto no escritas fueron resueltas por CTO/Lino (contraseña 8–128; AVIF animado), ambas **no G-10**. Seguimientos derivados a F02 (clave de rate limit, orden de guardas), F04 (adaptador UserStore, retención S3 vs TTL) y control de cambios del CTO (`spec.md`, marcadores JWT, tope de `LoginInput`). Docker apagado, sin tablas huérfanas, P4 no ampliado. Retorno: [F01-architect.md](reports/verification/F01-architect.md).

## 2. Pendientes inmediatos (en orden de prioridad)
1. ~~Relanzar Tester en otra sesión~~ — **HECHO (2026-11-19)**: `reports/implementation/F05/F05-audit-full-tester.md` emitido con `PASSED` (loop 1/3); `docker compose down` ejecutado y puertos 3001/5173/9297 verificados cerrados.
2. Revalidación P4 ligada a commit candidato + addendum del Auditor si procede — Responsable: `Auditor/Architect` — **seguimiento post-`G-6`**, no bloquea este cierre tras la aprobación del CTO.
3. **Cierre `G-6` EN CURSO** — Responsable: `Architect`: higiene pre-push (0 prohibidos, 0 P4 en diff) → commit limpio → `git push origin main` (sin `--force`) → verificar `ci.yml` e `infra-integration.yml` en `success` sobre el nuevo `HEAD`. `G-12` **RETENIDO**.
4. Al planificar F02/F04: clave de rate limit no suplantable y orden de guardas (F02); adaptador DynamoDB para `UserStore` y alineación retención S3 ↔ TTL (F04); no heredar `skip_*` del bootstrap — Responsable: `CTO`

## 3. Bloqueos activos
| ID / Tarea | Causa del bloqueo (`BLOCKED` / `GATE` / `NEEDS_CONTEXT`) | Quién desbloquea | Desde |
|---|---|---|---|
| `Ninguno` | `F00` y `F01` cerradas; F02/F03/F04 requieren autorización expresa (`G-2`) | `CTO / Lino` | — |

## 4. Últimos hitos cerrados
| Fecha | Fase / Tarea | Veredicto | Reporte verificable |
|---|---|---|---|
| `2026-11-17` | `F01-T04` — Seed sintético idempotente | `PASSED (1/3)` | `reports/implementation/F01/F01-T04-{developer,tester,architect}.md` + `evidence/` |
| `2026-11-17` | `F01-T03` — Auth JWT (hash, JWT, 401/404, rate limit) | `PASSED (1/3)` | `reports/implementation/F01/F01-T03-{developer,tester,architect}.md` + `reports/audits/F01/F01-T03-auditor.md` + `evidence/` |
| `2026-11-17` | `F01-T02` — Cliente DynamoDB (TTL/aislamiento) | `PASSED (1/3)` | `reports/implementation/F01/F01-T02-{developer,tester,architect}.md` + `reports/audits/F01/F01-T02-auditor.md` + `evidence/` |
| `2026-11-17` | `F01-T05` — Reglas puras (100 % cobertura) | `PASSED (1/3)` | `reports/implementation/F01/F01-T05-{developer,tester,architect}.md` + `reports/audits/F01/F01-T05-auditor.md` + `evidence/` |
| `2026-11-17` | `F01-T01` — Contratos Zod congelados + tipos generados | `PASSED (1/3)` | `reports/implementation/F01/F01-T01-{developer,tester,architect}.md` + `reports/audits/F01/F01-T01-auditor.md` + `evidence/` |
| `2026-11-17` | `F00-T06` — CI base (run verde) | `PASSED (1/3)` | `reports/implementation/F00/F00-T06-{developer,tester,architect}.md` + `reports/audits/F00/F00-T06-auditor.md` |
| `2026-11-17` | `F00-T05` — `.gitignore` + repo público | `PASSED (1/3)` | `reports/implementation/F00/F00-T05-{developer,tester,architect}.md` + `reports/audits/F00/F00-T05-auditor.md` |
| `2026-11-17` | `F00-T04` — Bootstrap Terraform | `PASSED (1/3)` | `reports/implementation/F00/F00-T04-{developer,tester,architect}.md` + `reports/audits/F00/F00-T04-auditor.md` |
| `2026-11-17` | `F00-T03` (v2) — Docker/aws-emulator en vivo + A-01/A-02 | `PASSED (1/3)` | `reports/implementation/F00/F00-T03-{developer,tester,architect}.md` + `reports/audits/F00/F00-T03-auditor.md` + `evidence/` |
| `2026-11-17` | `F00-T01` — addendum A-03 (Auditor MEDIUM) | `PASSED (addendum)` | `F00-T01-{developer,tester,architect}.md` (addenda) + `evidence/F00-T01-A03-*` |
| `2026-11-17` | `F00-T02` — Workspaces Vite/React + Hono + Vitest/Playwright | `PASSED (1/3)` | `reports/implementation/F00/F00-T02-{developer,tester,architect}.md` + `evidence/` |
| `2026-11-17` | `F00-T01` — `.env.example` y validación de configuración | `PASSED (1/3)` | `reports/implementation/F00/F00-T01-{developer,tester,architect}.md` + `evidence/` |
| `2026-11-17` | `Consolidación CTO + Gate 1 (SDD y A-01..A-07)` | `APROBADO` | `docs/sdd/{constitution,spec,plan,tasks}.md` + `P-00` |
| `2026-11-17` | `Levantamiento (intake) con Lino — 16 decisiones` | `COMPLETADO` | `reports/intake/intake-mediashrink.md` |
| `2026-11-17` | `Selección de ruta, stack y G-6b/G-7` | `APROBADO` | `docs/decisions/ADR-001-stack-and-aws-emulator.md` |

## 5. Relevos de sesión (append-only, el más reciente arriba)
### `2026-11-20` — `Architect (cierre de G-6; G-12 retenido)`
- **Realizado:** Tester emitió `PASSED` (loop 1/3) en `reports/implementation/F05/F05-audit-full-tester.md` (338/338 unit con re-verificación propia, 103/103 integración + 1/1, E2E real sin muletas, rate limits en vivo, P4=0, G-7 limpio). CTO auditó y aprobó el resultado y autorizó **únicamente** el cierre de `G-6`. Architect actualizó este `STATE.md` y `reports/verification/F05-full-review-architect.md` con el veredicto final sin cerrar `G-12`.
- **Decidido / Verificado:** higiene pre-push comprobada antes del commit (detalle en el retorno al CTO). `G-12` sigue retenido: sin release, sin deploy a AWS real. La revalidación P4 ligada a commit candidato queda como seguimiento formal del Auditor, no como bloqueo de `G-6`.
- **Pendiente al retomar:** confirmar `ci.yml` e `infra-integration.yml` en `success` sobre el nuevo `HEAD` y retornar al CTO con el hash del commit.
- **No repetir:** no cerrar `G-12`, no hacer push con `--force`, no ejecutar `terraform apply` contra AWS real, no reabrir contratos congelados.

### `2026-11-17` — `Architect (cierre de P-01 — FASE_COMPLETA)`
- **Realizado:** `F01-T04` cerrada `PASSED` (dry-run sin escrituras, idempotencia 12→12, 6/6 integración, 188/188 suite) con Tester independiente. Con las cinco tareas en `PASSED`, se entregó `reports/verification/F01-architect.md` con CA-01…CA-05 verificados y se actualizaron `tasks.md` y `STATE.md`.
- **Decidido / Verificado:** `FASE_COMPLETA`, sin G-9 ni G-10; dos decisiones de producto de CTO/Lino registradas (contraseña 8–128, AVIF animado), ambas no G-10. Auditorías `READY_WITH_CONCERNS` sin CRITICAL/HIGH ni bloqueantes. Seguimientos con responsable y fase: F02 (rate limit no suplantable, orden de guardas), F04 (UserStore → DynamoDB, retención S3 ↔ TTL), CTO (spec.md, marcadores JWT, tope de LoginInput).
- **Pendiente al retomar:** Revisión CTO y autorización expresa de F02/F03/F04; resolución de P4 antes de G-12.
- **No repetir:** No iniciar F02/F03/F04 sin autorización; no aceptar riesgos sin Lino; no reabrir contratos/reglas congelados sin control de cambios.

### `2026-11-17` — `Architect (cierre F01-T03)`
- **Realizado:** `F01-T03` cerrada `PASSED` (44/44 auth, 150/150 suite) con Tester independiente; Auditor `READY_WITH_CONCERNS` sin CRITICAL/HIGH ni bloqueantes. Actualizados `tasks.md` y `STATE.md`. Despachado `F01-T04` (seed) como última tarea de P-01.
- **Decidido / Verificado:** Seguimientos con fase de destino: `T03-A-01` (clave de rate limit suplantable) → F02 antes de exponer `/auth/login`; `T03-A-04` (UserStore en memoria) → F04 con adaptador DynamoDB; `T03-A-03`/`T03-A-05` → control de cambios del CTO. Ninguno aceptado como riesgo (sin G-10). Manifiestos sin cambios: `hono/jwt` ya estaba disponible.
- **Pendiente al retomar:** Cierre de `F01-T04` y retorno consolidado con `reports/verification/F01-architect.md` (CA-01…CA-05 PASSED), sin iniciar F02/F03/F04.
- **No repetir:** No exponer rutas HTTP en F01; no iniciar fases paralelas; no aceptar riesgos sin Lino.

### `2026-11-17` — `Architect (cierres F01-T05 y F01-T02)`
- **Realizado:** `F01-T05` cerrada `PASSED` (47/47 reglas, 100 % cobertura, 119/119 suite); Auditor `READY_WITH_CONCERNS` con AVIF animado como decisión no escrita → **Lino aprobó los aliases** (no G-10). `F01-T02` cerrada `PASSED` (19/19 integración, TTL 30 d, 6/6 aislamiento); Auditor `READY_WITH_CONCERNS` sin bloqueantes. Concern P3 de T05 resuelto por T02: `@vitest/coverage-v8` declarado y verificable con `npm ci`. Actualizados `tasks.md` y `STATE.md`.
- **Decidido / Verificado:** Dos decisiones de producto registradas por CTO/Lino (contraseña 8–128 en T01; AVIF animado en T05), ambas no G-10. Docker apagado tras las pruebas, sin tablas huérfanas, typecheck global limpio.
- **Pendiente al retomar:** Cierre de `F01-T03` (auth) y `F01-T04` (seed); retorno final con `F01-architect.md`. Seguimientos: A-04 del CTO en `spec.md`, T02-A-01 para F04, A-05 de T05 para F02.
- **No repetir:** No reabrir contratos/reglas cerrados sin control de cambios; no iniciar F02/F03/F04.

### `2026-11-17` — `Architect (cierre F01-T01)`
- **Realizado:** Tester emitió `PASSED` (32/32 contratos, 72/72 suite, generación byte-idéntica y sin duplicación en frontend); Auditor `READY_WITH_CONCERNS` con A-01 (longitud de contraseña no escrita) como único punto de gobernanza. Consultado CTO/Lino, **aprobó 8–128 caracteres**; el Auditor registró el cierre de A-01 en addendum append-only. Cerrada `F01-T01` con `F01-T01-architect.md`; actualizados `tasks.md` y `STATE.md`. Despachados en paralelo los Developers de T02 y T05.
- **Decidido / Verificado:** Decisión de producto 8–128 es **no G-10**; PR-06 satisfecho. A-02 (versión zod citada), A-03 (`tsx` devDependency) y A-04 (`spec.md` con etiqueta «PROPUESTA») quedan como seguimientos documentales; A-04 compete al CTO. Sin cambios en el catálogo ni en el hash `5d0082f8…`.
- **Pendiente al retomar:** Cierre de T02 y T05, despacho de T03 y T04, y retorno final con `F01-architect.md`.
- **No repetir:** No reabrir los contratos congelados sin control de cambios; no iniciar F02/F03/F04; no aceptar riesgos sin Lino.

### `2026-11-17` — `Architect (inicio de F01)`
- **Realizado:** Verificada DoR de `P-01` (paquete aprobado, F00 cerrada, gates G-2/G-3/G-4/G-6/G-6b/G-7 resueltos). Abiertos los cinco contratos `reports/implementation/F01/F01-T0x-task.md` con ámbitos disjuntos. Despachado `F01-T01` a Developer. Actualizado este `STATE.md`.
- **Decidido / Verificado:** Interpretación de ámbito: `backend/package.json` puede recibir dependencias de T01/T02/T03/T05; `package.json` raíz solo lo toca T04 para el script `seed`. Sin supuestos de producto; F02/F03/F04 no iniciadas. Docker con límites y apagado tras pruebas.
- **Pendiente al retomar:** Dictámenes de T01; cierre y avance a T02/T03/T05 en paralelo, luego T04; retorno final con `F01-architect.md`.
- **No repetir:** No implementar producto ni ejecutar pruebas como Architect; no iniciar F02/F03/F04; no usar AWS real.

### `2026-11-17` — `Architect (cierre de F00 — FASE_COMPLETA)`
- **Realizado:** `F00-T04`, `F00-T05` y `F00-T06` cerradas `PASSED` con Tester independiente y Auditor riesgo 2 sin bloqueantes. Terraform `init`/`validate`/`plan` en vivo; repo público `mediashrink-cloud` con G-6b y A-05 cerrado; CI run `44184037945` `success` (4/4 pasos). Actualizados `AGENTS.md` §6 (comandos comprobados, cifra final 40/40), `tasks.md`, `STATE.md` y `reports/verification/F00-architect.md` §7 (consolidación append-only).
- **Decidido / Verificado:** CA-01…CA-06 `PASSED`; sin `G-9` ni `G-10`; P4 y deudas CI/herramientas quedan como seguimientos no bloqueantes con responsable y fase. `G-12` no ejecutado (sin release/deploy); contenedor Docker apagado tras cada prueba.
- **Pendiente al retomar:** Revisión CTO y autorización de `P-01`; resolución de P4 antes de G-12; sincronización de `ab5ef7c`.
- **No repetir:** No iniciar Fase 1 sin autorización; no aceptar riesgos por Lino; no publicar release sin G-12.

### `2026-11-17` — `Architect (re-despacho F00: A-03 y T03 en vivo)`
- **Realizado:** Addendum A-03 de `F00-T01` corregido y re-verificado (`PASSED`): sin `:9324`, credenciales por archivos generados, QueueUrls canónicas con `AWS_ENDPOINT_URL` como transporte (sonda SigV4 real). `F00-T03` reanudada con Docker real: corregido el montaje (volumen named + `docker cp`, sin `user:`), imagen fijada por digest (A-01), procedencia documentada (A-02) y N-01/N-02 resueltos. Cerrada `PASSED` por Tester v2 con evidencia propia; Auditor `READY_WITH_CONCERNS` con A-05 transferido a T05. Actualizados `tasks.md` y `STATE.md`.
- **Decidido / Verificado:** Opción A sin G-9 ni G-10. Binarios fuera de PATH: Docker en `<DOCKER_CLI_DIR>`, Terraform en `<TF_CLI_DIR>` — se pasan rutas explícitas a cada subagente. Contenedor dejado APAGADO.
- **Pendiente al retomar:** `F00-T04` (Terraform) → `F00-T05` (repo, cierra A-05) → `F00-T06` (CI) → cierre de fase con `AGENTS.md` §6 y retorno consolidado.
- **No repetir:** No simular evidencia, no reabrir T01/T02/T03 salvo control de cambios, no iniciar Fase 1, no aceptar riesgos sin Lino.

### `2026-11-17` — `Architect (retorno de F00 al CTO)`
- **Realizado:** Tester de `F00-T03` emitió `NEEDS_CONTEXT` (loop 1/3 no consumido; configuración 15/15 estática, sin evidencia falsa de arranque) y Auditor emitió `INCONCLUSIVE` sin CRITICAL/HIGH ni bloqueantes de auditoría. Redactado `reports/verification/F00-architect.md` con motivo `GATE_PENDIENTE`/`NEEDS_CONTEXT`; `tasks.md` y este `STATE.md` actualizados con T01/T02 `PASSED` y T03…T06 pendientes.
- **Decidido / Verificado:** `CA-01` y `CA-02` satisfechos; `CA-03` solo documental; `CA-04`…`CA-06` no verificados. Sin G-9 ni G-10 concedidos: ningún riesgo aceptado en nombre de Lino. No se iniciaron `F00-T04`…`F00-T06` ni Fase 1; no se usaron Git/GitHub ni Docker.
- **Pendiente al retomar:** Decisión del CTO/Lino (Opción A: Docker + Terraform con admin; Opción B: G-9) y corrección del hallazgo A-03 en `.env.example`; después re-dispatch de T04…T06.
- **No repetir:** No presentar la auditoría estática como integración; no reabrir T01/T02 salvo control de cambios; no redactar `P-01`.

### `2026-11-17` — `Architect (cierre F00-T02 / bloqueo F00-T03)`
- **Realizado:** `F00-T02` cerrada `PASSED` (loop 1/3) tras dictamen de Tester; actualizados `tasks.md` y `STATE.md`. `F00-T03` recibida del Developer como `BLOCKED`: `docker-compose.yml` y runbook escritos y auditados (12/12 estáticos), sin evidencia falsa de arranque. Despachados Tester y Auditor de `F00-T03` para formalizar `NEEDS_CONTEXT` y revisar riesgos.
- **Decidido / Verificado:** P1 de T02 resuelto (lockfile + `npm ci` + Vitest/`sharp` cargan); P2 (ESLint 8) queda como deuda no bloqueante para `F00-T06`. Sin G-10. Docker no se pudo instalar sin administrador: se activa condición de retorno por gate/contexto; `F00-T04` queda bloqueada por dependencia.
- **Pendiente al retomar:** Dictámenes de Tester/Auditor de `F00-T03`; decisión del CTO/Lino sobre instalación de Docker con privilegios o verificación alternativa (G-9); después `F00-T04`…`F00-T06`.
- **No repetir:** No simular evidencia de Docker; no iniciar Fase 1; no aceptar riesgos sin Lino.

### `2026-11-17` — `Architect (cierre F00-T01)`
- **Realizado:** Revisada evidencia de Developer y Tester sin ejecutar pruebas propias. `F00-T01` cerrada `PASSED` en Loop 1/3; `CA-01` contrastado con SDD/paquete según §3.2. Actualizados `docs/sdd/tasks.md` y este `STATE.md`. Despachados en paralelo los Developers de `F00-T02` y `F00-T03`.
- **Decidido / Verificado:** RED cronológico íntegro (30 fallos por comportamiento), GREEN 30/30, typecheck limpio y G-3 sin hallazgos. P3 (`esbuild`/lockfile/`tsconfig.json`) queda como riesgo residual no bloqueante para `F00-T02`/`F00-T06`, sin aceptación de riesgo G-10.
- **Pendiente al retomar:** Dictámenes de Tester (y Auditor en `F00-T03`) para las dos tareas en curso; luego `F00-T04`, `F00-T05` y `F00-T06`.
- **No repetir:** No reejecutar el RED ni emitir un tercer dictamen como Architect; no iniciar Fase 1.

### `2026-11-17` — `Architect (Fase 0, harness OpenCode)`
- **Realizado:** Verificado DoR de `P-00` (SDD y paquete aprobados, gates G-1/G-2/G-3/G-6/G-6b/G-7/G-8 resueltos, `gh` autenticado como `linochamorro` con scopes `repo`/`workflow`). Abiertos los seis contratos `F00-T01`..`F00-T06` y despachado `F00-T01` a Developer bajo TDD.
- **Decidido / Verificado:** Sin supuestos ni reducción de aceptación. Se registró como riesgo de entorno la ausencia de `docker` y `terraform` en PATH (comprobado también en rutas habituales): se deja que Tester dictamine `NEEDS_CONTEXT` si no se pueden verificar `CA-03`/`CA-04`, sin fabricar evidencia.
- **Pendiente al retomar:** Recibir reporte de Developer `F00-T01`, derivar a Tester, cerrar y avanzar por dependencias (`F00-T02` y `F00-T03` en paralelo; luego `F04`, `T05`, `T06`).
- **No repetir:** No implementar ni ejecutar pruebas como Architect; no iniciar Fase 1; no tocar archivos fuera del ámbito de la fase.

### `2026-11-17 09:08` — `CTO (Atenea)`
- **Realizado:** Consolidación de `docs/sdd/{constitution,spec,plan,tasks}.md` (retirada marca `BORRADOR`, integrados `A-01`..`A-07` y `POST /jobs/:id/confirm`), actualización de `docs/architecture/00-overview.md`, redacción de `docs/sdd/packages/P-00-foundation-and-emulator.md` (`F00-T01`..`F00-T06`) y entrega del prompt de Fase 0.
- **Decidido / Verificado:** Gate 1 aprobado por Lino (2026-11-17). `A-01` Claro por defecto, `A-02` `scrypt`/`bcryptjs`, `A-04` miniatura WebP, `A-05` ZIP optimizadas+miniaturas, `A-06` rate limiting auth configurable, `A-07` comparativa `raw` vs `optimized` en ventana 30 días.
- **Pendiente al retomar:** Despachar `P-00` a Architect en OpenCode.
- **No repetir:** No iniciar Fase 1 sin cierre verificado de `F00` (`F00-architect.md`).
### `2026-11-17` — `Architect (modo levantamiento, harness OpenCode)`
- **Realizado:** Entrevista directa con Lino en 4 tandas (16 decisiones, alternativas explícitas, sin supuestos). Entregados `reports/intake/intake-mediashrink.md` y borradores `docs/sdd/{constitution,spec,plan,tasks}.md`. No se implementó código, no se ejecutaron pruebas y no se inició Fase 0.
- **Decidido / Verificado:** Portafolio con login multi-usuario simulado y datos ficticios; WebP + AVIF por imagen; 3 presets; descarga individual + ZIP; borrado manual + limpieza S3; JWT propio en Hono; aislamiento por `userId`; límites por `.env`; 3 reintentos + DLQ con continuación del lote; 30 días de retención; validación estricta y eliminación de todos los metadatos; UI en español con tema Claro/Dark, comparativa y polling; seed sintético; repo GitHub público `mediashrink-cloud` (G-6/G-6b).
- **Pendiente al retomar:** Revisión CTO, resolución de A-01…A-07, aprobación de Gate 1 y, solo entonces, redacción/despacho de `P-00`.
- **No repetir:** No dar por aprobado el SDD, no redactar `P-00` ni ejecutar operaciones Git/Docker/pruebas sin sus gates respectivos.

### `2026-11-17` — `CTO (Atenea)`
- **Realizado:** Corrección de flujo según `WORKFLOW.md §2`: retirados los borradores prematuros de SDD/`P-00` asumidos sin entrevista; conservados `AGENTS.md`, `STATE.md`, `.env.example`, `ADR-001`, arquitectura, runbooks y `.agents/roles/`. Preparado el encargo de levantamiento (`intake`) para que **Architect** en el otro harness entreviste a Lino.
- **Decidido / Verificado:** Stack aprobado (`Vite + React + TS`, `Hono`, `Node + sharp`, `Terraform`, `aws/aws-emulator` en Docker con `--memory=2g --cpus="2.0"`), `G-6` desde Fase 0 y `G-6b` abierto (archivos IA visibles en GitHub).
- **Pendiente al retomar:** Ejecutar el prompt de levantamiento (`intake`) en el otro harness con Lino y retornar al CTO con `reports/intake/` + borradores SDD.
- **No repetir (caminos descartados):** No redactar `P-00` ni dar por cerrado `spec.md` antes del levantamiento con Lino y Gate 1.

## 6. Enlaces rápidos
- Reglas locales: [AGENTS.md](AGENTS.md)
- Decisiones técnicas: [docs/decisions/index.md](docs/decisions/index.md)
- Runbooks: [docs/runbooks/development-workflow.md](docs/runbooks/development-workflow.md)
- Intake: [reports/intake/intake-mediashrink.md](reports/intake/intake-mediashrink.md)
- SDD (aprobado Gate 1): [constitution.md](docs/sdd/constitution.md) · [spec.md](docs/sdd/spec.md) · [plan.md](docs/sdd/plan.md) · [tasks.md](docs/sdd/tasks.md)
- Paquete F00: [P-00-foundation-and-emulator.md](docs/sdd/packages/P-00-foundation-and-emulator.md)
- Retorno de Fase 0: [F00-architect.md](reports/verification/F00-architect.md)

## 7. Retorno al CTO
**Estado actual (2026-11-20): `F05-AUDIT-FULL` con Tester `PASSED` (loop 1/3), auditado y aprobado por el CTO; cierre de `G-6` en ejecución por Architect; `G-12` RETENIDO.** F02/F03/F04 están cerradas (`FASE_COMPLETA`/`PASSED`) y la Fase Final está lista para consolidación/push condicionado. Detalle: [F05-full-review-architect.md](reports/verification/F05-full-review-architect.md) y [F05-audit-full-tester.md](reports/implementation/F05/F05-audit-full-tester.md).

**Estado histórico (2026-11-17): `FASE_COMPLETA` (P-01).** P-00 y P-01 cerradas: `F00-T01`…`F00-T06` y `F01-T01`…`F01-T05` con `PASSED` de Tester; CA-01…CA-06 y CA-01…CA-05 verificados; auditorías `READY_WITH_CONCERNS` sin hallazgos bloqueantes. No se concedió `G-9` ni `G-10`; G-1…G-8 ejecutados según fase; G-11/G-12 no ejecutados. P-01 dejó contratos congelados (hash `5d0082f8…`), persistencia con TTL/aislamiento, auth scrypt+JWT, reglas puras al 100 % y seed idempotente. Seguimientos no bloqueantes con responsable y fase: F02 (rate limit no suplantable, orden de guardas), F04 (UserStore → DynamoDB, retención S3 ↔ TTL, flags `skip_*`), CTO (P4, `spec.md`, marcadores JWT, tope de `LoginInput`, deuda ESLint 8/scripts). Se detiene la ejecución del Architect; **F02/F03/F04 no iniciadas** y se solicita autorización expresa. Detalle: [F01-architect.md](reports/verification/F01-architect.md) y [F00-architect.md §7](reports/verification/F00-architect.md).
