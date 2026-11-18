# `F01-T01` — Desarrollo: contratos Zod congelados y tipos generados

| Campo | Valor |
|---|---|
| **Tarea / paquete** | `F01-T01` · Fase 1 · `P-01-critical-foundations.md` |
| **Versión / loop** | `v1 — Loop 1/3` |
| **Rol** | `Developer` (harness OpenCode) |
| **Criterio asignado** | `CA-01`: esquemas Zod validan entradas/salidas; el frontend consume `types.generated.ts` sin duplicar tipos; `typecheck`/`lint`/tests en verde |
| **Estado final** | **`DONE`** (entregado a Tester y Auditor; **sin `PASSED` ni cierre de tarea por este rol**) |
| **Fecha** | `2026-11-17` |

## 1. Fuentes leídas

`AGENTS.md`; `STATE.md`; `.agents/roles/developer.md`; `docs/sdd/packages/P-01-critical-foundations.md` (CA-01, §3); `docs/sdd/{constitution,spec,plan}.md`; `reports/implementation/F01/F01-T01-task.md` (fuente de verdad de alcance); `backend/src/config/index.ts`; `backend/package.json`; `package.json` raíz; `frontend/src/{main.tsx,App.tsx}`; `frontend/tsconfig.json`, `backend/tsconfig.json`, `tsconfig.base.json`; `tests/unit/{config,health,frontend}.test.ts`; `reports/verification/F00-architect.md` §7; y la evidencia A-03 (`reports/audits/F00/F00-T03-auditor.md`, addendum de `F00-T01`) para fijar el convenio de QueueUrls.

## 2. Resultado frente a CA-01

- 14 contratos materializados en esquemas Zod estrictos con un catálogo único (`catalog.ts`).
- `frontend/src/api/types.generated.ts` generado de forma reproducible; el frontend no redefinió tipos.
- Test de sincronía/congelación: byte a byte contra `generateTypes()`, cabecera con versión/hash, nombres exactos, ausencia de redefiniciones y equivalencia exacta de tipos (`z.infer` vs. tipos generados).
- `npx vitest run tests/unit/contracts.test.ts`: **32/32**; `npm run test:unit`: **72/72** (40 preexistentes + 32 nuevos); `npm run typecheck` y `npm run lint`: exit 0.
- Sin secretos, sin `:9324` en valores y sin rutas Windows absolutas en los artefactos de esta tarea (la línea `RUN` de Vitest se normalizó a `<PROJECT_ROOT>`).

## 3. Cronología TDD (RED → GREEN → REFACTOR → FREEZE)

| Fase | Acción | Evidencia |
|---|---|---|
| **RED** | Scaffold temporal permisivo en `backend/src/contracts/index.ts` + 27 tests (19 negativos, 8 positivos/constantes). 19 fallos **por comportamiento** (`expected true to be false`), 0 errores de módulo/sintaxis/dependencias. Start `17:17:16`, exit 1. | `reports/implementation/F01/evidence/F01-T01-red.txt` |
| **GREEN** | Sustituido el scaffold por `catalog.ts`, `zod-schemas.ts`, `generate.ts` e `index.ts`; generado `types.generated.ts`. 27/27. Start `17:19:06`, exit 0. | `evidence/F01-T01-green.txt` |
| **REFACTOR** | Constantes `as const` sin ensanchamiento, `EMAIL`/`BOOLEAN`/`METRIC_FIELDS` compartidos; misma semántica y mismo hash. 27/27. Start `17:19:55`, exit 0. | `evidence/F01-T01-refactor.txt` |
| **FREEZE** | Añadidos 5 tests de sincronía/congelación y equivalencia de tipos; corrección de ruta raíz y de helpers de tipo. 32/32. Start `17:23:27`, exit 0. | `evidence/F01-T01-freeze.txt` |
| **Verificación** | `typecheck`, `lint` y regresión completa. | `evidence/F01-T01-{typecheck,lint,regression}.txt` |

El RED no es reproducible sin revertir el código (acción prohibida); se conserva el registro cronológico íntegro.

## 4. Tabla de comandos y exit codes

