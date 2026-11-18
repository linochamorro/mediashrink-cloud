# Auditoría de cambio — `F01-T03` (autenticación JWT propia)

| Campo | Valor |
|---|---|
| **Auditoría / tarea** | `F01-T03` — Fase 1, paquete `P-01-critical-foundations.md` (`CA-03`) |
| **Rol** | Auditor (riesgo 3 — sensible: hash, JWT, secretos, autorización y rate limiting) |
| **Loop** | `1/3` · **Fecha** `2026-11-17` · **Entorno** inspección estática + revisión de evidencia (sin ejecución propia) |
| **Encargo** | Hash y contraseñas (scrypt, parámetros/sal, `timingSafeEqual`, hash manipulado, anti-enumeración, rango 8–128, sin contraseñas en logs), JWT (HS256 con `hono/jwt`, firma/`exp`/`iat`/`typ`/`sub`, secretos y TTLs desde `loadConfig()`, access/refresh, `jti`, alg-confusion, token manipulado/expirado), aislamiento (`401`/`404` sin oracle, `userId` del token), rate limiting (ventana fija, 429 + `Retry-After`, reloj inyectable, abuso distribuido), persistencia P6 y G-3/PR-08 |
| **Frontera** | No se emite `PASSED`/`NO-PASSED` (compete a Tester); no se implementa, no se cierra la tarea, no se acepta riesgo en nombre de Lino (`G-10`), no se usan Docker/Git/AWS, no se escriben secretos ni rutas Windows absolutas nuevas |
| **Plantilla** | `docs/templates/problema-solucion.md` del laboratorio — 7 campos por hallazgo, modo append-only |

## 1. Preguntas falsificables y método

1. ¿El encoded de contraseña fija coste en código (no en el dato), usa sal por usuario, compara en tiempo constante y rechaza un hash manipulado sin lanzar?
2. ¿El login iguala coste para correo desconocido (dummy) y devuelve el mismo error que para contraseña errónea? ¿El rango 8–128 está aprobado y la contraseña nunca se registra?
3. ¿El JWT fija HS256, verifica firma/`exp`/`iat`/`typ`/`sub` explícitamente, usa secretos y TTLs distintos desde `loadConfig()`, `jti` único, y rechaza tokens manipulados/expirados/del otro tipo? ¿Es vulnerable a alg-confusion?
4. ¿`requireAuth` extrae `userId` del token verificado (no de cabeceras modificables) y falla cerrado con 401? ¿`assertOwnership` devuelve 404 con cuerpo idéntico para ajeno e inexistente?
5. ¿El rate limit sale de configuración, aplica 429 + `Retry-After`, tiene reloj inyectable y qué tan resistente es a spoofing/abuso distribuido?
6. ¿Es aceptable `InMemoryUserStore` (P6) para F01 y qué disposición recomendar sin `G-10`?
7. ¿Hay secretos reales, rutas Windows absolutas nuevas o `:9324` activo en código, tests, evidencia o reportes (G-3)?

**Método:** lectura íntegra de `backend/src/auth/**`, `backend/src/config/index.ts`, contratos, tests y evidencia; contraste con SDD/paquete/decisión CTO; búsquedas literales focalizadas; verificación de la API real de `hono/jwt` instalada (`node_modules/hono/dist/utils/jwt/jwt.js:42-59`) para alg-confusion. Conforme a METHODOLOGY §3.1, el Auditor **no repite la suite funcional del Tester**: las corridas verdes se califican `CORROBORATED`; el análisis estático reproducible por este rol se califica `REPRODUCED`.

**Fuentes:** `backend/src/auth/{errors,identity,password,jwt,user-store,rate-limit,service,middleware,routes,index}.ts`; `backend/src/contracts/{catalog,zod-schemas}.ts`; `backend/src/config/index.ts`; `.env.example`; `tests/unit/auth/**`; `tests/integration/auth/**`; reportes `F01-T03-{task,developer}.md`; `reports/audits/F01/F01-T01-auditor.md` (addendum A-01, decisión CTO 8–128); `evidence/F01-T03-*.txt`.

## 2. Matriz de verificación del alcance

