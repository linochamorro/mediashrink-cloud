# Entrega Developer — `F00-T05` (`.gitignore` y repo público GitHub)

| Campo | Valor |
|---|---|
| **Tarea / fase / paquete** | `F00-T05` · Fase 0 · `docs/sdd/packages/P-00-foundation-and-emulator.md` |
| **Versión / Loop** | `v1 — Loop 1/3` |
| **Rol / riesgo** | Developer · riesgo 2 |
| **Fecha** | `2026-11-17` |
| **Criterio asignado** | `CA-05` — repo público conectado, G-6b presente, secretos/`temporary/` excluidos |
| **Gates aplicados** | G-6 (autorizado desde Fase 0) · G-6b (PERMITIDO SUBIR IA) · G-3 (solo `.env.example`) |
| **Estado final** | **`DONE_WITH_CONCERNS`** — no se emite `PASSED` ni se cierra la tarea |

## 1. Fuentes consultadas (lectura obligatoria cumplida)

`AGENTS.md`; `STATE.md`; `.agents/roles/developer.md`; `docs/sdd/packages/P-00-foundation-and-emulator.md` (§3, §5 `CA-05`); `docs/sdd/constitution.md` (PR-08, PR-09, IN-14); `docs/runbooks/portfolio-publication.md` (§1–§3); `reports/implementation/F00/F00-T05-task.md` (incl. §5 nota de reanudación); `reports/audits/F00/F00-T03-auditor.md` (A-05, addenda v2/v2b); `reports/audits/F00/F00-T04-auditor.md` (T04-A-01/A-02/A-05); `reports/implementation/F00/F00-T04-architect.md`; `infra/terraform/.terraform.lock.hcl`; y listado real del árbol (incluye `.local/aws-emulator/`, `infra/terraform/.terraform/`, `.terraform.lock.hcl`, `temporary/`).

## 2. Criterio de aceptación `CA-05` — resultado

| Requisito | Resultado | Evidencia |
|---|---|---|
| `.gitignore` creado **antes** de cualquier `git add` | OK | Commit inicial `7bfa158`; `.gitignore` en el índice |
| `.env`, `.env.*` excluidos salvo `.env.example` | OK | `check-ignore` + 0 `.env` en árbol remoto |
| `.local/` (ca.pem, config, emulator_credentials) excluido | OK | 0 archivos `.local/` en el índice ni en el remoto |
| `node_modules/`, `dist/`, `.terraform/`, `*.tfstate*`, `temporary/`, caches | OK | 0 coincidencias en `git ls-files` y en árbol remoto |
| G-6b: `AGENTS.md`, `STATE.md`, `.agents/`, `docs/sdd/`, `reports/` presentes | OK | 8/8 rutas verificadas + 90 archivos en `reports/` |
| Repo público `mediashrink-cloud`, rama `main`, push inicial | OK | `https://github.com/linochamorro/mediashrink-cloud` |
| Sin secretos/credenciales/tokens reales en árbol versionado | OK | 0 secretos reales (falsos positivos triados, ver P5) |
| Sin rutas Windows absolutas **nuevas** en artefactos de T05 | OK | Notación `<PROJECT_ROOT>` usada en toda la evidencia |
| Sin rutas Windows absolutas en **ningún** archivo versionado | **NO (concern)** | 7 ocurrencias preexistentes fuera de ámbito (ver P4) |

## 3. Comandos ejecutados y exit codes

Todos ejecutados desde `<PROJECT_ROOT>`.

