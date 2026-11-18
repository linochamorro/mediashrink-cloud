# Dictamen de Tester independiente — `F02-T02`

| Campo | Valor |
|---|---|
| **Tarea** | `F02-T02` — Servicio S3 de Presigned URLs (`raw` PUT / `optimized` GET) |
| **Fase / paquete** | Fase 2 — `docs/sdd/packages/P-02-api-and-worker.md` (`CA-02`) |
| **Rol / harness** | Tester independiente · OpenCode |
| **Riesgo** | 2 (Relevante) |
| **Versión revisada** | `v1 — Loop 1/3` (entrega del Developer) |
| **Loop consumido por este dictamen** | **`Ninguno`** (veredicto `PASSED` en la primera revisión) |
| **Ejecución propia** | Sí: 8 evidencias `F02-T02-tester-*.txt` + 3 sondas temporales propias (eliminadas) |
| **Veredicto global** | **`PASSED`** |

## 1. Fuentes y criterio aplicado

Contrato de rol (`.agents/roles/tester.md`), `AGENTS.md`, `STATE.md`, `docs/sdd/packages/P-02-api-and-worker.md` (`CA-02`), `docs/sdd/spec.md` (FR-08/FR-09/FR-17), `docs/decisions/ADR-001-stack-and-aws-emulator.md` (Decisión 4), `F02-T02-task.md`, `F02-T02-developer.md`, `F02-T01-architect.md`, `.env.example` y código en `backend/src/storage/**` + `backend/src/api/presign.ts`.

Criterio: **ejecución propia**, contra la aceptación aprobada y no contra la interpretación del implementador. La evidencia del Developer se consultó solo como registro cronológico; ningún artefacto ajeno se presenta como evidencia propia.

## 2. Dictamen por criterio

| # | Criterio / fuente | Verificación propia y evidencia | Resultado |
|---|---|---|---|
| 1 | Suite API (`F02-T02-tester-api.txt`) | `npx vitest run tests/unit/api tests/integration/api` → **10 archivos, 83/83**, exit 0. Búsqueda de `.skip(`/`.only(`/`.todo(` en ambos árboles: **NINGUNO**. | **CUMPLIDO** |
| 2 | Roundtrip real contra emulador (`F02-T02-tester-roundtrip.txt`) | Sonda propia: buckets aislados creados; URL PUT firmada (host `127.0.0.1:9297`, `X-Amz-Expires=900`, `X-Amz-Signature` presente); fixture JPEG 100×100 de 342 bytes subida → `PUT status=200`, `HeadObject.ContentLength=342`, bytes en `raw` idénticos. Objeto optimizado sembrado; URL GET firmada → `GET status=200`, 38/38 bytes idénticos. Claves con prefijo `userId/` confirmadas. Limpieza de buckets ejecutada. | **CUMPLIDO** |
| 3 | Seguridad de claves y JWT (`F02-T02-tester-keys.txt`) | Sonda propia sobre funciones puras + tests unit/integración: `..`, `.`, vacío, `a/b`, absoluta, `C:\temp`, `%2f`, espacios y NUL rechazados; prefijo ajeno, ruta absoluta y prefijo extendido (`userId`+`x`) rechazados. Claves `user-123/job-1/raw/img_1` y `.../optimized/img_1.webp`. `X-Amz-Expires` en `[60,3600]`: 59 y 3601 rechazados, 60/120/3600 aceptados; HTTP fuera de rango → **400**. `userId` del cuerpo → 400 y cabeceras `x-user-id`/`x-forwarded-user` ignoradas (tests 47/47 y 83/83). | **CUMPLIDO** |
| 4 | Transporte y credenciales (`F02-T02-tester-transport.txt`) | Config cargada: `endpointUrl=https://127.0.0.1:9297`, `sin :9324=true`, `useSsl=true`, CA explícito, credenciales por `fromIni` desde archivos generados. `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`/`AWS_PROFILE` **ausentes** del entorno; `aws_access_key_id` del archivo del emulador con prefijo `EMULATOR` (valor nunca impreso). `client.ts` usa `fromIni`, `forcePathStyle: true` y `Agent({ ca: readFileSync(...) })`. | **CUMPLIDO** |
| 5 | Dependencias (`F02-T02-tester-deps.txt`) | Las **tres** declaradas en `backend/package.json` (`client-s3`, `s3-request-presigner`, `client-sqs`, `^3.1171.0`), resueltas a `3.1171.0` con `resolved`+`integrity` en el lockfile y visibles en `npm ls --depth=0`. `SHA256(package.json)` raíz = `88FF7055…FE45F`, `git diff --exit-code -- package.json` → 0 (invariante). Scripts `preinstall`/`install`/`postinstall`/`prepare`: **0** (ningún script de install aprobado). | **CUMPLIDO** |
| 6 | Cronología TDD (revisión documental, sin reejecución) | Evidencia cronológica del Developer: RED **36 fallos por comportamiento** (6 pasos, 5 omitidos por fallo de suite), GREEN **47/47**, REFACTOR **47/47**. Revisada como registro íntegro; **no se reejecutó el RED ni se invirtió código** para certificarlo. | **CUMPLIDO (como registro)** |
| 7 | Regresión y gates (`F02-T02-tester-regression.txt`) | `npx vitest run tests/unit` → **25 archivos, 241/241**, exit 0. Typecheck acotado (`temporary/tsconfig.f02-t02.json`, preexistente) → exit 0. ESLint acotado a `backend/src/storage`, `backend/src/api`, `tests/unit/api`, `tests/integration/api` → exit 0. Typecheck global exit 2 y lint global exit 1, ambos por archivos de **F03 paralelo** (`tests/e2e/frontend-flow.spec.ts`, `tests/unit/frontend/core.test.ts`), fuera del ámbito `F02-T02`: interferencia externa documentada, **no bloqueante**. | **CUMPLIDO** |
| 8 | Ámbito y apagado (`F02-T02-tester-scope.txt`, `F02-T02-tester-down.txt`) | Escrituras propias limitadas a los 8 evidencias y este dictamen; 3 sondas temporales propias creadas y eliminadas. Sin edición de código, tests, manifiestos, `STATE.md`, `tasks.md`, frontend, IaC ni reportes ajenos; sin push, sin AWS real, sin loops ni G-9/G-10. `docker compose down` exit 0, red y contenedor eliminados, `docker ps -a` → **0 contenedores**, red `mediashrink-cloud_default` ausente. | **CUMPLIDO** |

## 3. Notas sobre la interferencia paralela

Los dos gates globales en rojo (typecheck/lint) y el `git status` con trabajo paralelo se deben a `F03`/otras tareas de `P-02` ejecutándose en el mismo árbol. Se han aislado con: (a) verificación acotada en verde y (b) evidencia separada. No se ha modificado código ajeno para «arreglar» esos fallos. Esta observación ya fue registrada por el Developer (P-03/P-04) y por `F02-T01-architect.md` (A-06), y **no constituye hallazgo contra `CA-02`**.

## 4. Conclusión

`CA-02` queda satisfecho con evidencia de ejecución propia: URLs presignadas reales PUT/GET contra `aws/aws-emulator`, binario que no atraviesa la API, prefijo por `userId` del JWT, claves seguras con expiración acotada, credenciales efemeras por `fromIni`, manifiestos íntegros y Docker apagado. Registros cronológicos íntegros, sin hallazgos bloqueantes CRITICAL/HIGH ni revisiones obligatorias pendientes.

**Veredicto global: `PASSED`.** No se activa ningún loop de corrección. Se entrega a Architect para su integración y cierre.
