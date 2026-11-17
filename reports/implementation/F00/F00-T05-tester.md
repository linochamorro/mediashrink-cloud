# Dictamen Tester — `F00-T05` (`.gitignore` y repo público GitHub)

| Campo | Valor |
|---|---|
| **Tarea / fase / paquete** | `F00-T05` · Fase 0 · `docs/sdd/packages/P-00-foundation-and-emulator.md` |
| **Criterio asignado** | `CA-05` — repo público conectado, G-6b presente, `.env`/secretos/`temporary/` excluidos |
| **Rol / riesgo / loop** | Tester independiente · riesgo 2 · `v1 — Loop 1/3` |
| **Fecha** | `2026-11-17` |
| **Método** | Ejecución propia de comandos Git/`gh` de **solo lectura** + inspección directa. Sin commits, pushes, Docker ni mutación del repo. |
| **Estado final** | **`PASSED`** — con `P4` registrado como seguimiento de auditoría (no bloqueante de `CA-05`) |

## 1. Fuentes y alcance

**Lectura obligatoria cumplida:** `.agents/roles/tester.md`, `AGENTS.md`, `STATE.md`, `docs/sdd/packages/P-00-foundation-and-emulator.md` (§5 `CA-05`), `docs/runbooks/portfolio-publication.md`, `docs/sdd/constitution.md` (PR-08, PR-09, IN-14), `reports/implementation/F00/F00-T05-task.md` (incl. §5), `reports/implementation/F00/F00-T05-developer.md`, `.gitignore`, evidencias `F00-T05-*` del Developer y auditorías `F00-T03-auditor.md` (A-05) / `F00-T04-auditor.md` (T04-A-01/A-02).

**Reglas respetadas:** no se editaron `.gitignore`, archivos versionados, código, documentos ni el reporte del Developer. No se presentó evidencia ajena como propia: todas las comprobaciones de la §3 se reejecutaron por este rol. No se escribieron secretos ni rutas Windows absolutas en las salidas (se usa `<PROJECT_ROOT>`; las 7 rutas preexistentes se registran solo como `archivo:línea`).

**Convención:** las verificaciones se ejecutaron sobre el estado inicial del árbol, que estaba limpio (`STATUS_LINES=0`). Los únicos archivos introducidos por este rol son sus cinco salidas en `evidence/F00-T05-tester-*.txt` y este dictamen; se dejan **sin versionar** para que Architect los integre. No se realizó ningún `git add`, `commit` ni `push`.

## 2. Tabla de veredictos por criterio

| ID | Criterio verificado | Resultado de mi ejecución | Veredicto |
|---|---|---|---|
| **C1** | Rama `main`, `origin` → `linochamorro/mediashrink-cloud`, árbol limpio, repo `PUBLIC` | `main`; `origin` URL GitHub; `STATUS_LINES=0`; `HEAD == origin/main` (`4d321a5…`); `visibility=PUBLIC` | **PASSED** |
| **C2** | `git ls-files`: 0 de `.local/`, `temporary/`, `node_modules/`, `dist/`, `.terraform/`, `*.tfstate*`, `.pem`/`.exe`, `.env`; sí `.env.example` | 135 archivos versionados; todos los conteos de exclusión = 0; `.env.example` = 1; `.terraform.lock.hcl` = 1 | **PASSED** |
| **C3** | Árbol remoto recursivo con G-6b y sin excluidos | `truncated=False`, 160 entradas; `AGENTS.md` 1, `STATE.md` 1, `.agents/` 6, `docs/sdd/` 6, `reports/` 98; 0 excluidos; `.env.example` 1 | **PASSED** |
| **C4** | Auditoría de secretos: 0 reales; fixtures marcadas; sin `PRIVATE KEY` | `PRIVATE_KEY` 0; `github_pat_` 0; coincidencias AKIA/JWT/ghp en `tests/unit/config.test.ts` son literales negativos marcados del detector; hex≥32 = hashes/digests públicos y SHAs de objetos git; marcadores dummy ya dictaminados «SIN HALLAZGOS REALES» | **PASSED** |
| **C5** | `.gitignore` con patrones obligatorios y que no excluya rutas G-6b | 10/10 patrones presentes; 7/7 rutas G-6b y `.env.example` con `check-ignore -q` → EXIT 1 (no ignoradas); 8/8 rutas a excluir → EXIT 0 (ignoradas) | **PASSED** |
| **C6** | Concern P4: rutas Windows absolutas preexistentes en artefactos G-6b | 7/7 ubicaciones confirmadas por escaneo propio; todas en artefactos preexistentes; 0 en artefactos creados por T05 ni en este rol | **SEGUIMIENTO** (no incumplimiento de `CA-05`) |

