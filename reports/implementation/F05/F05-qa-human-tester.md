# F05-QA-HUMAN — Dictamen del Tester independiente

| Campo | Valor |
|---|---|
| **Tarea** | `F05-QA-HUMAN` (roadmap human-like E0-01 … E7-03) |
| **Fecha** | `2026-11-20` |
| **Rol** | Tester independiente (riesgo 3: privacidad, secretos, red local) |
| **Loop** | `1/3` |
| **Veredicto global** | **`NO-PASSED`** |
| **Entorno** | 100 % real: emulador `aws/aws-emulator` en Docker + Terraform + seed + SPA/API reales. Sin mocks, sin relays nuevos, sin `route.fulfill`, sin inflar límites. |
| **Detención** | Executado hasta `E1-04` inclusive. **Detenido en el primer fallo** según regla §3.3 del `task.md`. Casos `E1-05` … `E7-03` **no ejecutados**. |

---

## 1. Resumen ejecutivo y cifras reales

Se levantó el stack real completo y se recorrió el roadmap con un navegador Edge real (`channel: msedge`) contra `http://localhost:5173`.

- **E0-01:** emulador `healthy` con `2147483648` bytes de RAM y `2000000000` nanoCpus (`user=1000:1000`); `terraform plan` → `No changes` (exit 0); `npm run seed` ejecutado dos veces → primera `CREADO`, segunda `OMITIDO` (idempotente); `.env` con `RATE_LIMIT_AUTH_MAX=5`, `RATE_LIMIT_API_MAX=120`, `MAX_FILE_SIZE_MB=15`, `MAX_IMAGES_PER_BATCH=20`, `PORT=3001` (sin overrides). `GET /health` → 200 `{"status":"ok"}`.
- **E0-02 / E0-03:** UI en español, `Optimizar` deshabilitado, tema Claro por defecto y persistente tras dos `F5`. 0 `pageerror`, 0 errores de consola, 0 HTTP de error en Etapa 0.
- **E1-01 … E1-03:** validación HTML5 sin `POST`, 401 con mensaje genérico en español para clave errónea **y** para correo inexistente, **mensaje byte-idéntico** (anti-enumeración correcta).
- **E1-04 (FALLO):** la clave `< 8` se rechaza en cliente (0 `POST`), pero el **correo duplicado** `ana.demo@example.com` devuelve HTTP **409** con un mensaje genérico y engañoso: *«No se pudo completar la solicitud. Inténtalo de nuevo.»*. El mensaje específico *«Ya existe una cuenta con ese correo.»* —previsto en el propio frontend— **es inalcanzable**. Detalle completo en §4.
- **Cifras de ejecución:** 7 casos PASS, 1 caso FAIL, 25 casos no ejecutados; 51,6 s de ejecución antes de la detención; 3 capturas PNG; 3 respuestas HTTP de error esperadas en la ventana analizada (401, 401, 409); 0 `pageerror`.
- **Auth real:** bucket global de 5/min (`NonSpoofableAuthLimiter`); el roadmap aplicó espera a frontera de ventana antes de cada grupo de llamadas, **sin modificar ningún límite**.

---

## 2. Tabla caso por caso (E0-01 … E7-03)

| ID | Resultado | Observación concreta | Captura (relativa a `evidence/qa-human-roadmap/`) |
|---|---|---|---|
| `E0-01` | **PASS** | Emulador healthy (2 GiB/2 CPU), Terraform `No changes`, seed idempotente (CREADO→OMITIDO), sin overrides; `/health` 200 y SPA 200 | `E0-01-inicio.png` |
| `E0-02` | **PASS** | Español, Optimizar deshabilitado, tema claro, 0 pageerror/consola/HTTP-error | `E0-01-inicio.png` |
| `E0-03` | **PASS** | Claro→Oscuro→Claro, persistido tras dos F5 (`mediashrink-theme`) | `E0-03-tema.png` |
| `E1-01` | **PASS** | Correo mal formado y campos vacíos: 0 `POST /auth/login` | `E0-01-inicio.png` |
| `E1-02` | **PASS** | Ana + clave incorrecta → 401 *«El correo o la contraseña no son correctos.»*, sin stack/rutas | `E0-01-inicio.png` |
| `E1-03` | **PASS** | Correo inexistente → 401 con mensaje idéntico a E1-02 (anti-enumeración) | `E0-01-inicio.png` |
| `E1-04` | **FAIL** | Clave <8 rechazada en cliente (0 POST), pero duplicado `ana.demo@example.com` → **409** con texto genérico *«No se pudo completar la solicitud. Inténtalo de nuevo.»*; falta el mensaje claro de correo ya registrado | `FAIL-E1-04.png` + `E1-04-response-body.json` |
| `E1-05` | NO EJECUTADO | Detención en E1-04 | — |
| `E1-06` | NO EJECUTADO | Detención en E1-04 | — |
| `E1-07` | NO EJECUTADO | Detención en E1-04 | — |
| `E2-01` | NO EJECUTADO | Detención en E1-04 | — |
| `E2-02` | NO EJECUTADO | Detención en E1-04 | — |
| `E2-03` | NO EJECUTADO | Detención en E1-04 | — |
| `E2-04` | NO EJECUTADO | Detención en E1-04 | — |
| `E2-05` | NO EJECUTADO | Detención en E1-04 | — |
| `E2-06` | NO EJECUTADO | Detención en E1-04 | — |
| `E3-01` | NO EJECUTADO | Detención en E1-04 | — |
| `E3-02` | NO EJECUTADO | Detención en E1-04 | — |
| `E3-03` | NO EJECUTADO | Detención en E1-04 | — |
| `E3-04` | NO EJECUTADO | Detención en E1-04 | — |
| `E4-01` | NO EJECUTADO | Detención en E1-04 | — |
| `E4-02` | NO EJECUTADO | Detención en E1-04 | — |
| `E5-01` | NO EJECUTADO | Detención en E1-04 | — |
| `E5-02` | NO EJECUTADO | Detención en E1-04 | — |
| `E6-01` | NO EJECUTADO | Detención en E1-04 | — |
| `E6-02` | NO EJECUTADO | Detención en E1-04 | — |
| `E6-03` | NO EJECUTADO | Detención en E1-04 | — |
| `E6-04` | NO EJECUTADO | Detención en E1-04 (no se agotó el bucket de auth) | — |
| `E7-01` | NO EJECUTADO | Detención en E1-04 | — |
| `E7-02` | NO EJECUTADO | Detención en E1-04 (3 PNG parciales, sin cobertura E2…E7) | — |
| `E7-03` | NO EJECUTADO | Cierre G-7 ejecutado de todos modos (ver §5); escaneo P4/G-3 limpio (ver §6) | — |

---

## 3. Resumen por Etapa

| Etapa | Estado | Detalle |
|---|---|---|
| 0 — Inicio | **PASS** | E0-01/02/03 ok; entorno real sin trucos |
| 1 — Auth y errores | **FAIL** | E1-01/02/03 ok; **E1-04 falla** (mensaje de correo duplicado); E1-05…07 no ejecutados |
| 2 — Validación de entrada | NO EJECUTADA | detención en E1-04 |
| 3 — Flujo con fotos reales | NO EJECUTADA | detención en E1-04 |
| 4 — Descargas y privacidad | NO EJECUTADA | detención en E1-04 |
| 5 — Resiliencia y DLQ | NO EJECUTADA | detención en E1-04 |
| 6 — Borrado/multi-usuario/rate limit | NO EJECUTADA | detención en E1-04 |
| 7 — Salud, evidencias y cierre | NO EJECUTADA | cierre G-7 e higiene ejecutados igualmente |

---

## 4. Hallazgo bloqueante (7 campos obligatorios)

**1. Identificación**
`QA-HUMAN-01` · Caso `E1-04` · Severidad **MEDIA-ALTA** (UX/funcional de registro; no expone datos ni secretos) · Componente: contrato de errores de auth entre backend y SPA.

**2. Problema**
El registro con un correo ya existente (`ana.demo@example.com`) es rechazado correctamente con **HTTP 409**, pero la SPA muestra el texto genérico *«No se pudo completar la solicitud. Inténtalo de nuevo.»*. Ese mensaje no informa de la causa real (correo duplicado) y **invita a reintentar una operación que siempre fallará**. La aceptación `E1-04` exige «rechazo claro en ambos casos»; el caso de clave `< 8` sí es claro (validación HTML5, 0 peticiones), el de duplicado no lo es.

