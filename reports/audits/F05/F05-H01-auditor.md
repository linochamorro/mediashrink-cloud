# Auditoría de cambio + hardening — `F05-H01` (seed → `mediashrink-jobs`)

| Campo | Valor |
|---|---|
| **Fecha / rol** | `2026-11-19` · Auditor (riesgo 3, auditoría de cambio + hardening) |
| **Fase / tarea** | Fase Final · `F05-H01` (H-01 Opción A + verificación seguridad defensiva) |
| **Encargo** | Seed, hardening (`security.ts`/`app.ts`), `npm audit --omit=dev` (2 HIGH), secretos/P4, inventario heredado |
| **Lectura** | `.agents/roles/auditor.md`, `AGENTS.md`, `STATE.md` (H-01 Opción A autorizada; G-10 no invocado; G-12 retenido), `reports/implementation/F05/F05-H01-task.md`, `F05-H01-developer.md` (bloque 2: 2 HIGH sin fix ni aceptación), `backend/src/api/security.ts`, `backend/src/api/app.ts`, `tools/scripts/seed/{cli,index,store}.ts`, `package.json`, `backend/package.json`, `package-lock.json` (rango), plantilla 7 campos |
| **Frontera respectada** | No implementé código, no ejecuté nada (sin Docker/Git/AWS/npm: todo estático), no emito `PASSED`/`NO-PASSED` funcional, no acepto riesgos (`G-10` NO invocado). Escribo **solo** este archivo. Sin secretos ni rutas Windows absolutas. |
| **Conclusión** | **`READY_WITH_CONCERNS`** — 0 bloqueantes de auditoría para el push G-6; seguimientos obligatorios antes de G-12 |
| **Cobertura** | **`SUFFICIENT`** para inspección estática del diff H-01 + hardening; **`LIMITED`** para comportamiento vivo (evidencia ajena `CORROBORATED`), despliegue real y diff byte a byte |
| **Recuento propio** | **CRITICAL propios: 0 · HIGH propios: 0 · secretos reales: 0 · bloqueantes: 0** |
| **Dependencias** | **2 HIGH heredados de `npm audit --omit=dev`** (sharp transitivo, zod) — clasificados abajo; **NO bloquean el push G-6** (producto local/emulador, G-12 retenido), **SÍ exigen acción antes de G-12** |

## 1. Alcance y método (estático)

1. `tools/scripts/seed/`: grep propio `mediashrink-seed-demo|SEED_TABLE_NAME|SEED_TABLE` → **0 coincidencias** (`REPRODUCED`). `cli.ts:35` fija `LOCAL_DEFAULTS.DYNAMODB_TABLE_JOBS='mediashrink-jobs'` (igual que `.env.example:63` y `dynamodb_table_jobs` de Terraform); `main()` usa `resolveSeedTableName(config)` (`cli.ts:76-78,111`) = `config.resources.dynamodbTableJobs` (requerido, `config/index.ts:268`). `store.ts:82-133` documenta y cumple: si la tabla existe → `DescribeTable` OK → retorna `false` sin `CreateTable`/`UpdateTimeToLive`; solo crea (mismo esquema `userId` HASH + `jobId` RANGE + TTL `ttl`) si ausente. Unicidad: `putUserIfAbsent` con `ConditionExpression attribute_not_exists(userId) AND attribute_not_exists(jobId)` (`store.ts:208`); jobs/imágenes por `get-then-create` en `index.ts:147-176`.
2. Hardening: `security.ts:27-46` (`securityHeaders` post-`next()` mutando `c.res`; `jsonBodyLimit` 1 MiB → `413 { error: { code: 'PAYLOAD_TOO_LARGE' } }`); wiring global primero en `app.ts:109-112` (`app.use('*', securityHeaders)` + `app.use('*', jsonBodyLimit)` antes de todas las rutas). Orden correcto: el 413 de `bodyLimit` retorna dentro de la cadena, por lo que el `await next()` externo de `securityHeaders` sigue aplicando cabeceras al 413. Cuerpo 413: solo `code` + mensaje genérico, sin eco del body ni stack. Rate limiting (`NonSpoofableAuthLimiter`, `withPrincipal(ANONYMOUS_PRINCIPAL)`, `app.ts:114-116`), auth y validación Zod intactos (sin toques en `backend/src/auth/**`, contratos ni `jobs.ts`/`presign.ts` salvo el middleware global previo).
3. `npm audit --omit=dev`: **no reejecutado** (encargo); clasificado desde `F05-H01-audit-npm.txt:1-23` (0 CRITICAL, 2 HIGH, EXIT=1) y `F05-H01-developer.md` P-03.
4. Secretos/P4: greps propios sobre `tools/scripts/seed/**` y `backend/src/api/security.ts` → 0 `AKIA`/`eyJ`/`ghp_`/`PRIVATE KEY`/rutas `X:\`; único `secret` es la palabra en comentario G-3 de `demo-data.ts:6`. `LOCAL_DEFAULTS` usa marcadores `REPLACE_WITH_*`, nunca credenciales reales.
5. Heredados: contraste contra inventario `F05-T02-auditor.md` §4 (allowlist, ETag, IAM único, `cors_origin`, `is_emulator`, `USER#` sin ttl, billing, `@v4`, ESLint 8, `CONFIRM_INCONSISTENT`); el diff H-01 no toca ninguno de esos archivos.

