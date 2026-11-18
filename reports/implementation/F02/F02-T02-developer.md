# Entrega de Developer — `F02-T02`

| Campo | Valor |
|---|---|
| **Tarea** | `F02-T02` — Presigned URLs S3 (raw PUT / optimized GET) |
| **Fase / paquete** | Fase 2 — `docs/sdd/packages/P-02-api-and-worker.md` |
| **Versión / Loop** | `v1 — Loop 1/3` (sin loops consumidos de corrección) |
| **Rol / harness** | Developer · OpenCode |
| **Riesgo** | 2 (Relevante) |
| **Fuente de alcance** | `reports/implementation/F02/F02-T02-task.md` (FUENTE DE VERDAD) |
| **Estado final** | **`DONE_WITH_CONCERNS`** — CA-02 implementado y verificado; único concern es interferencia externa de F03 en checks globales (ajeno) |
| **Dictamen propio** | No se emite `PASSED`; la tarea no se cierra (compete a Tester/Auditor/Architect) |

## 1. Fuentes consultadas

`AGENTS.md` · `STATE.md` · `.agents/roles/developer.md` · `docs/sdd/packages/P-02-api-and-worker.md` (CA-02) · `docs/sdd/spec.md` FR-08/FR-09/FR-17 · `docs/sdd/plan.md` §3.2 · `docs/decisions/ADR-001-stack-and-aws-emulator.md` (Decisión 4) · `reports/implementation/F02/F02-T02-task.md` · `reports/implementation/F02/F02-T01-architect.md` · `docs/runbooks/development-workflow.md` §1.2–1.4 · `.env.example` · `backend/src/{config,contracts,db}/index.ts` · `backend/src/api/{app,index,jobs,publisher}.ts`.

## 2. Criterio de aceptación atendido (CA-02)

Servicio en `backend/src/storage/**` que genera Presigned URLs de subida a `raw` (PUT) y descarga de `optimized` (GET) contra `aws/aws-emulator`, con claves por `userId`/`jobId`/`imageId`, prefijo por usuario, sin pasar el binario por la API y sin secretos reales. Cubierto además por FR-08 (job PENDING + URL firmada), FR-09 (subida directa) y FR-17 (descarga individual, WebP/AVIF/miniatura).

## 3. Cronología (TDD)

1. **Preparación:** instalación única de las tres dependencias AWS SDK; arranque de `aws/aws-emulator` con límites G-7 y `docker cp` de CA/config/credenciales (runbook §1.3, nota N-01).
2. **RED:** módulos esqueleto con `NOT_IMPLEMENTED` + pruebas unitarias y de integración. Resultado: **36 fallos por comportamiento**, 6 pasos (aserciones de error genérico), 5 omitidos por fallo de suite; exit 1.
3. **GREEN:** implementación de claves seguras, cliente S3, firmador y rutas; cableado de `createApiApp()` sin tocar `backend/src/index.ts`. Resultado: **47/47**; exit 0.
4. **REFACTOR:** unificación de la validación de entrada de `/presign/upload` y `/presign/download` en `parsePresignBody()`, y eliminación de una aserción no nula en la fixture. Resultado: **47/47**; exit 0.
5. **Regresión y verificación:** 83/83 en `tests/unit/api` + `tests/integration/api`; 241/241 en `tests/unit`; typecheck y lint acotados a F02 en verde; apagado del contenedor y `docker ps -a` vacío.

## 4. Comandos y resultados