**3. Causa demostrada / hipótesis**
**Causa demostrada por código + respuesta real (no hipótesis):**
- Respuesta real capturada (`E1-04-response-body.json`): `HTTP 409` con cuerpo `{"error":{"code":"REGISTRATION_FAILED","message":"No se pudo completar el registro"}}`.
- `backend/src/auth/errors.ts`: `registrationFailed()` emite `code: 'REGISTRATION_FAILED'` (status 409).
- `frontend/src/api/auth.ts` (`publicMessages`) traduce `EMAIL_ALREADY_EXISTS → 'Ya existe una cuenta con ese correo.'`, **pero no incluye la clave `REGISTRATION_FAILED`**.
- Al no encontrar la clave devuelta, `request()` cae en el `message` por defecto: *«No se pudo completar la solicitud. Inténtalo de nuevo.»*.
- Por tanto la traducción `EMAIL_ALREADY_EXISTS` está muerta: el backend nunca emite ese código. Desajuste de contrato entre productor y consumidor.

**4. Solución propuesta (para el Developer, en loop 2)**
Alinear el contrato sin cambiar la política de anti-enumeración ni los mensajes de login:
- **Opción A (recomendada, mínima):** añadir en `frontend/src/api/auth.ts` → `publicMessages` la entrada `REGISTRATION_FAILED: 'Ya existe una cuenta con ese correo.'` (o un texto igual de claro, p. ej. *«No se pudo completar el registro. Es posible que ese correo ya esté en uso.»*). No tocar el backend ni los tests congelados.
- **Opción B:** que el backend emita `EMAIL_ALREADY_EXISTS` en `registrationFailed()`; requiere control de cambios del contrato Zod v1 congelado y revisión de impacto en tests, por lo que es más costosa.
- Acompañar con una prueba de regresión que compruebe el texto visible del `role="alert"` tras registrar un correo duplicado (no solo el status 409).

**5. Verificación**
Reproducible de forma determinista en el entorno real: `POST /auth/register` con `{"email":"ana.demo@example.com","password":"ClaveSegura2026!"}` → 409 `REGISTRATION_FAILED`. En UI: registrar ese correo desde «Crear cuenta» → `p[role=alert]` con el texto genérico. Evidencia: `FAIL-E1-04.png` (captura de pantalla con el error visible) y `E1-04-response-body.json` (cuerpo sanitizado). Log de red: `POST /auth/register` 409 con consola `*Failed to load resource: the server responded with a status of 409 (Conflict)*`. Tras el fix, el mismo caso debe mostrar el mensaje claro y el roadmap debe continuar sin detenerse.

**6. Pendientes**
- Reejecutar **todo** el roadmap desde cero en el siguiente loop; por la regla de detención, `E1-05` … `E7-03` carecen de evidencia y **no pueden darse por buenos**.
- Confirmar que el cambio no altera los mensajes de `E1-02`/`E1-03` (anti-enumeración: deben seguir siendo idénticos).
- Verificar que no se reabre el contrato congelado si se elige la Opción A.
- Respeto del bucket global de auth (5/min) en la repetición: el Tester volvió a esperar a frontera de ventana; no se inflaron límites.

**7. Aprendizaje**
Los códigos de error son parte del contrato de producto: un `code` correcto en el backend pero sin mapeo en el consumidor degrada una respuesta 409 válida en un mensaje inútil. Las pruebas unitarias pueden verificar status/código y aun así dejar escapar el texto que finalmente ve el usuario; un recorrido human-like de registro duplicado detecta este tipo de desajuste que las pruebas aisladas no cubren.

---

## 5. Estado del emulador y puertos tras el cierre (G-7)

- `docker compose down` → **exit 0**; contenedor `mediashrink-aws-emulator` detenido y eliminado.
- `docker ps` → **sin contenedores** de MediaShrink.
- `docker network ls` → **sin red** `mediashrink-cloud_default`.
- `Get-NetTCPConnection -State Listen` → **0 listeners** en `3001`, `5173` y `9297`.
- Los `webServer` de Playwright se detuvieron solos al finalizar la corrida (`reuseExistingServer: false`); no quedan procesos `dev:backend` ni `dev:frontend`. Los únicos procesos Node residuales pertenecen al harness (MCP), no al producto.
- **G-7 CERRADO.**

---

## 6. Higiene P4 / G-3

Escaneo de todos los artefactos de texto de `reports/implementation/F05/evidence/qa-human-roadmap/` (`*.json`) y de este informe:

| Comprobación | Resultado |
|---|---|
| Rutas absolutas de host (`[A-Za-z]:\\...`) | **0** (se sanearon las trazas de Playwright; un falso positivo `log:\n` se descartó con patrón estricto) |
| Query strings / URLs firmadas (`?X-Amz-…`, `?Signature=…`) | **0** (todas las URLs se reducen a `origin + pathname`) |
| Valores de token (`Bearer <...>`, `accessToken: <...>`, `AKIA…`, `REPLACE_WITH…`) | **0** (la palabra `accessToken` aparece solo como **nombre del campo prohibido** en el criterio E1-07 y en este informe, nunca como valor) |
| Cuerpos de respuesta | solo el JSON de error 409, sin secretos ni identificadores de sesión |

**Resultado: limpio tras la corrección registrada en el Addendum A-01 (revisión del Architect).**

---

## 7. Declaración de alcance

- **No se modificó** `backend/`, `frontend/`, `infra/`, `tests/`, `docs/sdd/`, `STATE.md` ni reportes ajenos.
- **No se hizo** `git commit` ni `git push`. No se ejecutó `G-12`. `terraform apply` se ejecutó **solo** contra `https://127.0.0.1:9297` con `-var=is_emulator=true`.
- Spec/config/helpers transitorios creados en `temporary/qa-human/**` y **eliminados al cerrar** para no revivir `G-11`.
- Evidencias en `reports/implementation/F05/evidence/qa-human-roadmap/`; este dictamen en `reports/implementation/F05/F05-qa-human-tester.md`.

---

## 8. Veredicto

**`NO-PASSED` (loop 1/3).** Primer fallo: `E1-04` — mensaje de correo duplicado no claro (desajuste `REGISTRATION_FAILED` ↔ `EMAIL_ALREADY_EXISTS`). El roadmap queda detenido en ese punto a la espera de corrección y re-ejecución completa en el siguiente loop.

---

## Addendum A-01 — Corrección P4 detectada en la revisión del Architect (append-only, 2026-11-20)

| Campo | Detalle |
|---|---|
| **1. Identificación** | `QA-HUMAN-AUD-01` · Tarea `F05-QA-HUMAN` · Loop 1/3 · Severidad `LOW` (higiene P4/G-6b) · Bloqueante del veredicto: **NO** (no altera el fallo funcional `E1-04`) |
| **2. Problema** | La afirmación del §6 «0 rutas absolutas de host» era **inexacta en el momento de la emisión**: `evidence/qa-human-roadmap/qa-human-results.json` contenía **3 ocurrencias** de la raíz del host en rutas Vite `/@fs/…/node_modules/vite/dist/client/env.mjs` (filas de responses `E0`, tras tres recargas). |
| **3. Causa** | El saneador reducía URLs a `origin + pathname`, pero los paths Vite `/@fs/<absoluta>/…` no son URLs con query y no fueron normalizados. El falso positivo `p://` de `http://` no está relacionado. |
| **4. Solución aplicada** | El **Architect**, en revisión de aceptación, sustituyó las 3 ocurrencias por el marcador `<PROJECT_ROOT>` (3 reemplazos), conservando el resto del JSON íntegro. No se modificó ningún resultado, observación ni veredicto. |
| **5. Verificación** | Re-escaneo del directorio `evidence/qa-human-roadmap/` tras la corrección: **0 rutas de host, 0 query strings/firmas, 0 valores de token**. El único `http://127.0.0.1:3001/health` en `playwright-results/**/error-context.md` es un falso positivo del patrón `p://` y es una URL determinista de loopback. |
| **6. Pendientes** | Ninguno para P4. Se recomienda añadir `/@fs/` al saneador del roadmap si se reejecuta en loop 2. |
| **7. Aprendizaje** | La normalización P4 debe cubrir también las rutas virtuales `/@fs/` del servidor de desarrollo, no solo query strings y URLs con host. |