## 2. Juicio sobre los 2 HIGH de dependencias (¿bloquean el push G-6?)

| Hallazgo npm | Severidad propia | Confianza | ¿Explotable en este producto? | ¿Mitiga el tope 1 MiB? | ¿Bloquea push G-6? |
|---|---|---|---|---|---|
| sharp ≤0.35.5-rc.1 (libvips CVE-2026-33327/33328/35590/35591; libheif GHSA-g89c/2jg2; librsvg CVE-2026-96889) | **HIGH (heredada del advisory)** | MEDIA (rango declarado `backend/package.json:23` `^0.33.5`; versión instalada según evidencia ajena) | **Sí, en el worker**: `sharp` procesa imágenes **no confiables** de usuarios (ruta `raw` → variantes). Corrupción de memoria en decodificadores nativos es el vector clásico de este componente. | **No**: el tope 1 MiB es de body JSON en la API, no del pipeline de imágenes S3/worker. | **NO bloquea G-6** (emulador local, sin despliegue; G-12 retenido). **Exige bump antes de G-12** (F05-H01-AUD-03). |
| zod <4.6.6 (GHSA-mrhx-c7xc-m3w5: agotamiento de memoria con colecciones sobredimensionadas) | **HIGH (heredada) / residual LOW-MEDIUM tras mitigación** | MEDIA-ALTA | **Parcialmente**: `zod` valida input de API (`schemas.*`), vector real pero autenticado y local. | **Mitigación parcial sí**: el body JSON queda acotado a 1 MiB **antes** de `c.req.json()`/Zod, lo que limita la magnitud del payload amplificable. No lo elimina (estructuras anidadas densas dentro de 1 MiB podrían seguir amplificando), y no cubre rutas que no pasen por este middleware. | **NO bloquea G-6**. **Exige upgrade mayor con control de cambios del CTO** (contratos congelados, hash `5d0082f8…`) **antes de G-12** (F05-H01-AUD-04). |

Disposición (SIN aceptar riesgo, SIN G-10): tarea autorizada de bump `sharp@0.35.5` con suite `worker` + `antiBomb`, y bump mayor `zod@4.6.7` con control de cambios del CTO por hash congelado; tracking con responsable y fase en el retorno del Architect. El criterio `CA-H01.3` ("0 CRITICAL/HIGH") queda **no satisfecho en sentido literal**; se registra como desviación documentada con plan, no como bloqueo del push de avances (G-6 ≠ G-12).

## 3. Hallazgos (7 campos obligatorios)