| # | Comando (fin/resumen) | Exit |
|---|---|---|
| 1 | `git --version` → 2.55.0.windows.2 | 0 |
| 2 | `git rev-parse --is-inside-work-tree` (pre-init) → "not a git repository" | 128 (esperado) |
| 3 | `gh --version` → 2.101.0 | 0 |
| 4 | `gh auth status` → cuenta `linochamorro`, scopes `gist/read:org/repo/workflow` | 0 |
| 5 | `gh repo view linochamorro/mediashrink-cloud` (pre-creación) → "Could not resolve" | 1 (esperado: no existía) |
| 6 | Escritura de `.gitignore` (ANTES de `git add`) | 0 |
| 7 | `git init -b main` → rama `main` | 0 |
| 8 | `git config user.name/user.email` (local: `linochamorro` / noreply) | 0 |
| 9 | `git check-ignore -v` sobre 16 rutas a excluir → 16/16 ignoradas | 0 |
| 10 | `git check-ignore -v` sobre 11 rutas a versionar → 10/10 OK; `.env.example` mostró la negación | 0 |
| 11 | `git check-ignore -q .env.example` → 1 (NO ignorado) + `git add --dry-run` → `add '.env.example'` | 1 / 0 |
| 12 | `git add -- .gitignore .env.example` + `git ls-files --stage` → ambos en índice | 0 |
| 13 | Creación de 4 archivos de evidencia + `git add -A` → 134 archivos en índice | 0 |
| 14 | Escaneo de secretos sobre 134 archivos → 0 secretos reales | 0 |
| 15 | `git ls-files > F00-T05-tracked-files.txt` + `git add -A` | 0 |
| 16 | `git commit -m "feat: inicializar repo publico..."` → `7bfa158` (134 files, 11769 insertions) | 0 |
| 17 | `gh repo create mediashrink-cloud --public --source=. --remote=origin --push` → URL creada, `main` tracks `origin/main` | 0 |
| 18 | `git remote -v` → `origin https://github.com/linochamorro/mediashrink-cloud.git` | 0 |
| 19 | `gh api repos/linochamorro/mediashrink-cloud/git/trees/main?recursive=1` → SHA `7bfa158…`, `truncated=False`, 134 blobs | 0 |
| 20 | Análisis del árbol remoto → G-6b 8/8, exclusiones 0, `.env.example`/lockfile presentes | 0 |
| 21 | `git add -A` + `git commit -m "chore: completar evidencia..."` → `9c84c23` + `git push` → OK | 0 / 0 |
| 22 | `git checkout -- F00-T05-git-status.txt` + captura de `git status --short` → 0 líneas | 0 |
| 23 | `git add -A` + commit final de evidencia + `git push` → OK | 0 |
| 24 | Verificación final `git status --short` → 0 líneas (árbol limpio) | 0 |

> Los commits 23/24 son de cierre de evidencia; sus hashes se pueden consultar con `git log -3 --oneline`. Ningún comando de publicación adicional (release/deploy/G-12) se ejecutó.

## 4. Decisión sobre `.terraform.lock.hcl` (T04-A-02)

**VERSIONAR.** El archivo contiene solo `provider registry.terraform.io/hashicorp/aws`, `version = 5.100.0`, `constraints = "~> 5.0"` y 15 hashes públicos (25 líneas, lectura directa). No incluye secretos, credenciales ni rutas absolutas. `terraform init` recomienda expresamente incluirlo para fijar la selección del provider, coherente con PR-04 / ADR-001 Decisión 4. Se distingue de `.terraform/` (plugins regenerables y voluminosos) y de `*.tfstate*` (estado local sensible), que sí se excluyen. La decisión queda documentada como comentario en `.gitignore` y en `evidence/F00-T05-gitignore-audit.txt` §3, para evitar exclusión por omisión futura.

## 5. Cierre de hallazgos heredados

| ID | Origen | Disposición |
|---|---|---|
| `A-05` | `F00-T03` (auditor, v2b) | **CERRADO por corrección** — `.gitignore` con `.local/` antes del primer `git add`; 0 credenciales del emulador en índice/remoto; contenidos nunca impresos |
| `T04-A-01` | `F00-T04` (auditor) | **CERRADO por corrección** — reglas `*.tfstate*` y `**/*.tfstate*` cubren la ruta anidada `.terraform/terraform.tfstate`; 0 tfstate en índice/remoto |
| `T04-A-02` | `F00-T04` (auditor) | **CERRADO por decisión documentada** — lockfile versionado (ver §4) |
| `T04-A-05` | `F00-T04` (seguimiento de A-05) | Cerrado junto con A-05; el resto de artefactos generados (`.terraform/`, `temporary/`) también excluidos |

## 6. Archivos versionados relevantes (de 134 totales)

- **Nuevos / propiedad de T05:** `.gitignore`; `reports/implementation/F00/evidence/F00-T05-{gitignore-audit,tracked-files,remote-tree,git-status}.txt`; este reporte.
- **G-6b presentes:** `AGENTS.md`, `STATE.md`, `.agents/roles/{architect,auditor,designer,developer,tester}.md`, `docs/sdd/{constitution,spec,plan,tasks}.md`, `docs/sdd/packages/P-00-foundation-and-emulator.md`, `reports/**` (90 archivos).
- **Trazabilidad incluida:** `.env.example` (G-3), `infra/terraform/.terraform.lock.hcl` (T04-A-02), `package-lock.json`.
- **Excluidos confirmados:** `.env`, `.local/**`, `node_modules/**`, `dist/**`, `infra/terraform/.terraform/**`, `*.tfstate*`, `temporary/**`, `*.log`, `.DS_Store`.