| Comando | Exit | Resultado |
|---|---|---|
| `npm install --workspace=@mediashrink/backend @aws-sdk/client-s3 @aws-sdk/s3-request-presigner @aws-sdk/client-sqs --no-audit --no-fund` | 0 | 6 paquetes añadidos; 3 dependencias directas |
| `docker version --format ...` / `docker compose config --quiet` | 0 / 0 | engine 29.9.3; esquema válido |
| `docker compose up -d` / `inspect` | 0 / 0 | `healthy`, `memory=2147483648`, `nanoCpus=2000000000`, `user=1000:1000` |
| `docker cp` ×3 + `curl.exe --cacert ... /__admin/health` | 0 | cuerpo `ok`; sin `:9324` |
| `npx vitest run tests/unit/api/presign-{keys,routes}.test.ts tests/integration/api/presign.test.ts` (RED) | **1** | 36 failed / 6 passed / 5 skipped |
| idem (GREEN) | 0 | **47/47** (3 archivos) |
| idem (REFACTOR) | 0 | **47/47** (3 archivos) |
| `npx vitest run tests/integration/api/presign.test.ts -t "PUT presignado"` | 0 | 1/1 (4 skipped) |
| `npx vitest run tests/integration/api/presign.test.ts -t "GET presignado"` | 0 | 1/1 (4 skipped) |
| `npx vitest run tests/unit/api tests/integration/api` | 0 | 10 archivos, **83/83** |
| `npx vitest run tests/unit` | 0 | 25 archivos, **241/241** |
| `npx eslint backend/src/storage backend/src/api tests/unit/api tests/integration/api --ext .ts` | 0 | sin hallazgos |
| `npm run lint` (global) | **1** | 1 error en `tests/unit/frontend/core.test.ts` (F03, ajeno) |
| `npm run typecheck` (global) | **2** | 2 errores en `tests/e2e/frontend-flow.spec.ts` (F03, ajeno: faltan tipos DOM) |
| `npx tsc --noEmit -p temporary/tsconfig.f02-t02.json` | 0 | sin diagnósticos (exclude `tests/e2e/**`) |
| `docker compose down` / `docker compose ps` / `docker ps -a` | 0 / 0 / 0 | contenedor y red eliminados; **0 contenedores** |

Evidencia: `reports/implementation/F02/evidence/F02-T02-{red,green,refactor,emulator-up,upload,download,emulator-down,regression,unit-all,typecheck,typecheck-scoped,lint-scoped,lint-global}.txt`. Toda la evidencia usa `<PROJECT_ROOT>` (sin rutas Windows absolutas) y no contiene URLs completas, firmas ni credenciales.

## 5. Dependencias añadidas

En `backend/package.json` (autorización CTO registrada en `F02-T02-task.md §2`), las **tres a la vez**:

- `@aws-sdk/client-s3` `^3.1171.0` — usada en T02.
- `@aws-sdk/s3-request-presigner` `^3.1171.0` — usada en T02.
- `@aws-sdk/client-sqs` `^3.1171.0` — **no usada en T02**; reservada para T04 según instrucción.

`package-lock.json` (único lockfile del monorepo de workspaces) se actualizó con 110 líneas nuevas. `package.json` raíz **no se modificó**: hash SHA-256 verificado antes y después (`88FF7055…FE45F`). No se tocaron manifiestos de `frontend/`, `infra/`, `.github/`, ni `STATE.md`/`tasks.md`.

## 6. Decisiones de implementación

