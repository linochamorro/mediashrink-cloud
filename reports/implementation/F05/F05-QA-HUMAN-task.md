# F05-QA-HUMAN — Roadmap de pruebas human-like con Playwright CLI

| Campo | Valor |
|---|---|
| **ID / Fase** | `F05-QA-HUMAN` · Fase Final `P-05` — previo a las pruebas manuales finales de Lino |
| **Versión / Loop** | v5 — 2026-11-20 · **Ciclo autorizado por CTO para `QA-HUMAN-04`**: guarda estricta `status === 'COMPLETED'` + matriz de estados + aviso de espera. Push `G-6` **condicionado** a `31/31 PASSED` y `P4=0`; `G-12` retenido. |
| **Recuento exacto del roadmap** | **31 casos** (`E0-01…E7-03` = 3+7+6+4+2+2+4+3). El «33» citado en el encargo CTO es un error aritmético; el Tester lo señaló y no se infló la cifra. |
| **Owner / verificador** | Architect (coordinación) · **Tester independiente** (ejecución y veredicto) |
| **Riesgo** | `3` (privacidad, secretos, red local) → evidencia exhaustiva y cierre G-7 obligatorio |
| **Gates** | `G-7` Docker autorizado (`--memory=2g --cpus="2.0"`, apagar al terminar) · `G-6` autorizado **pero NO usar** (prohibido commit/push) · `G-12` **RETENIDO** · `G-11` ya ejecutado (`temporary/` debió quedar ausente; si se crea, borrar al cerrar) |
| **Dependencia** | `F05-AUDIT-FULL` `PASSED` (Tester 2026-11-19, aprobado por CTO) + `G-6` cerrado (commit `8c64028`) |
| **Objetivo** | Recorrer TODAS las funcionalidades y errores típicos de usuario en un navegador real mediante **Playwright CLI**, sin mocks ni muletas, antes de la prueba manual de Lino |

---

## 1. Reglas estrictas de ejecución (SIN TRUCOS)

1. **Entorno 100 % real:** `docker compose up -d` → `docker cp` de `ca.pem`/`config`/`emulator_credentials` (repetir en cada arranque, volumen named) → `terraform apply -auto-approve -var=is_emulator=true` (solo contra `127.0.0.1:9297`, **nunca** AWS real) → `npm run seed` → arrancar `npm run dev:backend` y `npm run dev:frontend` con los **valores por defecto de `.env.example`** (`RATE_LIMIT_AUTH_MAX=5`, `RATE_LIMIT_API_MAX=120`, `MAX_FILE_SIZE_MB=15`, `MAX_IMAGES_PER_BATCH=20`). El navegador opera en `http://localhost:5173`.
2. **Prohibido usar muletas:** NO inflar `RATE_LIMIT_AUTH_MAX` ni ningún límite; NO `installS3Relay`; NO `context.route` / `page.route` / `route.fulfill` para interceptar S3 ni la API; NO dobles de API. El tráfico debe ser el de un usuario humano real. La única adaptación tolerable es `NODE_OPTIONS=--dns-result-order=ipv4first` en el arranque de Vite (harness Windows, ya documentada; no intercepta ni falsifica respuestas).
3. **Solo verificación:** si todo pasa, **no modificar código de producto** (`backend/`, `frontend/`, `infra/`) ni tests permanentes en `tests/`, ni hacer commit/push. Solo guardar reporte, evidencias y capturas. Si algún caso falla, **detener y reportar el fallo exacto con evidencia** (captura PNG + consola + red + cuerpo de respuesta sanitizado) para análisis del CTO; **no maquillar el test ni relajar la aserción**.
4. **Cierre limpio obligatorio (G-7):** al finalizar, detener `dev:backend` y `dev:frontend`, ejecutar `docker compose down` y comprobar que no quedan procesos propios ni listeners en `3001`, `5173`, `9297`.

---

## 2. Casos obligatorios por etapa (E0-01 … E7-03)

