# Auditoría de cierre F03 — revisión estática de riesgo 2

- **Fecha:** 2026-11-17
- **Rol:** Auditor (riesgo 2)
- **Snapshot:** árbol de trabajo observado durante P-03, con Designer detenido y cambios paralelos visibles de F02.
- **Método:** lectura de fuentes, SPA, cliente API, pruebas y evidencia existente. Solo lectura para el código y tests. No se ejecutaron comandos de build/typecheck/tests, Playwright, Docker ni servicios.
- **Conclusión:** **NOT_READY**
- **Evidencia:** revisión estática **CORROBORATED** (el request y la respuesta del handler se cotejaron directamente con el cliente y acuerdo F03).
- **Confianza global:** alta en divergencia de contrato; media en los riesgos de sesión/URLs por no ejecutar navegador ni servidor.
- **Cobertura:** **LIMITED**. Se inspeccionaron los archivos frontend existentes, la unidad `tests/unit/frontend/core.test.ts`, `tests/e2e/frontend-flow.spec.ts`, reportes/evidencia F03 disponibles y `backend/src/api/jobs.ts` para comparar el endpoint observado. Quedan fuera pruebas dinámicas, configuración de despliegue/CSP/CORS, headers HTTP reales, análisis de dependencias y verificación visual/AT con lector de pantalla.

## Hallazgos

### F03-AUD-01 — HIGH — El contrato de creación de lote no es interoperable con F02

1. **ID:** F03-AUD-01.
2. **Título:** `POST /jobs` diverge entre la SPA y el handler F02 observado.
3. **Contexto:** El acuerdo frontend↔API F03 documenta request `{ preset, files: [{ fileName, contentType, sizeBytes }] }` y response `{ job, uploads }` con URLs PUT presignadas. El cliente en `frontend/src/api/jobs.ts` implementa ese acuerdo.
4. **Resultado esperado:** el servidor acepta el cuerpo acordado, genera un plan de subida y devuelve `uploads`, permitiendo que el navegador suba directamente a S3 y luego confirme.
5. **Resultado observado:** el handler actual `backend/src/api/jobs.ts` lee `body.images` con objetos `{ imageId, bytes }`, crea y responde `{ job }` (201); no genera ni devuelve `uploads`. Por ello, la petición SPA será rechazada por validación y, aun si se aceptase, la UI no recibe el plan que necesita. La prueba E2E simula el acuerdo F03 y no ejercita el handler observado. **El POST /jobs observado en F02 diverge del acuerdo F03 y no se certifica como interoperable.**
6. **Impacto:** creación/subida/confirmación de lotes no puede funcionar de extremo a extremo con el snapshot de F02. Es un bloqueo de cierre funcional e integración, no evidencia de bypass de aislamiento.
7. **Resolución/seguimiento:** coordinación F02/Architect/CTO para adoptar un contrato común o devolver la decisión al CTO antes de cambiar contratos congelados. Repetir verificación de integración contra doble de API que implemente exactamente el contrato acordado; mantener explícito que esta auditoría no certifica interoperabilidad.

- **Evidencia:** CORROBORATED.
- **Confianza:** alta.
- **Cobertura:** SUFFICIENT para demostrar divergencia de formas; limitada para determinar cuál será el contrato final de F02.

### F03-AUD-02 — MEDIUM — Tokens bearer y refresh quedan expuestos a código ejecutable del mismo origen

1. **ID:** F03-AUD-02.
2. **Título:** access y refresh tokens se persisten en `sessionStorage`.
3. **Contexto:** `frontend/src/App.tsx` serializa el objeto completo `AuthSession` (incluye ambos JWT) en `sessionStorage` tras login/registro y refresh; al inicializar recupera el refresh token desde ese almacenamiento.
4. **Resultado esperado:** la sesión persiste solo con el mínimo de credencial necesario y cuenta con mitigaciones de despliegue contra ejecución de scripts no confiables; cierre/expiración invalida el estado local de la sesión.
5. **Resultado observado:** tokens legibles por cualquier script que se ejecute en el origen quedan disponibles durante la pestaña. No se observó `dangerouslySetInnerHTML` ni interpolación HTML cruda en el código inspeccionado; los datos dinámicos se muestran como texto React. No se pudo comprobar CSP, headers, dependencias transitivas ni superficie de XSS de despliegue.
6. **Impacto:** un XSS futuro o script de tercero comprometido podría extraer refresh/access JWT y operar como el usuario hasta expiración/revocación del refresh. El almacenamiento tab-scoped reduce persistencia frente a `localStorage`, pero no protege contra XSS.
7. **Resolución/seguimiento:** revisar diseño de sesión con CTO/F02 (cookie HttpOnly/SameSite si el contrato de arquitectura lo permite) o documentar controles concretos de XSS/CSP y ciclo de vida/revocación. No se atribuye explotación activa.

- **Evidencia:** CORROBORATED para almacenamiento; riesgo de abuso INDICATIVE.
- **Confianza:** alta para ubicación de tokens; media para impacto operacional sin headers/servidor.
- **Cobertura:** LIMITED.

### F03-AUD-03 — MEDIUM — La SPA navega y carga previews desde URLs presignadas sin validar origen/esquema

