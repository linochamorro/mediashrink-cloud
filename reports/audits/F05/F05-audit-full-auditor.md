# Auditoría estática de endurecimiento — `F05-AUDIT-FULL`

| Campo | Valor |
|---|---|
| **Fecha / rol** | `2026-11-19` · Auditor (riesgo 3, auditoría estática de cambio) |
| **Fase / tarea** | Fase Final `P-05` · `F05-AUDIT-FULL` · adendum correctivo |
| **Alcance material** | `HEAD 6804f28` y dos instantáneas del árbol de trabajo: corte inicial y revalidación final |
| **Método** | Inspección estática de código, tests, contratos, configuración y metadatos Git; escaneos de secretos y rutas; **sin ejecutar suites** |
| **Conclusión** | **`NOT_READY`** |
| **Gate de push** | **CERRADO** — no debe abrirse mientras persista la fuga P4 |
| **Cobertura** | **`SUFFICIENT`** para el análisis estático del cambio · **`LIMITED`** para firma SigV4, Claim Check real, rate limiting observado, E2E, CI y despliegue |
| **Recuento propio** | **6 hallazgos: 0 `CRITICAL` · 0 `HIGH` · 2 `MEDIUM` · 3 `LOW` · 1 `INFO`** |
| **Hallazgo heredado relevante** | **1 `MEDIUM`** (`F02-T01 A-03`, cubo global de autenticación), no introducido por este cambio |
| **P4 en el baseline versionado** | **11 ubicaciones con fuga en 8 archivos; 14 valores de ruta absoluta** |
| **Revalidación P4 del worktree** | **0** en archivos versionados y publicables no versionados; la remediación concurrente aún no está ligada a un commit candidato inmutable |
| **Secretos reales** | **0** |
| **G-10** | **NO invocado** — ningún riesgo se registra como aceptado en nombre de Lino |

> **Frontera respetada:** este Auditor no implementó correcciones, no modificó `backend/`, `frontend/`, `infra/` ni `tests/`, no ejecutó pruebas unitarias, de integración o E2E, no usó Docker/AWS, no hizo commit, push ni `docker compose down`, y no emitió el dictamen funcional `PASSED`/`NO-PASSED` del Tester. Escribe únicamente este informe. No reproduce rutas absolutas del host, secretos, cookies, tokens ni valores de entornos locales.

---

## 1. Dictamen ejecutivo

**`NOT_READY`.** El endurecimiento de código es sustancial: el relay S3 queda limitado al servidor de desarrollo y a un destino fijo, exige CA y filtra cabeceras; la reescritura de URL ocurre después de validar HTTPS y host; la persistencia de `name` es retrocompatible; y el sobre ligero de Claim Check tiene una ruta de recuperación desde S3.

El bloqueo determinante es, sin embargo, independiente de esa mejora: el baseline versionado en `HEAD 6804f28` contiene **11 ubicaciones P4 en ocho archivos**, con **14 valores absolutos**. El criterio de STOP de `F05-AUDIT-FULL` obliga a no publicar ante una fuga P4, aunque su impacto técnico sea `LOW`.

La matriz de los **ocho identificadores de regresión** queda en **8 `PASS` estáticos**:

1. **M-05 / Claim Check — `PASS` estático:** el umbral, el sobre ligero y la recuperación desde S3 están implementados. La validación heterogénea de segmentos en esa recuperación se registra como preocupación independiente (`F05-AF-AUD-02`), sin presentarla como un fallo funcional no demostrado.
2. **M-01, M-02, M-04, M-06 y UX-01…UX-03 — `PASS` estático:** la implementación satisface el invariante específico de cada punto. Los riesgos residuales de M-04 y M-06 se registran por separado y no se ocultan dentro de ese `PASS`.

Además, la higiene de `CA-06` es **`FAIL` por P4** en el baseline y activa por sí sola el STOP. La separación es deliberada: los ocho invariantes de regresión quedan satisfechos estáticamente, mientras el criterio de higiene independiente sigue incumplido.

Durante la redacción del dictamen aparecieron en el árbol de trabajo modificaciones concurrentes que sustituyen los ocho archivos con fuga. Una revalidación estática posterior encontró **0 rutas P4** en el conjunto versionado y en los archivos publicables no versionados. Esa remediación mutable todavía no está ligada a un commit candidato y, por tanto, no cierra formalmente `F05-AF-AUD-01` ni autoriza abrir el gate de push.

No hay `CRITICAL` ni `HIGH` **propios** de este dictamen. Esto no abre el gate: una fuga P4 lo bloquea aunque su impacto técnico sea `LOW`. Los dos `HIGH` heredados de dependencias ya inventariados en `F05-H01` no se cuentan como hallazgos propios, pero siguen exigiendo cierre antes de `G-12`.

## 2. Alcance, fuentes y método

### 2.1 Fuentes leídas