---

## Loop 2/3 — Re-verificación del Tester independiente

| Campo | Valor |
|---|---|
| **Fecha** | `2026-11-20` |
| **Rol** | Tester independiente (riesgo 3) |
| **Loop** | `2/3` (autorizado por el CTO tras el dictamen `QA-HUMAN-01`) |
| **Veredicto global del Loop 2** | **`NO-PASSED`** |
| **Disposición** | Todo el contenido del Loop 1 y el Addendum A-01 del Architect se conservan (append-only). |
| **Detención** | Ejecutado hasta `E2-04` inclusive; detenido en el primer fallo real. `E2-05` … `E7-03` no ejecutados. |

### L2.1 Re-verificación de gates (ejecutada por el Tester, evidencia propia)

| Comando | Exit code | Resultado | Evidencia |
|---|---|---|---|
| `npm run typecheck` | **0** | sin diagnósticos (backend + frontend) | `evidence/qa-human-roadmap/loop2/tester-loop2-typecheck.txt` |
| `npm run lint` | **0** | sin hallazgos | `evidence/qa-human-roadmap/loop2/tester-loop2-lint.txt` |
| `npm run build` | **0** | Vite 35 módulos, `✓ built in 980ms`; backend `tsc --noEmit` OK | `evidence/qa-human-roadmap/loop2/tester-loop2-build.txt` |
| `npm run test:unit` | **0** | **37 archivos, 341/341 tests, 0 fallos** | `evidence/qa-human-roadmap/loop2/tester-loop2-test-unit.txt` |

Confirmado: el baseline del Loop 1 era **338/338**; el conteo actual es **341/341** (los 3 tests nuevos de `tests/unit/frontend/core.test.ts` están incluidos). No se confundió 338 con 341.

**Transparencia del harness (no productos):** durante el Loop 2 el Tester corrigió dos problemas de **su propia spec transitoria**, sin tocar código de producto: (i) `E1-06` asumía que el placeholder genérico «Aún no hay lotes» desaparecía al cerrar sesión, pero la SPA lo muestra siempre que `jobs.length===0`; se sustituyó por la comprobación real de estado privado (0 lista de lotes, 0 resultados, 0 barra de sesión) — tras la corrección `E1-06` pasó; (ii) dos avisos de ESLint en la spec transitoria (`temporary/qa-human/`) que hicieron fallar `npm run lint` en una corrida intermedia; corregidos y re-verificados con exit 0. Ninguna corrección relieve un criterio de aceptación.

### L2.2 Tabla caso por caso (E0-01 … E7-03)

| ID | Resultado | Observación concreta | Captura (relativa a `evidence/qa-human-roadmap/loop2/`) |
|---|---|---|---|
| `E0-01` | **PASS** | Emulador healthy (2 GiB/2 CPU), Terraform `No changes`, seed idempotente (3/3 creados → 0/3 creados), `/health` 200 y SPA 200, sin overrides de rate limit | `E0-01-inicio.png` |
| `E0-02` | **PASS** | Español, Optimizar deshabilitado, tema claro, 0 pageerror/consola/HTTP-error | `E0-01-inicio.png` |
| `E0-03` | **PASS** | Claro→Oscuro→Claro persistente tras dos F5 | `E0-03-tema.png` |
| `E1-01` | **PASS** | Correo mal formado y vacío: 0 `POST /auth/login` | `E0-01-inicio.png` |
| `E1-02` | **PASS** | Ana + clave errónea → 401 *«El correo o la contraseña no son correctos.»* sin stack/rutas | `E0-01-inicio.png` |
| `E1-03` | **PASS** | Correo inexistente → 401 con mensaje byte-idéntico a E1-02 | `E0-01-inicio.png` |
| `E1-04` | **PASS** | Clave <8 sin POST; duplicado → **409** con mensaje exacto *«No se pudo completar el registro. Revisa tus datos o inicia sesión si ya tienes cuenta.»*; 0 `REGISTRATION_FAILED`/stack/hostil en UI | `E1-04-registro.png` |
| `E1-05` | **PASS** | Registro 201 de `usuario.humano.qa@example.com`, empty-state (0 lotes) | `E1-05-registro.png` |
| `E1-06` | **PASS** | Logout: 0 barra de sesión, 0 lista de lotes, 0 resultados; persistente tras F5 con `sessionStorage` sin `mediashrink-session` | `E1-05-registro.png` |
| `E1-07` | **PASS** | Login Ana 200 y sesión viva tras F5; solo `refreshToken` en `mediashrink-session`; 0 `accessToken` en storage | `E1-07-sesion.png` |
| `E2-01` | **PASS** | 4/4 formatos (.txt/.pdf/.svg/.gif) rechazados en cliente; Optimizar deshabilitado | `E2-01-formatos.png` |
| `E2-02` | **PASS** | 16 MB rechazados antes de subir por límite de 15 MB | `E2-01-formatos.png` |
| `E2-03` | **PASS** | 21 archivos rechazados por tope de 20 | `E2-01-formatos.png` |
| `E2-04` | **FAIL** | Mezcla `valida.jpg` (válida) + `malo.txt` (inválida): aparece solo el aviso *«malo.txt: formato no permitido…»*, **no queda ninguna imagen lista**, Optimizar sigue **deshabilitado** y 0 `POST /jobs`. Criterio «solo el válido queda listo» incumplido | `FAIL-E2-04.png` + `QA-HUMAN-02-E2-04-evidence.json` |
| `E2-05` | NO EJECUTADO | detención en E2-04 | — |
| `E2-06` | NO EJECUTADO | detención en E2-04 | — |
| `E3-01` | NO EJECUTADO | detención en E2-04 | — |
| `E3-02` | NO EJECUTADO | detención en E2-04 | — |
| `E3-03` | NO EJECUTADO | detención en E2-04 | — |
| `E3-04` | NO EJECUTADO | detención en E2-04 | — |
| `E4-01` | NO EJECUTADO | detención en E2-04 | — |
| `E4-02` | NO EJECUTADO | detención en E2-04 | — |
| `E5-01` | NO EJECUTADO | detención en E2-04 | — |
| `E5-02` | NO EJECUTADO | detención en E2-04 | — |
| `E6-01` | NO EJECUTADO | detención en E2-04 | — |
| `E6-02` | NO EJECUTADO | detención en E2-04 | — |
| `E6-03` | NO EJECUTADO | detención en E2-04 | — |
| `E6-04` | NO EJECUTADO | detención en E2-04 (bucket de auth intacto) | — |
| `E7-01` | NO EJECUTADO | detención en E2-04 | — |
| `E7-02` | NO EJECUTADO | detención en E2-04 (7 PNG parciales) | — |
| `E7-03` | NO EJECUTADO | cierre G-7 y escaneo P4/G-3 ejecutados igualmente (ver L2.5/L2.6) | — |

> El listado canónico `E0-01 … E7-03` contiene **31 identificadores** (3+7+6+4+2+2+4+3). El `task.md` habla de «33 casos»; se reporta la enumeración real para no inflar cifras.

### L2.3 Resumen por Etapa

| Etapa | PASS | FAIL | No ejecutados | Capturas |
|---|---:|---:|---:|---:|
| 0 — Inicio | 3 | 0 | 0 | 2 |
| 1 — Auth y errores | 7 | 0 | 0 | 3 |
| 2 — Validación de entrada | 3 | **1** (`E2-04`) | 2 | 2 |
| 3 — Flujo con fotos reales | 0 | 0 | 4 | 0 |
| 4 — Descargas y privacidad | 0 | 0 | 2 | 0 |
| 5 — Resiliencia y DLQ | 0 | 0 | 2 | 0 |
| 6 — Borrado / multi-usuario / rate limit | 0 | 0 | 4 | 0 |
| 7 — Salud, evidencias y cierre | 0 | 0 | 3 | 0 |
| **Total** | **13** | **1** | **17** | **7** |

### L2.4 Hallazgo bloqueante del Loop 2 (7 campos obligatorios)