1. **ID:** F03-AUD-03.
2. **Título:** URLs de descarga/previsualización aceptadas directamente desde la respuesta API.
3. **Contexto:** `frontend/src/api/jobs.ts` tipa `downloadUrl` como `string` y lo retorna sin validación. `App.tsx` asigna la URL a imágenes de comparación y abre la URL para descarga individual; el upload también hace `PUT` al `uploadUrl` devuelto por API.
4. **Resultado esperado:** aceptar únicamente URL absoluta HTTPS en el conjunto de orígenes de almacenamiento permitido, y fallar de forma segura ante respuesta malformada o inesperada.
5. **Resultado observado:** no hay comprobación de esquema, host, usuario/contraseña embebidos ni origen. El E2E usa hosts `upload.test`/`preview.test` y contenido de imagen simulado; no prueba URL hostil ni política de allowlist.
6. **Impacto:** si la respuesta API se manipula o el endpoint/origen de API se configura de forma no confiable, el navegador puede enviar el binario seleccionado a un destino arbitrario mediante PUT o cargar contenido de un host no previsto. Para previews en `<img>`, el contexto limita ejecución directa de SVG en navegadores modernos, pero no elimina solicitudes de red a origen inesperado. No se afirma que una API autenticada normal permita a un usuario forjar estas respuestas.
7. **Resolución/seguimiento:** definir el conjunto de hosts de almacenamiento por entorno y validar `https:` + host permitido antes de cada PUT, preview y navegación; probar URL inválida, `javascript:`, HTTP y host ajeno. Evitar incluir query firmada en logs/telemetría.

- **Evidencia:** CORROBORATED para ausencia de validación; escenario de manipulación INDICATIVE.
- **Confianza:** media.
- **Cobertura:** LIMITED; no se ejecutó navegador ni se inspeccionaron políticas de red del entorno.

### F03-AUD-04 — MEDIUM — Cierre de sesión conserva datos privados del lote en memoria visible

1. **ID:** F03-AUD-04.
2. **Título:** logout solo limpia la sesión persistida, no el historial ni resultados renderizados.
3. **Contexto:** el botón de cierre en `frontend/src/App.tsx` ejecuta `setSession(null)` y elimina `mediashrink-session`, pero no limpia `jobs`, `activeJob`, `jobDetail`, `sources`, ni mensajes asociados.
4. **Resultado esperado:** tras logout, retirar de la vista y memoria de componentes los datos de usuario/lotes y cancelar el polling/preview privado.
5. **Resultado observado:** el historial y detalle que ya estaban cargados permanecen en estado React y se siguen renderizando tras logout; imágenes ya descargadas como preview pueden mantenerse visibles. El polling se cancela por dependencia `session`, pero el estado `jobDetail` no se limpia.
6. **Impacto:** en un dispositivo compartido, el siguiente usuario de la pestaña puede ver identificadores, fechas, métricas y previews del usuario anterior, aunque no tenga sus tokens. Riesgo de confidencialidad local de alcance MEDIUM.
7. **Resolución/seguimiento:** en logout y expiración limpiar de forma coordinada datos de usuario, resultados y errores; revocar URLs blob creadas y cancelar solicitudes activas cuando corresponda. Añadir prueba de regresión de logout con lote cargado.

- **Evidencia:** CORROBORATED por lectura del manejador y estado renderizado.
- **Confianza:** alta.
- **Cobertura:** SUFFICIENT para el comportamiento visible en el código; no se evaluó caché del navegador/servidor.

### F03-AUD-05 — MEDIUM — Los mensajes de error de autenticación muestran texto de servidor sin normalización

1. **ID:** F03-AUD-05.
2. **Título:** texto API presentado directamente como mensaje al usuario.
3. **Contexto:** `frontend/src/api/auth.ts` extrae `message` o `error.message` de cualquier respuesta no exitosa y lo lanza como `ApiError`; `App.tsx` lo presenta en un nodo React con `role="alert"`.
4. **Resultado esperado:** errores de usuario accionables y acotados, sin detalles internos, stack traces, identificadores sensibles ni datos reflejados por el servidor.
5. **Resultado observado:** el render React escapa texto y no se encontró sink HTML crudo en la UI inspeccionada, por lo que no se demuestra XSS. Sin embargo, cualquier string de mensaje proporcionado por servidor se expone literalmente en pantalla. Los errores de jobs usan mensaje genérico con status HTTP.
6. **Impacto:** posible filtración de detalles internos si F02 propaga mensajes de excepción; además, los mensajes podrían incluir datos reflejados. Severidad acotada al contenido que devuelva el servicio; no hay prueba de que la implementación F02 actual exponga secretos.
7. **Resolución/seguimiento:** mapear códigos públicos conocidos a mensajes locales y usar fallback genérico para códigos/descripciones desconocidos; verificar que F02 no incluya stack, tokens, URL firmadas ni datos privados en mensajes.

- **Evidencia:** CORROBORATED para la propagación literal; escenario de filtración INDICATIVE.
- **Confianza:** media.
- **Cobertura:** LIMITED; no se inspeccionó exhaustivamente cada ruta de error F02.

### F03-AUD-06 — MEDIUM — Refresh no se aplica uniformemente a operaciones privadas

