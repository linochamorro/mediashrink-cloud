# Auditoría `F01-T01` — Contratos Zod congelados y tipos generados

| Campo | Valor |
|---|---|
| **Auditoría / tarea / fase** | `F01-T01` · Fase 1 · `P-01-critical-foundations.md` |
| **Rol** | `Auditor` (riesgo 2, según contrato `F01-T01-task.md`) |
| **Fecha / loop** | `2026-11-17` · `Loop 1/3` |
| **Encargo** | Congelación y trazabilidad; coherencia SDD (PR-06); secretos y dependencias (G-3/G-8); documentación técnica; riesgo P4 |
| **Conclusión** | **`READY_WITH_CONCERNS`** |
| **Cobertura** | **`SUFFICIENT`** para el alcance asignado (estático/documental) · **`LIMITED`** para historial Git y ejecución funcional (fuera de alcance/prohibido) |
| **Hallazgos** | 4 (1 `MEDIUM`, 2 `LOW`, 1 `INFO`) · **0 CRITICAL / 0 HIGH** · **0 bloqueantes de auditoría** |

> Frontera respetada: no se implementó código, no se emitió `PASSED`/`NO-PASSED`, no se reejecutó la suite funcional del Tester, no se usaron Git/GitHub, Docker ni AWS, y no se aceptó riesgo en nombre de Lino (G-10). No se escriben secretos ni rutas Windows absolutas; se usa el marcador `<PROJECT_ROOT>`.

---

## 1. Hallazgos (7 campos obligatorios)

### Problema `A-01` — Longitud de contraseña `8–128` sin respaldo en decisiones aprobadas (PR-06)

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID: `A-01` · Tarea: `F01-T01` · Fase: `P-01` · Loop: `1/3` · Fecha: `2026-11-17` · Entorno: Windows / Node 26 / sin AWS |
| **2. Problema** | **Síntoma:** `RegisterInput.password` congela `min: 8`, `max: 128` en `backend/src/contracts/catalog.ts` y lo documenta `docs/architecture/04-api-and-component-contract.md` §2. **Esperado:** PR-06 exige que ningún agente escriba lo que no está acordado; toda decisión material de producto/seguridad debe estar aprobada. **Observado:** búsqueda en `docs/sdd/**`, `reports/intake/intake-mediashrink.md`, `backend/src/config/index.ts` y `.env.example` no muestra política alguna de longitud de contraseña (solo "contraseña hasheada", D-06/FR-01/NFR-03/IN-05). **Impacto:** restricción de auth congelada sin acta de aprobación; afecta al registro en Fase 1 (T03) y a la UI en Fase 3. **Reproducción:** inspección documental + `catalog.ts` línea de `password: { type: { type: 'string', min: 8, max: 128 } }`. |
| **3. Causa** | **Estado:** `DEMOSTRADA` · **Evidencia:** `backend/src/contracts/catalog.ts` (CATALOG.RegisterInput), `docs/architecture/04-api-and-component-contract.md` §2, y búsqueda sin coincidencias en las fuentes aprobadas · **Alternativas descartadas:** que provenga de configuración (no hay clave de password en `ALL_ENV_KEYS`) o del intake (no aparece en D-01…D-16). |
| **4. Solución** | **Cambios aplicados:** ninguno (el Auditor no implementa). **Motivo técnico:** la corrección exige decisión de producto, no técnica. **Intentos fallidos relevantes:** N/A. **Disposición propuesta:** que CTO/Lino confirmen el rango `8–128` y lo registren en SDD/ADR, o que se ajuste el contrato y se regenere con nuevo hash. No se concede G-10. |
| **5. Verificación** | **Verificador independiente:** `Auditor` · **Comando/procedimiento:** cruce documental de fuentes aprobadas vs. catálogo y doc 04 · **Resultado y evidencia:** ausencia confirmada en fuentes aprobadas; presente en catálogo/doc 04 · **Regresión comprobada:** N/A (hallazgo documental) · **Límites:** no se evalúa si el rango es buena práctica, solo si está escrito. |
| **6. Pendientes** | **Riesgo residual:** decisión de auth sin aprobación explícita · **Cobertura ausente:** acta de confirmación del rango · **Responsable y siguiente paso:** CTO/Lino — pronunciarse antes del cierre formal de `F01-T01`; Architect — registrar la decisión en `STATE.md`/SDD si se aprueba. |
| **7. Aprendizaje** | **Prevención propuesta:** antes de congelar, contrastar cada restricción (min/max, literales, formatos) contra el SDD aprobado y anotar las decisiones derivadas · **Ámbito candidato:** `PROPUESTA_GLOBAL` · **Estado:** `PENDIENTE_DE_EVALUAR`. |