| # | Criterio | Comprobación propia | Resultado | Calificación |
|---|---|---|---|---|
| V-1 | Hash scrypt, sal y `timingSafeEqual` | `password.ts:19-31` fija `N=16384`, `r=8`, `p=1`, `maxmem=64 MiB`, `SALT_BYTES=16`, `KEY_LENGTH=64`; `:35-39` usa `randomBytes` por hash y formato `scrypt$N$r$p$salt$digest`; `:41-55` valida el patrón, exige parámetros exactos, longitud de sal/digest y compara con `timingSafeEqual`. `password.test.ts:8-50` verifica formato, sal aleatoria, digest manipulado, formato no scrypt y parámetros abaratados (6/6 en `F01-T03-hash.txt`). | Conforme | `REPRODUCED` (estático) + `CORROBORATED` (evidencia) |
| V-2 | Anti-enumeración en login | `service.ts:49-53,82-89`: si `findByEmail` es `null`, ejecuta `verifyAgainstDummy(password)` (un hash dummy perezoso por instancia) y lanza `invalidCredentials()`; si la contraseña es errónea, lanza el mismo `invalidCredentials()`. `service.test.ts:78-93` comprueba error idéntico; mismo coste scrypt en ambas ramas por inspección de código. | Conforme | `REPRODUCED` + `CORROBORATED` |
| V-3 | Rango 8–128 y contraseña nunca registrada | `catalog.ts:162` congela `min:8, max:128`; decisión CTO/Lino registrada en `F01-T01-auditor.md:115-142` (addendum A-01, **no G-10**). `service.test.ts:47-57` rechaza 7 y 129 caracteres. Búsqueda de la contraseña de prueba en errores/evidencia: 0 apariciones como valor persistido o mensaje; `errors.ts:29-51` mensajes genéricos. | Conforme | `CORROBORATED` |
| V-4 | JWT HS256, claims y alg-confusion | `jwt.ts:11,34-53` usa `sign(..., 'HS256')`; `:72` usa `verify(token, secret, { alg:'HS256', exp:false, iat:false })`; `:77-90` comprueba `exp`, `iat`, `typ`, `sub`, `email`. `hono/dist/utils/jwt/jwt.js:50` lanza `JwtAlgorithmMismatch` si `header.alg !== alg`: **no hay alg-confusion** (`none`/RS256 rechazados). Desactivar `exp`/`iat` de la lib no debilita: las comprobaciones propias son equivalentes (`<= now`, `> now`). | Conforme | `REPRODUCED` |
| V-5 | Secretos/TTLs desde config, access/refresh, `jti` | `jwt.ts:27-60`: secretos `config.jwt.{accessSecret,refreshSecret}`, TTLs `config.jwt.{accessTtlSeconds,refreshTtlSeconds}`, `jti: randomUUID()` distinto por token. `config/index.ts:248-249,279-285,298-303` los carga y exige access < refresh; `middleware.ts:56` usa `accessSecret` y `service.ts:101` usa `refreshSecret`. 0 literales de secreto en código de producto. **Sin comprobación de secretos distintos ni longitud mínima** (ver T03-A-03). | Conforme (con T03-A-03) | `REPRODUCED` |
| V-6 | Token manipulado/expirado rechazado | `jwt.test.ts:38-72` cubre otro secreto, firma alterada, expirado (`TOKEN_EXPIRED`), sin `sub`/`sin typ` y cadena no JWT; `:31-36` separa access/refresh. 7/7 en `F01-T03-jwt.txt`. | Conforme | `CORROBORATED` |
| V-7 | `requireAuth` 401 fail-closed; `userId` del token | `middleware.ts:47-66`: lee `authorization`, exige `Bearer`, verifica con `accessSecret`, exige que el usuario exista, y hace `c.set('userId', verified.userId)`; el `catch` convierte cualquier fallo inesperado en `unauthorized()` (401). El `userId` **no** se toma de `x-forwarded-for` ni de otra cabecera. `isolation.test.ts:47-58` verifica 401 previo a 404. | Conforme | `REPRODUCED` + `CORROBORATED` |
| V-8 | `assertOwnership` 404 sin oracle | `middleware.ts:69-82`: distinto `userId` → `resourceNotFound()` (404, «Recurso no encontrado»), sin identificadores en el mensaje; fallo inesperado también 404. `isolation.test.ts:34-45` compara cuerpo de ajeno vs. inexistente (idéntico); `middleware.test.ts:25-35` verifica que el mensaje no contiene los IDs. 4/4 en `F01-T03-isolation.txt`. | Conforme | `REPRODUCED` + `CORROBORATED` |
| V-9 | Rate limit configurable, 429 + `Retry-After`, reloj inyectable | `rate-limit.ts:17-54`: ventana fija por clave, `now` inyectable, `retryAfterSeconds`; `routes.ts:32-38` devuelve 429 con `Retry-After`; `config/index.ts:304-307` y `.env.example:33-34` (`5` / `60000`). 5/5 en `F01-T03-rate-limit.txt`. **Clave derivada de cabeceras modificables y estado por proceso** (ver T03-A-01/A-02). | Conforme con concerns | `REPRODUCED` + `CORROBORATED` |
| V-10 | P6 y G-3/PR-08 | `user-store.ts:33-57`: `InMemoryUserStore` con dos `Map` por instancia; interfaz `UserStore` preparada para adaptador (ver T03-A-04). Búsqueda literal en `backend/src/auth/**`, `tests/**/auth/**`, `evidence/F01-T03-*.txt` y este reporte: **0** `AKIA`/`ASIA`/`ghp_`/JWT reales/rutas Windows absolutas; evidencias con raíz normalizada `<PROJECT_ROOT>`; `:9324` solo aparece en documentación de prohibición de F00/T01, nunca en T03. | Conforme con concern | `REPRODUCED` |