## 7. Estado final y problemas registrados (7 campos obligatorios)

**Estado: `DONE_WITH_CONCERNS`.** CA-05 sustancialmente cumplido; único concern = P4 (rutas absolutas preexistentes, fuera de ámbito). No se emite `PASSED`.

### P1 — `.gitignore` ausente con credenciales efímeras en `.local/` (A-05)

| Campo | Detalle |
|---|---|
| **1. Identificación** | `P1` · heredado de `A-05` (`F00-T03`) y `T04-A-05` · T05 v1/3 · `2026-11-17` · fuentes: auditorías T03/T04 |
| **2. Problema** | No existía `.gitignore` mientras compose + `docker cp` escriben `ca.pem`, `config` y `emulator_credentials` en `.local/aws-emulator/`; riesgo de publicar credenciales efímeras en repo público (G-3/PR-08) |
| **3. Causa** | `DEMOSTRADA`: ausencia confirmada por auditorías; T03/T04 no podían crearlo (fuera de su ámbito) |
| **4. Solución e intentos fallidos** | Creado `.gitignore` con `.local/` **antes** de `git add`. Sin intentos fallidos |
| **5. Verificación** | `check-ignore -v` 3/3 sobre `.local/`; 0 archivos `.local/` en `git ls-files` ni en árbol remoto; contenidos nunca impresos |
| **6. Pendientes** | Ninguno. Cerrado por corrección; auditoría final puede reconfirmar |
| **7. Aprendizaje** | Crear `.gitignore` con patrones recursivos antes de introducir herramientas que escriban en el working tree (`PROPUESTA_GLOBAL`) |

### P2 — Estado `*.tfstate*` anidado no cubierto (T04-A-01)

| Campo | Detalle |
|---|---|
| **1. Identificación** | `P2` · `T04-A-01` · T05 v1/3 · `2026-11-17` · fuente: `F00-T04-auditor.md` §3 |
| **2. Problema** | `init` creó `infra/terraform/.terraform/terraform.tfstate`; una regla solo en raíz podría dejarlo sin excluir |
| **3. Causa** | `DEMOSTRADA`: archivo leído (12 líneas, sin secretos) por el auditor |
| **4. Solución e intentos fallidos** | Reglas `*.tfstate*` y `**/*.tfstate*` en `.gitignore`, con comentario explicativo. Sin intentos fallidos |
| **5. Verificación** | `check-ignore` sobre ambas rutas → ignoradas; 0 `*.tfstate*` en índice ni remoto |
| **6. Pendientes** | Ninguno. Cerrado por corrección |
| **7. Aprendizaje** | Usar siempre patrones recursivos al declarar exclusiones de estado IaC (`PROPUESTA_GLOBAL`) |

### P3 — Disposición pendiente de `.terraform.lock.hcl` (T04-A-02)

| Campo | Detalle |
|---|---|
| **1. Identificación** | `P3` · `T04-A-02` · T05 v1/3 · `2026-11-17` · fuente: `F00-T04-auditor.md` §3 + `init.txt` |
| **2. Problema** | Handoff de T04 no decidía si el lockfile se versionaba; riesgo de exclusión por omisión o de versionado sin documenting |
| **3. Causa** | `DEMOSTRADA`: omisión en el handoff; `init` recomienda incluirlo |
| **4. Solución e intentos fallidos** | Decisión documentada de **versionar** (§4), con comentario en `.gitignore`. Sin intentos fallidos |
| **5. Verificación** | Lockfile en `git ls-files` y en árbol remoto; 0 secretos en su contenido (25 líneas leídas) |
| **6. Pendientes** | Ninguno. Cerrado por decisión documentada |
| **7. Aprendizaje** | Toda decisión de inclusión/exclusión debe quedar razonada en el propio `.gitignore` (`PROPUESTA_GLOBAL`) |

### P4 — Rutas Windows absolutas preexistentes en artefactos G-6b (CONCERN ABIERTO)

