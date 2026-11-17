# Tarea `F00-T05` — `.gitignore` y repo público GitHub (G-6/G-6b)

| Campo | Valor |
|---|---|
| **ID completo** | `F00-T05` |
| **Fase y paquete** | Fase 0 — `docs/sdd/packages/P-00-foundation-and-emulator.md` |
| **Prioridad** | `P0` |
| **Rol implementador** | `Developer` |
| **Rol verificador** | `Tester` + `Auditor` |
| **Harness** | OpenCode |
| **Versión / Loop actual** | `v1 — Loop 1/3` |
| **Nivel de riesgo** | `2 (Relevante)` |
| **Excepción metodológica** | `Ninguna` |
| **Estimación / hitos / seguimiento** | Estimación 20 min. Hitos: (1) `.gitignore`, (2) `git init` + `gh repo create --public`, (3) commit/push, (4) verificación de árbol remoto. Revisión ≥5 min; diagnóstico a 10 min sin progreso o >2× estimación. |
| **Procesos y verificación proporcional** | `git status`, `git ls-files`, `gh repo view`, `gh api` para listar árbol remoto. Timeout 120 s. `gh auth status` verificado por Architect: cuenta `linochamorro`, scopes `repo`/`workflow`. |

## 1. Fuentes aprobadas y criterios de aceptación
- **Requisitos:** `constitution.md` PR-09 / IN-14, `runbooks/portfolio-publication.md`, `P-00` §5 `CA-05`, G-6 y G-6b.
- **Criterios asignados:**
  - `CA-05`: repo público `mediashrink-cloud` conectado; `AGENTS.md`, `STATE.md`, `.agents/`, `docs/sdd/`, `reports/` presentes (G-6b); `.env`, secretos, `node_modules/`, `dist/`, `.terraform/` y `temporary/` excluidos; sin rutas locales absolutas en artefactos públicos.

## 2. Entradas, contratos y entorno
- **Revisión previa:** `F00-T02` debe estar `PASSED`. El repositorio no existe aún (`git status`: no es repo). No crear el repo privado ni con otro nombre.
- **Gates:** G-6 autorizado desde Fase 0; G-6b PERMITIDO SUBIR; G-3 solo `.env.example`.

## 3. Ámbito exclusivo de archivos y límites
- **Escritura permitida:** `.gitignore`, operaciones `git`/`gh` autorizadas dentro de la raíz, `reports/implementation/F00/evidence/F00-T05-*`.
- **Prohibido tocar:** valores de `.env`, secretos, `temporary/`, `STATE.md`, `tasks.md`; no borrar nada fuera de la raíz; no publicar antes de la verificación de secretos.

## 4. Método exigido y entregables
- **Método:** auditoría de higiene + comandos CLI; no hay prueba de producto.
- **Reporte:** `F00-T05-developer.md`. **Evidencia:** `evidence/F00-T05-git-status.txt`, `F00-T05-tracked-files.txt`, `F00-T05-remote-tree.txt`.
- **Dictamen:** `F00-T05-tester.md`. **Auditoría:** `reports/audits/F00/F00-T05-auditor.md`. **Cierre:** `F00-T05-architect.md`.

## 5. Nota de reanudación (CTO, Opción A)
`gh` autenticado como `linochamorro` con scopes `repo`/`workflow` (verificado). El directorio aún **no es repo Git**. `.gitignore` debe incluir obligatoriamente `.env`, `.local/`, `node_modules/`, `dist/`, `.terraform/` y `temporary/` (cierra el hallazgo `A-05` de `F00-T03`). G-6b: incluir `AGENTS.md`, `STATE.md`, `.agents/`, `docs/sdd/` y `reports/`. El compose genera credenciales efímeras en `.local/aws-emulator/` mediante volumen named + `docker cp`; verificar que NO se versionan. Repo público `mediashrink-cloud`. Secretos y rutas Windows absolutas quedan prohibidas en artefactos públicos.