### Etapa 0 — Inicio
| ID | Caso | Resultado esperado |
|---|---|---|
| `E0-01` | Arranque real sin trucos | emulador healthy, Terraform sin deriva, seed idempotente, backend `3001` y frontend `5173` activos; sin overrides de rate limit |
| `E0-02` | Carga inicial | interfaz en **español**, **0 errores JS/HTTP** inesperados, botón **Optimizar** deshabilitado sin sesión/archivos |
| `E0-03` | Tema Claro ↔ Oscuro | cambio y **persistencia tras `F5`** |

### Etapa 1 — Auth y errores
| ID | Caso | Resultado esperado |
|---|---|---|
| `E1-01` | Login vacío / correo mal formado | validación en cliente, sin llamada `POST /auth/login` con correo inválido |
| `E1-02` | Clave incorrecta de Ana | error **genérico en español**, sin stack/rutas/indicio de existencia |
| `E1-03` | Correo inexistente | **mismo error** que E1-02 (anti-enumeración) |
| `E1-04` | Registro con clave < 8 chars y correo duplicado `ana.demo@example.com` | rechazo claro en ambos casos. Tras el dictamen CTO, el texto **exacto** esperado para el duplicado es: *«No se pudo completar el registro. Revisa tus datos o inicia sesión si ya tienes cuenta.»* (seguro, sin revelar existencia del correo y sin caer al genérico de red) |
| `E1-05` | Registro `usuario.humano.qa@example.com` | alta correcta y **estado vacío** (0 lotes) |
| `E1-06` | Cerrar sesión | limpia estado y **persiste tras `F5`** |
| `E1-07` | Login seed Ana `ana.demo@example.com` / `DemoAna2026!` | sesión persistente tras `F5` y **sin `accessToken` expuesto en storage** (clave real: `mediashrink-session` en `sessionStorage`, solo refresh token) |

### Etapa 2 — Validación de entrada y errores de usuario
| ID | Caso | Resultado esperado |
|---|---|---|
| `E2-01` | Rechazo en cliente de `.txt`, `.pdf`, `.svg`, `.gif` | ningún archivo inválido entra al selector; aviso claro |
| `E2-02` | Rechazo > 15 MB | aviso antes de subir; `Optimizar` permanece deshabilitado |
| `E2-03` | Rechazo > 20 archivos | aviso antes de subir (tope `MAX_IMAGES_PER_BATCH=20`) |
| `E2-04` | Mezcla válido + inválido | solo el válido queda listo; el inválido se descarta con motivo |
| `E2-05` | «Nombre del lote» con solo espacios, > 80 chars y XSS `<script>alert('xss')</script>` | saneado/acotado a 80; **renderizado como texto literal**; **0 `dialog`** |
| `E2-06` | Cambio entre los 3 presets | `Alta calidad` / `Equilibrado` / `Máxima compresión` seleccionables y persistentes en el formulario |

### Etapa 3 — Flujo completo con fotos reales grandes
| ID | Caso | Resultado esperado |
|---|---|---|
| `E3-01` | Nombre `Sesión Producto Noviembre` + **3 imágenes reales > 350 KiB cada una** (≥ 1 con EXIF/GPS real inyectado) + preset `Equilibrado` | 3 imágenes listas, nombre y preset correctos |
| `E3-02` | Subida/confirm/polling | `POST /jobs` **201** (contrato aprobado, `backend/src/api/jobs.ts:251`; el «200» del encargo original era un error documental, corregido por el Tester en el harness sin relajar la aserción), confirm **200** (sin `503`), botón bloqueado durante la subida, polling hasta **Completado** sin `429`, `Descargar ZIP` deshabilitado en `En espera`/`Procesando` |
| `E3-03` | Historial y métricas | lote **arriba** (orden descendente) con nombre + fecha/hora (`dd/mm/aaaa, hh:mm`); `Original > 1 MB`, `Optimizado < Original`, `Ahorro > 0 %`, `✓ EXIF eliminado`; comparativas con `naturalWidth > 0` |
| `E3-04` | Persistencia tras `F5` | lote, métricas y comparativas siguen visibles |

### Etapa 4 — Descargas y privacidad
| ID | Caso | Resultado esperado |
|---|---|---|
| `E4-01` | Descarga Original, WEBP y AVIF | HTTP `200`; WebP/AVIF de **menor peso**; **0 EXIF/GPS verificado en los bytes** descargados |
| `E4-02` | Descarga ZIP válida | contiene **WebP + AVIF + miniaturas de las 3 imágenes** |

