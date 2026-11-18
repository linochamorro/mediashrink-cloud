# Cierre de tarea (Architect) — `F01-T05`

| Campo | Valor |
|---|---|
| **Tarea** | `F01-T05` — Reglas puras bajo TDD |
| **Fase / paquete** | Fase 1 — `docs/sdd/packages/P-01-critical-foundations.md` |
| **Versión / Loop usado** | `v1 — Loop 1/3` |
| **Rol implementador / verificadores** | Developer / Tester + Auditor (riesgo 3) |
| **Dictamen Tester** | **`PASSED`** (`F01-T05-tester.md`: 47/47 reglas, 100 % cobertura, 119/119 suite) |
| **Dictamen Auditor** | **`READY_WITH_CONCERNS`** (`F01-T05-auditor.md` + addendum: A-01 cerrado por decisión CTO; sin bloqueantes) |
| **Decisión CTO/Lino registrada** | **AVIF animado aprobado** (`avis`, `.avifs`, `image/avif-sequence`) como decisión de producto (2026-11-17); no G-10 |
| **Estado de la tarea** | `CERRADA — PASSED` |

## 1. Revisión de aceptación reforzada (METHODOLOGY.md §3.2)

| Requisito / fuente superior | Comportamiento observable | Evidencia | Límite de cobertura | Estado |
|---|---|---|---|---|
| `CA-05` (P-01 §5) · reglas puras 100 % cubiertas — PR-05 | Tester reejecutó 47/47 con cobertura 100 % en sentencias/ramas/funciones/líneas de los 6 módulos de `backend/src/domain/**`; suite 119/119 | `F01-T05-tester-{coverage,coverage-filtered,unit}.txt` | Cobertura de reglas puras; no acredita el pipeline `sharp` real (F02) | **CUMPLIDO** |
| FR-07/IN-10 · magic bytes, MIME, rechazo SVG/GIF/polimorfismo | Rechazo fail-closed verificado por Tester y Auditor; sin ruta que permita metadatos o formatos peligrosos | `F01-T05-tester-rules.txt`; auditoría V-1…V-10 | Sin I/O real de archivos (F02) | **CUMPLIDO** |
| IN-10/D-08 · anti-bomba desde configuración | `MAX_PIXELS`/`MAX_FILE_SIZE_MB` desde `loadConfig()` (15 MB / 25 M px), sin constantes contradictorias | `F01-T05-tester-rules.txt`; auditoría | Orden de la guarda de tamaño frente al escaneo de buffer se traslada a F02 (A-05) | **CUMPLIDO** (con traspaso) |
| PR-12 · ahorro real 0 %/negativo | Bytes enteros, sin recorte, coherencia con `savings-coherence`; sin división por cero | `F01-T05-tester-rules.txt`; auditoría | — | **CUMPLIDO** |
| IN-08 · máquina de estados | Transiciones exhaustivas, `PARTIAL` exige imagen `FAILED`, terminales sin salidas inválidas | `F01-T05-tester-rules.txt`; auditoría | — | **CUMPLIDO** |
| PR-06 · sin supuestos (A-01) | AVIF animado **aprobado por CTO/Lino** el 2026-11-17; registrado en addendum del Auditor; sin cambios de código | Addendum `F01-T05-auditor.md` | No es G-10: decisión de producto | **CUMPLIDO** |
| `task.md` §3 · ámbito y manifiestos | Solo `backend/src/domain/**`, `tests/unit/domain/**`, evidence y reporte; manifiestos intactos en el handoff | `F01-T05-tester-scope.txt` | Cambios concurrentes de manifiestos por T02 (P5/A-04), ajenos al dominio | **CUMPLIDO** |

**Conclusión:** `CA-05` satisfecho con evidencia propia del Tester. La objeción material del Auditor (A-01) quedó resuelta por decisión expresa de Lino antes del cierre. No hay `PASSED` condicional ni riesgos aceptados sin autoridad.

## 2. Problemas y disposición

| ID | Clasificación | Disposición |
|---|---|---|
| `A-01` — AVIF animado sin respaldo SDD | MEDIUM | **CERRADO por decisión expresa de CTO/Lino**; no es G-10; PR-06 satisfecho |
| `A-02` — rama `avis` sin prueba RED | LOW | **SEGUIMIENTO de trazabilidad TDD**; no bloquea |
| `A-03` — `@vitest/coverage-v8` sin declarar (`--no-save`) | MEDIUM | **EN CORRECCIÓN por F01-T02** (propietario de `backend/package.json`): declarar devDependency y verificar `npm ci` + cobertura; no aceptado en nombre de Lino |
| `A-04` — manifiestos concurrentes | INFO | Observado, ajeno al dominio; sin acción |
| `A-05` — orden de guarda de tamaño | LOW | **TRASPASO a F02** (worker `sharp`): imponer rechazo por tamaño antes de escanear el buffer |

Cronología RED (40 fallos por comportamiento) → GREEN 47/47 → REFACTOR 47/47 revisada como registro; cobertura 100 % de aserciones sustantivas, sin mocks triviales ni `istanbul ignore`, sin debilitar expectativas en el REFACTOR.

## 3. Cobertura y cierre

- Las reglas puras quedan listas para ser consumidas por el worker de F02; la UI (F03) y el pipeline real no se implementaron aquí.
- Sin Git/GitHub, Docker ni AWS real en esta tarea; sin secretos ni rutas Windows absolutas en artefactos nuevos (P4 no ampliado).
- `F01-T05` queda **`CERRADA — PASSED`**. Se actualizan `docs/sdd/tasks.md` y `STATE.md`. Quedan `F01-T02` (en verificación), `F01-T03` (auth) y `F01-T04` (seed).