- `AGENTS.md`, `STATE.md`, `.agents/roles/auditor.md`, `docs/sdd/constitution.md`, `docs/sdd/spec.md`, `docs/sdd/plan.md`, `docs/sdd/tasks.md` y `docs/sdd/packages/P-05-final-integration-and-delivery.md`.
- `reports/implementation/F05/F05-AUDIT-FULL-task.md`, en especial `CA-01`…`CA-07` y el criterio de STOP.
- Auditorías previas `reports/audits/F05/F05-T02-auditor.md` y `reports/audits/F05/F05-H01-auditor.md`; inventario heredado de `F02-T01 A-03`.
- Código actual de `backend/src/{api,auth,config,contracts,db,storage,worker}/**`, `backend/src/server.ts`, `frontend/src/**`, `frontend/vite.config.ts`, `.env.example`, `.gitignore` y tests permanentes nuevos o afectados.
- Metadatos Git de solo lectura: `HEAD`, `status`, `diff`, `ls-files`, `check-ignore` y `diff --check`.

### 2.2 Comprobaciones estáticas realizadas

- Lectura de los puntos de entrada y de sus consumidores: API, presign, descarga, almacenamiento, publicador, consumidor SQS, persistencia y render React.
- Contraste de invariantes entre capas: allowlist de URL, destino del relay, cabeceras firmadas, claves S3, IDs DynamoDB, límites de entorno y contrato generado.
- Escaneo de patrones de credenciales (`AKIA`/`ASIA`, JWT, tokens GitHub y material de clave privada) sobre código, tests, documentación y reportes.
- Escaneo P4 de rutas absolutas del host con separadores de barras inclinadas y invertidas, y clasificación separada de rutas deterministas del contenedor, CI y fixtures sintéticos.
- Inventario de archivos versionados y comprobación de las reglas de exclusión de entornos, credenciales efímeras, Terraform y `temporary/`.

No se ejecutó código de producto ni se repitieron resultados de ejecución ajenos; las cifras de ejecución existentes se tratan como `CORROBORATED`, no como `REPRODUCED` por este Auditor.

## 3. Matriz de los ocho puntos de regresión

> Criterio: `PASS` significa que el invariante específico del punto está satisfecho en el estado inspeccionado. Una preocupación de endurecimiento se registra aparte salvo que contradiga directamente ese invariante; no se convierte en un fallo funcional no demostrado. Los riesgos heredados o las posibilidades de configuración también se registran como hallazgos separados.

| # | Punto | Veredicto | Evidencia propia y criterio |
|---|---|---|---|
| 1 | **M-01 — carga de `.env` desde raíz o subdirectorio** | **PASS** | `backend/src/server.ts:28-59` busca el archivo desde el cwd, el nivel superior y la raíz del módulo; no pisa variables ya presentes y resuelve las rutas relativas de entorno contra el directorio del `.env`. La cobertura está en `tests/unit/f05-audit-full.test.ts:36-62`; no se repitieron los tests. |
| 2 | **M-02 — secretos locales frente a credenciales reales** | **PASS** | `backend/src/config/index.ts:103-118,153-178` conserva patrones AWS, JWT y GitHub, acepta placeholders y cadenas locales aleatorias, y el error identifica el tipo sin imprimir el valor. Cobertura estática en `tests/unit/f05-audit-full.test.ts:64-85`; residual informativo en `F05-AF-AUD-07`. |
| 3 | **M-04 — relay S3 solo para emulador o desarrollo** | **PASS** | `frontend/vite.config.ts:69-147` usa `apply: 'serve'`, destino fijo, métodos cerrados, CA obligatoria con TLS fail-closed y allowlist de cabeceras; `frontend/src/api/jobs.ts:71-99` limita protocolo, host y puerto exactos. Residual `LOW` en `F05-AF-AUD-06`; la compatibilidad de firma queda para verificación dinámica. |
| 4 | **M-05 — Claim Check y sobre sin contenido** | **PASS** | El umbral y el sobre ligero están en `backend/src/api/enriched-publisher.ts:137-153`; el consumidor recupera desde S3 en `backend/src/worker/consumer.ts:181-193`. La recuperación concatena la clave directamente y no reutiliza la allowlist de segmentos; esa preocupación independiente se registra en `F05-AF-AUD-02`, pero no contradice el invariante estático de Claim Check ni demuestra un fallo funcional. |
| 5 | **M-06 — rate limits de autenticación y API separados** | **PASS** | `backend/src/config/index.ts:319-323` separa los máximos, `backend/src/api/app.ts:59-84` construye limitadores distintos y la API consume el `userId` firmado. El cubo global de autenticación heredado y la ventana compartida se registran aparte en `F05-AF-AUD-04` y `F05-AF-AUD-05`. |
| 6 | **UX-01 — fecha, hora y orden descendente** | **PASS** | `frontend/src/App.tsx:219` ordena por `createdAt` descendente y renderiza fecha y hora en locale español con día, mes, año, hora y minuto. |
| 7 | **UX-02 — nombre opcional, saneado y visible** | **PASS** | Input opcional y acotado en `frontend/src/App.tsx:21,134,213`; saneado y límite en `backend/src/api/jobs.ts:82-89,120-121`; persistencia e hidratación en `backend/src/db/job-store.ts:55-76`, `backend/src/api/job-list-store.ts:24-38,58-65` y `backend/src/api/job-transition.ts:50-56`; React lo muestra como texto con fallback en `App.tsx:219,223`. El drift de gobernanza del contrato se trata en `F05-AF-AUD-03`. |
| 8 | **UX-03 — ZIP solo en `COMPLETED` o `PARTIAL`** | **PASS** | `frontend/src/App.tsx:219` calcula `canZip` con exactamente esos dos estados y deshabilita el botón fuera de ellos. |

