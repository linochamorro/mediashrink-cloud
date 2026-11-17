# Stack tecnológico — MediaShrink Cloud

| Capa | Tecnología | Justificación |
|---|---|---|
| Frontend | Vite + React + TypeScript | SPA ligera, compilación estática limpia para S3/CloudFront y separación real del backend ([ADR-001](../decisions/ADR-001-stack-and-aws-emulator.md)) |
| Backend API | Hono (TypeScript + Zod) | ~14 KB, arranque inmediato en Lambda, adaptador nativo `hono/aws-lambda` y tests en memoria |
| Procesamiento | Node.js + `sharp` (`libvips`) | Streaming de bloques, 3x–5x más rápido y menor RAM que alternativas basadas en bitmap completo |
| Cloud local / CI | `aws/aws-emulator` (Docker) | Emulador oficial de AWS en Rust (S3, SQS, DynamoDB, Lambda) sin coste ni credenciales reales |
| IaC | Terraform | Definición reproducible de buckets, colas y tablas en `aws/aws-emulator` |
| Pruebas | Vitest + Playwright | TDD unitario, integración real contra `aws/aws-emulator` y E2E en navegador |