## 3. Detalle de verificaciones (ejecución propia)

### 3.1 Estado Git y visibilidad (C1)

Ejecuté `git status --short`, `git remote -v`, `git branch --show-current`, `git log -1 --oneline`, `git rev-parse HEAD` / `origin/main` y `gh repo view … --json visibility,name,url` → `evidence/F00-T05-tester-git.txt`.

- Rama `main`; remoto `origin` con URL `https://github.com/linochamorro/mediashrink-cloud.git` (fetch y push).
- Árbol limpio: `STATUS_LINES=0`. `HEAD=origin/main=4d321a5e…` → sin divergencia local/remoto.
- `gh auth status`: cuenta `linochamorro`, scopes `gist`, `read:org`, `repo`, `workflow`.
- `gh repo view`: `{"name":"mediashrink-cloud", … ,"visibility":"PUBLIC"}` → G-6 y G-6b ejercidos sobre repo público.

### 3.2 Índice versionado (C2)

Ejecuté `git ls-files` y conteos por expresión regular → `evidence/F00-T05-tester-tracked.txt`.

| Patrón | Conteo |
|---|---|
| `(^|/)\.env$` | 0 |
| `(^|/)\.env\.*` (excluyendo `.env.example`) | 0 |
| `(^|/)\.env\.example$` | 1 |
| `(^|/)\.local/`, `(^|/)temporary/`, `(^|/)node_modules/`, `(^|/)dist/`, `(^|/)\.terraform/` | 0 / 0 / 0 / 0 / 0 |
| `\.tfstate`, `\.(pem\|exe)$` | 0 / 0 |
| `AGENTS.md`, `STATE.md`, `.agents/`, `docs/sdd/`, `reports/` | 1 / 1 / 5 / 5 / 91 |
| `infra/terraform/.terraform.lock.hcl`, `.gitignore` | 1 / 1 |

El total (135 = 134 del commit inicial + el reporte del Developer) coincide con la nota final de su evidencia. Cierran así `A-05` (0 credenciales de `.local/`), `T04-A-01` (0 `*.tfstate*`) y `T04-A-02` (lockfile versionado y documentado).

### 3.3 Árbol remoto y G-6b (C3)

Ejecuté `gh api repos/linochamorro/mediashrink-cloud/git/trees/main?recursive=1` y analicé las rutas → `evidence/F00-T05-tester-remote.txt` (incluye el JSON crudo).

- `sha=4d321a5e…`, `truncated=False`, 160 entradas (blobs + trees).
- G-6b presente: `AGENTS.md`, `STATE.md`, `.agents/`, `docs/sdd/`, `reports/` (5/5 rutas canónicas; 1/1/6/6/98 entradas respectivamente).
- Exclusiones en remoto: `.env`, `.local/`, `temporary/`, `node_modules/`, `dist/`, `.terraform/`, `*.tfstate*`, `.pem`/`.exe` → **0 en todos los casos**. `.env.example` → 1.

### 3.4 Secretos y fixtures (C4)

Escaneo propio por regex sobre los 135 archivos versionados → `evidence/F00-T05-tester-secrets.txt` (solo conteos y rutas relativas; nunca el contenido de una coincidencia).