**Totales de los ocho identificadores:** **8 `PASS` estáticos · 0 `FAIL`**. **Gate adicional `CA-06`/higiene:** **`FAIL` por P4**.

## 4. Hallazgos — siete campos obligatorios

### `F05-AF-AUD-01` — P4: once ubicaciones con rutas absolutas del host en artefactos versionados

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID: `F05-AF-AUD-01` · Tarea: `F05-AUDIT-FULL` · Fase: `P-05` · Loop: `1/3` · Fecha: `2026-11-19` · Entorno: inspección estática y escaneo del índice Git. **Severidad técnica:** `LOW` · **Confianza:** `ALTA` · **Evidencia:** `REPRODUCED` · **Bloqueante de gate:** **SÍ**, por el criterio de STOP P4 |
| **2. Problema** | **Síntoma:** el baseline versionado en `HEAD 6804f28` volvió a incluir rutas absolutas del host en contratos de tarea y evidencias de F05. **Esperado:** `0` rutas absolutas del host en artefactos públicos bajo G-6b. **Observado en el baseline:** **11 ubicaciones con fuga en 8 archivos versionados y 14 valores absolutos**. Son 6 ubicaciones en 5 archivos con directorios de herramientas y 5 ubicaciones adicionales en 3 encabezados de Vitest que contienen la raíz del proyecto con separador inclinado. Archivos: `reports/implementation/F05/F05-H01-task.md:19`; `F05-QA-roadmap-task.md:29`; `F05-T05-task.md:19`; `evidence/F05-H01-loop3-ci-sim.txt:2`; `evidence/F05-H01-loop3-suite.txt:39,89`; `evidence/F05-H01-tester-loop2-suite.txt:35,86`; `evidence/F05-T05-emulator-down.txt:5`; `evidence/F05-T05-integration.txt:5,8`. Los valores se sustituyen aquí por marcadores y no se reproducen. **Impacto:** divulgan metadatos locales y reiteran el incumplimiento P4; no contienen credenciales. La repetición en contratos y evidencias visibles hace la fuga material para el gate, aunque el impacto técnico sea bajo. **Reproducción:** escaneo propio sobre el índice versionado con ambos separadores de ruta. |
| **3. Causa** | **Estado:** `DEMOSTRADA`. **Evidencia:** las rutas se introdujeron en `978096b` y `8814233`, después de la normalización P4 registrada en `F05-T02`; no se aplicó saneamiento al capturar esos contratos y evidencias. Un barrido limitado a separadores invertidos no detecta los cinco encabezados con separador inclinado. **Alternativas descartadas:** (a) rutas deterministas del contenedor contadas como P4 — descartado, son fijas y no describen el host; (b) fixtures sintéticos contados como fuga — descartado; (c) rutas ausentes del índice actual — descartado, los ocho archivos están versionados. |
| **4. Solución** | **Cambios aplicados por este Auditor:** ninguno. **Remediación concurrente observada:** el árbol de trabajo sustituye las rutas por marcadores en los ocho archivos señalados. **Motivo técnico:** sustituir los valores de herramientas por `<DOCKER_CLI_DIR>` y `<TF_CLI_DIR>`, y las raíces de proyecto por `<PROJECT_ROOT>`, preserva el significado de la evidencia y cumple la anonimización. **Disposición recomendada (NO aceptación):** Developer/Architect liga la remediación a un commit candidato, repite el escaneo con ambos separadores sobre el conjunto publicable de ese commit y decide por separado con CTO cualquier tratamiento del historial ya público. **Sin G-10.** |
| **5. Verificación** | **Verificador independiente:** Auditor (estática). **Procedimiento:** `git ls-files` más escaneo P4 de rutas del host sobre `reports/`, `docs/`, `README.md`, `STATE.md`, código y tests; revalidación del árbol de trabajo y de los archivos publicables no versionados. **Resultado en `HEAD 6804f28`:** **11 ubicaciones / 8 archivos / 14 valores**. **Resultado en la revalidación final del worktree:** **0 ubicaciones / 0 archivos / 0 valores** en el conjunto publicable inspeccionado. Las **146 coincidencias POSIX en 49 archivos** del baseline corresponden al emulador, al entorno de CI o a referencias genéricas documentadas; son deterministas y no son fugas del host. Las dos menciones textuales de una unidad de entorno en reportes tampoco son rutas. **Regresión comprobada:** el riesgo original fue reescaneado tras la remediación concurrente; no existe todavía commit candidato inmutable al que ligar el resultado. **Límites:** no se inspeccionaron valores fuera del repositorio ni secretos en memoria. |
| **6. Pendientes** | **Riesgo residual:** metadatos del host permanecen visibles en el baseline y en el historial ya publicado, aunque el worktree prospectivo presenta `0` coincidencias. **Cobertura ausente:** vínculo verificable con un commit candidato y decisión de historial. **Responsable y siguiente paso:** Developer/Architect; **push bloqueado** hasta cerrar formalmente la revalidación P4 y las demás condiciones de este dictamen. |
| **7. Aprendizaje** | **Prevención propuesta:** aplicar normalización P4 al generar contratos y evidencia, no como barrido posterior; añadir al checklist previo de cada push un escaneo que cubra ambos separadores. **Ámbito candidato:** `PROPUESTA_GLOBAL` · **Estado:** `PENDIENTE_DE_EVALUAR` |