**1. Identificación**
`QA-HUMAN-02` · caso `E2-04` · severidad **MEDIA-ALTA** (funcional/UX de selección de archivos; sin exposición de datos ni secretos) · componente: `frontend/src/App.tsx` → `acceptFiles()`.

**2. Problema**
Al seleccionar simultáneamente un archivo válido y otro inválido, la SPA **descarta toda la selección**: no aparece el resumen «1 imágenes listas», el botón `Optimizar` permanece deshabilitado y no se inicia ningún lote. La aceptación `E2-04` exige «solo el válido queda listo; el inválido se descarta con motivo». El motivo sí se muestra, pero el archivo sano se pierde sin posibilidad de continuar sin volver a seleccionarlo.

**3. Causa demostrada / hipótesis**
**Causa demostrada (código + DOM):** `frontend/src/App.tsx:126` ejecuta `setFiles(result.valid ? chosen : [])`. Como `validateFiles()` devuelve `valid:false` si **cualquier** archivo produce error (formatos, tamaño o cantidad), la rama falsa sustituye la selección completa por `[]`, eliminando también los archivos válidos. El snapshot de fallo confirma: `listitem: "malo.txt: formato no permitido…"`, `button "Optimizar tus imágenes" [disabled]` y **ningún** elemento «imágenes listas». No es una hipótesis ni un fallo del harness (la misma spec pasó E2-01/02/03 con la misma API de validación).

**4. Solución propuesta (Developer, bajo TDD)**
En `acceptFiles()`, conservar los archivos que pasan cada validación individual en lugar de aplicar el veredicto global: filtrar `chosen` con `ALLOWED_TYPES.has(file.type)` y `file.size <= maxFileSizeMb*MiB` y respetar el tope de `maxImagesPerBatch`, manteniendo `fileErrors` solo para los rechazados. Añadir tests de regresión: (a) mezcla válido+inválido → 1 imagen lista y `Optimizar` habilitado; (b) todos inválidos → 0 imágenes listas y avisos por archivo; (c) 21 archivos válidos → tope respetado. No tocar el backend ni los contratos congelados.

**5. Verificación**
Reproducible en entorno real: sesión Ana, seleccionar `valida.jpg` (JPEG 2×2, `image/jpeg`) + `malo.txt` (`text/plain`) desde `#file-picker`. Evidencia: `FAIL-E2-04.png`, `QA-HUMAN-02-E2-04-evidence.json`, `qa-human-results.json` (14 filas: 13 PASS + `E2-04` FAIL) y `playwright-results/**/error-context.md`. Tras el fix, el mismo caso debe mostrar «1 imágenes listas», `Optimizar` habilitado y un único aviso por `malo.txt`. Diagnóstico del navegador al fallar: **0 pageerror**, solo 3 errores de consola esperados (401/401/409 de E1) y **0 peticiones nuevas**.

**6. Pendientes**
Reejecutar el roadmap **completo** desde cero en el loop 3 (`E2-04` y todo `E2-05 … E7-03`). Verificar que el cambio no relaja `E2-01` (4 formatos rechazados), `E2-02` (>15 MB) ni `E2-03` (>20 archivos), y que no permite subir un archivo con magic bytes inválidos (debe seguir rechazándose en `E5-02`). Sin commit/push ni G-12.

**7. Aprendizaje**
Un validador que devuelve un único veredicto agregado es insuficiente cuando la UX promete aprovechamiento parcial: el consumidor debe poder distinguir « este archivo sí / este no » para conservar el trabajo del usuario. Las pruebas de formatos individuales (E2-01/02/03) pasaban mientras el caso mixto —el más habitual en la vida real— fallaba; por eso el roadmap human-like aporta cobertura que las pruebas aisladas no sustituyen.

### L2.5 Cierre G-7

`docker compose down` → exit 0; sin contenedor `mediashrink-aws-emulator` ni red `mediashrink-cloud_default`. **0 listeners** en `3001`, `5173` y `9297`. **0 procesos** `dev:backend` / `dev:frontend` / Vite. El volumen efímero se renovó (`down -v`) antes de la segunda corrida para garantizar ausencia de usuario de prueba residual. **G-7 CERRADO.**

### L2.6 Escaneo P4 / G-3

Saneamiento aplicado **desde la escritura** del JSON (normalización de las rutas virtuales internas de Vite a `<PROJECT_ROOT>/[redacted]`, URLs reducidas a `origin + pathname`, sin query strings) y post-procesado el resto de artefactos de texto. Escaneo final sobre **todos** los artefactos nuevos de `loop2/` y este informe:

| Comprobación | Resultado |
|---|---|
| Rutas virtuales internas de Vite sin normalizar | **0** |
| Rutas absolutas de host (barra o contrabarra) | **0** |
| Query strings / firmas S3 (`?X-Amz-…`, `Signature=`) | **0** |
| Valores de token (`Bearer …`, `AKIA…`, `REPLACE_WITH…`) | **0** |
| `pageerror` del navegador | **0** |

### L2.7 Veredicto Loop 2

**`NO-PASSED` (loop 2/3).** La corrección de `QA-HUMAN-01` quedó verificada (`E1-04` PASS, 341/341 unit), pero apareció un **nuevo defecto real en `E2-04`** (`QA-HUMAN-02`). El roadmap queda detenido en ese punto a la espera de que el CTO coordine la corrección y una nueva verificación completa. Sin commit, sin push y sin modificación de producto por parte del Tester.

---

## Loop 3/3 — Verificación final del Tester independiente

| Campo | Valor |
|---|---|
| **Fecha** | `2026-11-20` |
| **Rol** | Tester independiente (riesgo 3) |
| **Loop** | `3/3` — **ÚLTIMO LOOP, sin margen** |
| **Veredicto global del Loop 3** | **`NO-PASSED` → `BLOCKED` (límite de loops agotado)** |
| **Disposición** | Loop 1, Loop 2 y Addendum A-01 conservados íntegros (append-only). |
| **Ejecución** | 31 casos: **28 PASS · 1 FAIL (`E7-01`) · 2 no ejecutados (`E7-02`, `E7-03`)** por detención reglamentaria en el primer fallo. |

### L3.1 Re-verificación de gates (Tester, evidencia propia)

| Comando | Exit code | Resultado | Evidencia (`evidence/qa-human-roadmap/loop3/`) |
|---|---|---|---|
| `npm run typecheck` | **0** | sin diagnósticos | `tester-loop3-typecheck.txt` |
| `npm run lint` | **0** | sin hallazgos | `tester-loop3-lint.txt` |
| `npm run build` | **0** | Vite 35 módulos + backend `tsc --noEmit` | `tester-loop3-build.txt` |
| `npm run test:unit` | **0** | **37 archivos, 344/344 tests, 0 fallos** | `tester-loop3-test-unit.txt` |

Confirmado el salto 338 → 341 → **344** (3 tests nuevos de `selectValidFiles`). `validateFiles` sigue intacto.

### L3.2 Tabla caso por caso (E0-01 … E7-03)