1. **Estilo de clave:** `<userId>/<jobId>/raw/<imageId>` y `<userId>/<jobId>/optimized/<imageId>.<webp|avif>` (miniatura: `<imageId>_thumb.webp`). El primer segmento es el `userId` del JWT: prefijo por usuario y aislamiento por construcción.
2. **Rechazo de escape:** lista blanca estricta por segmento `^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$`, más verificación de la clave resultante contra `${userId}/`. Rechaza `..`, `.`, separadores `/` y `\`, rutas absolutas, NUL, espacios y codificaciones `%xx`. El valor rechazado nunca se imprime.
3. **Expiración:** 900 s por defecto (15 min), configurable por petición entre **60 y 3600 s**; fuera de rango → 400. No se introdujo una variable de entorno nueva porque `.env.example` está fuera del ámbito; la acotación vive en `storage/presigner.ts` y se refleja en `X-Amz-Expires`.
4. **Transporte y credenciales:** `fromIni` sobre `AWS_SHARED_CREDENTIALS_FILE`/`AWS_CONFIG_FILE`, CA explícito desde `CA_BUNDLE_PATH`, `AWS_ENDPOINT_URL=https://127.0.0.1:9297` como transporte, `forcePathStyle: true` para que el host firmado sea el del emulador. Nunca credenciales fijas ni `:9324`.
5. **Rutas:** `POST /presign/upload` y `POST /presign/download`, montadas dentro de `createApiApp()` reutilizado (solo se añadieron dos dependencias opcionales inyectables). El `userId` siempre sale del JWT; un `userId` en el cuerpo se rechaza como clave desconocida y las cabeceras `x-user-id`/`x-forwarded-user` se ignoran. Validación con esquemas congelados reutilizados (`ImageRecord.imageId` para `nonempty`, `OutputFormat` para `webp`/`avif`; `thumbnail` como literal WebP A-04).
6. **Binario:** la respuesta de la API es solo JSON de metadatos (`url`, `key`, `method`, `bucket`, `expiresIn`, `expiresAt`); la integración sube un fixture 100×100 con la URL PUT y valida el objeto en `raw` mediante `HeadObject`/`GetObject`.
7. **Servicio S3 perezoso:** se crea solo al usar `/presign` si no se inyecta un doble, para que los tests unitarios de F01/F02-T01 no dependan del CA del emulador.

## 7. Problemas y disposición (7 campos)

### P-01 — Validación de identificadores solo en el servicio real

1. **Identificación:** P-01 (F02-T02, loop 1).
2. **Problema:** en el primer GREEN, 4 pruebas unitarias de ruta fallaron (`expected 200 to be 400`): con un `PresignService` doble inyectado, un `imageId` como `../escape` llegaba al servicio sin rechazo.
3. **Causa:** **demostrada**. La ruta validaba solo `nonempty` (esquema congelado) y delegaba el rechazo de traversal a la capa S3 real; el doble no aplicaba esa regla, dejando un hueco de defensa en profundidad en el límite HTTP.
4. **Solución e intentos fallidos:** se añadió `isSafeId()` en `backend/src/api/presign.ts`, que reutiliza `assertSafeKeySegment()` antes de llamar al servicio. No hubo intentos fallidos previos distintos del GREEN inicial que expuso el defecto.
5. **Verificación:** 47/47, 83/83 y 241/241; la prueba de integración con el servicio real sigue rechazando traversal.
6. **Pendientes:** ninguno.
7. **Aprendizaje candidato:** las reglas de seguridad de claves deben aplicarse en el límite de la API *y* en el servicio, aunque el servicio ya sea estricto; los dobles de prueba deben poder exponer este tipo de hueco.

### P-02 — Correo de prueba inválido en `it.each`

1. **Identificación:** P-02 (F02-T02, loop 1).
2. **Problema:** 4 pruebas unitarias fallaron con `Cannot read properties of undefined (reading 'userId')` al registrar usuarios de prueba.
3. **Causa:** **demostrada**. El correo se generaba con `encodeURIComponent(imageId)`; para valores como `../escape` contenía `%2F` y el esquema de correo congelado lo rechazaba (400), por lo que no había `user` en la respuesta.
4. **Solución e intentos fallidos:** se sustituyó la interpolación del valor por un índice numérico en tuplas `it.each`. Primer intento (pasar `index` con un array 1D) descartado porque Vitest no garantiza ese argumento.
5. **Verificación:** GREEN 47/47 tras el cambio.
6. **Pendientes:** ninguno.
7. **Aprendizaje candidato:** los datos de identidad de las fixtures deben ser válidos según el contrato congelado; los valores hostiles se reservan para el campo bajo prueba.

### P-03 — Typecheck global rojo por F03 (ajeno)