### `F05-AF-AUD-02` — Claim Check: la nueva lectura S3 no valida IDs como segmentos seguros

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID: `F05-AF-AUD-02` · Tarea: `F05-AUDIT-FULL` · Fecha: `2026-11-19` · Entorno: inspección estática. **Severidad:** `MEDIUM` · **Confianza:** `ALTA` para el hueco / `MEDIA` para explotación cruzada · **Evidencia:** `REPRODUCED` (ruta de código); impacto dinámico `INDICATIVE` · **Bloqueante por severidad:** no · **Relación con la matriz:** preocupación independiente de M-05 |
| **2. Problema** | **Síntoma:** el Claim Check permite omitir `contentBase64`; el worker construye entonces una clave S3 a partir de `userId`, `jobId` e `imageId` presentes en el mensaje. **Esperado:** toda identidad que forme una clave S3 debe superar la allowlist estricta de segmentos ya usada por la capa de almacenamiento. **Observado:** `backend/src/worker/messages.ts:52-63` solo exige una cadena no vacía sin `#` mediante `assertOpaqueId`; admite `/`, `..`, barras invertidas y segmentos de ruta. `backend/src/worker/consumer.ts:185-190` concatena esos valores directamente en `rawKey`, sin `assertSafeKeySegment` ni `rawImageKey`. El error de `consumer.ts:190` incluye además la clave completa. **Impacto:** un sobre malformado o un productor de cola comprometido puede dirigir el `GetObject` a una clave no canónica; según cómo normalice el endpoint, esto podría apartarse del prefijo esperado. La precondición de job existente y la semántica literal de claves S3 reducen la explotabilidad, por lo que no se demuestra cruce entre usuarios. **Reproducción:** lectura de `messages.ts`, `consumer.ts`, `storage/keys.ts:31-53` y `storage/objects.ts:253-269`. |
| **3. Causa** | **Estado:** `DEMOSTRADA` para la validación heterogénea. **Evidencia:** el parser de transporte reutiliza la regla opaca de la capa DynamoDB (`assertOpaqueId`), mientras el productor enriquido usa `assertSafeKeySegment`; el nuevo consumidor saltó la segunda regla al crear una clave de almacenamiento. **Alternativas descartadas:** (a) que `assertOpaqueId` valide rutas — descartado, solo excluye `#`; (b) que la precondición de job haga innecesaria la validación — descartado, no valida `imageId`; (c) clasificarlo como `HIGH` entre usuarios — descartado por falta de reproducción y por las precondiciones existentes. |
| **4. Solución** | **Cambios aplicados:** ninguno por este Auditor. **Motivo técnico:** validar los tres segmentos y construir la clave con `rawImageKey` reutiliza una única invariante; el error de objeto ausente debe ser genérico. **Disposición recomendada (NO aceptación):** Developer añade la validación y tests negativos para cada ID; Tester verifica Claim Check real y recuperación. **Sin G-10.** |
| **5. Verificación** | **Verificador independiente:** Auditor (estática). **Procedimiento:** contraste de parser, consumidor y helpers de claves; no se ejecutó SQS/S3. **Resultado:** hueco reproducido estáticamente; `tests/unit/f05-audit-full.test.ts:107-129` cubre solo ausencia o presencia de contenido base64. **Regresión comprobada:** N/A. **Límites:** no se probó normalización de ruta en el emulador ni un sobre malicioso; no se afirma explotación. |
| **6. Pendientes** | **Riesgo residual:** `MEDIUM` hasta unificar la invariante. **Cobertura ausente:** mensajes con IDs no canónicos y recuperación real desde S3. **Responsable y siguiente paso:** Developer/Tester antes de la publicación. |
| **7. Aprendizaje** | **Prevención propuesta:** cada frontera que convierte identidad en clave debe reutilizar el constructor y validador canónicos, no una regla adyacente más débil. **Ámbito candidato:** `PROPUESTA_GLOBAL` · **Estado:** `PENDIENTE_DE_EVALUAR` |