## 3. Hallazgos

### Hallazgo `T03-A-01` — Clave del rate limit derivada de cabeceras modificables (`x-forwarded-for`)

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID: `T03-A-01` · Tarea: `F01-T03` · Fase: `P-01` · Loop: `1/3` · Fecha: `2026-11-17` · Entorno: inspección estática. **Severidad:** `MEDIUM` · **Confianza:** `ALTA` · **Evidencia:** `REPRODUCED` · **Bloqueo:** NO |
| **2. Problema** | **Síntoma:** `routes.ts:23-30` construye la clave del limitador con `x-forwarded-for` (primer valor) o `x-real-ip`, cabeceras controlables por el cliente si no hay un proxy de confianza que las reescriba. **Esperado:** que el límite de autenticación no sea eludible cambiando una cabecera. **Observado:** un atacante puede rotar `X-Forwarded-For` por petición y obtener un cubo nuevo, anulando el límite de `/auth/login` (fuerza bruta) y `/auth/register`. En la arquitectura destino (Hono tras API Gateway/Lambda) la cabecera puede ser inyectada por el proveedor, pero no hay configuración de proxy de confianza documentada. **Impacto:** `MEDIUM` — defensa en profundidad contra fuerza bruta degradada; el hash scrypt y el rango 8–128 siguen siendo la barrera principal. **Reproducción:** lectura de `routes.ts:23-38` y contraste con `requireAuth` (V-7, que sí usa el token). |
| **3. Causa** | **Estado:** `DEMOSTRADA`. **Evidencia:** `backend/src/auth/routes.ts:23-30`; `rate-limit.ts:29-50`. **Alternativas descartadas:** que la identidad de usuario se tome de estas cabeceras — descartado (V-7: `userId` sale del JWT); que falte el 429 — descartado (V-9 conforme). |
| **4. Solución** | **Cambios aplicados:** ninguno (el Auditor no implementa). **Motivo técnico:** la corrección es de diseño (derivar la clave de la IP real del transporte — p. ej. `c.env`/API Gateway — o fijar un proxy de confianza y documentar el límite de confianza). **Intentos fallidos relevantes:** ninguno. |
| **5. Verificación** | **Verificador independiente:** Auditor. **Comando/procedimiento:** trazado de `clientKey()` hasta `limiter.check()` y a la respuesta 429; revisión de `F01-T03-rate-limit.txt` (5/5 de la mecánica, que no cubre spoofing). **Resultado y evidencia:** límite funciona para una clave dada; la clave es falsificable. **Regresión comprobada:** no aplica (sin cambios). **Límites:** no se ejecutó un ataque de fuerza bruta (fuera de alcance y sin autorización para explotación activa). |
| **6. Pendientes** | **Riesgo residual:** fuerza bruta online no limitada de forma fiable si el despliegue no garantiza la cabecera. **Cobertura ausente:** test de clave suplantada. **Responsable y siguiente paso:** Architect/Developer — decidir la fuente de la clave antes de exponer `/auth/login` en F02; **no se registra como riesgo aceptado: no se invocó `G-10`**. |
| **7. Aprendizaje** | **Prevención propuesta:** tratar `x-forwarded-for`/`x-real-ip` como no fiables salvo configuración explícita de proxy de confianza; añadir caso de prueba de suplantación. **Ámbito candidato:** `PROPUESTA_GLOBAL` · **Estado:** `PENDIENTE_DE_EVALUAR` |

