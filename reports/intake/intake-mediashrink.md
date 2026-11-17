# Informe de levantamiento (intake) — MediaShrink Cloud

| Campo | Valor |
|---|---|
| **Estado** | `COMPLETO — Pendiente revisión CTO y Gate 1 (G-1)` |
| **Fecha** | `2026-11-17` |
| **Rol** | `Architect en modo levantamiento (delegado por CTO; WORKFLOW.md §1 y §2)` |
| **Harness** | `OpenCode (harness delegado)` |
| **Límite del encargo** | `Sin código de producto, sin ejecución de pruebas, sin Fase 0 / P-00` |
| **Método** | `Entrevista directa con Lino · 4 tandas · 16 decisiones · alternativas explícitas · sin supuestos` |

---

## 1. Fuentes consultadas (entradas aprobadas, no reabiertas)

1. `AGENTS.md` local y `STATE.md` (raíz).
2. `.agents/roles/architect.md` (contrato del rol).
3. `docs/WORKFLOW.md` §1 (dirección, delegación de intake, 4 condiciones de retorno) y §2 (matriz T1–T11, secuencia de proyecto nuevo).
4. `docs/METHODOLOGY.md` §4 (tabla de gates G-1…G-12) y `docs/PROJECT_STRUCTURE.md` (estructura canónica y `docs/sdd/`).
5. `docs/decisions/ADR-001-stack-and-aws-emulator.md` e `index.md`.
6. `docs/architecture/00-overview.md`, `01-stack.md`.
7. `docs/runbooks/development-workflow.md`, `portfolio-publication.md`.
8. Plantillas oficiales `D:\Projects\Bluemind_Lab\docs\templates\` (`P-xx-package.md`, `task.md`, `retorno-architect.md`, `readme-github.md`).

### 1.1 Decisiones ya aprobadas que NO se reabrieron

| Decisión | Fuente |
|---|---|
| Stack: Vite + React + TS, Hono + TS, `sharp`, Terraform, `aws/aws-emulator`, Vitest + Playwright | `ADR-001` (Lino, 2026-11-17) |
| Conversión WebP/AVIF, miniaturas, eliminación EXIF/GPS, métricas de ahorro reales | `AGENTS.md` §1 |
| S3 `raw` + `optimized`, SQS + DLQ, Lambda, DynamoDB | `AGENTS.md` §1 y `00-overview.md` |
| Docker con `--memory=2g --cpus="2.0"`, encendido solo en desarrollo/pruebas | `G-7`, `AGENTS.md` §5 |
| Git desde Fase 0 y archivos de agentes/IA visibles en GitHub | `G-6`, `G-6b`, `portfolio-publication.md` |
| Estructura canónica completa (`frontend/`, `backend/`, `infra/terraform/`, `tests/`, `temporary/`) | `AGENTS.md` §3 |

---

## 2. Metodología de la entrevista

Se formularon 16 preguntas en 4 tandas, cada una con alternativas mutuamente excluyentes y descripción de sus implicaciones. Lino seleccionó una opción por decisión o aportó un matiz expreso (D-12). No se asumió ningún valor no escrito; cuando una respuesta abrió una decisión de detalle (D-12 → selector de tema), se registró tal cual y los residuos menores se listan en §5 para el CTO.

---

## 3. Registro de acuerdos con Lino

| ID | Tema | Decisión acordada | Matiz / alternativa no elegida |
|---|---|---|---|
| **D-01** | Usuarios y acceso | Proyecto de **portafolio** que **simula acceso multi-usuario con login**, con **todos los protocolos de seguridad**; los datos son **ficticios** | No es multi-usuario real con datos personales; no es demo sin login |
| **D-02** | Formatos de salida | **Ambos por imagen**: cada imagen genera WebP **y** AVIF | No se eligió "el usuario elige uno" ni "solo WebP en MVP" |
| **D-03** | Presets de calidad | **Tres presets**: Alta calidad / Equilibrada / Máxima compresión | No preset único, no deslizador libre |
| **D-04** | Descarga | **Individual y ZIP**: cada archivo por separado y ZIP del lote | No solo individual, no solo ZIP |
| **D-05** | Eliminación / limpieza | **Ambas**: borrado manual del lote + limpieza automática por ciclo de vida en S3 | No una sola de las dos |
| **D-06** | Autenticación | **JWT propio en Hono**: access + refresh, contraseñas hasheadas; 100 % local/emulador, sin servicio externo | No Cognito (dependencia del emulador), no sesiones simples |
| **D-07** | Aislamiento de datos | **Por `userId`**: prefijo por usuario en S3 (`raw`/`optimized`) y `userId` como clave en DynamoDB | No espacio compartido |
| **D-08** | Límites operativos | **Configurables por `.env`**: sin cifra fija; tamaño máximo, imágenes por lote y píxeles máximos se validan en la API desde configuración | No 10/20, 25/50 ni 50/100 fijos |
| **D-09** | Errores y DLQ | **3 reintentos + DLQ, continúa**: si agota reintentos, imagen `FAILED` y el resto del lote sigue | No abortar el lote, no DLQ silenciosa |
| **D-10** | Datos y retención | **Job completo + 30 días**: `userId`, `jobId`, estado, preset, formatos, bytes antes/después, % ahorro, `exifStripped`, timestamps; TTL 30 días en DynamoDB y ciclo de vida 30 días en S3 | No 7 días, no conservación indefinida |
| **D-11** | Validación y privacidad | **Estricta + todo metadata**: magic bytes y MIME real, rechazo de SVG/GIF animados/formatos peligrosos, límite de dimensiones anti-bomba y eliminación de **todos** los metadatos (EXIF/GPS incluidos) | No validación moderada ni básica; no conservar otros metadatos |
| **D-12** | Lineamientos UI | Conjunto de capacidades de la **opción 1** (minimalista, drag & drop, barra de progreso, comparativa antes/después, tabla de métricas) **más selector de modo Claro / Dark** | Matiz literal de Lino: *"Claro + comparativa tal como indica la opción 1 pero debe permitir selección de modo Claro o Dark"* |
| **D-13** | Datos ficticios | **Script seed sintético**: usuarios demo e imágenes sintéticas pequeñas para poblar local/CI | No solo fixtures de test, no sin datos demo |
| **D-14** | GitHub remoto | **Crear repo nuevo**, **público**, nombre **`mediashrink-cloud`**; G-6 desde Fase 0; G-6b = incluir `AGENTS.md`, `STATE.md`, `.agents/`, `docs/sdd/`, `reports/` | No repo existente, no privado, no diferir |
| **D-15** | Progreso en UI | **Polling `GET /jobs/:id`** (~2 s) | No SSE, no WebSocket |
| **D-16** | Alta de usuarios e idioma | **Ambos** (registro público abierto + usuarios demo del seed) e interfaz en **español** | No solo seed, no inglés/bilingüe |

---

## 4. Especificación funcional derivada

### 4.1 Usuarios y acceso
- Tres tipos de actor: **visitante** (se registra), **usuario autenticado** (gestiona sus lotes) y **architect/CTO** (coordinación, no usuario de producto).
- Registro público con contraseña hasheada (D-16) + cuentas demo creadas por el seed (D-13).
- Login emite `access` + `refresh` JWT; el frontend envía el access token en cada llamada; refresh renueva la sesión (D-06).
- Toda lectura/escritura está filtrada por `userId` (D-07). Un usuario nunca puede ver, descargar ni borrar lotes de otro.

### 4.2 Flujo del MVP (happy path)
1. El usuario inicia sesión (o se registra) en la SPA en español.
2. Arranca imágenes por **drag & drop** (o selector de archivos) y elige uno de los **tres presets** (D-03).
3. La API valida la sesión y los límites configurados (D-08), registra el job en DynamoDB con estado `PENDING` y devuelve **Presigned URLs** de subida al bucket S3 `raw`.
4. El navegador sube cada imagen **directamente a S3 `raw`** bajo el prefijo del usuario.
5. La confirmación de subida encola un mensaje en **SQS**; el worker/lambda lo consume.
6. El worker descarga de `raw`, valida magic bytes y dimensiones, elimina **todos** los metadatos, genera **WebP + AVIF** y **miniatura** por imagen, guarda en S3 `optimized` y actualiza DynamoDB con bytes antes/después, % ahorro, `exifStripped` y estado `COMPLETED`.
7. La SPA consulta `GET /jobs/:id` cada ~2 s (D-15), muestra barra de progreso y, al terminar, la **comparativa antes/después** y la **tabla de métricas** (D-12).
8. El usuario descarga cada resultado o un **ZIP** del lote (D-04).
9. El usuario puede **borrar el lote** (S3 `raw` + `optimized` y fila DynamoDB) o dejar que el **ciclo de vida 30 días** lo limpie (D-05, D-10).

### 4.3 Procesamiento, formatos y presets
- Por imagen de entrada: 1 WebP + 1 AVIF + 1 miniatura (formato de miniatura a fijar por CTO/Designer; se propone WebP).
- Presets: `HIGH`, `BALANCED`, `MAX_COMPRESSION` (nombres a confirmar en Fase 1); el preset se aplica al **lote**.
- Regla de ahorro: `ahorro_pct = (bytesAntes − bytesDespués) / bytesAntes × 100`, calculado con bytes reales de S3; si el resultado optimizado pesa más, se reporta 0 % o valor negativo real (sin ocultar datos).

### 4.4 Descarga y eliminación
- Descarga individual: una URL presignada por archivo optimizado y por miniatura.
- Descarga ZIP: agrupa todos los resultados del lote del usuario.
- Borrado manual: elimina objetos `raw` y `optimized` del lote y su registro en DynamoDB; el mensaje SQS/DLQ asociado se gestiona según D-09.

### 4.5 Límites, errores y DLQ
- Variables configurables en `.env.example` (solo plantilla, sin valores secretos — G-3): tamaño máximo por archivo, número máximo de imágenes por lote y dimensiones máximas (anti-bomba).
- Validación fallida antes de subir → rechazo con error claro en la UI.
- Fallo del worker → 3 reintentos; agotados, mensaje a **DLQ**, imagen marcada `FAILED`, lote continúa (D-09); la UI refleja el estado parcial.

### 4.6 Datos y retención
- Registro por lote en DynamoDB con: `userId`, `jobId`, `estado`, `preset`, `formatos`, `bytesAntes`, `bytesDespues`, `ahorroPct`, `exifStripped`, `createdAt`, `updatedAt`, `ttl` (30 días).
- S3: ciclo de vida de 30 días en `raw` y `optimized`; borrado manual anticipado permitido.

### 4.7 Seguridad, validación y privacidad
- Magic bytes + MIME real + extensión; rechazo de SVG, GIF animados y formatos peligrosos; límite de píxeles.
- Eliminación de **todos** los metadatos embebidos, con `exifStripped: true` como evidencia verificable (D-11).
- JWT propio con contraseñas hasheadas; CORS explícito; validación Zod de entradas; errores sin exponer rutas internas ni secretos (G-3).
- Datos ficticios: ninguna foto personal real entra al sistema.

### 4.8 UI, idioma y progreso
- SPA en **español**, tema **Claro/Dark** con selector, drag & drop, barra de progreso por polling, comparativa antes/después y tabla de métricas (D-12, D-15, D-16).

### 4.9 GitHub y operación
- Repo **público `mediashrink-cloud`** creado en Fase 0 (G-6), con archivos de agentes/IA incluidos (G-6b) y exclusión absoluta de `.env`, secretos y `temporary/`.

---

## 5. Puntos abiertos menores (para el CTO; no bloquean Gate 1)

| # | Punto | Propuesta no confirmada |
|---|---|---|
| A-01 | Tema inicial por defecto al cargar (Claro u Oscuro) | Claro, con persistencia de la elección |
| A-02 | Algoritmo concreto de hash de contraseña | bcrypt o argon2 (elección a fijar en Fase 1 con criterio de seguridad) |
| A-03 | Nombres y valores por defecto de las variables `.env.example` | Definir en Fase 0; **sin valores reales** en reportes ni logs (G-3) |
| A-04 | Formato de la miniatura | WebP |
| A-05 | Contenido del ZIP | Solo optimizadas + miniaturas; originales quedan en `raw` con TTL |
| A-06 | Nivel de `rate limiting` en registro/login | Aplicar; pendiente de confirmación |
| A-07 | Precisión de la comparativa antes/después | Usar original de `raw` frente a optimizado de `optimized`, dentro de los 30 días de retención |

Estos puntos son **detalles de implementación**, no decisiones de alcance: el CTO puede resolverlos al consolidar el SDD o asignarlos a Fase 1. Ninguno fue asumido como aprobado en los borradores.

---

## 6. Gates aplicables y estado

| Gate | Estado | Nota |
|---|---|---|
| **G-1** Alcance y decisiones materiales | **PENDIENTE** | Revisión CTO + aprobación de Lino del SDD consolidado. Impide redactar/despachar `P-00` |
| **G-2** Apertura de fase | **NO AUTORIZADO** | Ninguna fase despachada en este encargo |
| **G-3** `.env` / secretos | **PARCIAL** | Solo `.env.example` se versionará; valores reales por canal seguro |
| **G-4** Base de datos | **PENDIENTE** | DynamoDB en emulador; seed en Fase 1 |
| **G-5** Servicios externos reales | **NO APLICA** | Sin cuenta AWS real, sin OAuth externo (JWT propio) |
| **G-6** Git / GitHub | **AUTORIZADO desde Fase 0** | Repo público `mediashrink-cloud` |
| **G-6b** Archivos de IA en GitHub | **PERMITIDO SUBIR** | Incluir `AGENTS.md`, `STATE.md`, `.agents/`, `docs/sdd/`, `reports/` |
| **G-7** Docker / `aws-emulator` | **AUTORIZADO** | `--memory=2g --cpus="2.0"`; apagar al terminar |
| **G-8** Dependencias | **PENDIENTE** | Instalación en Fase 0 |
| **G-11** Borrado de rutas | **PENDIENTE** | `temporary/` solo en Fase Final |
| **G-12** Publicación | **PENDIENTE** | Push final tras aceptación de Lino |

---

## 7. Entregables de este encargo

1. `reports/intake/intake-mediashrink.md` (este informe).
2. Borradores SDD: `docs/sdd/constitution.md`, `spec.md`, `plan.md`, `tasks.md`.
3. `STATE.md` actualizado con el relevo y el estado `Pendiente revisión CTO y Gate 1`.

**No entregados** (fuera de alcance): `docs/sdd/packages/P-00.md`, prompts de fase, código, pruebas, ejecución de comandos de build/test, operaciones Git.

---

## 8. Retorno al CTO (parada)

Se detiene la ejecución aquí, según `WORKFLOW.md` §1 (condiciones de retorno 3 y 4) y el encargo recibido: el SDD está complete en forma de **borrador** pero requiere **consolidación del CTO y aprobación de Gate 1 por Lino** antes de redactar y despachar `P-00`.

- **Estado:** `Pendiente revisión CTO y Gate 1`.
- **Siguiente acción del CTO:** revisar consistencia de los borradores, resolver A-01…A-07 si lo considera material, consolidar `docs/sdd/`, presentar a Lino para Gate 1 y —solo entonces— preparar `P-00`.
- **No repetir:** dar por aprobado el SDD, redactar `P-00` ni iniciar Fase 0 sin Gate 1.