### `F05-AF-AUD-03` — El contrato “congelado” cambia de hash y versión, pero la gobernanza documental conserva el estado anterior

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID: `F05-AF-AUD-03` · Tarea: `F05-AUDIT-FULL` · Fecha: `2026-11-19` · Entorno: contraste estático de contratos, tipos generados, SDD y arquitectura. **Severidad:** `MEDIUM` (gobernanza y trazabilidad, sin impacto de ejecución demostrado) · **Confianza:** `ALTA` · **Evidencia:** `REPRODUCED` · **Bloqueante por STOP:** no |
| **2. Problema** | **Síntoma:** el commit `6804f28` añadió el campo opcional `name` al contrato `Job` y regeneró los tipos, pero no actualizó el control de cambios congelado. **Esperado:** cualquier alteración del catálogo exige versión o hash aprobado, regeneración y actualización documental coherente. **Observado:** `backend/src/contracts/catalog.ts:15` conserva la versión `1.0.0`; `:237` añade `name`; el hash pasó del valor histórico `5d0082f8…` a `110ddd82…`; `frontend/src/api/types.generated.ts:4,71` está sincronizado con el nuevo hash. En cambio, `docs/architecture/04-api-and-component-contract.md:3`, `docs/architecture/03-data-model-and-storage-contract.md:11`, `docs/sdd/tasks.md:53` y auditorías F05-H01 siguen citando el hash anterior. `tests/unit/contracts.test.ts:329-331` prueba autogeneración y consistencia interna, no que el hash siga siendo el aprobado. **Impacto:** el runtime es retrocompatible porque `name` es opcional, pero la fuente de verdad documental queda desalineada y se rompe la trazabilidad del cambio. **Reproducción:** comparación de los archivos citados. |
| **3. Causa** | **Estado:** `DEMOSTRADA` como drift documental; el uso exacto del addendum correctivo debe ser confirmado por CTO. **Evidencia:** el campo se añadió para satisfacer `CA-01`, pero no hubo una sección de control de cambios que actualizara versión, hash y referencias. **Alternativas descartadas:** (a) archivo generado obsoleto — descartado, su hash coincide con el catálogo actual; (b) hash nuevo inválido — descartado, el generador es determinista; (c) runtime incompatible — descartado por opcionalidad y compatibilidad con lotes sin `name`. |
| **4. Solución** | **Cambios aplicados:** ninguno por este Auditor. **Motivo técnico:** el control de cambios debe registrar si el addendum autorizaba la extensión y elegir entre una versión menor explícita o una excepción formalmente aprobada; después se actualizan hash, arquitectura, tasks y referencias de auditoría. **Disposición recomendada (NO aceptación):** CTO/Architect decide la semántica de versión y Developer/Architect sincroniza la documentación y añade una guardia del hash aprobado. **Sin G-10.** |
| **5. Verificación** | **Verificador independiente:** Auditor (estática). **Procedimiento:** `git show` del commit, lectura del catálogo y de los tipos generados y búsqueda del hash histórico en documentación y reportes; no se regeneró el archivo. **Resultado:** drift confirmado; el cambio funcional de `name` está sincronizado, la gobernanza no. **Regresión comprobada:** autogeneración documentada en tests, no repetida. **Límites:** no se determina la intención final del versionado; corresponde al CTO. |
| **6. Pendientes** | **Riesgo residual:** `MEDIUM` de trazabilidad. **Cobertura ausente:** decisión de control de cambios y hash aprobado. **Responsable y siguiente paso:** CTO/Architect antes de `G-12`; no se acepta el drift. |
| **7. Aprendizaje** | **Prevención propuesta:** una prueba de sincronía debe contrastar el hash actual con un manifiesto aprobado, no solo consigo mismo. **Ámbito candidato:** `PROPUESTA_GLOBAL` · **Estado:** `PENDIENTE_DE_EVALUAR` |

### `F05-AF-AUD-04` — Heredado `F02-T01 A-03`: el límite de autenticación sigue siendo un cubo global

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID: `F05-AF-AUD-04` (heredado `F02-T01 A-03`) · Tarea: `F05-AUDIT-FULL` · Fecha: `2026-11-19` · Entorno: inspección estática. **Severidad:** `MEDIUM` **heredada**, no propia · **Confianza:** `ALTA` · **Evidencia:** `REPRODUCED` |
| **2. Problema** | **Síntoma:** el limitador de autenticación no es suplantable por cabeceras, pero todas las rutas de autenticación comparten el mismo principal. **Esperado:** límite por cliente de confianza sin permitir agotamiento global. **Observado:** `backend/src/api/rate-limit.ts:15-35` fuerza el principal anónimo; `backend/src/api/app.ts:114-116` lo aplica a todo el prefijo de autenticación; `backend/src/auth/routes.ts:23-35` descarta la clave de proxy. **Impacto:** un cliente puede agotar el cupo global y bloquear register, login y refresh de todos; no hay evasión por cabeceras ni escalada de privilegios. Además, el limitador es por proceso. **Reproducción:** lectura de los tres archivos y contraste con `reports/audits/F02/F02-T01-auditor.md` A-03. |
| **3. Causa** | **Estado:** `DEMOSTRADA`. **Evidencia:** el seguimiento A-03 fue derivado a F05, pero el wiring final conservó el principal fijo. **Alternativas descartadas:** (a) suplantación por `x-forwarded-for` — descartada, la clave se ignora; (b) bucket por usuario autenticado — descartada, la autenticación es preautenticación; (c) riesgo aceptado — descartado, no existe G-10. |
| **4. Solución** | **Cambios aplicados:** ninguno por este Auditor. **Motivo técnico:** un principal derivado de un proxy explícitamente confiable, o un limitador compartido/distribuido, conserva la no suplantación y evita el agotamiento global. **Disposición recomendada (NO aceptación):** Architect/CTO define el wiring de confianza y una estrategia por proceso o múltiples instancias; Tester prueba agotamiento aislado. **Sin G-10.** |
| **5. Verificación** | **Verificador independiente:** Auditor (estática). **Procedimiento:** inspección del wiring y del test existente de no suplantación; no se ejecutó carga. **Resultado:** no suplantación corroborada; aislamiento entre clientes no acreditado y no implementado por principal fijo. **Regresión comprobada:** N/A. **Límites:** no se midió el impacto en una topología multiproceso. |
| **6. Pendientes** | **Riesgo residual:** `MEDIUM` heredado. **Cobertura ausente:** prueba de dos clientes y diseño multiproceso. **Responsable y siguiente paso:** Architect/CTO antes de publicación; no se acepta el riesgo. |
| **7. Aprendizaje** | **Prevención propuesta:** anti-suplantación y aislamiento de cuota deben diseñarse juntos; fail-closed no debe degradar a un bucket compartido único. **Ámbito candidato:** `PROPUESTA_GLOBAL` · **Estado:** `PENDIENTE_DE_EVALUAR` |