1. **ID:** F03-AUD-06.
2. **Título:** llamadas GET detalle, descarga, ZIP y DELETE no renuevan el token ante 401.
3. **Contexto:** se observa wrapper de refresh/reintento en creación/confirmación/listado y un camino específico en `loadJobs`; `downloadImage`, `downloadZip`, `deleteJob` y polling llaman directamente al cliente con el access token actual.
4. **Resultado esperado:** toda operación privada con access expirado intenta una renovación controlada una vez o termina la sesión con estado coherente y mensaje de reautenticación.
5. **Resultado observado:** polling reintenta errores transitorios sin refrescar; descarga/borrado/ZIP reportan error y mantienen sesión. La experiencia puede quedar parcialmente funcional hasta otra ruta que sí refresque.
6. **Impacto:** errores evitables y comportamiento de sesión inconsistente; el código no revela tokens. Severidad de confiabilidad/auth UX, no bypass de autorización.
7. **Resolución/seguimiento:** centralizar fetch autenticado con refresh single-flight y reintento único para todas las rutas; al fallar refresh limpiar sesión y datos privados. Añadir pruebas de 401 para polling y las acciones de descarga/borrado.

- **Evidencia:** CORROBORATED.
- **Confianza:** alta.
- **Cobertura:** SUFFICIENT para las llamadas encontradas en `App.tsx` y `jobs.ts`; no se ejecutaron escenarios de expiración.

### F03-AUD-07 — LOW — Validación frontend puede discrepar de límites efectivos del servidor

1. **ID:** F03-AUD-07.
2. **Título:** límites de carga codificados como defaults constantes.
3. **Contexto:** `App.tsx` fija `maxFileSizeMb: 15` y `maxImagesPerBatch: 20`; los tipos generados incluyen `LimitsConfig`, pero no se consume una fuente runtime.
4. **Resultado esperado:** la UI presenta límites publicados por el despliegue actual, manteniendo la API como validación autoritativa.
5. **Resultado observado:** Designer documenta que los valores coinciden con defaults actuales, pero no con overrides de entorno; una instalación personalizada puede aceptar localmente archivos que backend rechaza o bloquear archivos permitidos.
6. **Impacto:** confusión y reintentos fallidos, sin elusión de límites porque el servidor vuelve a validar. El tamaño y cantidad del archivo se transmiten en request según el acuerdo F03, aunque el handler F02 observado usa otra forma y no se certifica ese flujo.
7. **Resolución/seguimiento:** acordar una configuración pública de límites o dejar claro que los valores son orientación y presentar errores de servidor con formato accionable; no aflojar validación server-side.

- **Evidencia:** CORROBORATED en el código y reporte Designer.
- **Confianza:** alta.
- **Cobertura:** SUFFICIENT para límites frontend; no se compararon todos los perfiles de despliegue.

### F03-AUD-08 — LOW — El E2E mock no representa formatos reales de salida ni acredita privacidad EXIF

1. **ID:** F03-AUD-08.
2. **Título:** fixtures E2E acreditan UI, no sanitización ni interoperabilidad real.
3. **Contexto:** `tests/e2e/frontend-flow.spec.ts` intercepta todas las rutas y devuelve un SVG pequeño bajo URL `.svg` para la vista previa, aunque declara un resultado WebP/AVIF y `exifStripped: true`.
4. **Resultado esperado:** separar claramente el objetivo de UI mock del control de privacidad de pipeline, y usar fixtures compatibles con formato declarado cuando se verifique comparativa visual.
5. **Resultado observado:** el test verifica el badge EXIF a partir del booleano mock y el ahorro negativo mostrado; no inspecciona metadatos de bytes ni la salida worker. El flujo no habla con backend y el handler de creación observado además diverge (F03-AUD-01).
6. **Impacto:** riesgo de sobreinterpretar el E2E como evidencia de EXIF eliminado o formatos/contrato interoperables. La privacidad de metadatos sigue dependiendo de las pruebas backend F02/F01; esta auditoría no las re-ejecutó.
7. **Resolución/seguimiento:** mantener el alcance del E2E etiquetado como UI contra doble; verificar eliminación EXIF/GPS con pruebas de worker independientes y una integración compatible antes del cierre global. No presentar el badge de fixture como evidencia de sanitización efectiva.

- **Evidencia:** CORROBORATED por fixture y assertions.
- **Confianza:** alta.
- **Cobertura:** SUFFICIENT para delimitar el alcance de la prueba; no se auditaron salidas reales del worker.

### F03-AUD-09 — LOW — Accesibilidad de foco de teclado para selector de archivos no queda demostrada

1. **ID:** F03-AUD-09.
2. **Título:** input de archivo visualmente oculto y activación solo verificada por label sin prueba de teclado/AT.
3. **Contexto:** el selector usa `<input type="file" className="visually-hidden">` y un `<label htmlFor>` estilizado como enlace; CSS proporciona foco visible a input, label y controles, pero el input se recorta a 1×1 px. No hay prueba DOM/RTL ni evidencia de teclado/lector de pantalla en los archivos revisados.
4. **Resultado esperado:** control de carga alcanzable y operable con teclado, con foco perceptible en el activador y estado/errores anunciados correctamente.
5. **Resultado observado:** hay nombres/roles y `role="alert"`/`aria-live` en varias zonas; el input recortado recibe foco visible en sí mismo, que puede no resultar perceptible dado el clipping. No se encontró evidencia automatizada o manual que resuelva el comportamiento del label/control en navegador/AT.
6. **Impacto:** barrera potencial de accesibilidad en una acción principal, con confianza limitada porque no se probó en navegador/tecnología asistiva. Otros controles tienen `:focus-visible` y el CSS contempla `prefers-reduced-motion`.
7. **Resolución/seguimiento:** comprobar teclado y lector de pantalla en navegador; considerar un botón/estilo de foco explícito para el selector. Auditar además contraste efectivo de ambos temas en la vista renderizada antes del cierre visual.