### Hallazgo `T03-A-02` — Limitador en memoria por proceso: abuso distribuido y reinicio

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID: `T03-A-02` · Tarea: `F01-T03` · Fase: `P-01` · Loop: `1/3` · Fecha: `2026-11-17` · Entorno: inspección estática. **Severidad:** `LOW` · **Confianza:** `ALTA` · **Evidencia:** `REPRODUCED` · **Bloqueo:** NO |
| **2. Problema** | **Síntoma:** `rate-limit.ts:18` guarda los cubos en un `Map` de la instancia; archivos generados por `hono` en F02 se desplegarán como Lambda. **Esperado:** límite efectivo frente a abuso distribuido en producción. **Observado:** cada instancia/cold start reinicia el estado, y un atacante que reparte peticiones entre instancias multiplica el cupo; un redeploy lo reinicia todo. **Impacto:** `LOW` para F01 (MVP local/CI, una sola instancia, sin exposición pública); creciente en F02+ si se despliega. **Reproducción:** lectura de `rate-limit.ts:17-54` y del modelo serverless de `plan.md` §1. |
| **3. Causa** | **Estado:** `DEMOSTRADA`. **Evidencia:** `rate-limit.ts:18,29-50`; `config/index.ts:304-307`; `plan.md:11-25`. **Alternativas descartadas:** que la ventana fija esté mal calculada — descartado (V-9 y `rate-limit.test.ts` correctos); que falte `Retry-After` — descartado. |
| **4. Solución** | **Cambios aplicados:** ninguno. **Motivo técnico:** para F01 basta con la implementación en memoria; la migración a almacén compartido (DynamoDB/API Gateway/WAF) es decisión de F04/producción. **Intentos fallidos relevantes:** ninguno. |
| **5. Verificación** | **Verificador independiente:** Auditor. **Comando/procedimiento:** inspección del estado del limitador y del modelo de despliegue. **Resultado y evidencia:** 5/5 pruebas de mecánica (`F01-T03-rate-limit.txt`); sin prueba multi-instancia. **Regresión comprobada:** no aplica. **Límites:** no se evaluó el comportamiento real de Lambda (fuera de alcance). |
| **6. Pendientes** | **Riesgo residual:** límite no global en despliegue distribuido. **Cobertura ausente:** prueba multi-instancia / persistencia del cubo. **Responsable y siguiente paso:** CTO/Architect al planificar F02/F04; documentar el alcance del MVP; **no es riesgo aceptado sin `G-10`**. |
| **7. Aprendizaje** | **Prevención propuesta:** declarar explícitamente en el contrato de rate limiting si la definición de "configurable" incluye ámbito compartido o solo por instancia. **Ámbito candidato:** `PROPUESTA_GLOBAL` · **Estado:** `PENDIENTE_DE_EVALUAR` |

