# Retorno intermedio de Fase `P-05` — MediaShrink Cloud

| Campo | Valor |
|---|---|
| **Fecha** | `2026-11-18` |
| **Fase / Paquete** | Fase Final — `docs/sdd/packages/P-05-final-integration-and-delivery.md` |
| **Etapa entregada** | `F05-T01`, `F05-T02`, `F05-T04` (autorizadas en este despacho) |
| **Motivo de retorno** | **PAUSA OBLIGATORIA** antes de `F05-T03` (pruebas exploratorias de Lino), `F05-T05` y `F05-T06` |
| **¿Fase completa?** | **NO.** `FASE_COMPLETA` solo se emitirá tras `F05-T06` y autorización de gates |
| **G-11 / G-12** | **PENDIENTES Y NO EJECUTADOS** — se solicita autorización expresa |

---

## 1. Veredictos de la etapa

| Tarea | Resultado | Dictamen | Cifras / detalle |
|---|---|---|---|
| `F05-T01` — Integración global real | **`PASSED (loop 2/3)`** | **Tester** `PASSED` en addendum (`F05-T01-tester.md`) | 3/3 E2E reales propias verdes (12.9/13.9/12.8 s, `EXIT_CODE=0`); unit 277/277; integración 97/97; typecheck/lint/build 0; `terraform apply` 11 recursos; CI limpia y verde. El `NO-PASSED` de v1 se conservó append-only |
| `F05-T02` — Seguimientos y Auditoría final | **`PASSED (loop 1/3)`** | **Auditor** `READY_WITH_CONCERNS` (`reports/audits/F05/F05-T02-auditor.md`) · Tester `PASSED` | **0 CRITICAL/HIGH, 0 secretos**; F03-AUD-03 cerrado (URL allowlist), `HeadObject` real para `bytesBefore`, P4 anonimizado (827 archivos escaneados, 0 rutas; 72 archivos/119 reemplazos) |
| `F05-T04` — Capturas y README | **`PASSED (loop 2/3)`** | Tester `PASSED` en addendum (`F05-T04-tester.md`) | 18 PNG reales Claro/Dark (9 flujos), README exacto a la plantilla, 24 enlaces sin rotos, 0 rastros internos, LICENSE MIT; cifra corregida a 303/303 |

Verificación adicional del Tester de T01: el relay S3 del E2E es **solo adaptación de transporte/CORS** (URL, cuerpo y CA reales; respuesta real del emulador), **no un doble de API ni del worker**. El default del producto `RATE_LIMIT_AUTH_MAX=5` permanece intacto; `F05_E2E_RATE_LIMIT_MAX=1000` se inyecta únicamente en el backend del E2E.

## 2. Guía exacta de arranque local (para pruebas exploratorias de Lino — F05-T03)

Requisitos: Node 26, npm 11, Docker Desktop con motor Linux, Terraform 1.17.2 (usar rutas absolutas si los binarios no están en PATH, ver `AGENTS.md` §6).

```bash
# 1) Raíz del repositorio
cd <PROJECT_ROOT>

# 2) Dependencias y entorno (solo .env.example está versionado)
npm ci
cp .env.example .env

# 3) Infraestructura local (emulador AWS, SIN cuenta real)
docker compose up -d                      # límites 2 GiB / 2.0 CPUs
# Repetir tras CADA arranque: el emulador regenera CA y credenciales
docker cp mediashrink-aws-emulator:/home/emulator/.aws/emulator/9297/ca.pem ./.local/aws-emulator/ca.pem
docker cp mediashrink-aws-emulator:/home/emulator/.aws/emulator/9297/config ./.local/aws-emulator/config
docker cp mediashrink-aws-emulator:/home/emulator/.aws/emulator/9297/emulator_credentials ./.local/aws-emulator/emulator_credentials

# 4) Aplicar infraestructura y sembrar datos ficticios
terraform -chdir=infra/terraform init
terraform -chdir=infra/terraform apply -auto-approve -var=is_emulator=true
npm run seed                              # idempotente; 3 usuarios, 3 lotes, 6 imágenes 100x100

# 5) Arrancar producto
npm run dev:backend                       # API Hono + consumidor SQS → http://localhost:3001
npm run dev:frontend                      # SPA Vite → http://localhost:5173
```

**Cuentas seed sintéticas** (datos de demostración; contraseñas **no son secretos**, están versionadas en `tools/scripts/seed/demo-data.ts`):