- **Evidencia:** INDICATIVE.
- **Confianza:** baja-media.
- **Cobertura:** INSUFFICIENT para emitir fallo de conformidad accesible.

## Síntesis de cierre

La divergencia de `POST /jobs` es un bloqueo comprobado de interoperabilidad del snapshot y basta para concluir **NOT_READY**. Hay concerns adicionales MEDIUM sobre almacenamiento/limpieza de sesión, confianza en URLs presignadas, errores de servidor y refresh inconsistente; deben resolverse o someterse a decisión explícita de CTO/Lino. No se detectó XSS demostrado: la inspección no encontró renderizado HTML crudo, pero el análisis fue estático y limitado. El badge `exifStripped` representa un dato de API y el mock E2E no verifica bytes ni ausencia EXIF/GPS. No se ejecutaron build/typecheck/tests/Playwright por instrucción; las evidencias de Tester/Designer citadas son reportadas por los artefactos existentes y no revalidadas aquí. No se tocó `STATE.md`, `docs/sdd/tasks.md` ni archivos de producto.

## Addendum append-only — seguimiento Auditor Loop 3 (2026-11-17)

### Alcance, fuentes y dictamen actualizado

Revisión estática de `AGENTS.md`, `STATE.md`, SDD y paquete P-03, contrato de arquitectura, tipos generados congelados, contrato Auditor, reporte Designer de Loop 2/3 y reportes/evidencias Tester, además del snapshot actual permitido de `frontend/src/**` y `tests/{unit/frontend,e2e}/` incluido el wrapper `tests/e2e/vite-webserver.mjs`. No se ejecutaron comandos de prueba, build, Docker ni API real. La evidencia de ejecución se atribuye a los reportes citados y no fue reproducida en esta auditoría.

**Dictamen: NOT_READY.** La severidad del hallazgo **F03-AUD-01 permanece HIGH**: Lino decidió que F02 adopte el acuerdo F03 y que F03 espere confirmación del responsable F02. El acuerdo documenta `files` → `{job, uploads}`, mientras el snapshot auditado previamente de F02 esperaba `images` → `{job}`. No hay confirmación/evidencia posterior de F02 en las fuentes revisadas; por tanto, el acuerdo sigue siendo una propuesta operativa para adopción y no se presume implementado. El mock E2E no acredita interoperabilidad.

La evidencia Tester Loop 3 registra Playwright iniciado con puerto libre, los tres casos anunciados y el tercero sin cierre durante más de ocho minutos; el proceso propio fue detenido, no hubo resumen ni resultado final atribuible a Playwright y no quedó listener. Por instrucción del encargo, los resultados de Loop 2 son la referencia de verificación: typecheck PASSED, build PASSED y unitarias 241/241 PASSED. Tester Loop 3 no los repitió. Ninguno compensa el NO-PASSED de Playwright ni la falta de integración F02.

### Estado actualizado de F03-AUD-01…09

| ID | Severidad actual | Estado | Evidencia de seguimiento |
|---|---|---|---|
| F03-AUD-01 | HIGH | OPEN | La decisión de Lino requiere confirmación de F02. El acuerdo F03 sigue sin evidencia de adopción por F02; snapshot previo de handler y contrato documentado divergen (`images`/`{job}` frente a `files`/`{job, uploads}`). No se inspecciona ni modifica backend en este seguimiento. |
| F03-AUD-02 | MEDIUM residual | RESOLVED para el defecto descrito | `App.tsx` persiste mediante `serializeStoredRefreshToken` solo `{refreshToken}` en `sessionStorage`; el access token ya no se serializa. El refresh token sigue siendo legible por scripts del mismo origen, riesgo residual inherente al almacenamiento web, pero distinto del hallazgo original de persistir ambos tokens. No se afirma mitigación de XSS. |
| F03-AUD-03 | MEDIUM | OPEN | `jobs.ts` valida URL absoluta HTTPS, host presente y ausencia de credenciales embebidas para PUT y descargas. No hay allowlist de hosts/orígenes; sigue abierta la parte del hallazgo sobre origen de almacenamiento permitido y política de host. |
| F03-AUD-04 | MEDIUM | RESOLVED en el estado React inspeccionado | `clearPrivateState()` elimina sesión persistida, jobs, lote activo/detalle, archivos seleccionados, mensajes y errores; cambia `sourcesResetKey` para desmontar comparativas. No se evaluaron caché del navegador ni invalidación remota de previews ya solicitadas. |
| F03-AUD-05 | MEDIUM | RESOLVED para mensajes de autenticación | `auth.ts` mapea códigos públicos conocidos a cadenas locales y usa fallback genérico; no presenta `message` libre del servidor. El texto HTTP de jobs es genérico y contiene status. Cobertura estática, sin inspección de cada respuesta real F02. |
| F03-AUD-06 | MEDIUM | RESOLVED en las rutas privadas encontradas | `App.tsx` envuelve polling/detalle, creación, confirmación, lista, descarga individual, ZIP y borrado con `authorized()`, que refresca y reintenta una vez ante 401 y limpia estado privado si refresh/reintento devuelve 401. No se verificó ejecución completa en browser debido al Playwright sin cierre. |
| F03-AUD-07 | LOW | OPEN | La UI continúa construyendo `limits` con defaults 15 MB/20 imágenes; el tipo `LimitsConfig` no tiene origen runtime en el snapshot. Los overrides pueden discrepar, aunque servidor revalida. |
| F03-AUD-08 | LOW | OPEN | E2E intercepta la API y el resultado EXIF/formato proviene de fixtures. No verifica bytes WebP/AVIF ni eliminación efectiva EXIF/GPS. Playwright Loop 3 no concluyó; mock no sustituye integración/pipeline. |
| F03-AUD-09 | LOW | OPEN | El input file sigue con clase `visually-hidden`/recorte y label activador. No hay evidencia concluyente de teclado/lector de pantalla; la ejecución E2E no finalizó y el análisis sigue estático. |