### F05-H01-AUD-01 — Colisión seed↔datos reales en tabla compartida `mediashrink-jobs`

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID: `F05-H01-AUD-01` · Tarea: `F05-H01` · Fase: Final · Loop: `1/3` · Fecha: `2026-11-19` · Entorno: inspección estática. **Severidad:** `LOW` · **Confianza:** `ALTA` · **Evidencia:** `REPRODUCED` (código) |
| **2. Problema** | **Síntoma:** el seed escribe IDs fijos (`demo-user-ana/bruno/carla`, `demo-job-*`, `img-<prefijo>-0x`, `demo-data.ts:44-55`) en la **misma tabla** que los datos reales de producto. **Esperado:** imposibilidad o detección de colisión con datos de usuario. **Observado:** la app genera IDs reales con `randomUUID()` (`api/jobs.ts:204,228`, `auth/service.ts:61`), cuyo formato (hex con guiones) nunca iguala literalmente `demo-user-*`; colisión accidental ≈ 0 salvo actor que fabrique a mano el prefijo `demo-`. **Impacto:** si un usuario real usara esos IDs (solo posible por construcción manual), `putUserIfAbsent` lo omitiría silenciosamente (`skipped`) y el login demo podría mapear a cuenta ajena; además demo y real conviven sin partición (ruido en listados/conteos). En emulador local el impacto es operativo, no de confidencialidad (aislamiento por `userId` intacto). **Reproducción:** lectura de `demo-data.ts`, `jobs.ts:204-228`, `service.ts:61`, `store.ts:187-216`. |
| **3. Causa** | **Estado:** `DEMOSTRADA` (diseño: claves deterministas para idempotencia + tabla compartida por H-01). **Evidencia:** `demo-data.ts:6-8` (IDs fijos intencionales), `index.ts:96-181`. **Alternativas descartadas:** (a) colisión UUID aleatoria — descartada por formato incompatible; (b) `putUserIfAbsent` como corrupción — descartado, es condicional y no sobrescribe. |
| **4. Solución** | **Cambios aplicados:** ninguno por este Auditor. **Motivo técnico:** fuera de frontera de rol. **Mitigación propuesta (SIN aceptar riesgo):** reservar el prefijo `demo-`/`img-` como namespace no generable por la app (validar rechazo en `POST /jobs` si se declara ID con ese prefijo, o documentar reserva) + chequeo pre-seed que aborte si la tabla ya contiene ítems no-demo fuera de emulador; responsable Architect/CTO. **Sin G-10.** |
| **5. Verificación** | **Verificador independiente:** Auditor (estática). **Procedimiento:** lectura cruzada seed↔generadores de IDs. **Resultado:** colisión accidental despreciable; colisión manual posible pero acotada al entorno local. **Regresión comprobada:** idempotencia condicional intacta (`putIfAbsent` + `get-then-create`). **Límites:** sin prueba viva de colisión forzada (no autorizada). |
| **6. Pendientes** | **Riesgo residual:** `LOW`, no bloqueante para G-6. **Cobertura ausente:** sonda de prefijo reservado. **Responsable y siguiente paso:** Architect/CTO antes de G-12. **Sin G-10.** |
| **7. Aprendizaje** | **Prevención propuesta:** todo seed sobre tabla de producto debe declarar su namespace reservado y su pre-condición de entorno. **Ámbito candidato:** `PROPUESTA_GLOBAL` · **Estado:** `PENDIENTE_DE_EVALUAR` |