### Hallazgo `T03-A-03` — `.env.example` con marcadores JWT idénticos y sin longitud mínima exigida

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID: `T03-A-03` · Tarea: `F01-T03` · Fase: `P-01` · Loop: `1/3` · Fecha: `2026-11-17` · Entorno: inspección estática. **Severidad:** `LOW` · **Confianza:** `ALTA` · **Evidencia:** `REPRODUCED` · **Bloqueo:** NO |
| **2. Problema** | **Síntoma:** `.env.example:25-26` usa el **mismo** marcador para `JWT_ACCESS_SECRET` y `JWT_REFRESH_SECRET` (`REPLACE_WITH_…`), aunque el comentario pide «32+ caracteres». `config/index.ts` rechaza placeholders en `production` (`:268-277`) y patrones de secreto real (`:96-103,257-263`), pero **no** exige `accessSecret !== refreshSecret` ni una longitud mínima para valores no placeholder. **Esperado:** secreto HS256 suficiente y distinto por tipo de token. **Observado:** un operador podría copiar la plantilla y dejar/reutilizar el mismo valor corto; la separación access/refresh quedaría solo en el claim `typ` (que sí se verifica, V-4), no en la clave. **Impacto:** `LOW` — debilita la defensa en profundidad; no hay secreto real versionado (G-3 conforme). **Reproducción:** lectura comparativa de `.env.example:20-28` y `config/index.ts:248-277,298-303`. |
| **3. Causa** | **Estado:** `DEMOSTRADA`. **Evidencia:** `.env.example:25-26`; `config/index.ts:268-285`. **Alternativas descartadas:** fuga de secreto real — descartado (marcadores y `assertNoRealSecret` activos); cross-use de tokens — descartado (V-4/V-6, `typ` firmado). |
| **4. Solución** | **Cambios aplicados:** ninguno (`.env.example` y `config/index.ts` son propiedad de F00/T01, fuera del alcance de T03). **Motivo técnico:** la corrección es documental/de validación de config y debe pasar por control de alcance. **Intentos fallidos relevantes:** ninguno. |
| **5. Verificación** | **Verificador independiente:** Auditor. **Comando/procedimiento:** cotejo de `.env.example`, `config/index.ts` y `jwt.ts`. **Resultado y evidencia:** secretos/TTLs leídos de `loadConfig()` (V-5), sin literales; 0 secretos reales en el repositorio. **Regresión comprobada:** no aplica. **Límites:** no se midió la entropía de secretos de despliegue reales (no disponibles). |
| **6. Pendientes** | **Riesgo residual:** posibilidad operacional de secretos débiles/iguales. **Cobertura ausente:** validación de longitud/desigualdad. **Responsable y siguiente paso:** CTO (dueño de config/`.env.example`) — valorar marcadores distintos y validación `>=32` + desigualdad; **no es G-10**. |
| **7. Aprendizaje** | **Prevención propuesta:** toda plantilla con dos secretos simétricos debe usar marcadores distintos y validar longitud/desigualdad en `loadConfig`. **Ámbito candidato:** `PROPUESTA_GLOBAL` · **Estado:** `PENDIENTE_DE_EVALUAR` |

### Hallazgo `T03-A-04` — Persistencia de usuarios en memoria (concern P6 del Developer)

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID: `T03-A-04` · Tarea: `F01-T03` · Fase: `P-01` · Loop: `1/3` · Fecha: `2026-11-17` · Entorno: inspección estática. **Severidad:** `MEDIUM` · **Confianza:** `ALTA` · **Evidencia:** `REPRODUCED` · **Bloqueo:** NO para F01 |
| **2. Problema** | **Síntoma:** `InMemoryUserStore` (`user-store.ts:33-57`) guarda cuentas en `Map`; no hay tabla de usuarios ni adaptador DynamoDB. **Esperado:** cuentas persistentes en el producto; usuarios demo del seed (IN-13) disponibles tras reinicio. **Observado:** al reiniciar el proceso se pierden todas las cuentas; en arquitectura Lambda cada instancia tendría su propio almacén. **Impacto:** `MEDIUM` para el producto, **aceptable para F01** porque CA-03 se acredita con lógica de auth aislada (44/44) sin Docker/AWS, y la interfaz `UserStore` ya abstrae la persistencia. **Reproducción:** lectura de `user-store.ts:25-57` y `F01-T03-developer.md` §5.8 / P6. |
| **3. Causa** | **Estado:** `DEMOSTRADA`. **Evidencia:** `user-store.ts:33-57`; `F01-T03-task.md:28` prohíbe escribir `db/**`; `F01-T03-developer.md:142-150`. **Alternativas descartadas:** crear tabla efímera en el emulador — descartada por el Developer (añadiría Docker sin aportar a hash/JWT/aislamiento/rate limit). |
| **4. Solución** | **Cambios aplicados:** ninguno. **Motivo técnico:** separar interfaz de persistencia permite verificar auth antes de la infraestructura definitiva; el adaptador DynamoDB es competencia de F04. **Intentos fallidos relevantes:** ninguno. |
| **5. Verificación** | **Verificador independiente:** Auditor. **Comando/procedimiento:** revisión de la interfaz y de los 44 tests con store aislado por prueba (`F01-T03-unit.txt`, `F01-T03-refactor.txt`). **Resultado y evidencia:** CA-03 acreditado sin persistencia externa; sin tablas huérfanas. **Regresión comprobada:** no aplica. **Límites:** no se probó reinicio ni multinstancia. |
| **6. Pendientes** | **Riesgo residual:** pérdida de cuentas al reiniciar y divergencia entre instancias fuera de F01. **Cobertura ausente:** adaptador DynamoDB, idempotencia del seed frente al store. **Responsable y siguiente paso:** Architect/CTO — asignar el adaptador en F04 y coordinar con `F01-T04` (seed) para que los usuarios demo se creen reproduciblemente; **no se acepta riesgo por Lino (sin G-10)**: es disposición propuesta, no dispensa. |
| **7. Aprendizaje** | **Prevención propuesta:** declarar en el contrato de cada fase si el almacén es efímero y quién garantiza la persistencia antes del despliegue. **Ámbito candidato:** `PROPUESTA_GLOBAL` · **Estado:** `PENDIENTE_DE_EVALUAR` |

