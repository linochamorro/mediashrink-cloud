# F05-UX-HEADER-AUTH — Dictamen del Tester independiente

| Campo | Valor |
|---|---|
| **Tarea** | `F05-UX-HEADER-AUTH` — acceso de cuenta en el `<header>` (encargo puntual de Lino) |
| **Fecha** | `2026-11-20` |
| **Rol** | Tester independiente (riesgo 2: UI accesible, temas, capturas públicas) |
| **Loop** | `1/3` |
| **Veredicto global** | **`PASSED`** |
| **Entorno** | 100 % real: emulador `aws/aws-emulator` + Terraform + seed + API/worker + SPA, navegador Edge real. Sin muletas. |
| **Disposición** | Informes/evidencias previos (F05-QA-HUMAN loop 1/2/3, micro-ciclo Opción A y ciclo final) conservados íntegros (append-only). |

---

## 1. Resumen ejecutivo y cifras reales

- **Gates re-verificados por el Tester:** `typecheck` 0 · `lint` 0 · `build` 0 · `test:unit` **0 → 355/355 tests en 37 archivos, 0 fallos** (idéntico al baseline, sin bajar).
- **Roadmap completo (31 casos E0-01…E7-03): 31 PASS / 0 FAIL** en **2 corridas limpias** (emulador `down -v` + reprovision + seed entre ambas), con el nuevo flujo de acceso desde el header.
- **Foco UX:** 0×404 en E5-01 y E5-02, `E7-01` PASS (0 `pageerror`, 0 errores de consola/red inesperados), aviso de espera en PROCESANDO capturado, sesión mostrada como correo compacto en `getByRole('banner')`, trigger «Abrir panel de acceso», panel `role="dialog"` con `aria-modal`/`aria-expanded`, cierre con Escape y botón ×, cierre tras autenticar, sin `.auth-strip`/`.session-bar` residuales.
- **Capturas propias:** 19 PNG en `evidence/qa-human-roadmap/header-ux/` (header claro/oscuro con y sin sesión, panel abierto, resto de etapas).
- **18 PNG de `docs/images/`:** verificadas visualmente (portada con header nuevo, panel de acceso en claro/oscuro, métricas/cargas coherentes).
- **Observación heredada** `qa-roadmap.spec.ts` paso 08: presente, ajena al UI y **no modificada** (detalle §6).

### Re-verificación de gates

| Comando | Exit code | Resultado | Evidencia (`header-ux/`) |
|---|---|---|---|
| `npm run typecheck` | **0** | sin diagnósticos | `tester-header-typecheck.txt` |
| `npm run lint` | **0** | sin hallazgos | `tester-header-lint.txt` |
| `npm run build` | **0** | Vite + backend `tsc --noEmit` | `tester-header-build.txt` |
| `npm run test:unit` | **0** | **37 archivos, 355/355 tests, 0 fallos** | `tester-header-test-unit.txt` |

---

## 2. Tabla caso por caso (E0-01 … E7-03)