| Comando (desde `<PROJECT_ROOT>`) | Exit | Resultado |
|---|---|---|
| `npm install zod@^3.24.2 --workspace=@mediashrink/backend --no-audit --no-fund` | 0 | `zod 3.25.76` (G-8) |
| `npm install -D tsx@^4.19.2 --workspace=@mediashrink/backend --no-audit --no-fund` | 0 | `tsx 4.23.15` (G-8) |
| `npx vitest run tests/unit/contracts.test.ts` (RED) | 1 | 19 failed / 8 passed (27) — comportamiento |
| `npm run generate:types --workspace=@mediashrink/backend` | 0 | archivo generado |
| `npx vitest run tests/unit/contracts.test.ts` (GREEN) | 0 | 27/27 |
| `npx vitest run tests/unit/contracts.test.ts` (REFACTOR) | 0 | 27/27 |
| `npx vitest run tests/unit/contracts.test.ts` (FREEZE, 1er intento) | 1 | 4 fallos por ruta raíz del test |
| `npx vitest run tests/unit/contracts.test.ts` (FREEZE final) | 0 | 32/32 |
| `npm run typecheck` (1er intento) | 2 | TS2740/TS2739 + TS2554 + TS2344 |
| `npm run typecheck` (final) | 0 | sin diagnósticos |
| `npm run lint` (1er intento) | 1 | 1 error: genérico `T` sin usar |
| `npm run lint` (final) | 0 | sin hallazgos |
| `npm run test:unit` | 0 | 4 archivos, 72/72 |
| Regeneración + `Get-FileHash` antes/después | 0 | `CEB6A184…D36B` idéntico → reproducible |

## 5. Contratos congelados (14 · todos `v1` · global `1.0.0`)

`RegisterInput`, `LoginInput`, `RefreshInput`, `TokenPair`, `AuthenticatedUser`, `Preset`, `JobStatus`, `OutputFormat`, `ImageRecord`, `JobMetrics`, `Job`, `LimitsConfig`, `AwsTransport`, `RetentionPolicy`.

- Hash del catálogo: `5d0082f8d97e0329862739123b7599c75ff7261834430039fa6e815bf68d626d`.
- Presets: `HIGH`, `BALANCED`, `MAX_COMPRESSION`. Estados: `PENDING`, `PROCESSING`, `COMPLETED`, `PARTIAL`, `FAILED`. Formatos: `webp`, `avif`.
- Convenios: TTL/ciclo 30 días (`ttlSeconds: 2592000`), límites desde `loadConfig().limits`, QueueUrls canónicas con `AWS_ENDPOINT_URL` como transporte, sin `:9324`.

## 6. Archivos creados / modificados

**Creados:** `backend/src/contracts/{catalog,zod-schemas,generate,index}.ts`; `frontend/src/api/types.generated.ts`; `tests/unit/contracts.test.ts`; `docs/architecture/04-api-and-component-contract.md`; `reports/implementation/F01/evidence/F01-T01-{red,green,refactor,freeze,typecheck,lint,regression}.txt`; este reporte.

**Modificados:** `backend/package.json` (dependencias `zod`/`tsx` y script `generate:types`). Efecto colateral de G-8: `package-lock.json` actualizado por `npm install` para fijar esas versiones; no se tocó el `package.json` raíz ni ningún otro archivo prohibido.

## 7. Problemas registrados (7 campos obligatorios)

### `F01-T01-P1` — RED sin módulo previo

1. **Identificación:** `F01-T01-P1`.
2. **Problema:** no existía `backend/src/contracts/**`; un RED con import directo habría fallado por resolución de módulo, no por comportamiento.
3. **Causa:** **DEMOSTRADA** — inspección inicial del árbol (`backend/src` solo tenía `config/index.ts` e `index.ts`).
4. **Solución e intentos fallidos:** scaffold temporal con 14 esquemas `z.any()` y constantes correctas, sustituido íntegramente en GREEN. Descartado import directo por no ser un RED conductual; sin intentos fallidos adicionales.
5. **Verificación:** RED 19 fallos de aserción (`expected true to be false`) + 8 aciertos, sin `MODULE_NOT_FOUND`, en `F01-T01-red.txt`.
6. **Pendientes:** ninguno.
7. **Aprendizaje candidato:** `PROPUESTA_GLOBAL` — en tareas greenfield, usar un scaffold permisivo temporal para lograr un RED por comportamiento.

### `F01-T01-P2` — API de `expectTypeOf` en Vitest 2.1.9

1. **Identificación:** `F01-T01-P2`.
2. **Problema:** `npm run typecheck` devolvió `TS2554: Expected 1 arguments, but got 0` en 11 comparaciones de tipos.
3. **Causa:** **DEMOSTRADA** — en esta versión `toEqualTypeOf` exige un argumento de valor; la forma parametrizada sin argumento no es válida.
4. **Solución e intentos fallidos:** sustituido por el helper `Exact<A, B>` y `expectExact<T extends true>(proof: T)`, invocado con `true`. Intentos fallidos: la llamada original sin argumento y un primer helper sin parámetro.
5. **Verificación:** `typecheck` final exit 0; las 14 equivalencias se evalúan en compilación y el test pasa 32/32.
6. **Pendientes:** ninguno.
7. **Aprendizaje candidato:** `SOLO_LOCAL` — fijar la forma de aserción de tipos según la versión instalada de Vitest.

