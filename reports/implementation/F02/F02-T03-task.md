# Tarea `F02-T03` — Worker `sharp` (WebP + AVIF + miniatura, privacidad)

| Campo | Valor |
|---|---|
| **ID completo** | `F02-T03` |
| **Fase / paquete** | Fase 2 — `docs/sdd/packages/P-02-api-and-worker.md` |
| **Prioridad** | `P1` |
| **Rol implementador / verificadores** | Developer / Tester + Auditor |
| **Harness / Loop** | OpenCode · `v1 — Loop 1/3` |
| **Nivel de riesgo** | `3 (Sensible)` — privacidad EXIF/GPS y procesamiento |
| **Estimación / hitos** | 45 min: (1) guarda de tamaño, (2) pipeline, (3) strip y verificación, (4) evidencia. Revisión ≥5 min; diagnóstico a 10 min o >2× estimación. |
| **Procesos** | `npx vitest run tests/unit/worker tests/integration/worker`, `npm run typecheck`, `npm run lint`. Timeout 240 s. |

## 1. Fuentes y criterio
- `spec.md` FR-11/FR-12, NFR-05; `plan.md` §4; `constitution.md` PR-01/IN-01/IN-10/IN-12; `P-02` §5 `CA-03`.
- **`CA-03`**: por imagen produce **WebP + AVIF + miniatura WebP**, elimina **todos** los metadatos (EXIF/GPS) con `exifStripped: true` verificable, aplica la **guarda de tamaño antes de escanear** (cierra `A-05` de T05), usa límites de config y reglas puras de F01-T05 sin reimplementarlas.

## 2. Entradas y entorno
- Depende de `F01-T05` PASSED; `sharp` ya está declarado en `backend/package.json`. **No modificar manifiestos** (T02 es propietario en F02).
- Reutilizar `backend/src/domain/**` (magic bytes, anti-bomba, ahorro, estados) y contratos congelados; no duplicar reglas.
- Sin AWS real; el worker es una función pura de procesamiento sobre buffers plus integración con S3 si la prueba lo requiere (usar el mismo patrón de emulador y apagado).

## 3. Ámbito exclusivo
`backend/src/worker/**`, `tests/unit/worker/**`, `tests/integration/worker/**`, `reports/implementation/F02/evidence/F02-T03-*`, `reports/implementation/F02/F02-T03-developer.md`.
**Prohibido:** `backend/src/{api,storage}/**` (propiedad de T01/T02), manifiestos, frontend, IaC, `.github/`, `STATE.md`, `tasks.md`, push a `main`.

## 4. Método y entregables
- TDD: RED con fixtures 100×100; GREEN con `sharp` (sin metadata: `.withMetadata({})`/equivalente que garantice strip total); verificar salidas WebP/AVIF/miniatura, `exifStripped: true`, bytes reales y que un archivo sobredimensionado se rechaza **antes** de decodificarlo (A-05).
- Evidencia: `F02-T03-{red,green,refactor,formats,metadata,anti-bomb}.txt`.
- Dictamen `F02-T03-tester.md`; auditoría `reports/audits/F02/F02-T03-auditor.md`; cierre `F02-T03-architect.md`.