| ID | Resultado | Observación concreta | Captura (`header-ux/`) |
|---|---|---|---|
| `E0-01` | PASS | `/health` 200; SPA 200; emulador healthy (2 GiB/2 CPU); `terraform plan` 0 cambios; seed idempotente | `E0-01-inicio-claro.png` |
| `E0-02` | PASS | Español, Optimizar deshabilitado; **header con trigger «Abrir panel de acceso», sin `.auth-strip`/`.session-bar`**; 0 errores | `E0-01-inicio-claro.png` |
| `E0-03` | PASS | Claro↔Oscuro persistente tras dos F5; header oscuro sin sesión capturado | `E0-03-header-claro-sin-sesion.png`, `E0-03-header-oscuro-sin-sesion.png` |
| `E1-01` | PASS | **Panel accesible** (`role=dialog`, `aria-modal=true`, `id=auth-panel`, botón × visible); correo inválido/vacío detenido, 0 `POST /auth/login`; Escape cierra | `E1-01-panel-abierto-claro.png` |
| `E1-02` | PASS | Ana + clave errónea → 401 genérico en el panel, sin stack | `E1-01-panel-abierto-claro.png` |
| `E1-03` | PASS | Correo inexistente → 401 byte-idéntico (anti-enumeración) | `E1-01-panel-abierto-claro.png` |
| `E1-04` | PASS | Clave <8 sin POST; duplicado → 409 con mensaje exacto, sin hostil/stack | `E1-04-registro.png` |
| `E1-05` | PASS | Registro 201; **correo en el banner**, panel cerrado tras autenticar; estado vacío | `E1-05-header-con-sesion-claro.png` |
| `E1-06` | PASS | **Logout desde el banner** limpia estado privado; persistente tras F5 | `E1-05-header-con-sesion-claro.png` |
| `E1-07` | PASS | Login Ana desde el panel del header + F5; correo en banner; solo `refreshToken`; 0 `accessToken`; header con sesión claro/oscuro capturado | `E1-07-header-con-sesion-claro.png`, `E1-07-header-con-sesion-oscuro.png` |
| `E2-01` | PASS | 4/4 formatos rechazados; Optimizar deshabilitado | `E2-01-formatos.png` |
| `E2-02` | PASS | 16 MB rechazados por límite de 15 MB | `E2-01-formatos.png` |
| `E2-03` | PASS | 21 archivos → tope de 20, Optimizar deshabilitado | `E2-01-formatos.png` |
| `E2-04` | PASS | Mixto: 1 imagen lista, 1 aviso, Optimizar habilitado, 0 POST prematuros | `E2-04-mixto.png` |
| `E2-05` | PASS | Espacios, >80 acotado a 80, XSS literal, 0 dialog | `E2-04-mixto.png` |
| `E2-06` | PASS | 3 presets seleccionables | `E2-06-presets.png` |
| `E3-01` | PASS | 3 JPEG >350 KiB, EXIF/GPS inyectado, nombre y preset correctos | `E3-03-resultados.png` |
| `E3-02` | PASS | `POST /jobs` **201**, confirm 200 sin 503, botón bloqueado, ZIP deshabilitado en primer render, polling 200, 0×429 | `E3-03-resultados.png` |
| `E3-03` | PASS | Historial arriba, fecha `dd/mm/aaaa,hh:mm`, Original >1 MB, Optimizado < Original, Ahorro >0 %, `✓ EXIF eliminado`, 6 comparativas `naturalWidth>0` | `E3-03-resultados.png` |
| `E3-04` | PASS | Tras F5 sesión en header, lote y métricas idénticas, 6 comparativas | `E3-04-persistencia.png` |
| `E4-01` | PASS | Descargas original/WEBP/AVIF HTTP 200, menor peso, 0 EXIF en optimizadas | `E4-01-descargas.png` |
| `E4-02` | PASS | ZIP válido con 9 entradas (WebP+AVIF+miniaturas) | `E4-01-descargas.png` |
| `E5-01` | PASS | **0×404 (delta).** Completado parcialmente; imagen sana con comparativa; imagen corrupta con aviso «Imagen no procesada. Motivo: …»; WEBP/AVIF deshabilitados; original activo; DLQ real `dlqMessages=1`, `attempts=3`, `RENDER_FAILED`; aviso de espera capturado | `E5-01-parcial-dlq.png` |
| `E5-02` | PASS | **0×404 (delta).** Texto `.jpg` rechazado por magic bytes → Fallido; ZIP deshabilitado; aviso en español; WEBP/AVIF deshabilitados; XSS literal | `E5-02-fallido.png`, `E5-02-header-oscuro-con-sesion.png` |
| `E6-01` | PASS | Cancelar borrado conserva el lote | `E5-01-parcial-dlq.png` |
| `E6-02` | PASS | Borrado confirmado y ausente tras F5 | `E5-01-parcial-dlq.png` |
| `E6-03` | PASS | **Logout desde el header** + login Bruno desde el panel; aislamiento total (0 lotes/nombre/jobId de Ana) | `E6-03-aislamiento.png` |
| `E6-04` | PASS | 5×401 + 6.º **429** con mensaje RATE_LIMITED, al final | `E6-04-rate-limit.png` |
| `E7-01` | PASS | **0 `pageerror`, 0×404**; 10 HTTP-error todos esperados (401/409/429); 10 errores de consola esperados | `E6-04-rate-limit.png` |
| `E7-02` | PASS | 19 capturas PNG E0…E7 (header claro/oscuro, panel, con/sin sesión) | `E5-02-header-oscuro-con-sesion.png` |
| `E7-03` | PASS | JSON saneado: 0 rutas de host, 0 rutas Vite internas, 0 tokens, 0 query strings | `qa-human-results.json` |

---

## 3. Resumen por Etapa

| Etapa | PASS | FAIL | Capturas |
|---|---:|---:|---:|
| 0 — Inicio | 3 | 0 | 3 |
| 1 — Auth y errores | 7 | 0 | 5 |
| 2 — Validación | 6 | 0 | 3 |
| 3 — Flujo con fotos reales | 4 | 0 | 2 |
| 4 — Descargas y privacidad | 2 | 0 | 1 |
| 5 — Resiliencia y DLQ | 2 | 0 | 2 |
| 6 — Borrado / multi-usuario / rate limit | 4 | 0 | 2 |
| 7 — Salud, evidencias y cierre | 3 | 0 | 1 |
| **Total** | **31** | **0** | **19** |