### F05-H01-AUD-02 — `ensureSeedTable` crea con billing divergente si la tabla está ausente

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID: `F05-H01-AUD-02` · Tarea: `F05-H01` · Loop: `1/3` · Fecha: `2026-11-19` · Entorno: estático. **Severidad:** `LOW` · **Confianza:** `ALTA` · **Evidencia:** `REPRODUCED` |
| **2. Problema** | **Síntoma:** si la tabla no existe, el seed la crea con `BillingMode: PAY_PER_REQUEST` (`store.ts:92-103`), mientras Terraform la define `PROVISIONED` (`dynamodb.tf:57`). **Esperado:** la tabla de producto siempre con billing/claves/TTL de Terraform. **Observado:** en el flujo canónico la tabla **existe** (Terraform `apply` previo) y el seed retorna `false` sin tocar nada (verificado en evidencia viva ajena: `(creada en esta ejecución: no)`); la rama de creación solo se ejerce en tablas de prueba (`*-idem`, `*-dbcheck`, eliminadas en `afterAll`) o entornos sin Terraform. **Impacto:** divergencia de billing/esquema solo en entornos no canónicos; nulo en el flujo `terraform apply → seed`. **Reproducción:** lectura de `store.ts:82-133` y `dynamodb.tf:56-57,82-84`. |
| **3. Causa** | **Estado:** `DEMOSTRADA`. **Evidencia:** literales citados. **Alternativas descartadas:** (a) el seed altera TTL/billing existentes — descartado, retorno temprano tras `DescribeTable`; (b) deriva de claves — descartado, mismo esquema HASH+RANGE. |
| **4. Solución** | **Cambios aplicados:** ninguno por este Auditor. **Motivo técnico:** frontera de rol. **Mitigación propuesta (SIN aceptar riesgo):** modo fail-closed: si la tabla falta fuera de tablas `*-idem`/`*-dbcheck`, abortar con mensaje "ejecuta `terraform apply`" en vez de crear con billing distinto; o alinear la creación con `PROVISIONED` 5/5. Responsable Architect. **Sin G-10.** |
| **5. Verificación** | Auditor estático + evidencia ajena `F05-H01-seed-live.txt` (`CORROBORATED` para lo vivo). **Regresión:** TTL/claves de Terraform intactos cuando la tabla existe. **Límites:** creación divergente no reproducida por este rol. |
| **6. Pendientes** | **Riesgo residual:** `LOW`, no bloqueante. **Responsable:** Architect antes de G-12. **Sin G-10.** |
| **7. Aprendizaje** | **Prevención propuesta:** todo helper `ensure*` sobre recurso IaC debe documentar y preferir fail-closed frente a crear con parámetros distintos. **Ámbito:** `PROPUESTA_GLOBAL` · **Estado:** `PENDIENTE_DE_EVALUAR` |

### F05-H01-AUD-03 — `sharp` transitivo HIGH (libvips/libheif/librsvg): exige bump antes de G-12, no bloquea G-6

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID: `F05-H01-AUD-03` · Tarea: `F05-H01` (bloque 2, P-03 del Developer) · Fecha: `2026-11-19` · Entorno: reporte `F05-H01-audit-npm.txt` (ajeno) + código. **Severidad:** `HIGH (heredada del advisory; sin hallazgo propio nuevo)` · **Confianza:** `MEDIA` · **Evidencia:** `CORROBORATED` (evidencia ajena) + `REPRODUCED` (rango + uso) |
| **2. Problema** | **Síntoma:** `npm audit --omit=dev` → `sharp <=0.35.5-rc.1` HIGH (libvips CVE-2026-33327/33328/35590/35591; libheif GHSA-g89c/2jg2; librsvg CVE-2026-96889), fix con breaking change a `sharp@0.35.5`. **Esperado (CA-H01.3):** 0 CRITICAL/HIGH en producción. **Observado:** rango declarado `backend/package.json:23` (`^0.33.5`); `sharp` procesa imágenes no confiables en el worker (superficie real). El tope 1 MiB de la API **no** mitiga este vector (pipeline S3/worker, no body JSON). **Impacto:** en despliegue real, imagen crafteada → corrupción de memoria nativa. En emulador local, impacto contenido. **Reproducción:** `F05-H01-audit-npm.txt:3-10`; uso en worker (lectura de `backend/src/worker/**` según Developer). |
| **3. Causa** | **Estado:** `DEMOSTRADA` (cadena transitiva del ecosistema). **Evidencia:** salida exacta citada; `package-lock.json` fija el árbol. **Alternativas descartadas:** (a) `audit fix --force` inmediato — descartado por el Developer con razón (breaking + fuera de ámbito/tarea); (b) mitigación por tope body — descartada para este vector. |
| **4. Solución** | **Cambios aplicados:** ninguno (correcto: sin tarea autorizada, sin G-10). **Disposición propuesta (NO aceptación):** tarea autorizada de bump `sharp@0.35.5` con suite `worker` + `antiBomb` antes de G-12; responsable Architect/CTO. **Sin G-10.** |
| **5. Verificación** | Auditor documental; `npm audit` no reejecutado por encargo. **Regresión comprobada:** no aplica (sin cambio). **Límites:** versión instalada exacta y exploitabilidad tomadas del advisory, no reproducidas. |
| **6. Pendientes** | **Riesgo residual:** `HIGH` heredado hasta el bump; **no bloquea G-6** (local/emulador, G-12 retenido), **bloquea G-12** si sigue abierto. **Responsable:** Architect/CTO. **Sin G-10.** |
| **7. Aprendizaje** | **Prevención propuesta:** programar bump de decodificadores nativos antes de cualquier gate de publicación, aunque el criterio diga "0 HIGH". **Ámbito:** `PROPUESTA_GLOBAL` · **Estado:** `PENDIENTE_DE_EVALUAR` |