| ID | Resultado | Observación concreta | Captura (relativa a `loop3/`) |
|---|---|---|---|
| `E0-01` | **PASS** | Emulador healthy (2 GiB/2 CPU), Terraform `No changes`, seed idempotente, `/health` 200, sin overrides | `E0-01-inicio.png` |
| `E0-02` | **PASS** | Español, Optimizar deshabilitado, tema claro, 0 pageerror/HTTP-error | `E0-01-inicio.png` |
| `E0-03` | **PASS** | Claro→Oscuro→Claro persistente tras dos F5 | `E0-03-tema.png` |
| `E1-01` | **PASS** | Correo inválido/vacío: 0 `POST /auth/login` | `E0-01-inicio.png` |
| `E1-02` | **PASS** | Ana + clave errónea → 401, mensaje genérico sin stack | `E0-01-inicio.png` |
| `E1-03` | **PASS** | Correo inexistente → 401 byte-idéntico (anti-enumeración) | `E0-01-inicio.png` |
| `E1-04` | **PASS** | Duplicado → 409 con mensaje exacto *«No se pudo completar el registro. Revisa tus datos o inicia sesión si ya tienes cuenta.»*; 0 `REGISTRATION_FAILED`/hostil | `E1-04-registro.png` |
| `E1-05` | **PASS** | Registro 201 de `usuario.humano.qa@example.com`, 0 lotes | `E1-05-registro.png` |
| `E1-06` | **PASS** | Logout limpia estado privado; persistente tras F5 | `E1-05-registro.png` |
| `E1-07` | **PASS** | Login Ana + F5 con sesión viva; solo `refreshToken`; 0 `accessToken` | `E1-07-sesion.png` |
| `E2-01` | **PASS** | **Anti-regresión:** 4/4 formatos (.txt/.pdf/.svg/.gif) rechazados; Optimizar deshabilitado | `E2-01-formatos.png` |
| `E2-02` | **PASS** | **Anti-regresión:** 16 MB rechazados por límite de 15 MB | `E2-01-formatos.png` |
| `E2-03` | **PASS** | **Anti-regresión:** 21 archivos → tope de 20, Optimizar deshabilitado | `E2-01-formatos.png` |
| `E2-04` | **PASS** | Fix `QA-HUMAN-02` verificado: «1 imágenes listas», 1 único aviso por `malo.txt`, Optimizar habilitado, 0 `POST /jobs` prematuros | `E2-04-mixto.png` |
| `E2-05` | **PASS** | Espacios, >80 acotado a 80, XSS literal, 0 dialog | `E2-04-mixto.png` |
| `E2-06` | **PASS** | 3 presets seleccionables; activo Equilibrado | `E2-06-presets.png` |
| `E3-01` | **PASS** | 3 JPEG reales >350 KiB (mayor con EXIF/GPS inyectado), nombre y preset correctos | `E3-03-resultados.png` |
| `E3-02` | **PASS** | `POST /jobs` **201**, confirm **200** sin 503, botón bloqueado, ZIP deshabilitado en primer render, polling 200, 0×429 | `E3-03-resultados.png` |
| `E3-03` | **PASS** | Historial arriba, fecha `dd/mm/aaaa, hh:mm`, Original >1 MB, Optimizado < Original, Ahorro >0 %, `✓ EXIF eliminado`, 6 comparativas `naturalWidth>0` | `E3-03-resultados.png` |
| `E3-04` | **PASS** | Tras F5 lote, métricas idénticas y comparativas recuperables | `E3-04-persistencia.png` |
| `E4-01` | **PASS** | Original/WEBP/AVIF HTTP 200, menor peso, 0 EXIF en optimizadas, EXIF presente en el original inyectado | `E4-01-descargas.png` |
| `E4-02` | **PASS** | ZIP `${jobId}.zip` válido con 9 entradas (WebP+AVIF+miniaturas) | `E4-01-descargas.png` |
| `E5-01` | **PASS** | Truncada con SOI válido → **Completado parcialmente**, ZIP habilitado; DLQ real con **1 mensaje, attempts=3, RENDER_FAILED** | `E5-01-parcial-dlq.png` |
| `E5-02` | **PASS** | **Anti-regresión:** texto renombrado `.jpg` rechazado por magic bytes → **Fallido**, ZIP deshabilitado, XSS literal, 0 dialog | `E5-02-fallido.png` |
| `E6-01` | **PASS** | Cancelar borrado conserva el lote | `E5-01-parcial-dlq.png` |
| `E6-02` | **PASS** | Confirmar borrado + F5 + «Actualizar historial» → lote ausente | `E5-01-parcial-dlq.png` |
| `E6-03` | **PASS** | Logout + login Bruno → 0 lotes/nombre/jobId de Ana | `E6-03-aislamiento.png` |
| `E6-04` | **PASS** | 5×401 + 6.º **429** con mensaje RATE_LIMITED en español, al final | `E6-04-rate-limit.png` |
| `E7-01` | **FAIL** | 0 pageerror, pero **2×404** inesperadas + 2 errores de consola en previsualizaciones optimizadas de imágenes FAILED de E5; criterio exige 0 4xx inesperadas | `FAIL-E7-01.png` + `QA-HUMAN-03-E7-01-evidence.json` |
| `E7-02` | NO EJECUTADO | detención en E7-01 (16 PNG parciales, cobertura E0…E6 completa) | — |
| `E7-03` | NO EJECUTADO | cierre G-7 y escaneo P4 ejecutados manualmente (ver L3.5/L3.6) | — |

### L3.3 Resumen por Etapa

| Etapa | PASS | FAIL | No ejec. | Capturas |
|---|---:|---:|---:|---:|
| 0 — Inicio | 3 | 0 | 0 | 2 |
| 1 — Auth y errores | 7 | 0 | 0 | 3 |
| 2 — Validación | 6 | 0 | 0 | 3 |
| 3 — Flujo con fotos reales | 4 | 0 | 0 | 2 |
| 4 — Descargas y privacidad | 2 | 0 | 0 | 1 |
| 5 — Resiliencia y DLQ | 2 | 0 | 0 | 2 |
| 6 — Borrado / multi-usuario / rate limit | 4 | 0 | 0 | 2 |
| 7 — Salud, evidencias y cierre | 0 | **1** | 2 | 1 |
| **Total** | **28** | **1** | **2** | **16** |

### L3.4 Hallazgo del Loop 3 (7 campos obligatorios)

**1. Identificación**
`QA-HUMAN-03` · caso `E7-01` · severidad **MENOR** (ruido de consola / peticiones innecesarias; sin pérdida funcional, sin fuga de datos) · componente: `frontend/src/App.tsx` → `ImageComparison` / `loadImageSources`.

**2. Problema**
En los lotes con imagen fallida (`E5-01` corrupta y `E5-02` falso `.jpg`), la SPA intenta cargar la vista previa optimizada de esas imágenes, que **no existe** porque el worker nunca escribió la variante. S3/relay responde **404** (2 peticiones) y Chromium registra **2 errores de consola**. `E7-01` exige 0 respuestas 4xx inesperadas (excluye solo 401 de login y 429 de E6-04), por lo que el caso falla aunque la UI muestre gracefulmente *«Vista no disponible»* y no haya `pageerror`.

**3. Causa demostrada**
`ImageComparison` se renderiza para **todas** las entradas de `jobDetail.images`, incluidas las de estado `FAILED`. `loadImageSources()` pide `original` y `format` sin comprobar el estado; para una imagen fallida no hay objeto optimizado en `mediashrink-optimized-local`, de ahí el 404. El `onError` del `<img>` solo cambia el texto a «Vista no disponible»: mitigación visual, no evita la petición ni el log. No es una hipótesis: las 2 URLs 404 corresponden exactamente a los `imageId` fallidos de E5-01 y E5-02.

**4. Solución propuesta**
Omitir `<ImageComparison>` (o al menos no solicitar la variante optimizada) cuando `image.status === 'FAILED'`, mostrando directamente el estado de error de la imagen. Añadir una aserción E2E que exija **0×404** en los lotes E5-01/E5-02. Sin tocar el backend ni los contratos.

**5. Verificación**
Evidencia: `qa-human-results.json` (29 filas: 28 PASS + `E7-01` FAIL), `FAIL-E7-01.png`, `QA-HUMAN-03-E7-01-evidence.json`, `E5-01-parcial-dlq.png`, `E5-02-fallido.png` y `error-context.md`. Diagnóstico: **0 pageerror**; 11 HTTP de error en total, de los cuales 9 son esperados (2×401 E1, 1×409 E1, 5×401 + 1×429 E6-04) y **2 son los 404 referidos**. DLQ confirmado real: `dlqMessages=1`, `attempts=3`, `reasonCode=RENDER_FAILED`.

**6. Pendientes**
**Loop 3/3 agotado → `BLOCKED`.** Queda a criterio del CTO aceptar `QA-HUMAN-03` como incidencia menor conocida (la aplicación es funcionalmente correcta) o abrir una vía de corrección fuera del límite normal de 3 loops. No se emite `PASSED` condicional. Sin commit, sin push, sin G-12.

**7. Aprendizaje**
Los escenarios negativos deliberados (imágenes corruptas / magic bytes inválidos) generan respuestas 404 que, aunque son la respuesta HTTP correcta para un objeto inexistente, contaminan el criterio de «salud del navegador». La UI debería evitar pedir artefactos que sabe que no se produjeron, en lugar de confiar en el `onError` para ocultar el fallo.