| Patrón | Coincidencias | Clasificación |
|---|---|---|
| `AKIA[0-9A-Z]{16}` | 3 / 2 archivos | 2 en `tests/unit/config.test.ts` (literales negativos de `findRealSecretPattern`, L194/L214); 1 en evidencia del Developer describiendo el patrón |
| JWT `eyJ…` (3 segmentos) | 2 / 1 archivo | `tests/unit/config.test.ts` L195/L224, marcados como fixture dentro de `expect(...)` |
| `gh[pousr]_[A-Za-z0-9]{20,}` | 2 / 2 archivos | 1 fixture sintética en `config.test.ts` L196; 1 descripción documental |
| `github_pat_` | 0 | — |
| hex ≥ 32 | 707 / 18 archivos | Digests sha256 públicos, hashes del provider en `.terraform.lock.hcl` (15), SHAs de objetos git en el JSON del árbol remoto (644) y 1 fixture de 32 hex en `config.test.ts` L197. **Ninguno es credencial.** |
| `PRIVATE KEY` | 0 | Sin claves privadas |
| `AWS_SECRET_ACCESS_KEY=<valor>` | 7 / 7 archivos | Menciones documentales de marcadores dummy (`test`, `REPLACE_WITH_…`), ya falladas «SIN HALLAZGOS REALES» por el Tester de `F00-T01` (`F00-T01-tester-secrets.txt` L6–14) |

Las fixture de `config.test.ts` (L194–197, L214, L224) están **claramente marcadas como sintéticas**: son los literales negativos con los que se prueba que el detector `findRealSecretPattern` reconoce patrones, dentro de aserciones `not.toBeNull()` / `toThrow`. No hay credenciales del emulador, tokens reales ni claves privadas. **G-3 / PR-08: 0 secretos reales.**

### 3.5 `.gitignore` (C5)

Inspección literal y `git check-ignore -q` → `evidence/F00-T05-tester-gitignore.txt`.

- Patrones obligatorios **10/10 presentes**: `.env`, `.env.*`, `!.env.example`, `.local/`, `node_modules/`, `dist/`, `.terraform/`, `*.tfstate*`, `**/*.tfstate*`, `temporary/` (más `*.tfvars`, caches y lockfile documentado como versionado).
- Rutas G-6b **no excluidas**: `AGENTS.md`, `STATE.md`, `.agents/roles/tester.md`, `docs/sdd/constitution.md`, `docs/sdd/packages/P-00-foundation-and-emulator.md`, `reports/implementation/F00/F00-T05-task.md` y `.env.example` → EXIT 1 en todos los casos (correcto).
- Rutas a excluir: `.env`, `.env.production`, `.local/aws-emulator/ca.pem`, `node_modules/…`, `dist/…`, `.terraform/…/terraform.tfstate`, `infra/terraform/terraform.tfstate`, `temporary/…` → EXIT 0 en todos los casos (correcto).

## 4. Concern P4 — rutas Windows absolutas preexistentes (seguimiento de auditoría)

Mi escaneo propio confirma exactamente **7 ocurrencias**, en las mismas ubicaciones que reportó el Developer:

| # | Ubicación (archivo:línea) | Naturaleza |
|---|---|---|
| 1 | `AGENTS.md:34` | Gobernanza preexistente |
| 2 | `STATE.md:16` | Gobernanza preexistente |
| 3 | `STATE.md:43` | Gobernanza preexistente |
| 4 | `reports/implementation/F00/F00-T03-task.md:40` | Reporte preexistente |
| 5 | `reports/implementation/F00/F00-T04-developer.md:40` | Reporte preexistente |
| 6 | `reports/implementation/F00/F00-T04-task.md:36` | Reporte preexistente |
| 7 | `reports/intake/intake-mediashrink.md:23` | Intake preexistente |

**Clasificación: SEGUIMIENTO DE AUDITORÍA, no incumplimiento de `CA-05`.** Motivo: (a) son artefactos preexistentes, no introducidos por el Developer de T05; (b) `AGENTS.md`, `STATE.md` y `reports/` están **obligados** a publicarse por G-6b, por lo que no pueden excluirse sin incumplir la directiva de Lino; (c) el ámbito exclusivo de T05 prohibía editarlos, y este Tester tampoco los ha tocado; (d) son rutas de estructura de proyecto, **no secretos**, y no aparecen en ningún artefacto creado por T05 ni en esta verificación (se usó `<PROJECT_ROOT>`).

