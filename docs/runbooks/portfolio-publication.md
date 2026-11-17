# Runbook — Publicación en GitHub (`G-6` y `G-6b`)

## 1. Política aprobada por Lino para este proyecto
- **GitHub desde Fase 0 (`G-6`):** Autorizado.
- **Transparencia de ingeniería con IA (`G-6b`):** **PERMITIDO SUBIR** a GitHub los artefactos de coordinación y trazabilidad (`AGENTS.md`, `STATE.md`, `.agents/`, `docs/sdd/`, `reports/`).

## 2. Tabla de rutas para publicación
| Categoría | Rutas | Regla en GitHub |
|---|---|---|
| **Producto, IaC y pruebas** | `frontend/`, `backend/`, `infra/terraform/`, `tests/`, `docs/`, `.github/`, `.env.example`, `README.md` | **Incluir siempre** |
| **Trazabilidad IA / Bluemind** | `AGENTS.md`, `STATE.md`, `.agents/`, `docs/sdd/`, `reports/` | **Incluir** (autorizado expresamente por Lino en `G-6b`) |
| **Secretos, caches y efímeros** | `.env`, `.local/`, `node_modules/`, `dist/`, `.terraform/`, `temporary/` | **PROHIBIDO SIEMPRE** |

## 3. Cierre previo a entrega final
En Fase 3, antes del cierre definitivo, se elimina físicamente `temporary/`, se reejecutan `build` y `tests/` completos y se alinea `README.md` al estándar visual de portafolio.