### L3.5 Ajustes del harness transitorio (transparencia; ninguno relaja un criterio)

Todos los fallos intermedios de este loop fueron **del harness del Tester**, no del producto, y se corrigieron conservando aserciones exactas:
1. `E3-02`: `POST /jobs` esperado 200 → **201 exacto**, según `backend/src/api/jobs.ts:251` y `F05-audit-full-tester.md` («create 201 con name»). No es un rango ni un `2xx`.
2. `E4-01`: Edge convierte la navegación del popup de descarga en una descarga del navegador; se pasó a observar el **enlace real devuelto por `/jobs/:id/download/:imageId`** y a descargar sus bytes por el relay del mismo origen (sin `route`/`fulfill`/doble).
3. `E5-01`: invocación del verificador de DLQ en Windows vía `cmd.exe /c npx tsx` (`spawnSync npx ENOENT`).
4. Rate limit: el conteo de `/auth/*` se deriva de **respuestas reales observadas con marca de tiempo**, no de un contador manual (evitó 429 espurios en refreshes).
5. `E6-02`: espera explícita a que la sesión se restaure tras F5 antes de pulsar «Actualizar historial», y `actionTimeout=30 s` para acotar esperas de accionabilidad.

### L3.6 Cierre G-7 y P4/G-3

- `docker compose down` → exit 0; sin contenedor `mediashrink-aws-emulator` ni red `mediashrink-cloud_default`; **0 listeners** en `3001`/`5173`/`9297`; **0** procesos `dev:backend`/`dev:frontend`. **G-7 CERRADO.**
- Saneamiento desde escritura en el JSON + post-proceso de todos los artefactos de texto. Escaneo final sobre `loop3/**` e informe: **0** rutas Vite internas sin normalizar, **0** rutas absolutas de host, **0** query strings/firmas, **0** valores de token, **0** cookies. **P4/G-3 = 0.**

### L3.7 Veredicto Loop 3

**`NO-PASSED` (loop 3/3) → `BLOCKED` por agotamiento del límite.** La corrección de `QA-HUMAN-02` quedó verificada (`E2-04` PASS y sin regresiones en E2-01/02/03 ni E5-02), igual que `QA-HUMAN-01` y todos los flujos funcionales E0…E6 (28/31 casos). El único incumplimiento es `E7-01` por `QA-HUMAN-03` (2×404 en previsualizaciones de imágenes fallidas), de severidad menor. No se hicieron commit/push ni modificaciones de producto por parte del Tester.

---

## Micro-ciclo excepcional (CTO+Lino, Opción A) — Verificación final del Tester

| Campo | Valor |
|---|---|
| **Fecha** | `2026-11-20` |
| **Rol** | Tester independiente (riesgo 3) |
| **Ciclo** | Micro-ciclo excepcional autorizado por CTO+Lino, **fuera del límite de 3 loops**, para cerrar `QA-HUMAN-03` |
| **Veredicto global** | **`NO-PASSED`** — **no procede el push `G-6`** |
| **Disposición** | Loop 1, Loop 2, Loop 3 y Addendum A-01 conservados íntegros (append-only). |
| ** Ejecución** | Roadmap COMPLETO de 31 casos: **28 PASS · 3 FAIL registrados** (`E5-01`, `E5-02`, `E7-01`). Ver detalle en §M.4. |

### M.1 Re-verificación de gates (Tester)

| Comando | Exit code | Resultado | Evidencia (`evidence/qa-human-roadmap/except/`) |
|---|---|---|---|
| `npm run typecheck` | **0** | sin diagnósticos | `tester-except-typecheck.txt` |
| `npm run lint` | **0** | sin hallazgos | `tester-except-lint.txt` |
| `npm run build` | **0** | Vite 36 módulos + backend `tsc --noEmit` | `tester-except-build.txt` |
| `npm run test:unit` | **0** | **37 archivos, 349/349 tests, 0 fallos** | `tester-except-test-unit.txt` |

Confirmado el salto 344 (Loop 3) → **349** (+5 tests). El módulo `image-availability.ts` es código fuente, por lo que el número de archivos de test sigue siendo 37.

### M.2 Tabla caso por caso (E0-01 … E7-03)

| ID | Resultado | Observación concreta | Captura (`except/`) |
|---|---|---|---|
| `E0-01` | PASS | Emulador healthy (2 GiB/2 CPU), Terraform `No changes`, seed idempotente, `/health` 200 | `E0-01-inicio.png` |
| `E0-02` | PASS | Español, Optimizar deshabilitado, tema claro, 0 pageerror/HTTP-error | `E0-01-inicio.png` |
| `E0-03` | PASS | Claro→Oscuro→Claro persistente tras dos F5 | `E0-03-tema.png` |
| `E1-01` | PASS | Correo inválido/vacío: 0 `POST /auth/login` | `E0-01-inicio.png` |
| `E1-02` | PASS | Ana + clave errónea → 401 genérico sin stack | `E0-01-inicio.png` |
| `E1-03` | PASS | Correo inexistente → 401 byte-idéntico (anti-enumeración) | `E0-01-inicio.png` |
| `E1-04` | PASS | Duplicado → 409 con mensaje exacto, 0 `REGISTRATION_FAILED`/hostil | `E1-04-registro.png` |
| `E1-05` | PASS | Registro 201 de `usuario.humano.qa@example.com`, 0 lotes | `E1-05-registro.png` |
| `E1-06` | PASS | Logout limpia estado privado; persistente tras F5 | `E1-05-registro.png` |
| `E1-07` | PASS | Login Ana + F5; solo `refreshToken`; 0 `accessToken` | `E1-07-sesion.png` |
| `E2-01` | PASS | 4/4 formatos rechazados; Optimizar deshabilitado | `E2-01-formatos.png` |
| `E2-02` | PASS | 16 MB rechazados por límite de 15 MB | `E2-01-formatos.png` |
| `E2-03` | PASS | 21 archivos → tope de 20, Optimizar deshabilitado | `E2-01-formatos.png` |
| `E2-04` | PASS | «1 imágenes listas», 1 aviso por `malo.txt`, Optimizar habilitado, 0 POST prematuros | `E2-04-mixto.png` |
| `E2-05` | PASS | Espacios, >80 acotado a 80, XSS literal, 0 dialog | `E2-04-mixto.png` |
| `E2-06` | PASS | 3 presets seleccionables | `E2-06-presets.png` |
| `E3-01` | PASS | 3 JPEG >350 KiB, EXIF/GPS inyectado, nombre y preset correctos | `E3-03-resultados.png` |
| `E3-02` | PASS | `POST /jobs` **201**, confirm 200 sin 503, botón bloqueado, ZIP deshabilitado en primer render, polling 200, 0×429 | `E3-03-resultados.png` |
| `E3-03` | PASS | Historial arriba, fecha `dd/mm/aaaa,hh:mm`, Original >1 MB, Optimizado < Original, Ahorro >0 %, `✓ EXIF eliminado`, 6 comparativas `naturalWidth>0` | `E3-03-resultados.png` |
| `E3-04` | PASS | Tras F5 lote, métricas idénticas y comparativas recuperadas | `E3-04-persistencia.png` |
| `E4-01` | PASS | Descargas original/WEBP/AVIF HTTP 200, menor peso, 0 EXIF en optimizadas | `E4-01-descargas.png` |
| `E4-02` | PASS | ZIP válido con 9 entradas (WebP+AVIF+miniaturas) | `E4-01-descargas.png` |
| `E5-01` | **FAIL** | Funcionalmente correcto (Completado parcialmente, aviso en español, WEBP/AVIF deshabilitados, original activo, DLQ `attempts=3`) **pero 1×404** en la variante optimizada de la imagen corrupta mientras aún está `PROCESANDO` | `FAIL-E5-01.png` + `QA-HUMAN-04-*.json` |
| `E5-02` | **FAIL\*** | Todas sus comprobaciones de producto pasaron con **0×404 propios**; el FAIL registrado es un artefacto del contador acumulativo del harness (heredó el 404 de E5-01) | `FAIL-E5-02.png`, `E5-02-fallido.png`, `E5-02-tema-oscuro.png` |
| `E6-01` | PASS | Cancelar borrado conserva el lote | `E5-01-parcial-dlq.png` |
| `E6-02` | PASS | Borrado confirmado y ausente tras F5 | `E5-01-parcial-dlq.png` |
| `E6-03` | PASS | Login Bruno con aislamiento total | `E6-03-aislamiento.png` |
| `E6-04` | PASS | 5×401 + 6.º **429** con mensaje RATE_LIMITED, al final | `E6-04-rate-limit.png` |
| `E7-01` | **FAIL** | 0 `pageerror`, pero **1×404 inesperada** (la de E5-01) + 1 error de consola por 404. Criterio exige 0 4xx fuera de 401/409/429 | `FAIL-E7-01.png` |
| `E7-02` | PASS | 19 capturas PNG E0…E7 (incluye tema oscuro y capturas de fallo) | `E6-04-rate-limit.png` |
| `E7-03` | PASS | JSON saneado: 0 rutas de host, 0 rutas virtuales Vite sin normalizar, 0 tokens, 0 query strings | `qa-human-results.json` |

