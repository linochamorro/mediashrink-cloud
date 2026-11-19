# Tarea `F05-T02` — Cierre de seguimientos y Auditoría final

| Campo | Valor |
|---|---|
| **ID / Fase** | `F05-T02` · Fase Final — `docs/sdd/packages/P-05-final-integration-and-delivery.md` |
| **Rol / verificadores** | Developer + Auditor (Riesgo 3) |
| **Harness / Loop** | OpenCode · `v1 — Loop 1/3` |
| **Riesgo** | `3 (Sensible)` — seguridad y privacidad |

## 1. Criterio (`CA-02`)
1. **F03-AUD-03** (MEDIUM): validar en `frontend/` que toda URL presignada (PUT de subida, preview/descarga, ZIP) sea `https:` con hostname permitido, sin usuario/contraseña embebidos, y fallar de forma segura ante `javascript:`/HTTP/host ajeno. Añadir pruebas unitarias.
2. **HeadObject en `raw` (bytesBefore)**: garantizar que el publicador enriquecido lee el tamaño real del objeto subido desde S3 (no del cuerpo declarado) y que la métrica persistida coincide; verificar con prueba de integración.
3. **P4 anonimización**: sustituir rutas absolutas `<PROJECT_ROOT>/...` (y variantes con `\`) en `reports/` y evidencias G-6b por marcadores (`<PROJECT_ROOT>`, `<LAB_ROOT>`), **incluido el banner de Vitest** y los artefactos F04-T05 señalados por `F04T05-A-06`. No alterar el contenido sustantivo de hallazgos ni borrar historial append-only: usar addendum de anonimización cuando un archivo deba conservar su texto original.
4. **Auditoría final** de seguridad y privacidad con **0 CRITICAL/HIGH abiertos y 0 secretos**. Inventariar P4, riesgos LOW/INFO heredados y su disposición sin G-10.

## 2. Entradas y entorno
- Depende de `F05-T01` PASSED. No tocar `temporary/` ni publicar (G-11/G-12 pendientes). Sin AWS real; Docker apagado tras pruebas.

## 3. Ámbito
Acceso controlado al repositorio, con énfasis en `frontend/src/api/**`, `backend/src/api/**`, `reports/**`, `tests/unit/**`, `tests/integration/**`. Sin secretos ni rutas absolutas nuevas en artefactos.

## 4. Método y entregables
- Evidencia: `F05-T02-{url-validation,headobject,anonymization-scan,audit-final,emulator-down}.txt`.
- Reportes: `F05-T02-developer.md`, `reports/audits/F05/F05-T02-auditor.md`, cierre `F05-T02-architect.md`.