**Severidad:** `MEDIUM` · **Confianza:** `HIGH` · **Evidencia:** `CORROBORATED` (documental directa) · **Bloqueante de auditoría:** `NO` (sí requiere pronunciamiento de CTO antes del cierre formal).

---

### Problema `A-02` — Traza del comando de instalación de `zod` no coincide con el manifiesto

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID: `A-02` · Tarea: `F01-T01` · Fase: `P-01` · Loop: `1/3` · Fecha: `2026-11-17` · Entorno: Windows / npm 11 |
| **2. Problema** | **Síntoma:** `F01-T01-developer.md` §4 registra `npm install zod@^3.24.2 …` con resultado `zod 3.25.76`. **Esperado:** el comando registrado sea reproducible desde el manifiesto/lockfile versionados. **Observado:** `backend/package.json` declara `"zod": "^3.25.76"` y `package-lock.json` fija `3.25.76` con integridad `sha512-gzUt/qt81…`. **Impacto:** solo de trazabilidad; la versión instalada satisface el rango declarado y el lockfile íntegro. **Reproducción:** comparar reporte §4 vs. `backend/package.json` línea 15 vs. `package-lock.json` entrada `node_modules/zod`. |
| **3. Causa** | **Estado:** `DEMOSTRADA` para la discrepancia textual; `HIPÓTESIS` para su origen (comando ejecutado y luego corregido, o transcripción del reporte) · **Evidencia:** tres fuentes citadas · **Alternativas descartadas:** instalación incompleta o lockfile corrupto (integridad presente y versión coherente). |
| **4. Solución** | **Cambios aplicados:** ninguno por el Auditor. **Motivo técnico:** no hay defecto funcional. **Intentos fallidos relevantes:** N/A. **Disposición propuesta:** corregir el comando anotado en el reporte a `zod@^3.25.76` (o indicar la corrección posterior) en un addendum append-only del Developer. |
| **5. Verificación** | **Verificador independiente:** `Auditor` · **Comando/procedimiento:** lectura de las tres fuentes · **Resultado y evidencia:** manifiesto y lockfile coinciden entre sí; solo el reporte difiere · **Regresión comprobada:** N/A · **Límites:** no se reconstruyó el historial de comandos (Git prohibido en este encargo). |
| **6. Pendientes** | **Riesgo residual:** traza de instalación imprecisa · **Cobertura ausente:** historial real del comando · **Responsable y siguiente paso:** Developer — addendum de trazabilidad; Architect — verificar sin reabrir la suite. |
| **7. Aprendizaje** | **Prevención propuesta:** copiar el comando exactamente desde el historial de la shell al reporte · **Ámbito candidato:** `SOLO_LOCAL` · **Estado:** `PENDIENTE_DE_EVALUAR`. |

**Severidad:** `LOW` · **Confianza:** `HIGH` (discrepancia textual) / `MEDIUM` (origen) · **Evidencia:** `CORROBORATED` · **Bloqueante de auditoría:** `NO`.

---

### Problema `A-03` — `tsx` como dependencia de desarrollo del generador de tipos

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID: `A-03` · Tarea: `F01-T01` · Fase: `P-01` · Loop: `1/3` · Fecha: `2026-11-17` · Entorno: Node 26 / npm 11 |
| **2. Problema** | **Síntoma:** el script `generate:types` ejecuta `tsx src/contracts/generate.ts` y `tsx` está en `devDependencies` del workspace backend. **Esperado:** evaluar el riesgo de la dependencia (G-8). **Observado:** `tsx 4.23.15`, `dev: true`, `resolved` registry npm e `integrity sha512-Yiex1Ovn…`, con `esbuild ~0.28.0` transitivo; el frontend no importa `tsx` y el archivo generado está versionado. **Impacto:** `generate:types` no funciona con `--omit=dev`; superficie supply-chain adicional vía `esbuild` (binario nativo), mitigada por lockfile con integridad. **Reproducción:** inspección de `backend/package.json`, script `generate:types` y entrada `node_modules/tsx` del lockfile. |
| **3. Causa** | **Estado:** `DEMOSTRADA` · **Evidencia:** manifiesto y lockfile citados · **Alternativas descartadas:** dependencia de producción (no lo es) o dependencia del frontend (no hay import). |
| **4. Solución** | **Cambios aplicados:** ninguno. **Motivo técnico:** la generación es una tarea de desarrollo y su salida está congelada y versionada; el runtime de frontend/backend no depende de `tsx`. **Intentos fallidos relevantes:** N/A. **Disposición propuesta:** mantener como `devDependency` y documentar que el generador se ejecuta solo en entornos de desarrollo/CI con dev-deps instaladas. No se registra aceptación de riesgo G-10. |
| **5. Verificación** | **Verificador independiente:** `Auditor` · **Comando/procedimiento:** inspección estática de manifiesto, script y lockfile; verificación de que la generación actual es byte-idéntica (ver §2) · **Resultado y evidencia:** riesgo bajo y confinado a desarrollo · **Regresión comprobada:** N/A · **Límites:** no se auditó el árbol transitivo completo de `esbuild` fuera del alcance de G-8. |
| **6. Pendientes** | **Riesgo residual:** dependencia de herramienta de generación solo en dev · **Cobertura ausente:** auditoría profundizada de `esbuild` · **Responsable y siguiente paso:** CTO — si se considera riesgo formal, decidir con G-10; en su defecto, seguimiento informativo. |
| **7. Aprendizaje** | **Prevención propuesta:** separar siempre herramientas de codegen en `devDependencies` y versionar la salida generada · **Ámbito candidato:** `PROPUESTA_GLOBAL` · **Estado:** `PENDIENTE_DE_EVALUAR`. |