### Etapa 5 — Resiliencia y DLQ
| ID | Caso | Resultado esperado |
|---|---|---|
| `E5-01` | Lote `Lote Mixto Corrupto` (1 válida + 1 JPEG truncada/corrupta con cabecera válida) | 3 reintentos + DLQ → **Completado parcialmente** con `Descargar ZIP` **habilitado** |
| `E5-02` | Archivo de texto renombrado a `.jpg` | rechazo por magic bytes → lote **Fallido** con `Descargar ZIP` **deshabilitado** |

### Etapa 6 — Borrado, multi-usuario y rate limit de auth
| ID | Caso | Resultado esperado |
|---|---|---|
| `E6-01` | Cancelar diálogo de borrado | el lote **se conserva** |
| `E6-02` | Confirmar borrado | lote eliminado y **no reaparece tras `F5`** |
| `E6-03` | Logout + login `bruno.demo@example.com` / `DemoBruno2026!` | **aislamiento total**: 0 lotes de Ana |
| `E6-04` | **(al final)** logout + 6 intentos fallidos de login | 6.º → **429** con mensaje claro en español (`RATE_LIMITED`); esperar la ventana si hiciera falta para seguir operando |

### Etapa 7 — Salud, evidencias y cierre
| ID | Caso | Resultado esperado |
|---|---|---|
| `E7-01` | Salud del navegador | **0 `pageerror`** y 0 errores de consola/respuestas 4xx-5xx inesperados (excluidos los esperados: 401 de login, 429 de E6-04) |
| `E7-02` | Capturas PNG por etapa | en `reports/implementation/F05/evidence/qa-human-roadmap/` (mínimo 1 por etapa, nombradas `E0-...png` … `E7-...png`) |
| `E7-03` | Cierre y higiene | `docker compose down`, puertos `3001`/`5173`/`9297` cerrados, **0 rutas absolutas de host ni secretos** en reportes/evidencias (P4/G-3) |

---

## 3. Ámbito de archivos

**Permitido al Tester:** `temporary/qa-human/**` (spec/config transitorios; **borrar al cerrar** para no revivir G-11), `reports/implementation/F05/F05-qa-human-tester.md`, `reports/implementation/F05/evidence/qa-human-roadmap/**`.
**Permitido al Architect:** este `task.md`, `reports/verification/F05-qa-human-architect.md`, `STATE.md`.
**Prohibido:** `backend/`, `frontend/`, `infra/`, `tests/`, `docs/sdd/`, reportes ajenos, `git commit`, `git push`, `G-12`, AWS real, `terraform apply` fuera del emulador.

**Referencias útiles (solo lectura):**
- `tests/e2e/f05-audit-full.spec.ts` y `playwright.f05-full.config.ts`: E2E real de referencia (selectores, generación de JPEG grande con `sharp`, monitorización de consola/red, `webServer` con `npm run dev:*`).
- `docs/runbooks/manual-qa-guide-lino.md`: arranque y flujo manual equivalente.
- `tests/e2e/qa-roadmap.spec.ts`, `screenshots.spec.ts`, `frontend-flow.spec.ts`: **NO usar como evidencia**; contienen dobles/relays por diseño.

**Selectores verificados de la SPA:** `getByLabel('Correo electrónico')`, `getByLabel('Contraseña')`, `getByRole('button', {name:/Iniciar sesión|Crear cuenta|Cerrar sesión/})`, `getByLabel('Nombre del lote (opcional)', {exact:true})`, `#file-picker`, `role=radiogroup` con nombre `Preset de compresión` y `role=radio` (`Alta calidad`/`Equilibrado`/`Máxima compresión`), `button.start-button` (`Optimizar …`), `ul[aria-label="Historial de lotes"]`, `section[aria-label="Resultados del lote"]`, botones `Descargar ZIP` y `Borrar`, `button.theme-toggle` con `aria-label="Cambiar a tema oscuro|claro"`. Estado UI: `En espera`/`Procesando`/`Completado`/`Completado parcialmente`/`Fallido`.

