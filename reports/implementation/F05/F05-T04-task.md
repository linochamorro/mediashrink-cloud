# Tarea `F05-T04` — Capturas reales y `README.md` público

| Campo | Valor |
|---|---|
| **ID / Fase** | `F05-T04` · Fase Final — `docs/sdd/packages/P-05-final-integration-and-delivery.md` |
| **Rol / verificadores** | Designer + Tester |
| **Harness / Loop** | OpenCode · `v1 — Loop 1/3` |
| **Riesgo** | `1 (Ordinario)` |

## 1. Criterio (`CA-04`)
- Generar **capturas reales Playwright** del producto en ejecución contra el stack real (no mocks), en modo **Claro y Oscuro**, guardadas en `docs/images/`: portada/banner, login, subida, progreso, comparativa antes/después, métricas, ZIP/descargas, tema Dark.
- Preparar `README.md` siguiendo **exactamente** `D:\Projects\Bluemind_Lab\docs\templates\readme-github.md`: portada visual en línea 1, badges, título y descripción, nota de alcance para portfolio (datos de demostración), Funcionalidades, Tecnología y estructura (tabla), Inicio local, Comandos (tabla), Imágenes agrupadas con `<details>`, Documentación y Licencia (MIT; crear `LICENSE` si no existe).
- **Cero rastros internos**: sin rutas locales, agentes/roles/harnesses ni enlaces a `docs/sdd/`, `docs/runbooks/`, `reports/`, `STATE.md`. Fidelidad estricta con scripts y comandos reales del repo.

## 2. Entradas y entorno
- Depende de `F05-T02` PASSED (stack integrado y seguimientos cerrados). Usar las cuentas seed sintéticas documentadas para las capturas. Docker apagado al terminar. Sin publicar (G-12 pendiente).

## 3. Ámbito
`docs/images/**`, `README.md`, `LICENSE`, `tests/e2e/**` (si hacen falta capturas), reportes propios en `reports/implementation/F05/`. No tocar `temporary/`.

## 4. Método y entregables
- Evidencia: `F05-T04-{screens-light,screens-dark,readme-check,internal-traces-scan,license}.txt`.
- Reportes: `F05-T04-designer.md`, `F05-T04-tester.md`, cierre `F05-T04-architect.md`.