### `F05-AF-AUD-05` — El límite de API hereda la ventana configurable de autenticación

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID: `F05-AF-AUD-05` · Tarea: `F05-AUDIT-FULL` · Fecha: `2026-11-19` · **Severidad:** `LOW` · **Confianza:** `ALTA` · **Evidencia:** `REPRODUCED` |
| **2. Problema** | **Síntoma:** el máximo de API se separó del máximo de autenticación, pero no su ventana. **Esperado:** una ventana de API propia, con semántica estable por minuto. **Observado:** `backend/src/config/index.ts:34,319-323` solo expone la ventana de autenticación y el máximo de API; `backend/src/api/app.ts:63-84` pasa esa misma ventana a los limitadores de API. **Impacto:** con la ventana predeterminada se cumple la semántica requerida; si se cambia la ventana de autenticación, el mismo cambio altera silenciosamente la frecuencia efectiva de API y puede endurecerla o debilitarla. **Reproducción:** lectura de configuración y wiring. |
| **3. Causa** | **Estado:** `DEMOSTRADA`. **Evidencia:** no existe una propiedad ni variable de entorno específica para la ventana de API en `backend/src/**`. **Alternativas descartadas:** (a) reutilización intencional documentada — descartada, no hay invariante ni nombre explícito; (b) el máximo por minuto sigue fijo al cambiar la ventana — descartada, la ventana es la unidad del contador. |
| **4. Solución** | **Cambios aplicados:** ninguno por este Auditor. **Motivo técnico:** separar la ventana de API de la de autenticación hace auditable la semántica por minuto. **Disposición recomendada (NO aceptación):** Developer añade la variable y un test de independencia, manteniendo el comportamiento predeterminado durante la transición. **Sin G-10.** |
| **5. Verificación** | Auditor estático; `tests/unit/f05-audit-full.test.ts:132-143` cubre solo los máximos predeterminados y su independencia, no el cambio de ventana. No se ejecutaron tests. |
| **6. Pendientes** | Riesgo residual `LOW`; responsable Developer/Tester; cobertura ausente para ventanas no predeterminadas. |
| **7. Aprendizaje** | **Prevención propuesta:** cada cubo de cuota debe tener máximo y ventana explícitos, especialmente cuando los límites tienen consumos distintos. **Ámbito candidato:** `PROPUESTA_GLOBAL` · **Estado:** `PENDIENTE_DE_EVALUAR` |

### `F05-AF-AUD-06` — El relay normaliza el host firmado: el host textual puede dejar de coincidir con SigV4

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID: `F05-AF-AUD-06` · Tarea: `F05-AUDIT-FULL` · Fecha: `2026-11-19` · **Severidad:** `LOW` · **Confianza:** `MEDIA-ALTA` · **Evidencia:** `CORROBORATED` estáticamente; no reproducida dinámicamente |
| **2. Problema** | **Síntoma:** el cliente acepta URLs del emulador firmadas para dos hosts loopback, pero el relay siempre envía la petición al host numérico de destino. **Esperado:** el host firmado y el host enviado al destino coincidan. **Observado:** `frontend/src/api/jobs.ts:77-99` acepta el host loopback textual y el numérico; `frontend/vite.config.ts:28-29,100-118` fija siempre el host numérico; la firma se crea desde el endpoint configurado en `backend/src/storage/client.ts:29-43` y `backend/src/storage/presigner.ts:101-110`. **Impacto:** con una configuración válida basada en el host textual, la petición enviada al destino puede dejar de coincidir con la petición canónica de SigV4 y fallar la firma; la configuración predeterminada usa el host numérico, por lo que el camino predeterminado no queda afectado. **Reproducción:** inspección de las tres rutas; la respuesta real del emulador queda para Tester. |
| **3. Causa** | **Estado:** `DEMOSTRADA` para la divergencia de normalización; impacto exacto `INDICATIVE` hasta reproducción. **Evidencia:** comparación de hosts aceptados y host enviado. **Alternativas descartadas:** (a) permitir el host textual como destino — descartado, rompería el destino fijo; (b) ignorar el host firmado — descartado, puede invalidar SigV4; (c) afirmar que la configuración predeterminada falla — descartado, el valor predeterminado es numérico. |
| **4. Solución** | **Cambios aplicados:** ninguno por este Auditor. **Motivo técnico:** usar un único host canónico extremo a extremo, o rechazar explícitamente el host textual si el destino fijo es numérico, evita la divergencia. **Disposición recomendada (NO aceptación):** Developer reduce la allowlist al host efectivo o hace que el relay preserve el host firmado solo cuando sea seguro; Tester prueba PUT y GET firmados con ambos casos. **Sin G-10.** |
| **5. Verificación** | Auditor estático; sin firma real ni suite E2E. La allowlist de cabeceras es fail-closed: solo nombres exactos pasan, de modo que una futura cabecera de metadatos firmada fallaría por falta de reenvío, no por exposición. |
| **6. Pendientes** | Riesgo residual `LOW`, dependiente de configuración; cobertura dinámica ausente; responsable Developer/Tester. |
| **7. Aprendizaje** | **Prevención propuesta:** la normalización de URL debe atravesar una sola política de host desde la firma hasta el transporte. **Ámbito candidato:** `PROPUESTA_GLOBAL` · **Estado:** `PENDIENTE_DE_EVALUAR` |