### Hallazgo `T03-A-05` — `LoginInput.password` sin tope superior (asimetría con registro)

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID: `T03-A-05` · Tarea: `F01-T03` · Fase: `P-01` · Loop: `1/3` · Fecha: `2026-11-17` · Entorno: inspección estática. **Severidad:** `LOW` · **Confianza:** `ALTA` · **Evidencia:** `REPRODUCED` · **Bloqueo:** NO |
| **2. Problema** | **Síntoma:** `catalog.ts:170` define `LoginInput.password` como `NON_EMPTY` (sin `max`), mientras `RegisterInput.password` tiene `max:128` (`:162`). **Esperado:** coherencia de límites y coste acotado en la verificación de login. **Observado:** una petición de login con una contraseña muy larga se pasa a `scrypt` (`service.ts:87`) y, para correo desconocido, también a la verificación dummy (`:84`), ampliando el trabajo por petición. **Impacto:** `LOW` — vector menor de amplificación de coste; no revela secretos ni bypassa el JWT. **Reproducción:** lectura de `catalog.ts:156-177`, `service.ts:78-93`, `password.ts:41-55`. |
| **3. Causa** | **Estado:** `DEMOSTRADA`. **Evidencia:** contratos y servicio citados. **Alternativas descartadas:** cambio en la política 8–128 aprobada — descartado: no se propone modificar el registro, solo aplicar el mismo techo al login; los contratos están congelados (hash `5d0082f8…`). |
| **4. Solución** | **Cambios aplicados:** ninguno (el catálogo está congelado en F01-T01). **Motivo técnico:** cualquier cambio exige control de cambios y regeneración de tipos, fuera de este loop. **Intentos fallidos relevantes:** ninguno. |
| **5. Verificación** | **Verificador independiente:** Auditor. **Comando/procedimiento:** contraste de los tres esquemas de auth y su consumo en `AuthService`. **Resultado y evidencia:** registro valida 8–128; login solo no-vacío. **Regresión comprobada:** no aplica. **Límites:** no se midió el efecto real de una contraseña de gran tamaño (sin explotación activa). |
| **6. Pendientes** | **Riesgo residual:** coste no acotado en login. **Cobertura ausente:** caso de contraseña sobrelarga en login. **Responsable y siguiente paso:** CTO con control de cambios de contratos; **no es riesgo aceptado sin `G-10`**. |
| **7. Aprendizaje** | **Prevención propuesta:** aplicar el mismo techo de longitud a todas las entradas que alimentan una función de derivación de clave. **Ámbito candidato:** `PROPUESTA_GLOBAL` · **Estado:** `PENDIENTE_DE_EVALUAR` |