\* Ver §M.4: no es un fallo de producto.

### M.3 Resumen por Etapa

| Etapa | PASS | FAIL | Capturas |
|---|---:|---:|---:|
| 0 — Inicio | 3 | 0 | 2 |
| 1 — Auth y errores | 7 | 0 | 3 |
| 2 — Validación | 6 | 0 | 3 |
| 3 — Flujo con fotos reales | 4 | 0 | 2 |
| 4 — Descargas y privacidad | 2 | 0 | 1 |
| 5 — Resiliencia y DLQ | 0 | **2\*** | 5 |
| 6 — Borrado / multi-usuario / rate limit | 4 | 0 | 2 |
| 7 — Salud, evidencias y cierre | 2 | **1** | 1 |
| **Total** | **28** | **3** | **19** |

### M.4 Resultado del foco del micro-ciclo y hallazgo

**Lo que SÍ se verificó (fix parcialmente eficaz):**
- **Aviso en español visible** en imágenes FAILED: «Imagen no procesada. Motivo: …» ✔
- **0 `<ImageComparison>`** en imágenes FAILED terminales; **Descargar WEBP/AVIF deshabilitados**, «Descargar original» activo ✔
- **Coherencia visual Claro/Oscuro** verificada (`E5-02-tema-oscuro.png`) ✔
- **Sin regresión**: E2-01/02/03/04, E3-03, E4-01, E4-02, E5-02 (rechazo magic bytes) y DLQ `attempts=3` ✔
- **E5-02: 0×404 propios** ✔

**Lo que NO se cumplió:** 0×404 en Etapa 5 y `E7-01` PASS. Aparece **1×404 determinista (3/3 corridas limpias)** en E5-01.

**`QA-HUMAN-04` — 7 campos obligatorios**

1. **Identificación:** `QA-HUMAN-04` · `E5-01`/`E7-01` · severidad **MENOR-MEDIA** · componente: `frontend/src/api/image-availability.ts` → `shouldLoadOptimized`.
2. **Problema:** El worker tarda ~1,6 s en agotar reintentos de la imagen truncada. Durante ese intervalo su estado es `PROCESANDO`, `shouldLoadOptimized` devuelve `true` y `ImageComparison` pide la variante optimizada inexistente → **1×404** + 1 error de consola. `E7-01` exige 0 4xx inesperadas (excluye solo 401/409/429), por lo que falla. No hay `pageerror` y la UI es graceful, pero el criterio de salud no se cumple.
3. **Causa demostrada:** `shouldLoadOptimized(image) { return image.status !== 'FAILED'; }` solo excluye el estado **terminal** `FAILED`. La guarda cubre el estado final (verificado: la tarjeta FAILED no tiene comparativa), pero no la fase transitoria `PROCESANDO`, en la que el componente sí se monta. Timeline: confirm `…184924` → GET download `…185485` → GET 404 optimizado `…186520`, con el job aún en `PROCESANDO`.
4. **Solución propuesta:** hacer la guarda total para estados no terminales — devolver `false` también para `PENDING`/`PROCESSING` (o condicionar a `status ∈ {COMPLETED, PARTIAL}`). El progreso ya se comunica con `<progress>` y el chip de estado, así que no se pierde información. Añadir aserción E2E de 0×404 en E5-01 desde el primer render.
5. **Verificación:** 3 corridas limpias (emulador `down -v` + reprovision + seed) → 1×404 en 3/3. `qa-human-results.json`, `FAIL-E5-01.png`, `error-context.md`. 0 `pageerror`; 11 HTTP-error = 10 esperados + 1×404.
6. **Pendientes:** decisión del CTO/Lino: aceptar como incidencia menor conocida o autorizar un fix acotado. **Mientras tanto NO procede el push `G-6`.** Sin commit/push ni modificación de producto por el Tester.
7. **Aprendizaje:** una guarda que solo excluye el estado terminal es insuficiente cuando la UI precarga artefactos durante el procesamiento asíncrono; la condición debe exigir un artefacto confirmado, no solo ausencia de fallo conocido.

**Nota de transparencia del harness:** el FAIL de `E5-02` es un artefacto de mi contador acumulativo (`e5_404` sumó el 404 de E5-01). El delta propio de E5-02 fue **0×404** y todas sus aserciones de producto pasaron. No afecta al veredicto: `E7-01` falla de todos modos por el 404 real de E5-01.

### M.5 Cierre G-7 y P4/G-3

`docker compose down` → exit 0; sin contenedor ni red `mediashrink-cloud_default`; **0 listeners** en `3001`/`5173`/`9297`; **0** procesos dev. `temporary/` eliminado. Escaneo final sobre `except/**` e informe: **0** rutas Vite internas sin normalizar, **0** rutas de host, **0** query strings/firmas, **0** tokens/cookies. **P4/G-3 = 0.**

### M.6 Veredicto micro-ciclo

**`NO-PASSED`.** El fix aplicado resolvió la parte terminal de `QA-HUMAN-03` (aviso en español, botones deshabilitados, 0 comparativa en FAILED, E5-02 sin 404, sin regresiones, 349/349 unit), pero **no logró 0×404 en E5-01 ni `E7-01` PASS** por el defecto determinista `QA-HUMAN-04` (404 transitorio durante `PROCESANDO`). Al no ser 31/31, **no se emite PASSED y no procede el commit/push de `G-6`**.

---

## Ciclo final QA-HUMAN-04 (CTO) — Verificación de cierre

| Campo | Valor |
|---|---|
| **Fecha** | `2026-11-20` |
| **Rol** | Tester independiente (riesgo 3) |
| **Ciclo** | Cierre de `QA-HUMAN-04` autorizado por el CTO (guarda estricta `=== 'COMPLETED'`) |
| **Veredicto global** | **`PASSED`** |
| **Disposición** | Secciones previas (Loop 1/2/3, Addendum A-01, Micro-ciclo Opción A) conservadas íntegras (append-only). |
| **Ejecución** | Roadmap COMPLETO de **31/31 PASS** · 0 FAIL · 0×404 · 0 `pageerror`. |

### F.1 Re-verificación de gates (Tester)

| Comando | Exit code | Resultado | Evidencia (`evidence/qa-human-roadmap/final/`) |
|---|---|---|---|
| `npm run typecheck` | **0** | sin diagnósticos | `tester-final-typecheck.txt` |
| `npm run lint` | **0** | sin hallazgos | `tester-final-lint.txt` |
| `npm run build` | **0** | Vite 36 módulos + backend `tsc --noEmit` | `tester-final-build.txt` |
| `npm run test:unit` | **0** | **37 archivos, 355/355 tests, 0 fallos** | `tester-final-test-unit.txt` |

Confirmado el salto 349 → **355** (+6 tests del mandato). `validateFiles` y los contratos siguen intactos.

### F.2 Tabla caso por caso (E0-01 … E7-03)