1. **Identificación:** P-03 (F02-T02, loop 1) — interferencia externa.
2. **Problema:** `npm run typecheck` terminó con exit 2: `DataTransfer` y `document` no existen en `tests/e2e/frontend-flow.spec.ts`.
3. **Causa:** **demostrada**. F03 (paralelo) añadió una prueba e2e con tipos DOM sin que el `tsconfig` base incluya `lib: ["dom"]`. Archivo fuera del ámbito de F02-T02.
4. **Solución e intentos fallidos:** no se modificó código ajeno. Se ejecutó un typecheck acotado con `temporary/tsconfig.f02-t02.json` (exclude `tests/e2e/**`), exit 0.
5. **Verificación:** `F02-T02-typecheck.txt` (global, ajeno) y `F02-T02-typecheck-scoped.txt` (propio, exit 0).
6. **Pendientes:** el propietario de F03 debe ajustar su config o sus tipos; **no bloquea CA-02**.
7. **Aprendizaje candidato:** en fases paralelas, distinguir fallos propios de ajenos con una verificación acotada y evidencia separada.

### P-04 — Lint global rojo por F03 (ajeno)

1. **Identificación:** P-04 (F02-T02, loop 1) — interferencia externa.
2. **Problema:** `npm run lint` terminó con exit 1: `Theme` sin usar en `tests/unit/frontend/core.test.ts`.
3. **Causa:** **demostrada**. Código de F03 paralelo, fuera del ámbito de F02-T02.
4. **Solución e intentos fallidos:** no se tocó el archivo ajeno. Se lintó explícitamente `backend/src/storage`, `backend/src/api`, `tests/unit/api` y `tests/integration/api`: primero detectó un `PutObjectCommand` sin usar en la fixture propia (corregido), después exit 0.
5. **Verificación:** `F02-T02-lint-scoped.txt` (exit 0) y `F02-T02-lint-global.txt` (exit 1, ajeno).
6. **Pendientes:** resolución por F03; **no bloquea CA-02**.
7. **Aprendizaje candidato:** el lint acotado al ámbito propio es la señal de salud fiable cuando otro harness escribe en paralelo.

### P-05 — Lockfile raíz modificado por npm workspaces

1. **Identificación:** P-05 (F02-T02, loop 1) — restricción de herramienta, no defecto funcional.
2. **Problema:** la instrucción indicaba no tocar manifiestos raíz, pero el monorepo tiene un único `package-lock.json` en la raíz.
3. **Causa:** **demostrada**. `npm install --workspace=...` actualiza necesariamente ese lockfile; no existe `backend/package-lock.json`.
4. **Solución e intentos fallidos:** se actualizó solo el lockfile (110 líneas, entradas de los 3 paquetes y transitivas). `package.json` raíz quedó byte-idéntico (hash verificado). No se editó a mano ningún lockfile.
5. **Verificación:** `git diff -- backend/package.json` (solo 3 líneas) y `git diff --stat -- package-lock.json` (110 inserciones); hash de `package.json` raíz invariante.
6. **Pendientes:** ninguno; debe quedar registrado para T04 (no reescribirá el manifiesto).
7. **Aprendizaje candidato:** en workspaces npm, "no tocar el manifiesto raíz" y "actualizar el lockfile" exigen verificar explícitamente que el `package.json` raíz no cambió.

## 8. Estado final y handoff

- `backend/src/storage/**` (4 archivos), `backend/src/api/presign.ts` y ajustes aditivos en `backend/src/api/{app,index}.ts`, pruebas en `tests/unit/api/**` y `tests/integration/api/**`, 13 evidencias, `backend/package.json` y `package-lock.json`.
- Sin cambios en `backend/src/index.ts`, `backend/src/db/**`, `backend/src/worker/**`, `frontend/`, `infra/`, `.github/`, `STATE.md`, `docs/sdd/tasks.md` ni reportes ajenos. Sin push a `main`.
- Contenedor Docker **apagado**; red y contenedor eliminados; `docker ps -a` vacío.
- Sin secretos, sin rutas Windows absolutas en artefactos y sin `:9324`.
- Se entrega a Tester/Auditor/Architect. **No se emite `PASSED` ni se cierra la tarea.**