### F05-H01-AUD-04 — `zod <4.6.6` HIGH (DoS memoria): mitigado parcialmente por 1 MiB; exige upgrade mayor antes de G-12

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID: `F05-H01-AUD-04` · Tarea: `F05-H01` (P-03) · Fecha: `2026-11-19` · Entorno: evidencia ajena + código. **Severidad:** `HIGH heredada / residual LOW-MEDIUM tras mitigación` · **Confianza:** `MEDIA-ALTA` · **Evidencia:** `CORROBORATED` + `REPRODUCED` |
| **2. Problema** | **Síntoma:** `zod <4.6.6` HIGH (GHSA-mrhx-c7xc-m3w5: agotamiento de memoria con colecciones sobredimensionadas), fix breaking a `zod@4.6.7`. **Esperado:** 0 HIGH. **Observado:** `backend/package.json:24` (`^3.25.76`); Zod valida input de API **después** del nuevo `jsonBodyLimit` 1 MiB (`app.ts:111-112` + `security.ts:34-45`), que acota el payload amplificable. **Impacto:** DoS de memoria acotado a ≤1 MiB de entrada por petición en rutas cubiertas; no eliminado (densidad anidada) ni cobertura de rutas fuera del middleware. Contratos Zod congelados (hash `5d0082f8…`) impiden el upgrade sin control de cambios. **Reproducción:** `F05-H01-audit-npm.txt:12-17`; orden de middlewares leído. |
| **3. Causa** | **Estado:** `DEMOSTRADA` para la existencia y la mitigación parcial. **Evidencia:** literales citados. **Alternativas descartadas:** (a) upgrade inmediato — descartado (rompería contratos congelados sin autorización); (b) 1 MiB como cierre — descartado, es mitigación, no fix. |
| **4. Solución** | **Cambios aplicados:** mitigación `jsonBodyLimit` (del Developer). **Disposición propuesta (NO aceptación):** upgrade mayor Zod con control de cambios del CTO (hash congelado) + pruebas de contratos antes de G-12. **Sin G-10.** |
| **5. Verificación** | Estática del orden + tests nuevos del Developer (`security-headers.test.ts`: 413 sobre 1 MiB, no-413 bajo el límite — `CORROBORATED`). **Límites:** sin fuzzing propio de amplificación. |
| **6. Pendientes** | Residual `LOW-MEDIUM`, no bloqueante G-6; **bloquea G-12** si sigue abierto. **Responsable:** CTO/Architect. **Sin G-10.** |
| **7. Aprendizaje** | **Prevención propuesta:** todo límite anti-DoS debe ir antes del parseo/validación y documentar qué vectores deja fuera. **Ámbito:** `PROPUESTA_GLOBAL` · **Estado:** `PENDIENTE_DE_EVALUAR` |