---

## 4. Entregables

1. `reports/implementation/F05/F05-qa-human-tester.md` — veredicto global `PASSED`/`NO-PASSED` y tabla **caso por caso `E0-01`…`E7-03`** con `PASS`/`FAIL`, observación y captura asociada; cifras concretas (tamaños, statuses, reintentos, 429); detalle de cualquier fallo con los 7 campos obligatorios; resultado del cierre G-7.
2. `reports/implementation/F05/evidence/qa-human-roadmap/` — capturas PNG por etapa + logs/JSON de salida (sanitizados: sin query strings firmadas ni tokens).
3. `reports/verification/F05-qa-human-architect.md` — consolidación breve del Architect + `STATE.md` actualizado.

**Retorno al CTO:** veredicto global, tabla resumen por etapa (0–7), cualquier fallo encontrado y confirmación de cierre limpio G-7. **Sin push ni G-12.**

---

## 5. Registro de acciones (append-only)

| Fecha | Actor | Acción | Resultado |
|---|---|---|---|
| 2026-11-20 | Architect | Lectura obligatoria (AGENTS, rol, STATE) y revisión de infraestructura E2E real | DoR vigente; G-7 autorizado; G-12 retenido; sin push |
| 2026-11-20 | Architect | Emisión de esta tarea y despacho de Tester independiente | Loop 1/3 `NO-PASSED` en `E1-04` (detención reglamentaria) |
| 2026-11-20 | CTO | Dictamen `QA-HUMAN-01`: **Loop 2/3 autorizado**. `REGISTRATION_FAILED` permanece genérico en backend (anti-enumeración `NFR-03`/`PR-08`); corrección solo en `publicMessages` del frontend, con TDD y cobertura total de `AuthErrorCode` | Autorizado: Developer + Tester + reejecución completa E0-01…E7-03; sin push/G-12 |
| 2026-11-20 | Architect | Despacho de Developer para el fix acotado (`auth.ts` + `tests/unit/frontend/core.test.ts`) y actualización de este contrato a v2 | Loop 2: `E1-04` PASS (fix verificado), pero nuevo fallo `E2-04` (`QA-HUMAN-02`) → `NO-PASSED` 2/3 |
| 2026-11-20 | CTO (mandato activo) | Resolver defectos tácticos de Etapas 2–7 con Developer/Designer bajo TDD y re-verificar con Tester, dentro de 3 loops | Autorizado: Loop 3/3 para `QA-HUMAN-02` |
| 2026-11-20 | Architect | Despacho de Developer para `QA-HUMAN-02` (helper puro `selectValidFiles` + 3 tests; App.tsx usa el helper) y corrección del recuento 33 → 31 | Loop 3: `QA-HUMAN-02` CERRADO; nuevo fallo `E7-01` (`QA-HUMAN-03`) → `BLOCKED` 3/3 |
| 2026-11-20 | CTO + Lino | **Opción A aprobada**: micro-ciclo excepcional fuera del límite de 3 loops. No montar comparativa ni pedir variantes optimizadas para imágenes FAILED; aviso en español con `failureReason`; WEBP/AVIF deshabilitados; cobertura unitaria; re-verificación 31/31; push `G-6` condicionado | Autorizado; `G-12` retenido, sin relajar E7-01 |
| 2026-11-20 | Architect | Despacho de Developer para el micro-ciclo (`shouldLoadOptimized` + JSX condicional + tests) | Micro-ciclo `NO-PASSED` (28/31): `QA-HUMAN-03` cubierto, nuevo `QA-HUMAN-04` (404 en `PROCESANDO`); push retenido, HEAD `11f6d33` |
| 2026-11-20 | CTO | Autoriza fix acotado de `QA-HUMAN-04`: guarda estricta `status === 'COMPLETED'` (false para PENDING/PROCESSING/FAILED), aviso de espera, matriz de estados en tests, re-verificación 31/31 y push G-6 condicionado | Autorizado; `G-12` retenido |
| 2026-11-20 | Architect | Despacho de Developer para la guarda de 1 línea + matriz de estados | En curso |
