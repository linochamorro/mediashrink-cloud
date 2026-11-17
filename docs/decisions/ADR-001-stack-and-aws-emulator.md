# ADR-001 — Selección de stack desacoplado (Vite + React, Hono, `sharp`, Terraform y `aws/aws-emulator`)

- **Estado:** Aceptada (aprobada por Lino el 2026-11-17)
- **Contexto:** MediaShrink Cloud es una aplicación de uso cotidiano para optimizar lotes de imágenes (conversión a WebP/AVIF, miniaturas y eliminación de metadatos EXIF/GPS por privacidad) ejecutada sobre una arquitectura AWS serverless (**S3 + SQS + DLQ + Lambda + DynamoDB**). Se requiere demostrar criterio arquitectónico cloud real, ejecución local y en CI sin coste usando **`aws/aws-emulator`**, y bajo consumo de recursos en Windows.

---

## Decisión 1: Frontend — Vite + React + TypeScript (SPA) frente a Next.js

### Alternativas evaluadas
1. **Next.js (App Router fullstack o `output: 'export'`)**
2. **Vite + React + TypeScript (SPA desacoplada)**

### Por qué se elige Vite + React frente a Next.js
Aunque Next.js soporta SSR, SSG, `output: 'export'` y API Routes/Server Actions, en una arquitectura AWS centrada en **S3 Presigned URLs** introduce dos fricciones claras:
1. **Contradicción en despliegue estático (`output: 'export'`):** en AWS real, un frontend SPA se aloja en **S3 + CloudFront** a coste mínimo y sin servidores. Si Next.js se exporta estáticamente para subirlo a S3, **pierde sus API Routes, Server Actions, SSR y Middleware**, quedando reducido a un bundler más pesado que Vite.
2. **Complejidad innecesaria si se usa el runtime de servidor:** mantener SSR/API Routes en AWS exige un servidor Node.js permanente (ECS/EC2) o adaptadores complejos en Lambda (*OpenNext* / Amplify).
3. **Necesidad real del producto:** MediaShrink es una herramienta interactiva privada (subida de lotes, progreso, comparativa *antes vs. después* y descarga), no un portal editorial que dependa de SEO por página.
4. **Versatilidad:** Vite compila en segundos a archivos estáticos puros y **fuerza la separación arquitectónica cloud real** (`Cliente SPA → API → S3 Presigned URL → Subida directa a S3`).

---

## Decisión 2: Backend API — Hono (TypeScript) frente a NestJS

### Alternativas evaluadas
1. **NestJS (con Express/Fastify + `serverless-http`)**
2. **Hono (TypeScript, Web Standards `Request`/`Response`)**

### Por qué se elige Hono frente a NestJS
NestJS es sólido para backends monolíticos o microservicios tradicionales en servidores persistentes, pero en **AWS Lambda** penaliza por diseño:
1. **Peso y *Cold Start*:** NestJS inicializa `reflect-metadata`, un contenedor de Inyección de Dependencias (IoC) y adaptadores HTTP puente, añadiendo latencia de arranque en Lambda. **Hono pesa ~14 KB, tiene cero dependencias externas** y arranca en pocos milisegundos.
2. **Proporcionalidad al alcance:** La API de MediaShrink orquesta ~4–5 operaciones concretas (solicitar Presigned URLs, registrar/consultar estado de jobs en DynamoDB, generar URL de descarga y eliminar activos). Montar módulos, decoradores y `@Injectable()` de NestJS para 5 rutas sería sobre-ingeniería.
3. **Portabilidad real local ↔ Lambda:** Hono usa estándares Web (`Fetch API`) e incluye adaptador nativo (`hono/aws-lambda`), permitiendo ejecutar exactamente el mismo código como servidor Node local y como handler de Lambda.
4. **Velocidad en TDD:** Las pruebas de integración HTTP con `app.request(...)` corren en memoria en milisegundos sin levantar servidores ni contenedores IoC.

---

## Decisión 3: Motor de procesamiento de imágenes — Node.js + `sharp` (`libvips`) frente a Python `Pillow`, Rust o Go

### Alternativas evaluadas
1. **Node.js (TypeScript) + `sharp` (`libvips`)**
2. **Python + `Pillow`**
3. **Rust (`image` crate / `libvips`)**
4. **Go (`image` stdlib)**

### Por qué se elige Node.js + `sharp`
1. **Rendimiento y memoria en Lambda:** `sharp` se apoya en `libvips`, que procesa imágenes mediante *streaming* por bloques sin cargar el bitmap completo descomprimido en RAM. Frente a Python `Pillow`, suele ser **3x–5x más rápido** y evita picos de memoria (`OOM`) al procesar fotos de alta resolución.
2. **Velocidad de desarrollo vs. Rust:** Rust ofrece un rendimiento comparable pero multiplica el código ceremonial necesario para orquestar S3/SQS/DynamoDB y pipelines de imagen.
3. **Unificación de lenguaje:** Todo el stack de aplicación (`frontend/`, `backend/`, `tests/`) comparte TypeScript, contratos Zod y Vitest.

---

## Decisión 4: Emulación Cloud e IaC — `aws/aws-emulator` (Docker) + Terraform

### Por qué se elige `aws/aws-emulator` + Terraform
1. **Fidelidad de APIs sin cuenta ni gasto AWS:** `aws/aws-emulator` está implementado en **Rust** a partir de los modelos oficiales de APIs de AWS y mantiene estado en memoria (~175 MiB en reposo).
2. **Control térmico y de recursos en Windows:** Se ejecuta en Docker con límites estrictos (`--memory=2g --cpus="2.0"`), encendido únicamente durante desarrollo/pruebas de integración y apagado al finalizar.
3. **Infraestructura declarativa real:** **Terraform** aprovisiona de forma reproducible los dos buckets S3 (`raw` y `optimized`, evitando bucles infinitos de eventos), la cola SQS + DLQ y la tabla DynamoDB tanto en local como en CI (GitHub Actions).

---

## Consecuencias
- **Positivas:** Arquitectura cloud fiel a producción, pruebas TDD/integración ultrarrápidas, cero vendor lock-in de frameworks fullstack y diferenciación clara frente a proyectos Next.js previos del portafolio.
- **Compromisos aceptados:** Al desacoplar `frontend/` y `backend/`, se mantiene configuración explícita de CORS y contratos compartidos tipados; en Windows se requiere Docker Desktop activo únicamente durante las pruebas contra `aws/aws-emulator`.