### F05-H01-AUD-05 — INFO: sin CSP/HSTS (correcto para emulador; recomendar para despliegue real)

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID: `F05-H01-AUD-05` · Tarea: `F05-H01` · Fecha: `2026-11-19` · Entorno: estático. **Severidad:** `INFO` · **Confianza:** `ALTA` · **Evidencia:** `REPRODUCED` |
| **2. Problema** | **Síntoma:** el hardening cubre `X-Content-Type-Options`/`X-Frame-Options`/`Referrer-Policy` + tope body, pero no `Content-Security-Policy` ni `Strict-Transport-Security`. **Esperado:** nada más para emulador local (HSTS sin HTTPS público es contraproducente; CSP es del frontend servido, fuera de `backend/src/api`). **Observado:** `security.ts:21-25` confirma el trío; sin CSP/HSTS en `api/**`. **Impacto:** ninguno en emulador; en despliegue real con TLS/CDN serían esperables. **Reproducción:** lectura de `security.ts` + `app.ts`. |
| **3. Causa** | **Estado:** `DEMOSTRADA` (ámbito `backend/src/api` del contrato). **Evidencia:** literales. **Alternativas descartadas:** exigir CSP/HSTS aquí — descartado, fuera de ámbito y de entorno. |
| **4. Solución** | Ninguna por este Auditor. **Recomendación (NO aceptación):** incluir CSP/HSTS en la guía de despliegue real (G-12), no en este cambio. **Sin G-10.** |
| **5. Verificación** | Estática; sin regresión (rate limit/auth/Zod intactos). **Límites:** despliegue real no evaluado. |
| **6. Pendientes** | `INFO`, no bloqueante. **Responsable:** Architect/CTO en G-12. |
| **7. Aprendizaje** | Etiquetar hardening "local/emulador" vs "despliegue real" evita sobredimensionar el middleware. **Ámbito:** `SOLO_LOCAL` · **Estado:** `PENDIENTE_DE_EVALUAR` |

## 4. Cobertura, secretos/P4 y herencia

- **Secretos:** 0 reales en el diff (`security.ts`, `cli.ts`, `store.ts`, `index.ts`, tests nuevos). Marcadores `REPLACE_WITH_*` intactos; `redactPaths` en `cli.ts:52-56` redacta rutas en errores.
- **P4:** 0 rutas Windows absolutas en artefactos nuevos de este cambio (los `D:\...` visibles en el árbol pertenecen a contratos de tarea/task y evidencias de harness ajenas, fuera del diff H-01; `temporary\` relativo ya inventariado como `F04T02-A-04`).
- **413/cabeceras:** cuerpo 413 sin eco de datos ni stack (`security.ts:37-44`); cabeceras aplicadas también a 4xx/5xx por mutación post-`next()` (`security.ts:27-32`), con wiring global previo a rutas (`app.ts:111-112`); rate limiting, auth y Zod no debilitados (montajes intactos).
- **Herencia (`F05-T02-auditor.md` §4):** allowlist prod, ETag/HeadObject, IAM único, `cors_origin`, `is_emulator`, `USER#` sin ttl (+`USER#EMAIL`/5.ª fuente), billing, `@v4`, ESLint 8, `CONFIRM_INCONSISTENT` — **ninguno empeora**: el diff no toca `frontend/src/api/jobs.ts`, `enriched-publisher.ts`, `infra/terraform/**`, workflows ni contratos. El `USER#PROFILE` del seed sigue sin `ttl` propio visible en `store.ts:198-207` (coherente con `F04T03-A-04`: las cuentas no expiran; el `ttl` citado en `store.ts` es de jobs/imágenes vía `computeTtl`).
- **Límites:** sin ejecución propia (Docker/Git/AWS/npm prohibidos en el encargo); lo vivo es `CORROBORATED` de Developer/Tester; sin despliegue real.

## 5. Conclusión y disposición

**`READY_WITH_CONCERNS`** — 0 CRITICAL/HIGH propios, 0 secretos, 0 bloqueantes para el **push G-6** de avances. Los 2 HIGH de dependencias **NO bloquean G-6** pero **exigen bump/tracking antes de G-12** (F05-H01-AUD-03/-04); la desviación literal de CA-H01.3 queda documentada con plan. Colisión de tabla compartida y billing divergente quedan como LOW no bloqueantes con mitigación propuesta (AUD-01/-02). CSP/HSTS como INFO para despliegue real (AUD-05). **G-10 no invocado; G-12 sigue retenido.** Este dictamen no sustituye el veredicto funcional de Tester/Architect.