**Severidad:** `INFO` · **Confianza:** `HIGH` · **Evidencia:** `CORROBORATED` · **Bloqueante de auditoría:** `NO`.

---

### Problema `A-04` — Anotación obsoleta en `spec.md` sobre los nombres de presets

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID: `A-04` · Tarea: `F01-T01` · Fase: `P-01` · Loop: `1/3` · Fecha: `2026-11-17` · Entorno: documental |
| **2. Problema** | **Síntoma:** `docs/sdd/spec.md` §4 mantiene `HIGH / BALANCED / MAX_COMPRESSION [PROPUESTA: nombres a confirmar en Fase 1]`. **Esperado:** el SDD refleje que los nombres quedaron congelados en Fase 1. **Observado:** los contratos fijan esos tres valores y el test los verifica; la autoridad para congelarlos existe en `F01-T01-task.md` CA-01 y `P-01` §1/§4, no en el propio `spec.md`. **Impacto:** doble lectura del SDD (propuesta vs. congelado) que puede inducir a supuestos en fases paralelas; sin impacto funcional. **Reproducción:** comparar `spec.md` §4 con `catalog.ts` (`PRESET_VALUES`) y con `04-api-and-component-contract.md` §2. |
| **3. Causa** | **Estado:** `DEMOSTRADA` · **Evidencia:** documentos citados · **Alternativas descartadas:** que el congelamiento esté fuera de alcance (no: CA-01 lo asigna explícitamente). |
| **4. Solución** | **Cambios aplicados:** ninguno; `spec.md` no está en el ámbito de escritura de T01 (pertenece al CTO). **Motivo técnico:** es una actualización documental de gobernanza, no de implementación. **Intentos fallidos relevantes:** N/A. **Disposición propuesta:** que CTO sustituya la anotación por la referencia al contrato congelado, sin cambiar el valor. |
| **5. Verificación** | **Verificador independiente:** `Auditor` · **Comando/procedimiento:** cruce de `spec.md`, paquete `P-01`, contrato de tarea y catálogo · **Resultado y evidencia:** congelamiento autorizado; anotación no actualizada · **Regresión comprobada:** N/A · **Límites:** no se juzga el nombre de los presets, solo la traza documental. |
| **6. Pendientes** | **Riesgo residual:** desincronización documental leve · **Cobertura ausente:** actualización de `spec.md` · **Responsable y siguiente paso:** CTO — actualizar la anotación en la próxima consolidación del SDD. |
| **7. Aprendizaje** | **Prevención propuesta:** cuando un contrato congela un valor marcado como «PROPUESTA», actualizar la marca en la misma iteración de gobernanza · **Ámbito candidato:** `PROPUESTA_GLOBAL` · **Estado:** `PENDIENTE_DE_EVALUAR`. |

**Severidad:** `LOW` · **Confianza:** `HIGH` · **Evidencia:** `CORROBORATED` · **Bloqueante de auditoría:** `NO`.

---

## 2. Verificaciones sin hallazgo (evidencia de cobertura)