---

## 4. Foco de la tarea — verificado

- **0×404 en E5-01 y E5-02** (contadores delta por caso) ✔
- **`E7-01` PASS**: 0 `pageerror`, 0×404 globales, 0 errores de consola/red inesperados (excluidos 401/409/429) ✔
- **Nuevo flujo de acceso:** trigger en header, panel `role=dialog` con `aria-modal`/`aria-expanded`/`aria-controls`, cierre con Escape y botón ×, cierre tras autenticar; foco al primer campo verificado visualmente ✔
- **Sesión en header:** correo compacto visible en `getByRole('banner')`, botón «Cerrar sesión» en el banner; trigger de acceso ausente con sesión ✔
- **Ausencia de bloques antiguos:** 0 `.auth-strip` y 0 `.session-bar` bajo «Prepara un lote» ✔
- **Coherencia de temas:** header legible y alineado en Claro y Oscuro, con y sin sesión (capturas propias) ✔
- **Sin regresión** en el resto del roadmap: E2-01/02/03/04, E3-03, E4-01, E4-02, E5-02, rate limit 5/min y DLQ `attempts=3` ✔

**Hallazgos: ninguno.**

---

## 5. Capturas del header y fidelidad de `docs/images/`

**Capturas propias** (`evidence/qa-human-roadmap/header-ux/`): 19 PNG, entre ellas:
- `E0-03-header-claro-sin-sesion.png` / `E0-03-header-oscuro-sin-sesion.png`
- `E1-01-panel-abierto-claro.png` (panel desplegado bajo el trigger «Iniciar sesión»)
- `E1-05-header-con-sesion-claro.png` / `E1-07-header-con-sesion-claro.png` / `E1-07-header-con-sesion-oscuro.png`
- `E5-02-header-oscuro-con-sesion.png`

**Verificación de las 18 PNG regeneradas en `docs/images/`:** inspeccionadas visualmente; `01-portada-claro.png` muestra el header nuevo con «Iniciar sesión» y sin `.auth-strip` bajo «Prepara un lote», coincidiendo con la portada real del navegador; `02-acceso-claro.png`/`02-acceso-oscuro.png` muestran el panel de acceso con el formulario y el botón ×, coherente con `E1-01-panel-abierto-claro.png`; el resto (carga, progreso, comparativa, métricas, descarga, ZIP, borrado) conserva la estructura actual. 18/18 presentes. Se verificó que `README.md` no referencia texto eliminado (0 coincidencias de `auth-strip`/`session-bar`/«Sesión iniciada como»).

---

## 6. Observación heredada (no bloqueante, no modificada)

En `tests/e2e/qa-roadmap.spec.ts` paso 08 (línea 418) se mantiene `await popup.waitForURL(/^https:\/\//, { timeout: 30_000 });`. Según lo dictaminado por el Architect, es una aserción **preexistente y ajena al UI**, en un spec de capturas con dobles/relays (no evidencia de aceptación). **No se ha modificado ni relajado.** Se registra aquí como observación heredada, sin impacto en el veredicto, que se apoya en el roadmap 31/31 sobre el stack real.

---

## 7. Cierre G-7 y P4/G-3

- `docker compose down` → exit 0; sin contenedor `mediashrink-aws-emulator` ni red `mediashrink-cloud_default`.
- **0 listeners** en `3001`, `5173`, `9297`; **0** procesos `dev:backend`/`dev:frontend`.
- `temporary/` eliminado.
- **P4/G-3 = 0:** escaneo de todos los artefactos nuevos (JSON, logs, informe) → 0 rutas de host, 0 rutas Vite internas sin normalizar, 0 query strings/firmas, 0 tokens/cookies/secrets. Las 18 PNG de `docs/images/` se escanearon también: 2 coincidencias ASCII (`d:\`, `B:\`) resultaron ser **falsos positivos en bytes comprimidos** (contexto binario aleatorio), no rutas reales.

---

## 8. Veredicto

**`PASSED` (31/31).** Único cambio visual (acceso/sesión en el header) verificado sin regresiones funcionales ni de accesibilidad, 355/355 unit, 0×404, `E7-01` PASS, G-7 cerrado y P4=0. **Procede el commit + push de `G-6`** según la autorización condicionada. Sin commit/push ni modificación de producto por parte del Tester.