| Campo | Detalle |
|---|---|
| **1. Identificación** | `P4` · concern heredado (`F00-T04-auditor.md`, nota tras §4) · Tester `F00-T05` v1/3 · `2026-11-17` · 7 ocurrencias |
| **2. Problema** | PR-08/CA-05 prohíben rutas locales absolutas en artefactos públicos; 7 rutas preexistentes en artefactos G-6b están ya visibles en el repo público |
| **3. Causa** | `DEMOSTRADA`: escaneo literal propio sobre archivos versionados; coinciden con el inventario del Developer y del Auditor de T04 |
| **4. Solución e intentos fallidos** | No aplicada: fuera del ámbito de escritura de T05 y de este Tester; excluirlos violaría G-6b. Mitigación verificada: 0 rutas nuevas en artefactos de T05 ni en esta verificación |
| **5. Verificación** | 7/7 localizada por `ejecución propia`; 0 en los cinco archivos `F00-T05-tester-*.txt` ni en este dictamen (solo `archivo:línea`) |
| **6. Pendientes** | **Abierto** → Auditor de `F00-T05` / auditoría final / decisión de Lino. Requiere autoridad para editar gobernanza. Sin G-10 |
| **7. Aprendizaje** | Redactar las rutas de gobernanza con marcadores (`<PROJECT_ROOT>`) antes de la primera publicación G-6b, o registrar una excepción expresa de Lino |

**Recomendación al Auditor/CTO:** mantener `P4` como seguimiento documental de PR-08; no bloquea el cierre de `CA-05` ni de `F00-T05`, pero debe resolverse o aceptarse explícitamente antes de la publicación final (G-12).

## 5. Observaciones de trazabilidad (sin impacto en el veredicto)

- El reporte del Developer referencia los commits iniciales `7bfa158`, `9c84c23` y, en su nota final, `9f6a19c`. El `HEAD` verificado por este rol es **`4d321a5`** (`chore: sincronizar evidencia F00-T05 con el arbol remoto final`), con `HEAD == origin/main`. El dictamen se emite **sobre el estado real actual**, no sobre los hashes citados en el reporte ajeno.
- `git status --short` al inicio de la verificación: `STATUS_LINES=0`. Al cierre de este rol aparecen como sin versionar: los cinco `evidence/F00-T05-tester-*.txt`, este `F00-T05-tester.md` y `reports/audits/F00/F00-T05-auditor.md` (este último, **ajeno** a este rol, escrito por el Auditor en paralelo). No se han versionado ni modificado.

## 6. Veredicto global

> ## **`PASSED`**
>
> `CA-05` se cumple con **evidencia propia**: repo público `linochamorro/mediashrink-cloud` conectado en rama `main` y sincronizado; G-6b presente en local y remoto; 0 secretos, 0 `.env`, 0 `.local/`, 0 `temporary/`, 0 artefactos de build/IaC excluidos en el índice y en el árbol remoto; `.gitignore` correcto y no excluye trazabilidad IA. `P4` queda registrado como **seguimiento de auditoría no bloqueante** para Auditor/CTO. No se activan loops (1/3 no consumido).

## 7. Evidencias generadas por este rol

- `reports/implementation/F00/evidence/F00-T05-tester-git.txt`
- `reports/implementation/F00/evidence/F00-T05-tester-tracked.txt`
- `reports/implementation/F00/evidence/F00-T05-tester-remote.txt`
- `reports/implementation/F00/evidence/F00-T05-tester-secrets.txt`
- `reports/implementation/F00/evidence/F00-T05-tester-gitignore.txt`

**Retorno a Architect:** dictamen `PASSED` de `CA-05`; corresponde al Auditor cerrar la revisión de riesgo 2 (`F00-T05-auditor.md`) y a Architect integrar este reporte y sus evidencias. Este rol no cierra la tarea ni acepta riesgos en nombre de Lino.
