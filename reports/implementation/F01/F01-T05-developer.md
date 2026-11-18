# `F01-T05` — Desarrollo: reglas puras bajo TDD

| Campo | Valor |
|---|---|
| **Tarea / paquete** | `F01-T05` · Fase 1 · `docs/sdd/packages/P-01-critical-foundations.md` |
| **Versión / loop** | `v1 — Loop 1/3` |
| **Rol** | `Developer` (harness OpenCode) |
| **Riesgo** | `3 (Sensible)` — privacidad y seguridad de archivos |
| **Criterio asignado** | `CA-05`: reglas puras 100 % cubiertas bajo `RED → GREEN → REFACTOR` (magic bytes y MIME real, rechazo SVG/GIF animado, anti-bomba, ahorro real 0 %/negativo y máquina de estados) |
| **Estado final** | **`DONE_WITH_CONCERNS`** — entregado a Tester y Auditor; **sin `PASSED` ni cierre de tarea por este rol** |
| **Fecha** | `2026-11-17` |

## 1. Fuentes leídas

`AGENTS.md`; `STATE.md`; `.agents/roles/developer.md`; `docs/sdd/packages/P-01-critical-foundations.md` (CA-05, §3–§5); `docs/sdd/spec.md` (FR-07, FR-11, FR-12, NFR-04, NFR-05); `docs/sdd/plan.md` §4; `docs/sdd/constitution.md` (PR-01, PR-12, IN-08, IN-10, IN-12); `reports/implementation/F01/F01-T01-architect.md` (contratos v1, hash `5d0082f8…68d626d`); `reports/implementation/F01/F01-T05-task.md` (**fuente de verdad de alcance**); `backend/src/contracts/**`; `backend/src/config/index.ts`; `.env.example`; `package.json` raíz, `backend/tsconfig.json`, `tsconfig.base.json`; `tests/unit/{config,contracts}.test.ts`; `reports/implementation/F01/F01-T01-developer.md` (formato de reporte y convención de normalización de rutas).

## 2. Resultado frente a CA-05

| Familia | Regla implementada | Ubicación |
|---|---|---|
| (a) Cabeceras | Magic bytes reales de `jpeg`/`png`/`webp`/`avif`; extracción de dimensiones; MIME y extensión coherentes con el formato detectado; rechazo de extensiones engañosas | `backend/src/domain/imageHeader.ts` |
| (b) Formatos peligrosos | Rechazo de SVG (con/sin declaración XML y con BOM), GIF animado (`NETSCAPE2.0`) y GIF estático, ZIP y cualquier magic byte no raster permitido (IN-10) | `backend/src/domain/imageHeader.ts` |
| (c) Anti-bomba | `MAX_FILE_SIZE_MB` y `MAX_PIXELS` **proyectados desde `loadConfig()`** (sin constantes embebidas); rechazo de tamaño, dimensiones no positivas y producto de píxeles antes de procesar | `backend/src/domain/antiBomb.ts` |
| (d) Ahorro real | `(bytesBefore - bytesAfter) / bytesBefore * 100` con bytes enteros seguros; **0 % y negativo reportados sin recorte**; coherente con la refinación `savings-coherence` del contrato congelado | `backend/src/domain/savings.ts` |
| (e) Estados | `PENDING → PROCESSING → {COMPLETED, PARTIAL, FAILED}`; `PARTIAL` exige imagen `FAILED` **y** al menos una completada; terminales sin salida; transiciones inválidas lanzan `DomainError` | `backend/src/domain/stateMachine.ts` |

Soporte transversal: `backend/src/domain/guards.ts` (enteros seguros y `DomainError`) y `backend/src/domain/index.ts` (puerta pública).

Sin I/O de red/S3, sin pipeline `sharp`, sin mocks que sustituyan la lógica bajo prueba. Las imágenes de prueba son fixtures **sintéticas de cabecera** construidas con `node:buffer` (`tests/unit/domain/fixtures.ts`, ≤33 bytes), acordes con NFR-05.

## 3. Cronología TDD (RED → GREEN → REFACTOR)