| Campo | Detalle |
|---|---|
| **1. Identificación** | `P4` · concern heredado (nota de `F00-T04-auditor.md` tras §4) · T05 v1/3 · `2026-11-17` · 7 ocurrencias |
| **2. Problema** | PR-08 prohíbe rutas locales absolutas en artefactos públicos, pero `AGENTS.md` L34, `STATE.md` L16/L43, `F00-T03-task.md` L40, `F00-T04-developer.md` L40, `F00-T04-task.md` L36 e `intake-mediashrink.md` L23 las contienen y deben publicarse por G-6b |
| **3. Causa** | `DEMOSTRADA`: búsqueda literal sobre archivos versionados; son artefactos de gobernanza preexistentes |
| **4. Solución e intentos fallidos** | **No aplicada**: está PROHIBIDO tocar `AGENTS.md`, `STATE.md`, `tasks.md` ni reportes ajenos (ámbito exclusivo de T05). No pueden excluirse sin incumplir G-6b. Intentos fallidos: ninguno; se respetó el ámbito. Mitigación aplicada: no introducir rutas nuevas (notación `<PROJECT_ROOT>`) y documentar el concern |
| **5. Verificación** | 7/7 ocurrencias localizadas (ver `evidence/F00-T05-gitignore-audit.txt` §6); 0 rutas absolutas en artefactos creados por T05; árbol remoto verificado |
| **6. Pendientes** | **Abierto** → auditoría final / decisión de Lino. Requiere autoridad para editar esos archivos (no este Developer). No se da por aceptado; sin G-10 |
| **7. Aprendizaje** | Resolver el contenido de artefactos G-6b antes de la primera publicación, o redactar rutas con marcadores (`PROPUESTA_GLOBAL`) |

### P5 — Coincidencias de patrones de secretos en el escaneo (triado, no riesgo)

| Campo | Detalle |
|---|---|
| **1. Identificación** | `P5` · T05 v1/3 · `2026-11-17` · 4 patrones con coincidencias |
| **2. Problema** | El escaneo inicial reportó `AKIA…` (2), `ghp_…` (1), `github_pat_` (2) y `AWS_SECRET_ACCESS_KEY=<valor>` (5) en 134 archivos |
| **3. Causa** | `DEMOSTRADA`: todas son fixtures sintéticas de `tests/unit/config.test.ts` (literales negativos del detector) y referencias documentales a valores dummy `test`/`REPLACE_WITH_…` en reportes/evidencias de F00-T01, ya clasificadas por el Tester como "0 hallazgos reales" |
| **4. Solución e intentos fallidos** | Sin corrección de contenido (no son secretos); clasificación documentada en `gitignore-audit.txt` §5. Sin intentos fallidos |
| **5. Verificación** | Lectura directa de `tests/unit/config.test.ts` L194/L196/L214 y `F00-T01-tester-secrets.txt` L1–17; `PRIVATE KEY` → 0 |
| **6. Pendientes** | Ninguno. 0 secretos reales, 0 credenciales del emulador, 0 tokens |
| **7. Aprendizaje** | Distinguir fixtures deliberadas de secretos reales antes de escalar un hallazgo (`SOLO_LOCAL`) |

### P6 — `git check-ignore -v` mostró la regla de negación de `.env.example`

| Campo | Detalle |
|---|---|
| **1. Identificación** | `P6` · T05 v1/3 · `2026-11-17` · comando #10 |
| **2. Problema** | `check-ignore -v .env.example` devolvió `!.env.example` con exit 0, lo que podría interpretarse erróneamente como "ignorado" |
| **3. Causa** | `DEMOSTRADA`: `-v` informa el último patrón coincidente, incluso si es una negación |
| **4. Solución e intentos fallidos** | Verificación cruzada con `check-ignore -q` (exit 1), `add --dry-run` y `ls-files --stage`. Sin intentos fallidos |
| **5. Verificación** | `.env.example` en el índice local y en el árbol remoto (G-3 cumplido) |
| **6. Pendientes** | Ninguno |
| **7. Aprendizaje** | No concluir ignorabilidad solo con `-v`; confirmar con `-q` o con el índice (`SOLO_LOCAL`) |

## 8. Evidencias generadas

- `reports/implementation/F00/evidence/F00-T05-gitignore-audit.txt` — patrones, contenido del índice, decisión lockfile, cierre de hallazgos, escaneo de secretos y concern P4.
- `reports/implementation/F00/evidence/F00-T05-tracked-files.txt` — 134 rutas de `git ls-files`.
- `reports/implementation/F00/evidence/F00-T05-remote-tree.txt` — SHA/JSON de `gh api`, G-6b 8/8, exclusiones 0, `.env.example` y lockfile presentes.
- `reports/implementation/F00/evidence/F00-T05-git-status.txt` — `git remote -v` y `git status --short` limpio (0 líneas).

**Retorno a Architect:** tarea entregada con estado `DONE_WITH_CONCERNS`; corresponde a Tester dictaminar `PASSED`/`NO-PASSED` y a Auditor revisar riesgo 2. Este rol no aprueba su propio trabajo ni cierra la tarea.
