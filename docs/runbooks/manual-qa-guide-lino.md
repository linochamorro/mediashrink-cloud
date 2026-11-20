# Guía paso a paso de pruebas manuales (Lino) — MediaShrink Cloud

Vigente: 2026-11-20 · Uso: validación manual completa de extremo a extremo en tu máquina local contra `aws/aws-emulator` (sin cuenta AWS real).

> **Acceso de cuenta (F05-UX-HEADER-AUTH):** el botón **Iniciar sesión** está en el **encabezado** (junto a Claro/Oscuro). Al pulsarlo se abre un panel accesible con el formulario; ciérralo con **Escape**, con la **×** del panel o al autenticar. Con sesión iniciada, el encabezado muestra tu correo compacto y el botón **Cerrar sesión**. Ya no hay formulario ni barra de sesión bajo «Prepara un lote».

> **Prerrequisito:** ejecutar después de que OpenCode cierre la corrección `H-01` (seed apuntando a `mediashrink-jobs`) y sincronice los cambios.

---

## Preparación: arranque del entorno local

Abre una terminal en la raíz del proyecto (la carpeta que contiene este repositorio) y ejecuta en orden:

```powershell
# 1. Instalar dependencias y preparar .env (si no existe)
npm ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }

# 2. Levantar aws/aws-emulator en Docker (límite 2 GiB RAM / 2 CPUs)
docker compose up -d

# 3. Copiar certificado TLS y credenciales efímeras del emulador (repetir en CADA arranque)
New-Item -ItemType Directory -Force -Path .local\aws-emulator | Out-Null
docker cp mediashrink-aws-emulator:/home/emulator/.aws/emulator/9297/ca.pem .\.local\aws-emulator\ca.pem
docker cp mediashrink-aws-emulator:/home/emulator/.aws/emulator/9297/config .\.local\aws-emulator\config
docker cp mediashrink-aws-emulator:/home/emulator/.aws/emulator/9297/emulator_credentials .\.local\aws-emulator\emulator_credentials

# 4. Aprovisionar buckets S3, SQS+DLQ, DynamoDB y CORS con Terraform
terraform -chdir=infra/terraform init
terraform -chdir=infra/terraform apply -auto-approve -var=is_emulator=true

# 5. Cargar usuarios y lotes demo sintéticos (idempotente)
npm run seed
```

Luego abre **dos terminales adicionales** en la misma carpeta:
- **Terminal A (Backend + Worker):** `npm run dev:backend` → espera a ver el servidor activo en `http://localhost:3001`.
- **Terminal B (Frontend SPA):** `npm run dev:frontend` → abre en tu navegador `http://localhost:5173`.

---

## Pruebas paso a paso y resultados esperados

### Prueba 1 — Carga inicial, idioma y tema Claro/Oscuro
1. Abre `http://localhost:5173`.
   - **Resultado esperado:** interfaz en **español**, tema **Claro** por defecto, sin errores en la consola del navegador (`F12 → Console`).
2. Haz clic en el botón **Oscuro** (esquina superior derecha) y recarga la página (`F5`).
   - **Resultado esperado:** la interfaz cambia a modo **Oscuro** y **conserva** el tema Oscuro tras recargar. Vuelve a **Claro** si lo prefieres.

### Prueba 2 — Error seguro de credenciales inválidas (Seguridad Auth)
1. Haz clic en **Iniciar sesión** en el encabezado (esquina superior derecha) para abrir el panel de acceso.
2. En el formulario del panel, escribe `ana.demo@example.com` y contraseña incorrecta `ClaveIncorrecta123!`.
3. Haz clic en **Iniciar sesión** (botón del formulario).
   - **Resultado esperado:** aparece un mensaje de error claro en español dentro del panel (sin mostrar stack traces, rutas internas ni decir si el correo existe o no). El panel permanece abierto para corregir el error.

### Prueba 3 — Inicio de sesión con cuenta seed (`H-01`)
1. Si aún no está abierto, haz clic en **Iniciar sesión** en el encabezado para abrir el panel de acceso.
2. Inicia sesión con:
   - Correo: `ana.demo@example.com`
   - Contraseña: `DemoAna2026!`
   - **Resultado esperado:** acceso concedido (`200 OK`), el panel se cierra automáticamente y el encabezado muestra el correo `ana.demo@example.com` junto al botón **Cerrar sesión**. Aparece el historial de lotes demo de Ana.

