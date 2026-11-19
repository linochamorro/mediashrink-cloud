# `F05-T02` — Dictamen del Tester independiente

| Campo | Valor |
|---|---|
| **Tarea / Criterio** | `F05-T02` · `CA-02` (P-05, Fase Final) |
| **Rol / Riesgo** | Tester independiente · riesgo `3` (seguridad y privacidad) |
| **Loop** | `v1 — Loop 1/3` (no se activan loops) |
| **Fecha** | `2026-11-18` |
| **Verdicto global** | **`PASSED`** — todas las verificaciones asignadas satisfechas con ejecución propia |
| **Auditoría asociada** | `reports/audits/F05/F05-T02-auditor.md`: `READY_WITH_CONCERNS`, 0 `CRITICAL`/`HIGH`, 0 secretos, 0 bloqueantes; sin revisión obligatoria pendiente |

## 1. Método e independencia

Verifiqué contra `F05-T02-task.md` (CA-02), no contra la interpretación del Developer. Leí contrato de rol, `AGENTS.md`, `STATE.md`, paquete `P-05`, `F05-T02-developer.md`, código (`frontend/src/api/jobs.ts`, `frontend/src/api/auth.ts`, `backend/src/api/enriched-publisher.ts`), los tests nuevos y las evidencias `F05-T02-*`. **Ejecuté por mi cuenta** las suites, el emulador real, los escaneos y un diagnóstico adicional. No presento evidencia ajena como propia: la evidencia del Developer queda como contexto y mis cifras proceden de mis propias corridas. No edité código, tests, manifiestos, reportes de otros roles ni `STATE.md`/`tasks.md`.

## 2. Dictamen por verificación

| # | Verificación | Resultado propio | Verdicto |
|---|---|---|---|
| 1 | `npx vitest run tests/unit` · `npm run typecheck` · `npm run lint` | **32 archivos / 303/303**, exit 0 · typecheck exit 0 · lint exit 0. Búsqueda propia de `.skip(`/`.only(`/`.todo(`/`x*`: **0 coincidencias**. Banner de Vitest normalizado a `<PROJECT_ROOT>`. | **PASSED** |
| 2 | URLs presignadas (`F03-AUD-03`) | Focal `npx vitest run tests/unit/frontend/secure-url.test.ts --reporter=verbose`: **26/26**, exit 0. Negativos cubiertos y superados: `javascript:`, `data:`, `http:`, relativa, vacía/no-cadena, credenciales `user:pass@`/`user@`, host ajeno (`evil.example.com`), plan de subida malformado, allowlist por entorno. Positivos: loopback del emulador, TLD reservados y allowlist explícita. **Diagnóstico propio adicional (`npx tsx`) sobre el cliente, no solo la función: 14/14 OK** — `client.upload` rechaza la `uploadUrl` hostil y **no ejecuta la PUT**; `client.download` rechaza `downloadUrl` hostil; `client.create` valida cada `uploadUrl` del plan antes de cualquier PUT; el ZIP se sirve por la API con `Authorization` y `response.ok`. | **PASSED** |
| 3 | `HeadObject` en `raw` (`bytesBefore`) contra emulador real | Docker en vivo con límites G-7: `memory=2147483648`, `nanoCpus=2000000000`, `user=1000:1000`, `healthy`, healthcheck `ok`; `docker cp` de `ca.pem`/`config`/`emulator_credentials` exit 0 en cada arranque. Focal **3/3**, exit 0: (a) `declaredBytes=1` frente a bytes reales, una llamada `HeadObject` con bucket/clave correctos y `ContentLength` = bytes leídos; (b) `declaredBytes=7` → `bytesBefore` persistido en DynamoDB (job e imagen) = tamaño real del objeto, **no** el declarado; (c) divergencia `HeadObject=999` vs 3 bytes → rechazo fail-closed. Regresión de integración no-infra **21 archivos / 94/94**, exit 0. | **PASSED** |
| 4 | P4 anonimización y addenda append-only | Escaneo propio de **827 archivos** en `reports/**` y `docs/**`: patrón P4 exacto `[A-Za-z]:[\\/](Projects\|Programs\|Users\|Program Files)` → **0 coincidencias**; **68 banners** de Vitest, **0 con ruta absoluta**. Los 46 hallazgos del patrón amplio son sintaxis de contenedor (`docker cp …:/home/…`), documentación de regex, referencias ya normalizadas y fixtures sintéticos preexistentes (`X:\`, `C:\temp`) — ninguno es ruta de entorno filtrada, coincidente con el Auditor. **8/8 addenda append-only**: contenido original conservado como subsecuencia exacta del `HEAD`, marca de addendum presente y longitud no decreciente (+8 líneas cada uno). | **PASSED** |
| 5 | Ámbito, gates y gobernanza | `temporary/` intacto (G-11 no ejecutado); sin `git push`/release (G-12 no ejecutado); sin secretos ni rutas Windows absolutas nuevas en mis artefactos; no se tocaron reportes del Auditor ni del Tester de `F05-T01`. Docker apagado: `docker compose down` exit 0, sin contenedor ni red del proyecto; en `docker ps -a` solo permanece `dazzling_edison`, contenedor ajeno **preexistente** (verificado antes de iniciar la sesión). | **PASSED** |

## 3. Evidencia propia

- `reports/implementation/F05/evidence/F05-T02-tester-unit-typecheck-lint.txt`
- `reports/implementation/F05/evidence/F05-T02-tester-url.txt`
- `reports/implementation/F05/evidence/F05-T02-tester-headobject.txt`
- `reports/implementation/F05/evidence/F05-T02-tester-anonymization.txt`
- `reports/implementation/F05/evidence/F05-T02-tester-emulator-down.txt`
- `reports/implementation/F05/evidence/F05-T02-tester-scope.txt`

Diagnóstico transitorio alojado en `temporary/` (`F05-T02-tester-diag.ts` y scripts `.ps1` de ejecución/evidencia); el producto y `tests/` no se modificaron para hacerlo pasar.

## 4. Límites de cobertura (no bloqueantes)

- `tests/integration/infra/**` (5 pruebas) quedó fuera de la regresión: exige `terraform apply` previo, documentado por el Developer (`F05T02-D-06`) y competencia de `F05-T01`/F05-T05, no de CA-02. El resto de la integración se ejecutó real contra el emulador.
- No se evaluó despliegue real con host S3 definitivo: rige el default local restrictivo de `VITE_ALLOWED_STORAGE_HOSTS`, inventariado por el Auditor.
- La verificación de anonimización es por escaneo y comparación con `HEAD`, no una auditoría byte a byte de codificaciones.

## 5. Problemas registrados

**Ninguno con los 7 campos obligatorios**: no se encontró incumplimiento que bloquee CA-02. La observación sobre fixtures sintéticos preexistentes (`C:\temp`) y sintaxis de contenedor es `INFO`, ya documentada por el Auditor; no es fuga de ruta de entorno y sustituirla alteraría el contenido sustantivo que CA-02.3 protege.

## 6. Cierre

Emito **`PASSED`** para `F05-T02` / `CA-02`. El Architect integra este dictamen con la auditoría `READY_WITH_CONCERNS` sin bloqueantes y retorna al CTO/Lino para `F05-T03` y la autorización expresa de `G-11`/`G-12`, que **no** se ejecutaron en esta verificación.