### Hallazgo `T03-A-06` — Coste scrypt en el mínimo recomendado

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID: `T03-A-06` · Tarea: `F01-T03` · Fase: `P-01` · Loop: `1/3` · Fecha: `2026-11-17` · Entorno: inspección estática. **Severidad:** `INFO` · **Confianza:** `ALTA` · **Evidencia:** `REPRODUCED` · **Bloqueo:** NO |
| **2. Problema** | **Síntoma:** `password.ts:21-24` fija `N=16384 (2^14)`, `r=8`, `p=1`, `maxmem=64 MiB`. **Esperado:** coste suficiente para el entorno de despliegue. **Observado:** `2^14` es el piso recomendado por guías habituales para hashes interactivos; para un despliegue real suele recomendarse un valor mayor si el presupuesto de latencia lo permite. Cumple A-02 (`scrypt` nativo) y PR-06 (no se inventa política). **Impacto:** `INFO` — recomendación de endurecimiento, no incumplimiento de CA-03. **Reproducción:** lectura de `password.ts:19-31`. |
| **3. Causa** | **Estado:** `DEMOSTRADA` (elección de parámetros documentada en `F01-T03-developer.md` §5.1). **Evidencia:** `password.ts:19-31`; `F01-T03-hash.txt` (6/6). **Alternativas descartadas:** uso de `bcryptjs` — descartado por A-02 (ambas opciones válidas) y por no añadir dependencias (P8). |
| **4. Solución** | **Cambios aplicados:** ninguno; el Auditor no impone preferencias de rendimiento como requisito. **Motivo técnico:** cualquier subida de coste debe medir latencia en el entorno real y pasa por control de cambios. **Intentos fallidos relevantes:** ninguno. |
| **5. Verificación** | **Verificador independiente:** Auditor. **Comando/procedimiento:** inspección de constantes y comparación con la práctica habitual. **Resultado y evidencia:** parámetros fijos, sal 16 B, digest 64 B, `timingSafeEqual`. **Regresión comprobada:** no aplica. **Límites:** no se benchmarkingó el coste real. |
| **6. Pendientes** | **Riesgo residual:** margen de endurecimiento. **Cobertura ausente:** medición de latencia por hash. **Responsable y siguiente paso:** CTO/Developer al dimensionar producción; **no es riesgo aceptado por Lino**. |
| **7. Aprendizaje** | **Prevención propuesta:** documentar los parámetros de hash y su justificación de latencia en la decisión técnica. **Ámbito candidato:** `PROPUESTA_GLOBAL` · **Estado:** `PENDIENTE_DE_EVALUAR` |

### Hallazgo `T03-A-07` — Evidencia de ejecución no reproducida por este rol

| Campo | Detalle |
|---|---|
| **1. Identificación** | ID: `T03-A-07` · Tarea: `F01-T03` · Fase: `P-01` · Loop: `1/3` · Fecha: `2026-11-17` · Entorno: frontera de roles. **Severidad:** `INFO` · **Confianza:** `ALTA` · **Evidencia:** `CORROBORATED` · **Bloqueo:** NO |
| **2. Problema** | **Síntoma:** las corridas verdes (44/44, 150/150, typecheck/lint) provienen del Developer y del Tester; el Auditor no las reejecuta. **Esperado:** revisión de riesgos sin duplicar la suite funcional (METHODOLOGY §3.1 y contrato de rol). **Observado:** diez artefactos `evidence/F01-T03-*.txt` con comandos, exit codes y timestamps coherentes; raíz normalizada `<PROJECT_ROOT>`. **Impacto:** `INFO` — limitación declarada de cobertura, no defecto. **Reproducción:** lectura cruzada de los diez artefactos. |
| **3. Causa** | **Estado:** `DEMOSTRADA` (restricción de alcance del encargo). **Evidencia:** `F01-T03-{red,green,refactor,hash,jwt,isolation,rate-limit,typecheck,lint,unit}.txt`. **Alternativas descartadas:** retractar la evidencia por no ser propia — descartado: se califica `CORROBORATED`, no fabricada. |
| **4. Solución** | **Cambios aplicados:** ninguno. **Motivo técnico:** preservar independencia Tester/Auditor. **Intentos fallidos relevantes:** ninguno. |
| **5. Verificación** | **Verificador independiente:** Auditor (revisión documental). **Comando/procedimiento:** contraste de exit codes, conteos y marcas de tiempo; análisis estático propio de las rutas de seguridad (V-1…V-10). **Resultado y evidencia:** coherentes; 0 secretos/rutas absolutas en los artefactos. **Regresión comprobada:** no aplica. **Límites:** no se ejecutaron pruebas propias. |
| **6. Pendientes** | **Riesgo residual:** ninguno para `CA-03`. **Cobertura ausente:** ejecución propia. **Responsable y siguiente paso:** Tester (dictamen funcional) y Architect (cierre); **no aceptado por Lino**. |
| **7. Aprendizaje** | **Prevención propuesta:** declarar en cada auditoría de riesgo 3 qué se califica `REPRODUCED`, `CORROBORATED` o `INDICATIVE`. **Ámbito candidato:** `PROPUESTA_GLOBAL` · **Estado:** `PENDIENTE_DE_EVALUAR` |