### Hallazgos relevantes con siete campos

#### F03-AUD-01 — HIGH — Divergencia de contrato de creación de lote sigue sin confirmación F02 — OPEN

1. **ID:** F03-AUD-01.
2. **Título:** contrato `POST /jobs` frontend↔F02 no acreditado como adoptado.
3. **Contexto:** Lino eligió que F02 adopte el acuerdo F03 y mantener F03 pendiente hasta confirmación del responsable F02. El acuerdo define request `files` y respuesta `{ job, uploads }` para carga presignada; el snapshot F02 revisado en la auditoría base esperaba `images` y devolvía `{ job }`.
4. **Resultado esperado:** evidencia del propietario F02 de adopción compatible del acuerdo, seguida de verificación de interoperabilidad en un entorno autorizado.
5. **Resultado observado:** no aparece confirmación posterior en los reportes/evidencias revisados. El cliente actual sigue enviando `files` y consume `uploads`; no se atribuye cambio al backend ni se supone que F02 lo haya adoptado.
6. **Impacto:** creación/carga no puede considerarse interoperable; bloquea cierre de F03. El mock solo acredita comportamiento contra doble.
7. **Resolución/seguimiento:** responsable F02 confirma/adopta el acuerdo y aporta evidencia compatible; mantener abierto hasta entonces. No cambiar el contrato congelado ni backend desde F03.

- **Evidencia:** CORROBORATED para forma del cliente/acuerdo y decisión pendiente; divergencia del handler atribuida al snapshot de la auditoría inicial, sin nueva inspección de backend en este seguimiento.
- **Confianza:** alta en que no existe confirmación en el expediente revisado; media-alta en estado actual del handler por no volver a inspeccionarlo.
- **Cobertura:** LIMITED para implementación F02 actual; SUFFICIENT para mantener el gate abierto por ausencia de la confirmación requerida.

#### F03-AUD-03 — MEDIUM — URLs sin lista de orígenes permitidos — OPEN

1. **ID:** F03-AUD-03.
2. **Título:** validación HTTPS añadida, sin allowlist de almacenamiento.
3. **Contexto:** `frontend/src/api/jobs.ts` llama `validateSecureUrl` antes del PUT y valida el enlace de descarga; el helper comprueba parseo, `https:`, hostname y ausencia de usuario/contraseña.
4. **Resultado esperado:** validar también que el hostname/origen pertenezca a la configuración de almacenamiento permitida por entorno.
5. **Resultado observado:** cualquier host HTTPS que supere esas comprobaciones se acepta. No hay allowlist runtime en el snapshot revisado.
6. **Impacto:** una respuesta API manipulada o endpoint no confiable podría dirigir PUT/previews/descargas a un origen ajeno; no se demuestra explotación ni manipulación real.
7. **Resolución/seguimiento:** acordar hosts por entorno y rechazar host/origen fuera de esa lista; añadir cobertura de URL externa, HTTP y esquema inválido cuando se autorice el loop correspondiente.

- **Evidencia:** CORROBORATED por inspección estática del helper y sus puntos de uso.
- **Confianza:** media.
- **Cobertura:** LIMITED; sin ejecución browser ni configuración de despliegue.

#### F03-AUD-07 — LOW — Límites locales no consumen configuración runtime — OPEN

1. **ID:** F03-AUD-07.
2. **Título:** defaults de validación pueden diferir por despliegue.
3. **Contexto:** el snapshot de `App.tsx` inicializa máximos de 15 MB y 20 imágenes; `validateFiles` recibe esos límites y muestra los valores al usuario.
4. **Resultado esperado:** servir límites públicos por despliegue o etiquetarlos explícitamente como defaults orientativos, manteniendo validación autoritativa backend.
5. **Resultado observado:** no se observa consumo runtime de `LimitsConfig` ni endpoint de configuración.
6. **Impacto:** rechazos o intentos evitables para instalaciones con overrides; no elude validación server-side.
7. **Resolución/seguimiento:** acordar fuente de configuración pública con responsable de API/CTO y reflejarla en cliente sin debilitar validación servidor.

- **Evidencia:** CORROBORATED en snapshot de frontend y reporte Designer.
- **Confianza:** alta.
- **Cobertura:** SUFFICIENT para cliente; LIMITED respecto de perfiles de despliegue.

#### F03-AUD-08 — LOW — Mock no prueba formato real ni saneamiento EXIF/GPS — OPEN

1. **ID:** F03-AUD-08.
2. **Título:** evidencia UI simulada no demuestra privacidad del pipeline.
3. **Contexto:** Playwright intercepta HTTP y fija campos de formato/`exifStripped`; las pruebas no procesan salidas reales del worker.
4. **Resultado esperado:** delimitar el E2E como prueba UI y mantener pruebas independientes sobre bytes/formato y eliminación EXIF/GPS del pipeline.
5. **Resultado observado:** los artefactos solo acreditan fixture/marcador en UI. Además, Tester Loop 3 no obtuvo resultado final de Playwright.
6. **Impacto:** presentar el badge como evidencia efectiva de privacidad o compatibilidad de formato sería una sobreinterpretación.
7. **Resolución/seguimiento:** no usar mock como evidencia del worker; verificar sanitización y formato en fase/pipeline autorizado y completar Playwright para las interacciones UI.