| Correo | Contraseña | Preset del lote demo |
|---|---|---|
| `ana.demo@example.com` | `DemoAna2026!` | `BALANCED` |
| `bruno.demo@example.com` | `DemoBruno2026!` | `HIGH` |
| `carla.demo@example.com` | `DemoCarla2026!` | `MAX_COMPRESSION` |

**Flujo sugerido para la exploración:** registro/login → arrastrar fotos → elegir preset → subida directa a S3 → progreso (polling) → comparativa antes/después → métricas de ahorro → descarga individual/WebP/ZIP → borrado del lote → alternar tema Claro/Oscuro → comprobar que un usuario no ve lotes ajenos (401/404).

**Al terminar:** `docker compose down` (apaga emulador y red; el volumen named persiste por diseño). **No borrar `temporary/`.**

## 3. Solicitud expresa de gates

- **G-11 — Borrado físico de `temporary/`:** se solicita autorización expresa de Lino para ejecutar `F05-T05` (borrado verificado + reejecución de `build` y `tests/` completos sin `temporary/`). Hoy `temporary/` contiene 71 ítems y **no se ha tocado**.
- **G-12 — Publicación final en GitHub:** se solicita autorización expresa de Lino para ejecutar `F05-T06` (push final de los entregables pendientes, verificación de CI y cierre con `FASE_COMPLETA`). El repo público `linochamorro/mediashrink-cloud` ya existe por G-6; **no se ha realizado publicación/release/deploy** en esta etapa. Último commit verificado: `f43d903`; los entregables T02/T04 están aún sin commitear a la espera de esta autorización.

**Nota de gobernanza:** el Auditor final inventarió dos rutas institucionales restantes (`AGENTS.md:34`, `STATE.md:87`) y recomendaciones LOW/INFO (allowlist de hosts en producción, `ETag`/`VersionId` para `HeadObject`, rol IAM único por función, `cors_origin`, default `is_emulator=true`, perfiles `USER#` sin `ttl`, billing 5/5, acciones `@v4`, ESLint 8, `CONFIRM_INCONSISTENT`, F03-AUD-07/08/09). Ninguna fue aceptada como riesgo: **G-10 no invocado**; se requiere decisión de Lino antes de G-12 si se desea tratarlas de otro modo.

## 4. Confinamiento y estado

- Docker apagado tras cada prueba (`docker ps -a` sin contenedores del proyecto; solo `dazzling_edison`, ajeno y preexistente); puertos 3001 y 9297 sin escuchas.
- Sin AWS real, sin secretos en reportes/logs, sin rutas Windows absolutas en artefactos nuevos (P4 resuelto), sin borrado de `temporary/`.
- No se actualizaron `STATE.md` ni `docs/sdd/tasks.md` en esta etapa: el CTO consolida al retorno.

---

**Estado del retorno:** `PAUSA PARA F05-T03` — se detiene la ejecución del Architect en el punto obligatorio. Se solicita a CTO/Lino: (1) coordinar las pruebas exploratorias con la guía anterior, y (2) autorizar expresamente **G-11** y **G-12** para continuar con `F05-T05`/`F05-T06`.

---

## Addendum (2026-11-19) — Corrección de la guía de arranque (hallazgo `H-01`)

Durante la ejecución del roadmap QA (`reports/verification/F05-qa-roadmap-architect.md`, capa 5) se detectó que **`npm run seed` escribe en la tabla `mediashrink-seed-demo` (`tools/scripts/seed/cli.ts:100`) mientras la app lee `mediashrink-jobs`**, por lo que **el login con las cuentas seed de la guía anterior devuelve `401`**. Evidencia: `evidence/qa-roadmap/cap2-01-seed-idempotente.txt`.

**Corrección operativa de la guía:** para explorar la SPA, crear las cuentas mediante el **formulario de registro** (o `POST /auth/register`) en lugar de usar las credenciales seed; el flujo a explorar no cambia. El seed sigue siendo válido e idempotente como generador de datos de demostración (`MISMOS_IDS=True`).

**Pendiente de decisión del CTO** (no ejecutado: ninguna prueba falló y el alcance no autorizaba Developer): opción **A** — corregir el seed para usar `DYNAMODB_TABLE_JOBS` (esquema compatible `USER#PROFILE`, bajo TDD); opción **B** — documentar el registro por UI/API como vía de acceso. Ningún riesgo aceptado sin Lino (G-10 no invocado). G-12 sigue retenido.