### Prueba 4 — Validación de seguridad de archivos en cliente
1. Intenta arrastrar o seleccionar un archivo **no permitido** (por ejemplo, cualquier archivo `.svg`, `.txt`, `.pdf` o una imagen > `15 MB`).
   - **Resultado esperado:** la interfaz **rechaza el archivo antes de subirlo**, muestra un aviso claro del motivo y mantiene deshabilitado el envío del archivo inválido.

### Prueba 5 — Subida real, procesamiento asíncrono (`sharp`) y métricas
1. Selecciona o arrastra **2 o 3 imágenes reales** (`JPEG` o `PNG`, idealmente una foto tomada con celular que tenga metadatos EXIF/GPS).
2. Elige el preset **Equilibrado** y haz clic en **Optimizar tus imágenes**.
   - **Resultado esperado:**
     - La barra de progreso avanza automáticamente cada ~2 s (`Pendiente` → `Procesando` → `Completado`).
     - Aparece el resumen del lote con **Original**, **Optimizado**, **Ahorro real (%)** y el badge **`✓ EXIF eliminado`**.
     - Se muestran las tarjetas comparativas **Original** vs. **Optimizada · WEBP** por cada imagen.

### Prueba 6 — Descarga individual, ZIP y verificación real de privacidad (EXIF)
1. Haz clic en **Descargar WEBP** y **Descargar AVIF** en una imagen.
   - **Resultado esperado:** ambos archivos se descargan y abren correctamente con menor peso que la original.
   - *(Opcional en Windows):* clic derecho en la imagen descargada → **Propiedades → Detalles** → **Resultado esperado:** sin cámara, modelo ni coordenadas GPS.
2. Haz clic en **Descargar ZIP del lote**.
   - **Resultado esperado:** se descarga un `.zip` válido que contiene las versiones optimizadas (`WebP` + `AVIF`) y las miniaturas del lote.

### Prueba 7 — Resiliencia ante archivo corrupto (3 reintentos + DLQ)
1. Crea un archivo de texto vacío, cámbiale la extensión a `corrupta.jpg` (no tiene *magic bytes* válidos de JPEG) o corrompe los bytes internos de una copia de un `.jpg`.
2. Sube 1 imagen válida junto con la imagen corrupta en el mismo lote.
   - **Resultado esperado:**
     - Si falla en validación de cabecera: la API/UI rechaza el archivo inválido antes de procesar.
     - Si pasa con cabecera JPEG válida pero contenido truncado/corrupto: el worker reintenta 3 veces, envía ese ítem a la **DLQ**, marca esa imagen como fallida y el lote termina en **`Completado parcialmente`** conservando la imagen sana optimizada.

### Prueba 8 — Registro de usuario nuevo y aislamiento multi-usuario (Anti-IDOR)
1. Haz clic en **Cerrar sesión** en el encabezado.
   - **Resultado esperado:** se borran de la pantalla todos los lotes, métricas y previsualizaciones de Ana (nada queda visible en memoria) y el encabezado vuelve a mostrar **Iniciar sesión**.
2. Haz clic en **Iniciar sesión** en el encabezado para abrir el panel y, dentro de él, haz clic en **Crear cuenta**; registra `prueba.manual@example.com` / `MiClaveSegura2026!` e inicia sesión (o cambia a «Ya tengo cuenta» y accede con `bruno.demo@example.com` / `DemoBruno2026!`).
   - **Resultado esperado:** ves únicamente los lotes del nuevo usuario (o de Bruno), **nunca** los lotes de Ana.

### Prueba 9 — Borrado manual de lote (`DELETE /jobs/:id`)
1. Con la sesión de `ana.demo@example.com`, abre uno de los lotes que creaste y haz clic en **Eliminar lote**.
2. Recarga la página (`F5`).
   - **Resultado esperado:** el lote desaparece inmediatamente de la lista y **no reaparece** al recargar (eliminado de DynamoDB y de ambos buckets S3).

### Prueba 10 — Cierre limpio de recursos (Docker)
1. Detén Terminal A y Terminal B (`Ctrl + C`).
2. Ejecuta:
   ```powershell
   docker compose down
   ```
   - **Resultado esperado:** el contenedor `mediashrink-aws-emulator` y su red se detienen limpiamente (`docker ps` sin contenedores de MediaShrink) y tu PC vuelve a reposo.