- **Evidencia:** CORROBORATED por alcance del spec mock y reporte Tester; resultado final E2E NO-PASSED.
- **Confianza:** alta.
- **Cobertura:** SUFFICIENT para declarar los límites del mock; no cubre pipeline real.

#### F03-AUD-09 — LOW — Operabilidad accesible del selector no demostrada — OPEN

1. **ID:** F03-AUD-09.
2. **Título:** selector de archivos con foco/teclado sin evidencia concluyente.
3. **Contexto:** `App.tsx` conserva input file `visually-hidden` activado por label; el spec incluye escenario teclado/errores, pero la corrida Loop 3 queda detenida en ese tercer caso.
4. **Resultado esperado:** evidencia de activación con teclado, foco visible y anuncio de errores en navegador/tecnología asistiva apropiada.
5. **Resultado observado:** hay estructura semántica y estilos de foco en el proyecto, pero no existe resultado de Playwright ni verificación manual concluyente en los reportes revisados.
6. **Impacto:** barrera potencial en una acción principal; no hay base para afirmar incumplimiento observado.
7. **Resolución/seguimiento:** completar revisión accesible de teclado/lector de pantalla y corregir el control solo si se reproduce el problema.

- **Evidencia:** INDICATIVE.
- **Confianza:** baja-media.
- **Cobertura:** INSUFFICIENT para dictaminar conformidad.

#### F03-LOOP3-E2E-01 — MEDIUM — Playwright termina sin resumen al quedar bloqueado en caso 3 — OPEN

1. **ID:** F03-LOOP3-E2E-01.
2. **Título:** suite E2E no produce resultado final con el wrapper nuevo.
3. **Contexto:** Tester Loop 3 usa puerto libre, wrapper Vite dedicado, `workers=1`; los tres casos se anuncian y la ejecución queda en el caso de validación/teclado por más de ocho minutos.
4. **Resultado esperado:** Playwright concluye todos los casos con código de salida limpio y evidencia de teardown.
5. **Resultado observado:** el Tester detiene su proceso; no hay resumen ni exit code final atribuible a Playwright. La evidencia registra `LISTENER_AFTER=NO`. El wrapper usa la API de Vite y cierra en SIGINT/SIGTERM, pero su presencia no demuestra que el test termine.
6. **Impacto:** CA-01…CA-06 permanecen NO-PASSED en la evidencia Tester; no se certifican los flujos de navegador.
7. **Resolución/seguimiento:** investigar el paso bloqueante del tercer caso y obtener una corrida completa independiente de Tester; respetar que Loop 3 fue el último intento autorizado en el despacho vigente.

- **Evidencia:** CORROBORATED por `F03-loop3-tester-final-playwright.txt` y dictamen Tester Loop 3.
- **Confianza:** alta.
- **Cobertura:** SUFFICIENT para afirmar ausencia de cierre y resultado no certificable; LIMITED para causa raíz del bloqueo.

### Resolución de findings corregidos y límites

F03-AUD-02, F03-AUD-04, F03-AUD-05 y F03-AUD-06 quedan marcados **RESOLVED** respecto de los comportamientos concretos descritos originalmente, con evidencia estática del snapshot actual indicada arriba. No equivale a certificación de browser: el ciclo de refresh y el borrado local necesitan cobertura funcional independiente, y el refresh token conserva exposición a scripts same-origin. F03-AUD-03 permanece OPEN porque el nuevo control HTTPS no implementa allowlist de origen.

La evaluación de severidad no reduce F03-AUD-01: continúa HIGH y bloqueante por decisión explícita de Lino. Los hallazgos LOW abiertos son concerns de configuración, alcance de fixtures y accesibilidad. Playwright sigue NO-PASSED; build/typecheck/unitarias se informan PASSED solo en evidencia Loop 2 (incluidas 241/241 unitarias), sin repetición por Tester Loop 3. Auditoría estática de seguimiento: confianza alta en observaciones directas de frontend y evidencia de ejecución reportada; cobertura limitada donde faltan browser finalizado, configuración de despliegue o confirmación F02.

## Addendum — reevaluación acotada F03-AUD-01 tras F02-AUD-01

- **Fecha:** 2026-11-18
- **Rol:** Auditor F03 (reevaluación de interoperabilidad, solo lectura)
- **Alcance:** contrato `POST /jobs`, contraste entre `backend/src/api/jobs.ts`, `frontend/src/api/jobs.ts` y reportes F02-AUD-01. No se editaron código ni pruebas y no se ejecutaron verificaciones.
- **Evidencia:** inspección directa CORROBORATED; ejecución HTTP/PUT referida en evidencia Tester F02, revisada documentalmente y no reproducida por esta auditoría.
- **Conclusión de esta reevaluación:** **F03-AUD-01 RESOLVED** para correspondencia del contrato frontend↔F02. Esta conclusión no sustituye el gate de cierre F03 ni el dictamen final de Tester.
- **Confianza:** alta para las formas estáticas de request/response; media-alta para su operación real, respaldada por Tester F02 independiente y sin repetición aquí.
- **Cobertura:** LIMITED a creación del lote y plan de subida; no se certifican Playwright/lint de F03 ni todos los endpoints privados.

