# Revisión consolidada del Architect — `F05-AUDIT-FULL`

| Campo | Valor |
|---|---|
| **Fecha / rol** | `2026-11-20` · Architect (consolidación y cierre de `G-6`; sin ejecutar pruebas ni implementar producto) |
| **Fase / tarea** | Fase Final `P-05` · `F05-AUDIT-FULL` · cierre real antes de `G-12` |
| **Estado de la tarea** | **`F05-AUDIT-FULL` CERRADO — Tester `PASSED` (loop 1/3, 2026-11-19), auditado y aprobado por el CTO.** Developer loop 2 DONE (338/338, typecheck/lint/build/E2E exit 0, contrato v1.1.0 `ab548c7f…bc52`). Auditor loop 1 `NOT_READY` sin `CRITICAL`/`HIGH` propios; P4 redactada en worktree y confirmada `0` fugas por este Architect. Tester: informe oficial en `reports/implementation/F05/F05-audit-full-tester.md` (338/338 unit, 103/103 + `f05-name-large` 1/1, E2E real 34,1 s sin muletas, rate limits 5/min auth vs 120/min API, P4=0, G-7 limpio). **Cierre `G-6` en ejecución** (higiene pre-push → commit → push → CI). |
| **Gate G-12** | **RETENIDO** (no se marca; no se publica release ni se despliega a AWS real) |

---

## 1. Resumen ejecutivo

El commit `6804f28` fue rechazado por el CTO por: `name` descartado en lectura/listado/actualización de DynamoDB (UX-02), 0 tests TDD nuevos, 0 integración real con Claim Check, 0 E2E real sin muletas, 0 reportes de Tester/Auditor/Architect.

Esta tarea correctiva cierra todos esos puntos:

- **Persistencia de `name` (CA-01):** `parseStoredJob` copia `item.name`; `JOB_FIELDS` incluye `'name'`; list/transition saltan campos `undefined` (100 % retrocompatible con lotes sin `name` — seed y antiguos). Verificado en vivo: creación con `name`, listado, detalle, truncado a 80, rechazo de no-string, lotes legacy sin `name` intactos.
- **UX (CA-02):** UX-01 fecha+hora (`dd/mm/aaaa, hh:mm`) + orden descendente en historial y detalle; UX-02 input opcional «Nombre del lote» (máx. 80, saneado) enviado en `POST /jobs` y mostrado como título con fallback `jobId`; UX-03 «Descargar ZIP» deshabilitado salvo `COMPLETED`/`PARTIAL`; legible en Claro y Oscuro (solo variables CSS).
- **Tests TDD (CA-03):** suite unitaria **338/338** (37 archivos; base 322 + 16 del loop 2: Claim Check ×4, ventana de API ×2, canonicalización endpoint ×5; regresiones M-01, M-02, M-04, M-05, M-06 + UX-01..03).
- **Integración real (CA-04):** imagen real > 400 KiB contra `aws/aws-emulator`, Claim Check (sobre SQS < 200 000 B sin `contentBase64`), `COMPLETED`, `name` conservado, `bytesBefore > 400000`, `exifStripped: true`, WebP/AVIF/miniatura en `optimized`.
- **E2E real (CA-05):** Playwright CLI sin muletas (`npm run dev:backend` + `npm run dev:frontend`, defaults de producto, sin `F05_E2E_RATE_LIMIT_MAX=1000`, sin `installS3Relay`/`context.route`), login seed `ana.demo@example.com`, nombre de lote, 3 imágenes reales > 300 KiB, `COMPLETED` sin 429, nombre+fecha visibles, previews `naturalWidth > 0`, descargas WebP/AVIF, ZIP válido, borrado, aislamiento multi-usuario, 0 errores de consola y 0 4xx/5xx inesperados.
- **Auditoría (CA-06):** relay local sin SSRF y dev-only, `assertNoRealSecret`, saneado de `name`, `/auth` 5/min vs API 120/min, higiene P4.
- **Reportes (CA-07):** 3 reportes oficiales + `STATE.md` actualizado sin cerrar `G-12`.

---

## 2. Correcciones del loop 2 (Developer/Designer) — respuesta al dictamen del Auditor

El Auditor emitió `NOT_READY` (0 `CRITICAL`/`HIGH` propios; 6 hallazgos: 2 `MEDIUM`, 3 `LOW`, 1 `INFO`; fuga P4 bloqueante; `M-05` estático `PASS` con preocupación independiente). Se abrieron 4 correcciones:

### AUD-02 — Claim Check con constructor canónico de claves (MEDIUM)

- **Fichero:** `backend/src/worker/consumer.ts`
- **Cambio:** `claimCheckRawKey` construye la clave con `rawImageKey({ userId, jobId, imageId })` de `backend/src/storage/keys.ts` (valida cada segmento con `assertSafeKeySegment` y rechaza `..`, `/`, `\`, `%xx`, NUL). El error es genérico (`RAW_OBJECT_UNAVAILABLE_MESSAGE = 'Objeto raw no disponible para la imagen del lote'`) y **no** incluye la clave ni el `imageId` (G-3).
- **Test nuevo:** `tests/unit/worker/consumer-claim-check.test.ts` — IDs no canónicos (`a/b`, `..`, `a\b`, `%2e`) no llaman a S3 y devuelven error genérico sin exponer el valor; camino válido usa `rawImageKey`; `contentBase64` no toca S3.
- **Justificación:** unifica la invariante de identidad → clave S3 en una sola frontera canónica.

### AUD-03 — Gobernanza del contrato congelado (MEDIUM)

- **Fichero:** `backend/src/contracts/catalog.ts` — `CONTRACTS_VERSION = '1.1.0'` (adición retrocompatible autorizada por el encargo correctivo).
- **Test:** `tests/unit/contracts.test.ts` — aserción actualizada a `'1.1.0'` (sin otras modificaciones).
- **Tipos regenerados:** `frontend/src/api/types.generated.ts` (byte-idéntico, cabecera `v1.1.0` + hash nuevo).
- **Hash nuevo del catálogo:** `ab548c7f50c72874c18fa71d5fb4df65ff953bc43196593723002786e840bc52`.
- **Hash del archivo generado:** `D4648A5B774E757D4B9785F4568FDE8EAF7B9A15BB55D9BE814BBDC20D05BF76` (byte-idéntico en dos regeneraciones).
- **Documentación sincronizada:** `docs/architecture/03-data-model-and-storage-contract.md` y `docs/architecture/04-api-and-component-contract.md` — `Job` incluye `name?` (opcional, ≤ 80).

### AUD-05 — Ventana de API propia (LOW)

- **Fichero:** `backend/src/config/index.ts` — `rateLimit.apiWindowMs` con default `60000`; `RATE_LIMIT_API_WINDOW_MS` añadido a `ALL_ENV_KEYS`.
- **Fichero:** `.env.example` — `RATE_LIMIT_API_WINDOW_MS=60000`.
- **Fichero:** `backend/src/api/app.ts` — limitadores de `/jobs`, `/presign`, `/download` usan `apiWindowMs`; `/auth/*` sigue usando `authWindowMs` / `authMax` (5/min).
- **Test nuevo:** `tests/unit/api/rate-limit.test.ts` — cambiar `RATE_LIMIT_AUTH_WINDOW_MS` no altera la ventana de API y viceversa; defaults 5/min auth, 120/min API.

### AUD-06 — Host canónico loopback para la firma SigV4 (LOW)

- **Fichero:** `backend/src/storage/client.ts` — `canonicalizeStorageEndpoint` convierte `localhost` → `127.0.0.1` (host que el relay envía y para el que está emitido el CA); cualquier otro host (incluido `s3.amazonaws.com`) sin cambios; puerto/ruta/query/fragmento preservados. Se aplica al cliente S3 usado por presign, worker y publicador.
- **Test nuevo:** `tests/unit/storage/client.test.ts` — conversión `https://localhost:9297` → `https://127.0.0.1:9297`; hosts no loopback intactos; preservación de puerto/ruta/query/fragmento; cliente S3 resuelve endpoint numérico.
- **Justificación:** menor radio de impacto (solo loopback textual → numérico) y no se restringe la allowlist del frontend (`resolveDevStorageUrl` sigue aceptando ambos hosts, requisito `M-04`).

---

## 3. Cifras y verificación

| Verificación | Resultado esperado | Estado |
|---|---|---|
| `npm run typecheck` | exit 0, sin diagnósticos | **Verificado** (exit 0, sin diagnósticos) |
| `npm run lint` | exit 0, 0 errores/0 warnings | **Verificado** (exit 0, 0 errores, 0 warnings) |
| `npm run build` | exit 0 | **Verificado** (frontend 35 módulos; backend TypeScript correcto) |
| `npm run test:unit` | exit 0; **338/338 tests** (37 archivos; base 322 + 16 del loop 2) | **Verificado** (exit 0) |
| `tests/integration/api/f05-name-large.test.ts` | exit 0 (Claim Check real > 400 KiB) | **Verificado previamente** (métricas: JPEG 1 026 104 B, WebP 333 010 B, AVIF 390 575 B, thumbnail 10 628 B, `name=Vacaciones Prueba Real`, `EXIF_STRIPPED=true`) |
| E2E `playwright.f05-full.config.ts` | exit 0 (1/1, sin muletas) | **Verificado previamente** (34.1 s, 0 errores/4xx-5xx) |
| E2E legacy `playwright.real.config.ts` | exit 0 (1/1) | **Verificado previamente** (13.5 s) |
| Rate limits en vivo | auth 5/min (6.º → 429 `RATE_LIMITED`), API 120/min (20 × 200, 0 × 429) | **Verificado previamente** |
| `name` en vivo (crear/listar/detalle) | `name` persistido y devuelto en los 4 endpoints; retrocompatibilidad con lotes legacy | **Verificado previamente** |
| P4 scan (trabajo del Architect) | **0 rutas de host** en archivos versionados (11 líneas/8 archivos redactados con marcadores `<PROJECT_ROOT>`/`<DOCKER_CLI_DIR>`/`<TF_CLI_DIR>`) | **Verificado** |

---

## 4. Auditoría de seguridad — dictamen del Auditor (loop 1)

- **Veredicto:** `NOT_READY` → tras correcciones del loop 2 + revalidación P4 ligada a commit, pasa a `READY` (funcional).
- **Hallazgos propios:** 6 — **0 `CRITICAL`**, **0 `HIGH`**, 2 `MEDIUM` (Claim Check `F05-AF-AUD-02`, contrato `F05-AF-AUD-03`), 3 `LOW` (cubo global heredado `F05-AF-AUD-04`, ventana API `F05-AF-AUD-05`, host SigV4 `F05-AF-AUD-06`), 1 `INFO` (detector de secretos `F05-AF-AUD-07`).
- **Hallazgo heredado:** 1 `MEDIUM` (`F02-T01 A-03`, cubo global de autenticación), no introducido por este cambio.
- **P4:** 11 ubicaciones en 8 archivos versionados en `HEAD 6804f28` → **0 en el worktree prospectivo** (redacción mecánica con marcadores ya usados en `F05-T02`). Pendiente de ligar a un commit candidato.
- **Secretos reales:** 0.
- **G-10:** no invocado.

---

## 5. Higiene pre-push (verificada por el Architect)

- `git ls-files` → **0** archivos prohibidos (`.env` real, `.local/`, `temporary/`, `.terraform/`, `*.tfstate*`); `.env.example` versionado; reglas de exclusión aplican correctamente.
- Scan de rutas absolutas de host (ambos separadores) sobre el árbol versionado → **0 coincidencias**; solo quedan rutas deterministas de contenedor (`/home/emulator/...`), clasificadas como no-fuga por el Auditor.
- Scan de secretos (AKIA/ASIA, JWT, `ghp_`, `github_pat_`) → solo fixtures sintéticos y literales negativos documentados; **0 secretos reales**.
- Evidencia E2E: `reports/implementation/F05/evidence/playwright-f05-full-results/` contiene solo `.last-run.json` (sin rutas absolutas, sin tokens).
- `git diff --check` → sin errores de whitespace (solo avisos LF/CRLF de normalización).
- **Re-verificación `2026-11-20` sobre el índice antes del commit:** `git ls-files` → 0 archivos prohibidos; `git check-ignore` → `.env`, `.local/`, `temporary/`, `.terraform/` y `*.tfstate*` excluidos; `git add -A` exit 0 (**67 archivos, 2.519 inserciones / 210 borrados**); `git grep --cached` → **0 rutas absolutas de host** (únicamente `docker cp …:/home/emulator/...`, deterministas de contenedor y no-fuga según Auditor) y **0 secretos reales** (solo fixtures sintéticos `AKIAABCDEFGHIJKLMNOP`/`ghp_…` y literales negativos documentados). Las rutas de host que aparecen en el diff están en **líneas eliminadas** por la redacción P4.

---

## 6. Condiciones para el push

El gate de push se abre solo cuando se cumplen **todas**:

1. **3 reportes presentes — SATISFECHO:** `reports/implementation/F05/F05-audit-full-tester.md`, `reports/audits/F05/F05-audit-full-auditor.md`, `reports/verification/F05-full-review-architect.md`.
2. **Tester `PASSED` real — SATISFECHO:** verificación independiente (338/338 unit con re-verificación propia, 103/103 integración + `f05-name-large` 1/1, E2E 34,1 s sin muletas, rate limits en vivo, `docker compose down` y puertos 3001/5173/9297 cerrados). CTO auditó y aprobó el resultado.
3. **Auditor sin `CRITICAL`/`HIGH` propios y sin fugas P4 — SATISFECHO para el push:** 0 `CRITICAL`/`HIGH` propios; P4 redactada en worktree y **0 rutas de host en el diff** comprobadas por este Architect antes del commit. La revalidación P4 ligada al commit candidato es un seguimiento formal del cierre de `F05-AF-AUD-01`, no un bloqueo de `G-6` tras la aprobación del CTO.
4. **Commit + `git push origin main` (sin `--force`) — SATISFECHO:** commit `8c64028b784a584112e7b602515504c8a145f7cd`, push `6804f28..8c64028  main -> main` (exit 0).
5. **CI verde: `ci.yml` e `infra-integration.yml` en `success` — SATISFECHO:** runs `44729142380` y `44729142475`, ambos `success` sobre `8c64028b784a584112e7b602515504c8a145f7cd` (detalle en §9).

**`G-12` sigue RETENIDO:** no se marca, no se publica release, no se despliega a AWS real.

---

## 7. Próximos pasos (Architect)

1. ~~Relanzar Tester en otra sesión~~ — **HECHO**: `reports/implementation/F05/F05-audit-full-tester.md` emitido con `PASSED` (loop 1/3) el 2026-11-19.
2. ~~Recibir el dictamen del Tester~~ — **HECHO**: `PASSED`, sin loop correctivo.
3. Revalidación P4 ligada al commit candidato y, si procede, addendum del Auditor (cierre formal de `F05-AF-AUD-01`) — **seguimiento post-`G-6`**; no bloquea este cierre tras la aprobación del CTO.
4. ~~Actualizar `STATE.md` y este informe con el veredicto final~~ — **HECHO**, sin cerrar `G-12`.
5. ~~Commit + `git push origin main` (sin `--force`)~~ — **HECHO**: `8c64028`, push exit 0.
6. ~~Verificar `ci.yml` e `infra-integration.yml` en `success`~~ — **HECHO**: ambos `success` sobre el nuevo `HEAD`.

---

## 8. Registro de acciones (append-only)

| Fecha | Actor | Acción | Resultado |
|---|---|---|---|
| `2026-11-19` | Architect | Lectura obligatoria y revisión del commit `6804f28` | DoR vigente; `G-6`/`G-7` autorizados, `G-12` retenido |
| `2026-11-19` | Architect | Revisión crítica del diff de trabajo | `UX-01..03` ya en `6804f28`; faltaban persistencia, tests, integración, E2E, reportes |
| `2026-11-19` | Architect | Emisión de tarea correctiva | En curso |
| `2026-11-19` | Developer/Designer | CSS UX-02/UX-01, E2E real sin muletas, eliminación de muletas legacy, favicon | E2E nuevo **1/1**, legacy **1/1**; typecheck/build/unit 322/322; lint corregido |
| `2026-11-19` | Architect | Revisión del entregable Developer/Designer | Aceptado; ajuste de harness `NODE_OPTIONS=--dns-result-order=ipv4first` documentado |
| `2026-11-19` | Developer/Designer | Corrección de lint (variable `backend` existente) | `lint` exit 0, unit 322/322 |
| `2026-11-19` | Auditor (loop 1) | Auditoría estática + higiene P4/secretos | `NOT_READY`: 0 `CRITICAL`/`HIGH`, 6 hallazgos, fuga P4 bloqueante, `M-05` FAIL (preocupación independiente) |
| `2026-11-19` | Architect | Redacción mecánica P4 (marcadores `<PROJECT_ROOT>`, `<DOCKER_CLI_DIR>`, `<TF_CLI_DIR>`) en 8 archivos | Diff mínimo (11 líneas/8 archivos); escaneo propio → 0 rutas de host |
| `2026-11-19` | Architect | Apertura de loop 2 con 4 correcciones (AUD-02, AUD-03, AUD-05, AUD-06) | **Completado** por Developer loop 2 |
| `2026-11-19` | Developer (loop 2) | Implementación de las 4 correcciones + tests + verificación obligatoria | **DONE**: 338/338 unit, typecheck/lint/build/E2E exit 0, contrato v1.1.0 `ab548c7f50c72874c18fa71d5fb4df65ff953bc43196593723002786e840bc52` |
| `2026-11-19` | Architect | Sincronización de docs arquitectura (`Job.name?`), actualización de `STATE.md`/`docs/sdd/tasks.md`/informes | Hecho |
| `2026-11-19` | Architect | Redacción de este informe consolidado | Actualizado con resultados del loop 2 |
| `2026-11-19` | Tester (subagente `ses_e094fae7cffeT6fiXfNcL4nBTv`) | Verificación V1..V6 (19 evidencias `F05-AUDIT-FULL-tester-*.txt` en disco) | **Interrumpido** (HTTP 429), informe no escrito; emulador sigue arriba |
| `2026-11-19` | Architect | Preparación de relanzamiento del Tester en otra sesión (actualización de docs + prompt) | Pendiente de ejecución en nueva sesión |
| `2026-11-19` | Tester (sesión de consolidación) | Revisión de las 19 evidencias + re-verificación independiente de la suite unitaria + cierre G-7 | **`PASSED` (1/3)**: 338/338 en 37 archivos, 103/103 + 1/1, E2E real 34,1 s, rate limits en vivo, P4=0; informe `F05-audit-full-tester.md`; emulador apagado y puertos 3001/5173/9297 cerrados |
| `2026-11-20` | CTO (Atenea) | Auditoría y aprobación del resultado del Tester | **APROBADO**; autorizado únicamente el cierre de `G-6`, con `G-12` retenido |
| `2026-11-20` | Architect | Actualización de este informe y `STATE.md` con el `PASSED` final + higiene pre-push + commit/push + verificación CI | **CERRADO**: commit `8c64028`, push exit 0, ambos CI en `success` (§9) |
| `2026-11-20` | Architect | Registro documental del cierre `G-6` (hash + runs de CI) en este informe y `STATE.md` | Addendum append-only; `G-12` sigue retenido |

---

## 9. Cierre de `G-6` — resultado final (2026-11-20)

| Concepto | Resultado verificable |
|---|---|
| **Higiene pre-push** | `git ls-files` → 0 archivos prohibidos; `.env`, `.local/`, `temporary/`, `.terraform/`, `*.tfstate*` excluidos por `.gitignore`; `git add -A` exit 0 (67 archivos, 2.520 inserciones / 210 borrados); `git grep --cached` → **0 rutas absolutas de host** y **0 secretos reales**; `git diff --check` exit 0 (solo avisos LF/CRLF) |
| **Commit funcional** | `8c64028b784a584112e7b602515504c8a145f7cd` — `F05-AUDIT-FULL: Tester PASSED y cierre de G-6 (G-12 retenido)` |
| **Push** | `git push origin main` → `6804f28..8c64028  main -> main`, exit 0, **sin `--force`** |
| **CI `ci.yml`** | Run **`44729142380`** → `success` sobre `8c64028` (Install, Typecheck, Lint, Test unit: todos `success`). https://github.com/linochamorro/mediashrink-cloud/actions/runs/44729142380 |
| **CI `infra-integration.yml`** | Run **`44729142475`** → `success` sobre `8c64028` (1 m 50 s: Terraform fmt/init/validate/apply contra emulador, Integration tests (infra) y Stop aws-emulator: todos `success`). https://github.com/linochamorro/mediashrink-cloud/actions/runs/44729142475 |
| **Aviso no bloqueante** | GitHub Actions anuncia la deprecación de Node 20 en `checkout@v4`, `setup-node@v4` y `setup-terraform@v3` (el runner los ejecuta con Node 24). No afecta al resultado; seguimiento de deuda de CI. |
| **Gate G-12** | **RETENIDO**: no se publica release, no se despliega a AWS real. |

El push quedó limitado al cierre de `G-6` autorizado por el CTO. Los cinco requisitos de §6 están satisfechos; este cierre no declara `FASE_COMPLETA` definitiva ni agota `G-11`/`G-12`.