| Fase | Acción y resultado | Evidencia |
|---|---|---|
| **RED** | Se escribieron primero los tests y seis stubs con firmas correctas y valores deliberadamente erróneos. 46 tests: **40 fallos por aserción de comportamiento**, 6 aciertos; 0 fallos de resolución/sintaxis. Start `18:14:17`, exit 1. | `evidence/F01-T05-red.txt` |
| **GREEN (1er intento)** | Implementación pura completa. 47 tests: 1 fallo (`resolveBatchStatus({0,0})` devolvió `COMPLETED`). Exit 1. | (registro en cronología; conservado en el historial de ejecución) |
| **GREEN (final)** | Añadida guarda fail-closed para resumen vacío. **47/47**, exit 0. Start `18:16:08`. | `evidence/F01-T05-green.txt` |
| **REFACTOR** | Unificadas las comparaciones de magic bytes en `hasAscii`/`hasHex`; mismo comportamiento. **47/47** y cobertura 100 %. Start `18:17:03` / re-verificado `18:18:31`. | `evidence/F01-T05-refactor.txt` |
| **Cobertura (comando exigido)** | `npx vitest run tests/unit/domain --coverage`: 47/47; bloque `backend/src/domain` al 100 % en las 4 métricas. | `evidence/F01-T05-coverage.txt` |
| **Familias sensibles** | Privacidad/anti-bomba: 21/21. Estados: 13/13. | `evidence/F01-T05-{privacy,states}.txt` |
| **Verificación** | `typecheck` (2 → 0 tras reforzar un test), `lint` 0, suite completa 119/119. | tabla §4 |

El RED no es reproducible sin revertir la implementación (acción prohibida); se conserva el registro cronológico íntegro. Las seis evidencias tienen la línea `RUN` normalizada a `<PROJECT_ROOT>` para no ampliar el seguimiento P4 (G-6b).

## 4. Tabla de comandos y exit codes

Todos ejecutados desde `<PROJECT_ROOT>`.

| Comando | Exit | Resultado |
|---|---|---|
| `node -e "require.resolve('@vitest/coverage-v8')"` (inicial) | 0 | `NO coverage-v8` (no instalado) |
| `npm install --no-save --package-lock=false --no-audit --no-fund @vitest/coverage-v8@2.1.9` | 0 | Proveedor disponible solo en `node_modules`; 0 cambios en manifiestos (hashes verificados antes/después) |
| `Get-FileHash` de manifiestos (antes / justo después del install) | 0 | `package.json A2729881…`, `package-lock.json 3DE69FAD…`, `backend/package.json 524C9410…` → idénticos |
| `npm run typecheck` (baseline, antes de escribir) | 0 | sin diagnósticos |
| `npm run test:unit` (baseline) | 0 | 4 archivos, 72/72 |
| `npx vitest run tests/unit/domain` (**RED**) | 1 | 40 failed / 6 passed (46) — comportamiento |
| `npx vitest run tests/unit/domain` (GREEN 1er intento) | 1 | 1 failed / 46 passed (47) |
| `npx vitest run tests/unit/domain` (**GREEN**) | 0 | 6 archivos, **47/47** |
| `npx vitest run tests/unit/domain --coverage` | 0 | 47/47 · `backend/src/domain` 100 % |
| `npx vitest run tests/unit/domain --coverage --coverage.include='backend/src/domain/**' --coverage.all --coverage.reporter=text` | 0 | **100 % líneas/ramas/funciones/sentencias** en los 6 archivos del módulo |
| `npx vitest run tests/unit/domain/imageHeader.test.ts tests/unit/domain/antiBomb.test.ts` | 0 | 21/21 |
| `npx vitest run tests/unit/domain/stateMachine.test.ts` | 0 | 13/13 |
| `npm run typecheck` (1er intento) | 2 | `TS2367` en `savings.test.ts:51` |
| `npm run typecheck` (final) | 0 | sin diagnósticos |
| `npm run lint` | 0 | sin hallazgos |
| `npm run test:unit` (final) | 0 | 10 archivos, **119/119** (72 preexistentes + 47 nuevos) |

No se usaron Docker, emulador AWS, Git de escritura ni GitHub en esta tarea (`git status` solo lectura, para la observación P5).

## 5. Cobertura alcanzada

Comando con filtro explícito y `--coverage.all` (incluye archivos no importados):