### F03-AUD-01 — HIGH — Contrato de creación de lote no interoperable — RESOLVED

1. **ID:** F03-AUD-01.
2. **Título:** divergencia entre el cliente SPA y `POST /jobs` F02.
3. **Contexto:** el hallazgo original observó que el cliente acordado enviaba `files` y consumía `{ job, uploads }`, mientras el handler entonces observado esperaba `images` y respondía `{ job }`.
4. **Resultado esperado:** el servidor acepta `{ preset, files: [{ fileName, contentType, sizeBytes }] }` y responde 201 con `{ job, uploads: [{ imageId, uploadUrl, method: 'PUT' }] }`, permitiendo carga directa de los archivos.
5. **Resultado observado:** el handler actual `backend/src/api/jobs.ts` define claves permitidas `preset/files`, valida los tres campos de cada archivo, firma un plan PUT y construye respuesta 201 `{ job: stored, uploads }`. El cliente `frontend/src/api/jobs.ts` define `JobUploadRequest` con esos campos, `JobUploadPlan` con `job/uploads`, serializa el request y usa cada `uploadUrl` con método PUT. El reporte F02-AUD-01-architect registra correspondencia campo por campo; el Tester F02 reporta 201, claves exactas, PUT real con HeadObject y verificación independiente PASSED. Por tanto, la divergencia que originó el HIGH ya no está presente en el código cotejado.
6. **Impacto:** la forma incompatible que bloqueaba la creación y subida directa queda corregida. El estado se limita a este contrato; no implica certificación de los restantes flujos ni de la suite frontend.
7. **Resolución/seguimiento:** **RESOLVED** por adopción del acuerdo F03 en F02, respaldada por inspección del handler/cliente y por la evidencia documentada de F02-AUD-01. Mantener pendiente la verificación final independiente de Playwright y lint global F03 antes del cierre de fase.

- **Referencias:** `backend/src/api/jobs.ts` (solo lectura); `frontend/src/api/jobs.ts`; `reports/implementation/F02/F02-AUD-01-architect.md`; `reports/implementation/F02/F02-AUD-01-tester.md` y evidencias allí indexadas.
- **Límite probatorio:** no se ejecutaron pruebas en esta reevaluación. Las pruebas de integración y PUT son resultados del Tester F02 declarados en su reporte, no ejecución propia del Auditor F03.

### Estado de verificación F03 al momento de este addendum

Playwright independiente con `EXIT_CODE=0` y resumen completo: **PENDIENTE**. Lint global (`npm run lint`): **PENDIENTE**. Esta reevaluación no actualiza los dictámenes previos de ejecución ni los hallazgos ajenos a F03-AUD-01; el Architect/Tester deberá incorporar la evidencia final antes del cierre F03.

## Addendum append-only — reevaluación de cierre F03 tras reapertura

- **Fecha:** 2026-11-18
- **Rol:** Auditor F03
- **Alcance:** reevaluación de F03-AUD-01, verificación de evidencia final Tester, revisión estática del frontend en alcance y contraste de `backend/src/api/jobs.ts` en solo lectura. Sin edición de código, sin ejecución de tests/lint y sin acceso a rutas prohibidas.
- **Fuentes de ejecución final:** `reports/implementation/F03/F03-final-tester.md`; `reports/implementation/F03/evidence/F03-final-reopen-playwright.txt`, `F03-final-reopen-lint.txt` y `F03-final-reopen-endpoint.txt`.
- **Evidencia de revisión:** directa CORROBORATED para frontend y handler; ejecución final CORROBORATED documentalmente desde el dictamen Tester y sus capturas, no repetida por Auditor.
- **Conclusión de auditoría tras reapertura:** **READY_WITH_CONCERNS** respecto de la revisión de riesgos F03. `F03-AUD-01` pasa de **HIGH/OPEN** a **RESOLVED**. No quedan findings **CRITICAL ni HIGH** en el registro F03 tras esta reevaluación. Persisten los riesgos inferiores descritos abajo; no equivalen a aceptación de riesgo por Lino ni a cierre de fase por Auditor.
- **Confianza:** alta en la correspondencia estática del contrato y en la lectura de las capturas de Tester; media-alta en el cierre de la corrida de navegador por la evidencia estricta de teardown y resultado natural.
- **Cobertura:** SUFFICIENT para reclasificar F03-AUD-01 y confirmar los gates de lint/Playwright reportados; LIMITED para seguridad de despliegue, allowlist de almacenamiento, accesibilidad asistiva y comportamiento backend fuera de la creación/subida.

### Dictamen de F03-AUD-01 — HIGH → RESOLVED

1. **ID:** F03-AUD-01.
2. **Título:** divergencia entre contrato SPA y creación de lote en F02.
3. **Contexto:** el hallazgo original comparó el request `files` y response `{ job, uploads }` del acuerdo F03 con la forma incompatible `images` / `{ job }` del handler de aquel snapshot.
4. **Resultado esperado:** frontend y backend comparten el request `POST /jobs` `{ preset, files: [{ fileName, contentType, sizeBytes }] }`, y el backend devuelve 201 `{ job, uploads }` con URLs PUT que la SPA utiliza para subir los binarios directamente.
5. **Resultado observado:** lectura actual (solo lectura) de `backend/src/api/jobs.ts` confirma `BODY_KEYS = preset/files`, validación de `fileName/contentType/sizeBytes`, generación de `uploads`, URLs presignadas PUT verificadas como HTTPS y respuesta 201 `{ job: stored, uploads }`. `frontend/src/api/jobs.ts` usa `JobUploadRequest`/`JobUploadPlan` con las mismas formas y envía cada archivo a su `uploadUrl`. El addendum `F02-AUD-01` confirma prueba del contrato y dos PUT reales con `HeadObject`; su Tester reporta PASSED. La prueba final F03 también pasó el escenario de registro/upload/polling/resultados/descargas/logout dentro del mock E2E.
6. **Impacto:** la incompatibilidad que impedía certificar el intercambio de creación y plan de subida ya no se observa. El E2E F03 usa mock y, por sí solo, no prueba integración real; la evidencia real de PUT corresponde al Tester F02.
7. **Resolución/seguimiento:** **RESOLVED** por adopción y verificación documentadas en F02-AUD-01, corroboradas con lectura directa actual del handler y cliente. No requiere más seguimiento para esta divergencia.