## 4. Rutas examinadas y descartadas

- **Alg-confusionJWT:** descartado. `jwt.ts:72` fija `{ alg:'HS256' }` y `hono/dist/utils/jwt/jwt.js:50` rechaza cualquier `header.alg` distinto; `sign` también fija HS256. `crit` se rechaza en la validación de cabecera de la librería.
- **Claim `typ` falificado desde cabecera:** descartado. El `typ` relevante es un claim firmado (`jwt.ts:85`) y el payload se verifica antes de leerse; la cabecera `typ` de la librería no sustituye al claim.
- **Identidad por cabeceras modificables:** descartado para autorización. `requireAuth` toma `userId` del `sub` del JWT (V-7); las cabeceras `x-*` solo alimentan el limitador y son el objeto de `T03-A-01`.
- **Oracle de existencia en 404:** descartado. Cuerpo literal idéntico y sin IDs para ajeno/inexistente; 401 evalúa primero (`isolation.test.ts:34-58`).
- **Contraseña en logs/errores:** 0 apariciones como valor en `errors.ts`, reportes o evidencia; solo la contraseña de prueba de los tests, nunca persistida.
- **Secretos reales / rutas Windows absolutas / `:9324` activo:** 0 en código, tests, evidencia T03 ni en este reporte (raíz normalizada `<PROJECT_ROOT>`); los marcadores `REPLACE_WITH_…` son locales por diseño (G-3/PR-08).
- **Exposición de hash interno:** `AuthenticatedUser` no incluye `passwordHash` (`service.ts:45-47`); `service.test.ts:26-33` lo verifica.

## 5. Conclusión

**`READY_WITH_CONCERNS`** · **Cobertura:** `SUFFICIENT` para código, configuración, contratos, tests y evidencia del alcance; `LIMITED` únicamente para ejecución propia (no reproducida, calificada `CORROBORATED` — `T03-A-07`).

- **Hallazgos `CRITICAL`/`HIGH`: 0.** Bloqueantes para `CA-03`: **0**.
- **Concerns:** `T03-A-01` (MEDIUM, clave de rate limit suplantable), `T03-A-02` (LOW, limitador por proceso), `T03-A-03` (LOW, marcadores JWT idénticos / sin longitud mínima), `T03-A-04` (MEDIUM, store en memoria — P6, aceptable solo para F01), `T03-A-05` (LOW, login sin tope de contraseña), `T03-A-06` (INFO, coste scrypt), `T03-A-07` (INFO, evidencia no propia). Ninguno exige reabrir el loop ni modificar `backend/src/auth/**`.
- **CA-03:** `register`/`login`/`refresh` con hash scrypt y sal por usuario, `timingSafeEqual`, hash manipulado rechazado, anti-enumeración, JWT HS256 con claims verificados, `401`/`404` sin oracle y rate limit configurable — acreditado por V-1…V-9 y 44/44 pruebas (`CORROBORATED`).
- **Decisión 8–128:** aprobada por CTO/Lino en el addendum de `F01-T01-auditor.md` (**no G-10**); PR-06 satisfecho.
- **G-3/PR-08:** sin secretos reales, rutas Windows absolutas nuevas ni `:9324` activo; G-8 sin dependencias nuevas (P8 conforme: `scrypt` nativo + `hono/jwt` ya instalado).
- **Frontera:** no se emite `PASSED`/`NO-PASSED`; no se concedió `G-10`; ningún riesgo queda registrado como aceptado por Lino.

**Recomendación al Architect:** cerrar `F01-T03` sin bloqueantes, registrando `T03-A-01` y `T03-A-04` como concerns con responsable y fase (`T03-A-01` antes de exponer login en F02; `T03-A-04` con el adaptador de F04 y la coordinación con `F01-T04`), y trasladar `T03-A-03`/`T03-A-05` al CTO como ajustes de configuración/contratos con control de cambios. La auditoría obligatoria de riesgo 3 queda satisfecha sin hallazgos que impidan el cierre de `F01-T03`.