| ID | Resultado | Observación concreta | Captura (`final/`) |
|---|---|---|---|
| `E0-01` | PASS | Emulador healthy (2 GiB/2 CPU), `terraform plan` 0 cambios, seed idempotente, `/health` 200 | `E0-01-inicio.png` |
| `E0-02` | PASS | Español, Optimizar deshabilitado, tema claro, 0 errores | `E0-01-inicio.png` |
| `E0-03` | PASS | Claro↔Oscuro persistente tras dos F5 | `E0-03-tema.png` |
| `E1-01` | PASS | Correo inválido/vacío: 0 `POST /auth/login` | `E0-01-inicio.png` |
| `E1-02` | PASS | Ana + clave errónea → 401 genérico sin stack | `E0-01-inicio.png` |
| `E1-03` | PASS | Correo inexistente → 401 byte-idéntico (anti-enumeración) | `E0-01-inicio.png` |
| `E1-04` | PASS | Duplicado → 409 con mensaje exacto, 0 `REGISTRATION_FAILED`/hostil | `E1-04-registro.png` |
| `E1-05` | PASS | Registro 201 de `usuario.humano.qa@example.com`, 0 lotes | `E1-05-registro.png` |
| `E1-06` | PASS | Logout limpia estado privado; persistente tras F5 | `E1-05-registro.png` |
| `E1-07` | PASS | Login Ana + F5; solo `refreshToken`; 0 `accessToken` | `E1-07-sesion.png` |
| `E2-01` | PASS | 4/4 formatos rechazados; Optimizar deshabilitado | `E2-01-formatos.png` |
| `E2-02` | PASS | 16 MB rechazados por límite de 15 MB | `E2-01-formatos.png` |
| `E2-03` | PASS | 21 archivos → tope de 20, Optimizar deshabilitado | `E2-01-formatos.png` |
| `E2-04` | PASS | Mixto: 1 imagen lista, 1 aviso, Optimizar habilitado, 0 POST prematuros | `E2-04-mixto.png` |
| `E2-05` | PASS | Espacios, >80 acotado a 80, XSS literal, 0 dialog | `E2-04-mixto.png` |
| `E2-06` | PASS | 3 presets seleccionables | `E2-06-presets.png` |
| `E3-01` | PASS | 3 JPEG >350 KiB, EXIF/GPS inyectado, nombre y preset correctos | `E3-03-resultados.png` |
| `E3-02` | PASS | `POST /jobs` **201**, confirm 200 sin 503, botón bloqueado, ZIP deshabilitado en primer render, polling 200, 0×429 | `E3-03-resultados.png` |
| `E3-03` | PASS | **Sin regresión:** historial arriba, fecha `dd/mm/aaaa,hh:mm`, Original >1 MB, Optimizado < Original, Ahorro >0 %, `✓ EXIF eliminado`, 6 comparativas `naturalWidth>0` | `E3-03-resultados.png` |
| `E3-04` | PASS | Tras F5 lote, métricas idénticas y comparativas recuperadas | `E3-04-persistencia.png` |
| `E4-01` | PASS | **Sin regresión:** descargas original/WEBP/AVIF HTTP 200, menor peso, 0 EXIF en optimizadas, EXIF detectado en original inyectado | `E4-01-descargas.png` |
| `E4-02` | PASS | **Sin regresión:** ZIP válido con 9 entradas (WebP+AVIF+miniaturas) | `E4-01-descargas.png` |
| `E5-01` | PASS | **0×404 (delta).** Completado parcialmente; imagen sana con comparativa `naturalWidth>0`; imagen corrupta con aviso «Imagen no procesada. Motivo: …»; WEBP/AVIF deshabilitados; original activo; DLQ real `dlqMessages=1`, `attempts=3`, `RENDER_FAILED`; **aviso de espera capturado** en PROCESANDO | `E5-01-parcial-dlq.png` |
| `E5-02` | PASS | **0×404 (delta).** Texto `.jpg` rechazado por magic bytes → Fallido; ZIP deshabilitado; aviso en español; WEBP/AVIF deshabilitados; XSS literal | `E5-02-fallido.png`, `E5-02-tema-oscuro.png` |
| `E6-01` | PASS | Cancelar borrado conserva el lote | `E5-01-parcial-dlq.png` |
| `E6-02` | PASS | Borrado confirmado y ausente tras F5 | `E5-01-parcial-dlq.png` |
| `E6-03` | PASS | Login Bruno con aislamiento total | `E6-03-aislamiento.png` |
| `E6-04` | PASS | 5×401 + 6.º **429** con mensaje RATE_LIMITED, al final | `E6-04-rate-limit.png` |
| `E7-01` | PASS | **0 pageerror, 0×404**; 9 HTTP-error todos esperados (7×401 login, 1×409 register, 1×429 login); 9 errores de consola esperados | `E6-04-rate-limit.png` |
| `E7-02` | PASS | 16 capturas PNG E0…E7 (incluye tema oscuro) | `E6-04-rate-limit.png` |
| `E7-03` | PASS | JSON saneado: 0 rutas de host, 0 rutas Vite internas sin normalizar, 0 tokens, 0 query strings | `qa-human-results.json` |

### F.3 Resumen por Etapa

| Etapa | PASS | FAIL | Capturas |
|---|---:|---:|---:|
| 0 — Inicio | 3 | 0 | 2 |
| 1 — Auth y errores | 7 | 0 | 3 |
| 2 — Validación | 6 | 0 | 3 |
| 3 — Flujo con fotos reales | 4 | 0 | 2 |
| 4 — Descargas y privacidad | 2 | 0 | 1 |
| 5 — Resiliencia y DLQ | 2 | 0 | 3 |
| 6 — Borrado / multi-usuario / rate limit | 4 | 0 | 2 |
| 7 — Salud, evidencias y cierre | 3 | 0 | 1 |
| **Total** | **31** | **0** | **16** |

### F.4 Foco del cierre — `QA-HUMAN-04` resuelto

- **0×404 en E5-01 y E5-02** (contadores **delta por caso**, no acumulativos) ✔
- **`E7-01` = PASS**: 0 `pageerror`, 0×404 en todo el roadmap, 0 errores de consola/red inesperados; los 9 HTTP-error y 9 errores de consola son todos esperados (401/409/429) ✔
- **Aviso de espera en PROCESANDO** capturado por `MutationObserver`: *«Imagen en procesamiento. La comparativa estará disponible al completarse.»* ✔
- **Aviso terminal** «Imagen no procesada. Motivo: …» visible en FAILED ✔
- **Botones WEBP/AVIF deshabilitados** hasta COMPLETED; «Descargar original» activo ✔
- **No regresión** confirmada: E2-01/02/03/04, E3-03 (6 comparativas), E4-01, E4-02, E5-02 y DLQ `attempts=3` ✔
- **Efecto colateral declarado por el Developer** (PARTIAL difiere comparativa a COMPLETED): se verificó en E5-01 — la imagen buena (status `COMPLETED` dentro de un lote `PARTIAL`) **sí conserva su comparativa** con `naturalWidth>0`. No rompe E3-03 ni E4-01/E4-02 ✔

**Hallazgos: ninguno.** `QA-HUMAN-04` queda cerrado.

**Determinismo:** 3 corridas limpias (emulador `down -v` + reprovision + seed). Corridas 1 y 3: 31/31. Corrida 2: 30/31 por una **carrera del harness** (conteo de la comparativa antes de que `IntersectionObserver` resolviera `loadImageSources`): 0×404 y 0 `pageerror` también en esa corrida, es decir, **el producto estuvo siempre limpio**. Se corrigió el harness con un `expect.poll` explícito, sin relajar ninguna aserción. En **3/3 corridas el producto produjo 0×404**. Detalle en `QA-HUMAN-04-cierre-resultado.json`.

### F.5 Cierre G-7 y P4/G-3

`docker compose down` → exit 0; sin contenedor `mediashrink-aws-emulator` ni red `mediashrink-cloud_default`; **0 listeners** en `3001`/`5173`/`9297`; **0** procesos dev. `temporary/` eliminado. Escaneo final sobre `final/**` e informe: **0** rutas Vite internas sin normalizar, **0** rutas de host, **0** query strings/firmas, **0** tokens/cookies/secrets. **P4/G-3 = 0.**

### F.6 Veredicto final

**`PASSED` (31/31).** `QA-HUMAN-04` cerrado, `E7-01` PASS con 0×404 y 0 `pageerror`, 355/355 unit, G-7 cerrado y P4=0. **Procede el commit + push de `G-6`** según la autorización condicionada del CTO. Sin commit/push ni modificación de producto por parte del Tester.