- **Evidencia:** CORROBORATED.
- **Confianza:** alta para formas de request/response; media-alta para operación real por evidencia independiente del Tester F02, no reproducida en esta auditoría.
- **Cobertura:** SUFFICIENT para el contrato de creación y subida presignada; no certifica todos los endpoints ni el pipeline de procesamiento.

### Reevaluación de evidencia final Tester

- Playwright Microsoft Edge, 1 worker, puerto aislado 51605: **3 passed (48.7s)** y `EXIT_CODE=0` natural, según `F03-final-reopen-playwright.txt` y el dictamen `F03-final-tester.md`.
- `npm run lint`: **EXIT_CODE=0**, sin diagnósticos, según `F03-final-reopen-lint.txt`.
- El teardown de `tests/e2e/global-teardown.mjs` solo resuelve para HTTP 204 con `x-f03-server-shutdown: accepted`; cualquier respuesta distinta lanza error. La salida natural 0 documentada respalda que el endpoint aceptó el shutdown. La evidencia post-run registra cero listeners en el puerto 51605 y sonda TCP sin conexión (`F03-final-reopen-endpoint.txt`). Esta aceptación 204 es inferencia basada en el contrato estricto del teardown más el exit natural, no una captura HTTP directa.
- La corrida previa fallida que aparece en `F03-reopen-final-playwright.txt` corresponde a otro artefacto/run (puerto 48585, HTTP 404). La evidencia final posterior indicada arriba es la base del dictamen actual.
- La ejecución y el lint son evidencia de Tester; Auditor no reejecutó ni repitió estos comandos.

### Estado de findings tras reapertura

| ID | Severidad | Estado tras reevaluación | Nota de riesgo / límite |
|---|---|---|---|
| F03-AUD-01 | HIGH | **RESOLVED** | Contrato `files` → `{ job, uploads }` adoptado por F02 y respaldado por handler y prueba de PUT real. |
| F03-AUD-02 | MEDIUM residual | RESOLVED para el defecto original | Solo refresh token persistido; sigue siendo legible por scripts same-origin. El riesgo residual de XSS no se considera eliminado. |
| F03-AUD-03 | MEDIUM | OPEN | URLs exigen HTTPS y host, pero no hay allowlist de orígenes de almacenamiento. Escenario de manipulación es indicativo; no se demuestra explotación. |
| F03-AUD-04 | MEDIUM | RESOLVED para estado de UI | El logout limpia estado privado React; no se evaluaron cachés de navegador/servidor ni invalidación de solicitudes ya emitidas. |
| F03-AUD-05 | MEDIUM | RESOLVED para mensajes de autenticación | Códigos conocidos se mapean a textos locales y hay fallback genérico; revisión estática. |
| F03-AUD-06 | MEDIUM | RESOLVED en rutas privadas inspeccionadas | Refresh/reintento se aplica mediante `authorized()`; no se certifica cada ruta contra backend real en esta auditoría. |
| F03-AUD-07 | LOW | OPEN | Los límites UI 15 MB/20 imágenes son defaults locales y pueden discrepar de overrides; servidor revalida. |
| F03-AUD-08 | LOW | OPEN | E2E usa mocks/fixtures; no acredita bytes WebP/AVIF ni eliminación real de EXIF/GPS. |
| F03-AUD-09 | LOW | OPEN | Teclado/lector de pantalla y foco visible del selector requieren evaluación accesible específica. El caso E2E pasó, pero no sustituye esa evaluación. |
| F03-LOOP3-E2E-01 | MEDIUM | RESOLVED | La reapertura posterior produjo resumen completo, salida natural 0, teardown aceptado y puerto sin listener; queda como antecedente histórico de la corrida fallida. |

**Recuento de severidad abierta:** CRITICAL = 0; HIGH = 0. Se mantienen como concerns abiertos un MEDIUM (F03-AUD-03) y tres LOW (F03-AUD-07/08/09). Los MEDIUM marcados RESOLVED conservan los límites residuales descritos; no se convierten en aceptación de riesgo.

### Disposición final del Auditor

La auditoría de cierre queda **READY_WITH_CONCERNS**: no hay findings CRITICAL/HIGH abiertos tras resolver F03-AUD-01 y la evidencia final Tester satisface los gates reabiertos de lint y ejecución/cierre Playwright. Permanecen los findings menores citados, en especial la falta de allowlist de origen y la ausencia de verificación real del pipeline/EXIF y de accesibilidad asistiva. Este dictamen de riesgo no sustituye el cierre funcional de Architect/CTO ni la decisión de Lino sobre cualquier aceptación de riesgo.