| Archivo (`backend/src/domain/`) | Sentencias | Ramas | Funciones | Líneas |
|---|---|---|---|---|
| `antiBomb.ts` | 100 % | 100 % | 100 % | 100 % |
| `guards.ts` | 100 % | 100 % | 100 % | 100 % |
| `imageHeader.ts` | 100 % | 100 % | 100 % | 100 % |
| `index.ts` | 100 % | 100 % | 100 % | 100 % |
| `savings.ts` | 100 % | 100 % | 100 % | 100 % |
| `stateMachine.ts` | 100 % | 100 % | 100 % | 100 % |
| **Total módulo** | **100 %** | **100 %** | **100 %** | **100 %** |

Nota: el informe global sin filtro muestra ~36 % porque Vitest incluye módulos cargados ajenos a este alcance (`config/`, `contracts/`, `db/` — este último en modificación por `F01-T02` — y `frontend/`). El criterio `CA-05` exige el 100 % de `backend/src/domain/**`, que está acreditado arriba.

## 6. Archivos creados / modificados

**Creados:** `backend/src/domain/{guards,antiBomb,savings,imageHeader,stateMachine,index}.ts`; `tests/unit/domain/{fixtures,guards,savings,antiBomb,imageHeader,stateMachine,index}.test.ts` (más `fixtures.ts`); `reports/implementation/F01/evidence/F01-T05-{red,green,refactor,coverage,privacy,states}.txt`; este reporte.

**Modificados por esta tarea:** ningún archivo fuera del ámbito exclusivo. En particular **no se escribió** `backend/package.json`, `package-lock.json`, `package.json` raíz, `.env.example`, `STATE.md`, `tasks.md`, `backend/src/{contracts,db,auth,config}/**` ni `frontend/**`. El proveedor de cobertura se instaló únicamente en `node_modules` con `--no-save --package-lock=false`.

## 7. Problemas registrados (7 campos obligatorios)

### `F01-T05-P1` — RED greenfield sin módulo previo

1. **Identificación:** `F01-T05-P1`.
2. **Problema:** `backend/src/domain/**` no existía; un RED con imports directos habría fallado por resolución de módulo, no por comportamiento.
3. **Causa:** **DEMOSTRADA** — inspección inicial del árbol (`backend/src` solo contenía `config/index.ts`, `contracts/**` e `index.ts`).
4. **Solución e intentos fallidos:** seis stubs con firmas exactas y valores deliberadamente incorrectos, sustituidos íntegramente en GREEN. Descartado el import directo por no ser RED conductual; sin intentos fallidos adicionales.
5. **Verificación:** 40 fallos de aserción (`expected … to be …`), 0 `MODULE_NOT_FOUND`, en `F01-T05-red.txt`.
6. **Pendientes:** ninguno.
7. **Aprendizaje candidato:** `PROPUESTA_GLOBAL` — en módulos nuevos, un stub conductual permite un RED por comportamiento sin depender de errores de resolución.

### `F01-T05-P2` — Resumen vacío resuelto como `COMPLETED`

1. **Identificación:** `F01-T05-P2`.
2. **Problema:** `resolveBatchStatus({completed: 0, failed: 0})` devolvió `COMPLETED` en el primer GREEN; la expectativa fail-closed es `FAILED`.
3. **Causa:** **DEMOSTRADA** — fallo de aserción `expected 'COMPLETED' to be 'FAILED'`; la rama `failed === 0` se evaluaba antes de detectar lote vacío.
4. **Solución e intentos fallidos:** guarda explícita `completed === 0 && failed === 0 → FAILED` antes del resto. Intento fallido: orden original (`failed === 0 → COMPLETED` primero).
5. **Verificación:** 47/47; la nueva rama está cubierta por el test de `resolveBatchStatus` y por la cobertura 100 % de ramas.
6. **Pendientes:** ninguno.
7. **Aprendizaje candidato:** `PROPUESTA_GLOBAL` — los agregados vacíos en máquinas de estados deben fallar cerrado, no inducir éxito.

### `F01-T05-P3` — Proveedor `@vitest/coverage-v8` ausente