### `F01-T01-P3` — Tipos generados no exactamente iguales a los inferidos

1. **Identificación:** `F01-T01-P3`.
2. **Problema:** `Exact<z.infer<...>, TypeGenerado>` evaluó `false` en 11 contratos objeto; `RetentionPolicy` además mostraba `2592000` vs `number`.
3. **Causa:** **DEMOSTRADA** — el mapped type `Simplify` preservaba los modificadores `readonly` del catálogo `as const`, y `TTL_SECONDS` se infirió como `number` al calcularlo con multiplicación.
4. **Solución e intentos fallidos:** `Simplify<T> = { -readonly [K in keyof T]: T[K] }`; `TTL_SECONDS = 2_592_000` como literal; `buildSchema<S>` devuelve `z.ZodType<InferContract<S>>`. Intentos fallidos: `Simplify` sin `-readonly` y TTL deriveado de `RETENTION_DAYS * 24 * 60 * 60`.
5. **Verificación:** 14 comparaciones `Exact` verdaderas; `typecheck` exit 0 con la misma salida generada (hash inalterado).
6. **Pendientes:** ninguno.
7. **Aprendizaje candidato:** `PROPUESTA_GLOBAL` — al proyectar tipos desde un catálogo `as const`, eliminar `readonly` explícitamente y conservar literales numéricos.

### `F01-T01-P4` — Ruta raíz errónea en el test de congelación

1. **Identificación:** `F01-T01-P4`.
2. **Problema:** los 4 tests de sincronía fallaron con `ENOENT ... tests/frontend/src/api/types.generated.ts`.
3. **Causa:** **DEMOSTRADA** — `PROJECT_ROOT` se calculó con `'..'` desde `tests/unit/` en lugar de `'../..'`.
4. **Solución e intentos fallidos:** corregir a `resolve(dirname(import.meta.url), '../..')`, coherente con `config.test.ts`. Sin otros intentos.
5. **Verificación:** FREEZE final 32/32, `evidence/F01-T01-freeze.txt`.
6. **Pendientes:** ninguno.
7. **Aprendizaje candidato:** `SOLO_LOCAL` — reutilizar el helper de raíz ya establecido en la suite.

### `F01-T01-P5` — Reasignación de esquemas Zod tipados

1. **Identificación:** `F01-T01-P5`.
2. **Problema:** `TS2740`/`TS2739` al reasignar `ZodString`/`ZodArray` desde un `refine` (`ZodEffects`).
3. **Causa:** **DEMOSTRADA** — anotar la variable como `ZodTypeAny` eliminaba los métodos; dejarla inferida impedía asignar `ZodEffects`.
4. **Solución e intentos fallidos:** ruta `https-url` con `return` tipado propio; en arrays, `arraySchema` para `min`/`max` y `schema: z.ZodTypeAny` solo para los `refine`. Intentos fallidos: ambas anotaciones simples.
5. **Verificación:** `typecheck` exit 0 y 32/32 tests.
6. **Pendientes:** ninguno.
7. **Aprendizaje candidato:** `SOLO_LOCAL` — separar la fase de restricciones de la fase de refinamientos al construir esquemas dinámicos.

### `F01-T01-P6` — Genérico sin usar en ESLint

1. **Identificación:** `F01-T01-P6`.
2. **Problema:** `npm run lint` devolvió `'T' is defined but never used` en el helper `expectExact`.
3. **Causa:** **DEMOSTRADA** — el parámetro de tipo solo aparecía en la firma y la regla `@typescript-eslint/no-unused-vars` lo marca como variable no usada.
4. **Solución e intentos fallidos:** convertirlo en parámetro en tiempo de ejecución (`proof: T`) y pasar `true` en las 14 llamadas. Sin otros intentos.
5. **Verificación:** `npm run lint` exit 0; `typecheck` sigue en 0.
6. **Pendientes:** ninguno.
7. **Aprendizaje candidato:** `SOLO_LOCAL` — dar uso runtime a los genéricos de aserción cuando el project lint lo exige.

## 8. Estado final y handoff

**`DONE`.** Sin hallazgos pendientes, sin excepción metodológica y sin riesgo aceptado. Queda para el **Tester** la emisión de `F01-T01-tester.md`, para el **Auditor** la revisión `reports/audits/F01/F01-T01-auditor.md` y para el **Architect** el cierre de la tarea. Este rol no emite `PASSED` ni actualiza `STATE.md`/`tasks.md`.
