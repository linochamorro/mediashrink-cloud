# Constitución — MediaShrink Cloud

> **ESTADO: APROBADO (Gate 1 / G-1, Lino, 2026-11-17).** Consolidado por CTO (Atenea).

Fuente de decisiones: `ADR-001`, entrevista de intake (`D-01`…`D-16`) y consolidación CTO (`A-01`…`A-07`).

---

## 1. Propósito invariante

MediaShrink Cloud es una SPA de **portafolio** que demuestra una arquitectura AWS serverless real, ejecutable en local/CI sin coste, para optimizar lotes de imágenes **ficticias**: conversión **WebP + AVIF**, miniaturas, eliminación total de metadatos y métricas reales de ahorro. Simula acceso multi-usuario con protocolos de seguridad completos.

## 2. Principios rectores

| ID | Principio | Consecuencia normativa |
|---|---|---|
| **PR-01** | Privacidad primero | Se eliminan **todos** los metadatos (EXIF/GPS incluidos) y se evidencia con `exifStripped`. Ninguna foto personal real entra al sistema (D-01, D-11) |
| **PR-02** | Datos ficticios | Usuarios e imágenes de prueba se generan con script seed sintético (D-13); jamás datos personales reales |
| **PR-03** | Arquitectura desacoplada real | `frontend/` (Vite SPA) → API Hono → S3 Presigned URL → subida directa. Sin backend fullstack ni servidor permanente (ADR-001) |
| **PR-04** | Emulación sin coste | Toda infraestructura se aprovisiona con Terraform contra `aws/aws-emulator`; no se usa cuenta AWS real (ADR-001) |
| **PR-05** | SDD + TDD obligatorio | Toda lógica de producto: `RED → GREEN → REFACTOR` en `tests/`. Documentación e IaC se verifican por criterios documentales/comandos declarados |
| **PR-06** | Sin supuestos | Ningún agente escribe lo que no está acordado. Ante decisión material de producto/diseño → `NEEDS_CONTEXT` al CTO (WORKFLOW §1) |
| **PR-07** | Aislamiento por usuario | Todo acceso a S3 y DynamoDB está filtrado por `userId` (D-07) |
| **PR-08** | Secretos fuera del repositorio | Solo `.env.example` se versiona; nunca valores reales en código, reportes, prompts ni logs (G-3) |
| **PR-09** | Transparencia de ingeniería IA | Con G-6b abierto, se versionan `AGENTS.md`, `STATE.md`, `.agents/`, `docs/sdd/`, `reports/`; se excluyen siempre `.env`, secretos y `temporary/` |
| **PR-10** | Supervisión y autonomía acotada | Architect coordina la fase asignada y retorna al CTO en las 4 condiciones de WORKFLOW §1; no implementa ni ejecuta pruebas |
| **PR-11** | Gates explícitos | Ninguna tarea dependiente de un gate sin resolver se da por autorizada; los gates se listan en cada paquete `P-xx` |
| **PR-12** | Métricas honestas | El ahorro se calcula con bytes reales; no se ocultan resultados negativos ni se falsifican cifras (D-10) |

## 3. Decisiones aprobadas que no se reabren

1. **Stack (ADR-001):** Vite + React + TypeScript; Hono + TypeScript + Zod; `sharp` (libvips); Terraform; `aws/aws-emulator`; Vitest + Playwright.
2. **Infraestructura (AGENTS.md):** S3 `raw` y `optimized`, SQS + DLQ, Lambda worker, DynamoDB.
3. **Container (G-7):** `--memory=2g --cpus="2.0"`, encendido solo en desarrollo/pruebas, apagado al terminar.
4. **Git/GitHub (G-6, G-6b):** desde Fase 0, repo público `mediashrink-cloud`, archivos de agentes/IA incluidos.
5. **Intake D-01…D-16:** íntegramente recogidos en `reports/intake/intake-mediashrink.md` §3.

## 4. Invariantes técnicos

| ID | Invariante |
|---|---|
| **IN-01** | Cada imagen produce **un WebP, un AVIF y una miniatura** (D-02, AGENTS §1) |
| **IN-02** | Existen exactamente **tres presets** de calidad (D-03) |
| **IN-03** | La descarga admite **individual y ZIP** (D-04) |
| **IN-04** | Existen el **borrado manual de lote** y la **limpieza automática por ciclo de vida** (D-05) |
| **IN-05** | La autenticación es **JWT propio en Hono** con contraseñas hasheadas, sin servicio externo (D-06) |
| **IN-06** | El prefijo S3 y la clave DynamoDB incluyen `userId` (D-07) |
| **IN-07** | Los límites (tamaño, lote, píxeles) se leen de configuración `.env` y se validan en la API (D-08) |
| **IN-08** | El worker reintenta **3 veces**, envía a **DLQ** y marca la imagen `FAILED` sin abortar el lote (D-09) |
| **IN-09** | TTL DynamoDB y ciclo de vida S3 son de **30 días** (D-10) |
| **IN-10** | Validación estricta: magic bytes + MIME real + anti-bomba; rechazo de SVG y animados; **todos** los metadatos eliminados (D-11) |
| **IN-11** | UI en **español**, con selector **Claro/Dark**, drag & drop, progreso, comparativa y métricas (D-12, D-16) |
| **IN-12** | Progreso por **polling `GET /jobs/:id`** (~2 s); sin SSE ni WebSocket (D-15) |
| **IN-13** | Registro público abierto **y** usuarios demo del seed (D-16) |
| **IN-14** | Repo GitHub público `mediashrink-cloud` creado en Fase 0 (D-14) |

## 5. Prohibiciones

- No implementar código ni ejecutar pruebas durante el intake o sin paquete `P-xx` autorizado.
- No usar cuenta AWS real, servicios externos de pago ni OAuth de terceros (G-5 = no aplica).
- No versionar `.env` real, secretos, tokens ni rutas locales absolutas en artefactos públicos.
- No copiar metadatos EXIF/GPS a `optimized` ni a las miniaturas.
- No iniciar Fase 0 ni redactar `P-00` antes de Gate 1.
- No reducir criterios de aceptación por limitaciones de herramienta; no aceptar riesgos sin autorización de Lino (G-10).

## 6. Gobernanza y cambios

- `constitution.md` y `spec.md`: CTO consolida, Lino aprueba (Gate 1 y cambios de alcance).
- `plan.md` y `tasks.md`: CTO redacta y asigna; Architect actualiza estado de tareas.
- Toda enmienda a este documento debe registrarse con fecha, autoridad y motivo, y reflejarse en `STATE.md`.