1. **Identificación:** `F01-T05-P3`.
2. **Problema:** `--coverage` no podía ejecutarse: el proveedor V8 no estaba instalado en `node_modules`.
3. **Causa:** **DEMOSTRADA** — `require.resolve('@vitest/coverage-v8')` devolvió `NO coverage-v8` con `vitest 2.1.9`.
4. **Solución e intentos fallidos:** `npm install --no-save --package-lock=false @vitest/coverage-v8@2.1.9`, sin tocar manifiestos; se descartó añadir la dependencia a `backend/package.json` por la restricción explícita de alcance (otra tarea es propietaria del manifiesto).
5. **Verificación:** hashes de los tres manifiestos idénticos inmediatamente antes y después del install; cobertura 100 % con y sin `--coverage.all`.
6. **Pendientes:** si se requiere `--coverage` en CI limpio, la tarea propietaria del manifiesto backend debe declarar `@vitest/coverage-v8` como `devDependency`; decisión del Architect/CTO, no de este rol.
7. **Aprendizaje candidato:** `PROPUESTA_GLOBAL` — al instalar herramientas con `--no-save`, verificar hashes de manifiestos antes/después para acreditar que no se modificaron.

### `F01-T05-P4` — `TS2367` en tabla de pruebas de ahorro

1. **Identificación:** `F01-T05-P4`.
2. **Problema:** `npm run typecheck` terminó con exit 2: comparación `before === 0` imposible en `savings.test.ts:51`.
3. **Causa:** **DEMOSTRADA** — el array `as const` no contenía el valor `0`, por lo que TypeScript infinitó `before` como `1000 | 7 | 250 | 90`.
4. **Solución e intentos fallidos:** añadir el caso `[0, 500]` a la tabla de coherencia (refuerza la cobertura del caso sin bytes de entrada) en lugar de relajar la aserción. Primer `typecheck` fallido; sin otros intentos.
5. **Verificación:** `npm run typecheck` exit 0 final; 47/47 y cobertura 100 % tras el cambio.
6. **Pendientes:** ninguno.
7. **Aprendizaje candidato:** `SOLO_LOCAL` — las tablas `as const` estrechan los tipos hasta volver "imposibles" comparaciones de caso límite; incluir explícitamente el 0.

### `F01-T05-P5` — Manifiestos con cambios concurrentes (observación de alcance)

1. **Identificación:** `F01-T05-P5`.
2. **Problema:** al cierre de la sesión, `package-lock.json` (`3DE69FAD…` → `FBC9E5D0…`) y `backend/package.json` (`524C9410…` → `6056015E…`) tienen hashes distintos a los registrados al inicio.
3. **Causa:** **DEMOSTRADA** — `git status` muestra `M backend/package.json` y `M package-lock.json` (además de `STATE.md` y `tasks.md`), archivos propiedad de `F01-T02` / roles superiores según `STATE.md`. Los hashes justo después de mi instalación con `--no-save` seguían siendo los iniciales.
4. **Solución e intentos fallidos:** no se escribió ni se intentó revertir ninguno de esos archivos: son trabajo ajeno en ejecución paralela y están fuera de mi ámbito. No hubo intentos fallidos.
5. **Verificación:** `Get-FileHash` inicial / posterior al install / final, y `git status --short` (solo lectura).
6. **Pendientes:** el Architect debe confirmar que los cambios provienen de `F01-T02`; sin acción de este rol.
7. **Aprendizaje candidato:** `PROPUESTA_GLOBAL` — en trabajo paralelo, registrar hashes de manifiestos al inicio y al final permite distinguir cambios propios de ajenos sin acusaciones infundadas.

## 8. Estado final y handoff

- **Estado:** `DONE_WITH_CONCERNS` (P3 y P5 son seguimientos de gobernanza/herramienta, no defectos de la lógica entregada).
- **No se emite `PASSED` ni se cierra la tarea:** corresponden a Tester y Auditor de riesgo 3, con base en `evidence/F01-T05-*.txt` y este reporte.
- Sin secretos, sin `:9324` y sin rutas Windows absolutas en los artefactos nuevos (línea `RUN` normalizada a `<PROJECT_ROOT>`). Sin Docker, AWS real ni Git de escritura.
- Handoff: Tester reejecuta `npx vitest run tests/unit/domain --coverage` y Auditor revisa reglas de privacidad/anti-bomba (IN-10, PR-12) y la decisión pendiente P3.