### `F05-AF-AUD-07` — INFO: el detector de secretos solo examina el inventario declarado de variables

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID: `F05-AF-AUD-07` · Tarea: `F05-AUDIT-FULL` · Fecha: `2026-11-19` · **Severidad:** `INFO` · **Confianza:** `ALTA` · **Evidencia:** `REPRODUCED` |
| **2. Problema** | **Síntoma:** `assertNoRealSecret` reconoce formatos de tokens, pero la invocación de validación se limita a `ALL_ENV_KEYS`. **Esperado:** que la política G-3 sea explícita sobre credenciales AWS en variables de entorno. **Observado:** `backend/src/config/index.ts:58-88,272-277` no incluye deliberadamente los nombres de credenciales AWS prohibidos; los patrones de `config/index.ts:110-118` no incluyen una clave secreta AWS genérica. `.env.example:39-41` prohíbe esas variables y el transporte usa archivos efímeros. **Impacto:** un valor AWS real añadido como variable no declarada podría entrar en `process.env` sin que el detector lo evalúe; no se encontró ninguno en el árbol. **Reproducción:** lectura de loader, inventario y detector; escaneo de formas de credenciales. |
| **3. Causa** | **Estado:** `DEMOSTRADA` para el alcance. **Evidencia:** el inventario de 29 claves es el gate de la llamada; los patrones amplios se retiraron para evitar falsos positivos. **Alternativas descartadas:** (a) clasificar toda cadena aleatoria larga como secreto — descartado, produce falsos positivos; (b) afirmar que existe un secreto real — descartado por el escaneo; (c) omitir el detector — descartado, los formatos tokens explícitos siguen cubiertos. |
| **4. Solución** | **Cambios aplicados:** ninguno por este Auditor. **Motivo técnico:** una comprobación contextual por nombre de variable puede detectar credenciales AWS prohibidas sin imponer una forma genérica sobre secretos JWT locales. **Disposición recomendada (NO aceptación):** Architect decide si el runtime debe rechazar nombres AWS prohibidos aunque no figuren en el inventario y añade la prueba correspondiente. **Sin G-10.** |
| **5. Verificación** | Auditor estático y escaneo: **9 líneas coincidentes y 12 ocurrencias**, todas correspondientes a fixtures sintéticos o literales negativos documentados; **0 secretos reales**. No se inspeccionaron procesos ni archivos fuera del repositorio. |
| **6. Pendientes** | Riesgo residual `INFO`; cobertura ausente para variables extra no declaradas; responsable Architect. |
| **7. Aprendizaje** | **Prevención propuesta:** combinar detección por formato con políticas contextuales por nombre de variable para evitar falsos positivos sin abrir un bypass. **Ámbito candidato:** `PROPUESTA_GLOBAL` · **Estado:** `PENDIENTE_DE_EVALUAR` |

## 5. Higiene P4, secretos e inventario Git

| Comprobación | Resultado propio | Clasificación |
|---|---|---|
| Archivos versionados totales | **1140** | `REPRODUCED` |
| Archivos prohibidos versionados (`.env` real, `.local/`, `temporary/`, `.terraform/`, estados Terraform) | **0** | `REPRODUCED` |
| `.env.example` versionado | **Sí** | `REPRODUCED` |
| Reglas de exclusión para entornos, credenciales efímeras, `temporary/`, `.terraform/` y `*.tfstate*` | **Aplican correctamente** | `REPRODUCED` |
| Fuga P4 del host en `HEAD 6804f28` | **11 ubicaciones · 8 archivos · 14 valores absolutos** | `REPRODUCED` · bloqueante del baseline |
| Revalidación P4 del worktree prospective | **0 ubicaciones · 0 archivos · 0 valores** | `REPRODUCED` · remediación concurrente, aún sin commit candidato |
| Fuga P4 solo en el árbol local, no versionada | **1 ubicación · 1 archivo ignorado · 1 valor absoluto** | `REPRODUCED` · no forma parte del push salvo adición forzada al índice |
| Coincidencias POSIX del prefijo personal genérico en el baseline | **146 ocurrencias en 49 archivos**: 142 del emulador, 1 de CI y 3 referencias genéricas documentadas; rutas deterministas del contenedor/CI | `REPRODUCED` · no fuga del host |
| Menciones textuales de unidades de entorno en dos reportes | **2**; no son rutas | `REPRODUCED` · no fuga |
| Formas de credencial | **9 líneas coincidentes · 12 ocurrencias**, todas fixtures sintéticos o literales negativos | `REPRODUCED` |
| Secretos reales | **0** | `REPRODUCED` |
| Evidencia F05 versionada | **163 archivos**, incluidos **12 PNG** de QA | `REPRODUCED` |
| `git diff --check` | Sin errores de whitespace; solo avisos de normalización LF/CRLF | `REPRODUCED` |

