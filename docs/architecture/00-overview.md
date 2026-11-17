# Visión general de arquitectura — MediaShrink Cloud

## 1. Estructura de código elegida
Según la tabla de estructura por tipo de proyecto:
- **`frontend/`**: Aplicación SPA en Vite + React + TypeScript (español, tema Claro/Dark, auth JWT, drag & drop, polling, comparativa y métricas).
- **`backend/`**: API HTTP serverless en Hono (TypeScript + Zod, JWT propio) y worker/Lambda de procesamiento de imágenes con `sharp`.
- **`infra/terraform/`**: Infraestructura declarativa (S3 `raw` y `optimized` con ciclo de vida 30 días, SQS + DLQ con `maxReceiveCount = 3`, DynamoDB con TTL 30 días, CORS).
- **`tools/scripts/`**: Script seed sintético (usuarios demo + imágenes `100x100`).
- **`tests/`**: Suite permanente (`unit/`, `integration/`, `e2e/`).
- **`temporary/`**: Material efímero (se elimina antes de cerrar el proyecto).

### 1.1 Workspaces y tooling (F00-T02)
- **Workspaces npm**: paquetes `@mediashrink/frontend` y `@mediashrink/backend` declarados en `package.json` raíz; `package-lock.json` se versiona para instalación reproducible (`npm ci`).
- **TypeScript**: `tsconfig.base.json` en la raíz con opciones compartidas (`strict`, `moduleResolution: Bundler`, `noEmit`); `frontend/tsconfig.json` añade JSX/DOM y `backend/tsconfig.json` incluye `src/` y la suite permanente `tests/`.
- **Esqueleto únicamente**: `backend/src/index.ts` expone solo `GET /health` (humo); `frontend/` contiene el entrypoint Vite + React sin pantallas de producto. Rutas, contratos Zod, worker `sharp` y UI se incorporan en F01–F03.
- **Scripts raíz verificados**: `npm run typecheck`, `npm run lint`, `npm run test:unit` (Vitest sobre `tests/unit`). Playwright queda declarado para E2E de fases posteriores.

## 2. Flujo de datos
1. El usuario se registra o inicia sesión en `frontend/` (JWT access + refresh gestionados en `backend/src/api/`).
2. El cliente solicita una **Presigned URL** (`POST /jobs`) eligiendo uno de los **3 presets**; la API valida límites por `.env`, crea el job en **DynamoDB** (`PENDING`, `ttl = 30 días`, clave `userId`/`jobId`) y devuelve URLs firmadas hacia **S3 `raw/<userId>/<jobId>/`**.
3. El navegador sube cada imagen directamente a **S3 `raw`** y confirma la subida (`POST /jobs/:id/confirm`), publicando en **SQS**.
4. El worker (`backend/src/worker/`) descarga de `raw`, valida *magic bytes*/MIME/dimensiones anti-bomba, elimina **todos** los metadatos (EXIF/GPS), genera **WebP + AVIF + miniatura WebP** con **`sharp`**, guarda en **S3 `optimized/<userId>/<jobId>/`** y actualiza **DynamoDB** (`COMPLETED` / `PARTIAL` / `FAILED` tras 3 reintentos + DLQ).
5. La SPA consulta `GET /jobs/:id` cada ~2 s, muestra comparativa *antes/después* (dentro de los 30 días de retención), descarga individual o **ZIP** (optimizadas + miniaturas) y permite borrado manual (`DELETE /jobs/:id`).