| # | Verificación | Resultado | Clasificación |
|---|---|---|---|
| V-1 | Hash `5d0082f8d97e0329862739123b7599c75ff7261834430039fa6e815bf68d626d` documentado en `04-*.md` §cabecera y en la cabecera de `types.generated.ts`. | Coincide en ambas fuentes. | `REPRODUCED` |
| V-2 | Recálculo independiente del hash del catálogo y comparación byte a byte de la generación. | `catalogHash()` devuelve el mismo valor; `generateTypes()` === contenido del archivo (`byte_identical=true`); versión `1.0.0`. Sin escritura de archivos. | `REPRODUCED` |
| V-3 | 14 contratos y nombres declarados vs. catálogo vs. doc 04 vs. archivo generado. | 14/14, mismos nombres: `RegisterInput`, `LoginInput`, `RefreshInput`, `TokenPair`, `AuthenticatedUser`, `Preset`, `JobStatus`, `OutputFormat`, `ImageRecord`, `JobMetrics`, `Job`, `LimitsConfig`, `AwsTransport`, `RetentionPolicy`. | `REPRODUCED` |
| V-4 | Segunda fuente de tipos en el frontend. | No hay redefiniciones ni imports desde `backend/` en `frontend/src/**` fuera del archivo generado. | `REPRODUCED` |
| V-5 | Decisiones SDD reflejadas: presets, 5 estados, `webp`/`avif`, `userId` obligatorio, ahorro 0/negativo, TTL 30 d, sin `:9324`, `AWS_ENDPOINT_URL` como transporte. | Todas presentes en catálogo/esquemas/doc 04 y cubiertas por `tests/unit/contracts.test.ts` (revisión estática, sin reejecutar la suite). | `CORROBORATED` |
| V-6 | G-3: secretos reales en esquemas, tests, evidencia y documentación. | Solo marcadores (`REPLACE_WITH_LOCAL_DEV_SECRET`), cuenta dummy `000000000000` y endpoint de emulador; sin patrones `AKIA`/JWT/llaves privadas. `:9324` aparece únicamente como valor rechazado. | `REPRODUCED` |
| V-7 | G-8: `zod`/`tsx` y script `generate:types` declarados con integridad en lockfile. | Presentes; `zod 3.25.76` y `tsx 4.23.15` con `resolved` e `integrity` SHA-512. Detalle A-02. | `REPRODUCED` |
| V-8 | `package.json` raíz no modificado fuera del script `seed` (propiedad de T04). | El manifiesto raíz conserva solo los scripts de F00-T02 (`dev:*`, `build`, `typecheck`, `lint`, `test:unit`) y no contiene `seed`, `zod` ni `tsx`. Como no se pudo usar Git, la afirmación es de contenido, no de historial. | `CORROBORATED` |
| V-9 | Documentación técnica `04-*.md`: contratos, versionado y reglas de uso sin rutas Windows ni secretos. | Cumple; usa `<PROJECT_ROOT>`; describe generación, congelación y superficie entre componentes. | `REPRODUCED` |
| V-10 | Riesgo P4: nuevas rutas locales en artefactos G-6b. | Sin coincidencias de rutas `X:\` en `backend/src/contracts/**`, `tests/unit/contracts.test.ts`, archivo generado, doc 04 ni `reports/implementation/F01/**` (incluida `evidence/`). | `REPRODUCED` |

---

## 3. Conclusión y disposición

**`READY_WITH_CONCERNS`.** No hay hallazgos `CRITICAL`/`HIGH` ni bloqueantes de auditoría. La congelación y la trazabilidad del catálogo están demostradas (hash recalculado de forma independiente, generación byte-idéntica, 14 contratos coherentes, sin segunda fuente de tipos en el frontend). G-3, G-8 y la documentación técnica cumplen; el riesgo P4 no se amplía.

**Concerns para Architect/CTO:**
1. `A-01` (MEDIUM): decide y registra la política de longitud de contraseña antes del cierre formal de `F01-T01`. No se ha aceptado riesgo por Lino (sin G-10).
2. `A-04` (LOW): actualizar la anotación "PROPUESTA" de `spec.md` §4 en la próxima consolidación del SDD.
3. `A-02`/`A-03` (LOW/INFO): addendum de trazabilidad del comando `zod` y seguimiento informativo de `tsx` como dependencia de desarrollo.

**Cobertura y límites:** `SUFFICIENT` para el alcance asignado; `LIMITED` para historial Git (prohibido por el encargo) y para la suite funcional (competencia del Tester). No se ejecutaron `vitest`, `typecheck` ni `lint` propios; las verificaciones V-1…V-10 son de inspección estática y recálculo del hash, sin modificar archivos del proyecto.

**Registro:** append-only. Addenda futuras se agregan aquí sin borrar estos hallazgos.

---

## Addendum A — Decisión de CTO/Lino sobre `A-01` (2026-11-17)

> Append-only: este addendum cierra `A-01` sin modificar el hallazgo original ni las verificaciones V-1…V-10. No se ha ejecutado código, usado Git/Docker/AWS ni aceptado riesgo por Lino.

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID: `A-01` (cierre) · Tarea: `F01-T01` · Fase: `P-01` · Addendum: `A` · Loop: `1/3` · Fecha: `2026-11-17` · Autoridad: CTO/Lino |
| **2. Problema** | **Síntoma:** el hallazgo `A-01` registró que el rango `8–128` de `RegisterInput.password` carecía de respaldo en fuentes aprobadas. **Esperado:** decisión expresa de la autoridad antes del cierre formal. **Observado:** CTO/Lino aprobaron el rango `8–128` tal como está implementado. **Impacto:** se disipa la única objeción PR-06; sin cambios de código. **Reproducción:** acta de decisión de CTO/Lino de fecha 2026-11-17 (esta misma sesión). |
| **3. Causa** | **Estado:** `DEMOSTRADA` · **Evidencia:** decisión expresa de CTO/Lino comunicada al Auditor · **Alternativas descartadas:** modificar el catálogo o regenerar tipos (innecesario: la decisión confirma el valor congelado). |
| **4. Solución** | **Cambios aplicados:** ninguno en código; solo este addendum documental. **Motivo técnico:** la aprobación convalida el valor ya congelado; el catálogo y su hash `5d0082f8d97e0329862739123b7599c75ff7261834430039fa6e815bf68d626d` se mantienen intactos, así como `types.generated.ts` (byte-idéntico, ver V-2). **Intentos fallidos relevantes:** N/A. |
| **5. Verificación** | **Verificador independiente:** `Auditor` · **Comando/procedimiento:** confirmación de que no se solicitó regeneración ni cambio de manifiesto; contraste con V-1/V-2 · **Resultado y evidencia:** `A-01 CERRADO`; PR-06 **satisfecho**; **no es G-10** (no se acepta un riesgo, se aprueba una decisión de producto). **Regresión comprobada:** no aplica (sin cambio de código). **Límites:** el hash no se recalculó de nuevo porque el catálogo no se tocó. |
| **6. Pendientes** | **Riesgo residual:** ninguno para `A-01` · **Cobertura ausente:** N/A en el alcance del Auditor · **Responsable y siguiente paso:** Architect — registrar el cierre en `STATE.md`/`tasks.md` al consolidar `F01-T01`. |
| **7. Aprendizaje** | **Prevención propuesta:** toda restricción congelada sin acta previa debe resolverse con una decisión escrita antes del cierre (ya aplicado en este caso) · **Ámbito candidato:** `PROPUESTA_GLOBAL` · **Estado:** `PENDIENTE_DE_EVALUAR`. |

### Estado actualizado de los hallazgos

| ID | Estado tras el addendum | Observación |
|---|---|---|
| `A-01` | **`CERRADO`** | Decisión expresa de CTO/Lino (2026-11-17). No es G-10; PR-06 satisfecho. Sin cambios de código; catálogo y hash inalterados. |
| `A-02` | **`ABIERTO — LOW, no bloqueante`** | Inconsistencia documental menor en la versión de `zod` citada en el reporte del Developer (`^3.24.2` vs. manifiesto `^3.25.76`). Sin impacto funcional; no bloquea. |
| `A-03` | **`ABIERTO — INFO, no bloqueante`** | `tsx` queda documentado como `devDependency` del generador. **No aceptado en nombre de Lino** (sin G-10). Seguimiento informativo. |
| `A-04` | **`ABIERTO — LOW, no bloqueante`** | `docs/sdd/spec.md` no está en el ámbito de escritura de `F01-T01`. Se recomienda al CTO corregir la etiqueta «PROPUESTA» de los presets en la próxima consolidación del SDD. |

### Conclusión final actualizada

Tras la decisión de CTO/Lino sobre `A-01`, **no quedan bloqueantes de auditoría para cerrar `F01-T01`**. Se mantiene la conclusión **`READY_WITH_CONCERNS`** (ahora sin el concern PR-06): los tres hallazgos restantes son de severidad `LOW`/`INFO`, documentales y no bloqueantes. La congelación, el hash y la generación byte-idéntica siguen vigentes; G-3, G-8 y el riesgo P4 permanecen conformes.

**Este addendum no emite `PASSED`/`NO-PASSED`**: el dictamen funcional sigue siendo competencia exclusiva del Tester. No se ha aceptado riesgo en nombre de Lino; la resolución de `A-01` fue una aprobación de decisión de producto, no una dispensa G-10.