**Conclusión de higiene:** la exclusión de entornos, credenciales y estados está bien implementada y no hay secretos reales; sin embargo, **P4 está incumplido en el baseline publicado**. La remediación concurrente del worktree arroja `0` coincidencias, pero debe quedar ligada a un commit candidato y recibir la verificación independiente del cierre antes de abrir el gate.

## 6. Cobertura, límites y verificación pendiente

- **`SUFFICIENT`:** análisis estático del relay, allowlist y reescritura de URL; detección de secretos; inventario de entorno; saneado, persistencia y render de `name`; rate limits; Claim Check; contrato y tipos generados; higiene Git y P4.
- **`LIMITED`:** no se ejecutaron typecheck, lint, build, unitarias, integración, S3/SQS, navegador ni E2E; no se comprobó una firma real, TLS contra CA, agotamiento de cuota, aislamiento entre clientes ni una cola malformada; no se observó CI ni un despliegue real.
- **Evidencia ajena no repetida:** `F05-H01` mantiene **2 `HIGH` heredados de dependencias** (`sharp` y `zod`). Los rangos actuales siguen en `backend/package.json:23-24` y la evidencia de audit está en `reports/implementation/F05/evidence/F05-H01-audit-npm.txt`. No se cuentan como hallazgos propios ni se presenta su explotación como reproducida. Exigen cierre antes de `G-12` según la auditoría previa.
- **Verificación funcional ajena:** el dictamen funcional y los reportes oficiales de Tester/Architect no forman parte de esta auditoría. `CA-07` debe comprobarlos durante la consolidación; este dictamen no suple el `PASSED` o `NO-PASSED` funcional.
- **Comprobaciones dinámicas mínimas pendientes para el Tester:** (a) relay PUT/GET con firma válida, CA válida o ausente, método y ruta prohibidos, y ambos hosts loopback; (b) Claim Check con imagen grande real, sobre malicioso y recuperación desde S3; (c) autenticación con dos clientes y API con ventana no predeterminada; (d) nombre antiguo o sin `name`, persistencia y render; (e) reescaneo P4 ligado al commit candidato y suites/CI completas.

## 7. Conclusión y disposición

### Veredicto

**`NOT_READY` — push bloqueado.**

- **Matriz de los ocho identificadores:** **8 `PASS` estáticos · 0 `FAIL`**.
- **Gate de higiene `CA-06`:** **`FAIL` por P4**.
- **Hallazgos propios:** **6** — `0 CRITICAL`, `0 HIGH`, `2 MEDIUM`, `3 LOW`, `1 INFO`.
- **Hallazgo heredado abierto en el alcance:** **1 MEDIUM** (`F02-T01 A-03`).
- **P4 en el baseline publicado:** **11 ubicaciones con fuga en 8 archivos, 14 valores absolutos**; la revalidación del worktree prospectivo da **0**, pendiente de vinculación a un commit candidato.
- **Secretos reales:** **0**.
- **G-10:** no invocado; no se aceptó ningún riesgo.

### Condiciones mínimas para reconsiderar `READY`

1. Ligar la remediación P4 ya visible en el worktree a un commit candidato y demostrar **0 fugas** sobre ese conjunto inmutable con un escaneo que cubra ambos separadores; conservar el hallazgo y su severidad en el historial público.
2. Cerrar `F05-AF-AUD-02` unificando la validación de segmentos S3 y añadir la prueba negativa correspondiente.
3. Reconciliar formalmente el cambio de contrato y hash de `F05-AF-AUD-03` con CTO/Architect y actualizar la documentación afectada.
4. Dar disposición ejecutable —no aceptación— a `F05-AF-AUD-04`…`F05-AF-AUD-07`; los MEDIUM de Claim Check, contrato y cubo global no deben quedar implícitamente aceptados.
5. Obtener verificación funcional independiente del Tester y CI verde; resolver `CA-03`…`CA-05` y los dos `HIGH` heredados antes de `G-12`.

Este dictamen es de riesgo y **no sustituye** el `PASSED`/`NO-PASSED` funcional del Tester ni el cierre del Architect. No se ejecutó `G-12`, no se abrió el gate de push y no se modificó, commiteó ni publicó ningún archivo de producto.
