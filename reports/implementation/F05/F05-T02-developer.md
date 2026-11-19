# `F05-T02` — Entrega del Developer (cierre de seguimientos e insumo de auditoría)

| Campo | Valor |
|---|---|
| **Tarea / Criterio** | `F05-T02` · `CA-02` (P-05, Fase Final) |
| **Rol / Riesgo** | Developer · riesgo `3` (seguridad y privacidad) |
| **Loop** | `v1 — Loop 1/3` |
| **Estado de entrega** | **`DONE_WITH_CONCERNS`** — entregado a Architect; **no se emite `PASSED` ni se cierra la tarea** |
| **Fuente de verdad** | `reports/implementation/F05/F05-T02-task.md` y `docs/sdd/packages/P-05-final-integration-and-delivery.md` (CA-02) |
| **Fecha** | `2026-11-18` |

## 1. Resumen de ejecución

| Subcriterio CA-02 | Resultado de este rol | Evidencia |
|---|---|---|
| F03-AUD-03 — allowlist de URLs presignadas | Implementado y verificado (TDD RED→GREEN) | `F05-T02-url-validation.txt` |
| HeadObject en `raw` (`bytesBefore`) | Implementado y verificado con integración real (TDD RED→GREEN) | `F05-T02-headobject.txt` |
| P4 anonimización en `reports/**` y `docs/**` | 72 archivos / 119 reemplazos; escaneo final 0 | `F05-T02-anonymization-scan.txt` |
| Auditoría final (insumo para rol separado) | Entregado: 0 CRITICAL/HIGH abiertos, 0 secretos, inventario LOW/INFO | `F05-T02-final-audit-input.txt` (+ alias `F05-T02-audit-final.txt`) |
| Apagado G-7 | `docker compose down` exit 0, red eliminada | `F05-T02-emulator-down.txt` |

**Verificaciones:** unitarias 32 archivos / **303/303** (exit 0) · integración sin `infra/**` 21 archivos / **94/94** (exit 0) · `typecheck` y `lint` globales exit 0 · emulador `memory=2147483648`, `nanoCpus=2000000000`, `user=1000:1000`, healthcheck `ok`.

**Límite:** `tests/integration/infra/**` (5 pruebas) requiere `terraform apply` previo; no se ejecutó porque Terraform no es necesario para CA-02 y `F05-T01` ya lo certificó (`97/97`, `apply` de 11 recursos). El resto de la integración quedó en verde.

---

## 2. Problemas registrados (7 campos obligatorios)

### F05T02-D-01 — F03-AUD-03: URLs presignadas sin allowlist de origen

1. **Identificación:** `F05T02-D-01` · `CA-02` · MEDIUM heredado de F03 · riesgo 3 · `frontend/src/api/jobs.ts`, `tests/unit/frontend/secure-url.test.ts`.
2. **Problema:** `validateSecureUrl()` solo comprobaba esquema `https:`, hostname presente y ausencia de credenciales; cualquier host HTTPS era aceptado. `createJobsClient` no exponía configuración de orígenes y validaba la `uploadUrl` solo en el momento de la PUT, sin validar el plan de subida ni la forma de la respuesta de descarga.
3. **Causa:** **DEMOSTRADA.** Auditoría `F03-auditor.md` (F03-AUD-03) y prueba RED: 3 fallos por comportamiento (host ajeno aceptado en `validateSecureUrl`, en `upload` y en `download`). El segundo argumento y la opción del cliente no existían y eran ignorados por el runtime.
4. **Solución e intentos fallidos:** se añadió `resolveAllowedStorageHosts()` con precedencia **parámetro explícito > `VITE_ALLOWED_STORAGE_HOSTS` > default local** (`127.0.0.1`, `localhost`, `[::1]`); `isHostAllowed()` normaliza mayúsculas/punto final y admite TLD reservados RFC 2606/6761 (`.test`, `.example`, `.invalid`, `.localhost`) por ser no resolubles, conservando los mocks E2E sin modificar tests de otros roles. `create()` valida el plan y cada `uploadUrl` antes de cualquier PUT; `download()` exige `downloadUrl` de tipo cadena antes de validarla; `upload()` pasó a `async` para fallar como promesa rechazada. **Intentos fallidos:** el primer GREEN dejó 1 fallo porque `upload` lanzaba de forma síncrona y `expect(...).rejects` no lo capturaba; corregido haciendo `async` el método.
5. **Verificación:** RED 3 fallos por comportamiento → GREEN 26/26 en el archivo nuevo; suite unitaria 303/303; `typecheck`/`lint` limpios. Cubre `javascript:`, `data:`, `http:`, relativa, vacía, no-cadena, credenciales `user:pass@`, host ajeno, precedencia de allowlist, plan malformado y ZIP servido por la API con `Authorization`.
6. **Pendientes:** el Auditor debe confirmar el cierre de F03-AUD-03. El despliegue real debe poblar `VITE_ALLOWED_STORAGE_HOSTS` con el host S3 definitivo (no disponible en este snapshot); sin él rige el default local, que es deliberadamente restrictivo. Riesgo LOW residual no aceptado: los TLD reservados siguen permitidos por diseño para pruebas.
7. **Aprendizaje candidato:** una allowlist útil debe resolverse en cada llamada (no al cargar el módulo) para que el entorno y las pruebas puedan reconfigurarla sin recargar; validar la *forma* de la respuesta es tan importante como validar la URL. (`PROPUESTA_GLOBAL`)

### F05T02-D-02 — F02-T06 A-02: `bytesBefore` no garantizado por HeadObject en consumo

1. **Identificación:** `F05T02-D-02` · `CA-02` · LOW heredado de F02-T06 · `backend/src/api/enriched-publisher.ts`, `tests/integration/api/enriched-headobject.test.ts`.
2. **Problema:** el publicador enriquecido leía el objeto con `GetObject` y construía el base64 del sobre, pero no emitía `HeadObject` en la ruta de producto: el tamaño real solo se verificaba en la fixture de prueba. Un sobre desactualizado/manipulado podría transportar bytes distintos del objeto persistido, haciendo que `bytesBefore` reflejara el mensaje y no el artefacto.
3. **Causa:** **DEMOSTRADA.** Hallazgo `F02-T06 A-02` del auditor F02 y prueba RED: `headCalls` quedó vacío (`expected [] to have a length of 1`) y el caso fail-closed resolvió sin rechazar.
4. **Solución e intentos fallidos:** se importó `HeadObjectCommand`; por cada clave bajo `<userId>/<jobId>/raw/` se obtiene `ContentLength`, se valida como entero seguro `>= 0` y se compara con `bytes.byteLength` de `GetObject`. Si no coincide o el header es inválido, se lanza `RawObjectSizeMismatchError` (**fail-closed**) antes de delegar en `publishJob()`. El mensaje de error no incluye claves ni identificadores (G-3). **Intentos fallidos:** ningún parche previo; se descartó usar el `sizeBytes` declarado por el cliente (es exactamente el valor deliberadamente erróneo que la prueba descarta) y se descartó duplicar el cliente S3 en el consumidor.
5. **Verificación:** RED 2 fallos → GREEN 3/3 contra `aws/aws-emulator`. Caso 1: `HeadObject` se llama una vez con el bucket/key correctos, `ContentLength` = bytes reales ≠ `declaredBytes=1`, y el base64 del sobre decodifica exactamente ese tamaño. Caso 2: con `declaredBytes=7`, `bytesBefore` persistido en DynamoDB (job e imagen) = bytes reales del objeto. Caso 3: `HeadObject=999` frente a 3 bytes leídos → rechazo. Regresión: 94/94 integración no-infra, including `e2e-metrics`, `e2e-persist` y `CONFIRM_INCONSISTENT`.
6. **Pendientes:** el Auditor debe confirmar el cierre de `F02-T06 A-02`. Contrapartida de rendimiento: un `HeadObject` adicional por imagen (aceptada como coste de la garantía; no se mide en este snapshot). Sin G-10.
7. **Aprendizaje candidato:** anclar la métrica al artefacto persistido exige confirmar el tamaño *en la ruta de producto*, no solo en la fixture; la igualdad verificada en un test no equivale a una garantía en código. (`PROPUESTA_GLOBAL`)

### F05T02-D-03 — P4: rutas Windows absolutas en artefactos G-6b

1. **Identificación:** `F05T02-D-03` · `CA-02` · MEDIUM/INFO heredado · `reports/**`, `docs/**` · ampliado por `F04T05-A-06`.
2. **Problema:** 105 coincidencias de rutas absolutas en 70 archivos, incluidos el banner `RUN v2.1.9 <ruta>` de Vitest, rutas de tooling (`docker.exe`, `terraform.exe`), caché de npm, perfil de usuario y referencias abreviadas en 4 reportes. Tres evidencias F04-T05 reintroducían el prefijo del proyecto señalado por `F04T05-A-06`.
3. **Causa:** **DEMOSTRADA.** Escaneo propio con patrón `[A-Za-z]:[\\/](Projects|Programs|Users|Program Files)` sobre `reports/**` y `docs/**`; las absoluteness provenía de capturas de consola y de plantillas que citaban rutas del harness.
4. **Solución e intentos fallidos:** sustitución byte-segura (Latin-1, 1 byte = 1 carácter) de ASCII únicamente, preservando el resto de bytes y codificaciones: `<PROJECT_ROOT>`, `<LAB_ROOT>`, `<DOCKER_CLI_DIR>`, `<TF_CLI_DIR>`, `<NPM_CACHE_DIR>`, `<USER_HOME>`. Pasada 1: 70 archivos / 115 reemplazos; pasada 2 para prefijos abreviados: 4 archivos / 4 reemplazos. Total **72 archivos únicos / 119 reemplazos**. Se añadió un addendum de anonimización a 8 reportes append-only con hallazgos sustantivos. **Intentos fallidos:** el primer escaneo tras la pasada 1 dejó 4 prefijos abreviados; el addendum grabado mediante Windows PowerShell 5.1 salió con mojibake (el intérprete leyó el script como ANSI), corregido reescribiendo los 8 bloques en UTF-8 con Node.
5. **Verificación:** escaneo final sobre `reports/**` y `docs/**` → **0 coincidencias**. Lectura directa de un addendum confirma acentuación UTF-8 correcta. Se conservaron las URLs públicas `github.com/linochamorro/...` (G-6/G-6b, repo público, no secretos). No se borró historial ni se alteraron hallazgos, severidades ni cifras.
6. **Pendientes:** `AGENTS.md` y `STATE.md` (raíz) conservan referencias institucionales de confinamiento/tooling; no se editan por ser gobernanza de otro rol (el contrato de Developer prohíbe modificar `STATE.md`/`tasks.md`). Quedan inventariadas para decisión del Auditor/CTO antes de G-12. `temporary/` intacto (G-11 pendiente). Sin G-10.
7. **Aprendizaje candidato:** normalizar el banner de la herramienta en el momento de capturar la evidencia evita reintroducir P4 en cada fase; y en Windows, los scripts con texto no-ASCII deben ejecutarse con un intérprete UTF-8 explícito. (`SOLO_LOCAL`; la plantilla de captura, `PROPUESTA_GLOBAL`)

### F05T02-D-04 — Insumo para auditoría final de seguridad y privacidad

1. **Identificación:** `F05T02-D-04` · `CA-02` · riesgo 3 · `F05-T02-final-audit-input.txt` (y alias `F05-T02-audit-final.txt`).
2. **Problema:** el criterio exige entregar al rol Auditor un paquete con 0 `CRITICAL`/`HIGH` abiertos, 0 secretos e inventario de P4 y riesgos LOW/INFO heredados, sin aceptar riesgo por Lino.
3. **Causa:** **DEMOSTRADA.** La auditoría F03 cerró con `READY_WITH_CONCERNS` (F03-AUD-03 MEDIUM + tres LOW); F04 inventarió P4 ampliado y otros seguimientos sin cerrarlos; F02 conservaba `A-02` como seguimiento a F05.
4. **Solución e intentos fallidos:** se redactó el insumo con: cambios de F05-T02, cifras de verificación, recuento 0/0, mapa de marcadores P4, inventario de 14 seguimientos LOW/INFO con disposición y responsable, y límite de roles. **Intentos fallidos:** el primer escaneo de secretos marcó cadenas tipo `AKIA...`/`ghp_...` y marcadores `REPLACE_WITH_...`; se inspeccionaron y se confirmó que son fixtures sintéticos y placeholders del detector, no credenciales; se documentan como INFO, no como secretos.
5. **Verificación:** 0 `CRITICAL`/`HIGH` abiertos; 0 claves AWS reales, 0 claves privadas, 0 credenciales activas en `.env.example` (solo un comentario que prohíbe definirlas); 15 coincidencias de `:9324` en configuración son todas negaciones o guardias (`validation { condition = !can(regex(":9324", ...)) }`). El Auditor recibe el paquete; este rol no redacta `reports/audits/F05/F05-T02-auditor.md`.
6. **Pendientes:** el Auditor debe emitir su dictamen (`READY` / `READY_WITH_CONCERNS` / `NOT_READY`) y decidir sobre los residuales P4 de raíz; el Architect cierra la tarea tras `PASSED` de Tester y auditoría sin bloqueantes. Sin G-10.
7. **Aprendizaje candidato:** un insumo de auditoría debe distinguir explícitamente "secreto real" de "fixture sintético usado para probar el detector", y enumerar cada seguimiento heredado con su disposición para que nadie lo interprete como riesgo aceptado. (`PROPUESTA_GLOBAL`)

### F05T02-D-05 — `import.meta.env` no declarado al compilar el módulo desde `tests/`

1. **Identificación:** `F05T02-D-05` · incidente técnico menor · `frontend/src/api/jobs.ts`, `tests/unit/frontend/secure-url.test.ts`.
2. **Problema:** `npm run typecheck` falló con `TS2339: Property 'env' does not exist on type 'ImportMeta'` en `jobs.ts:36` al añadir el acceso a la variable de entorno.
3. **Causa:** **DEMOSTRADA.** `backend/tsconfig.json` incluye `../tests/**/*.ts` con `types: ["node"]`; el nuevo test unitario importa `jobs.ts`, de modo que ese módulo se compila también sin los tipos `vite/client` (que sí están en `frontend/tsconfig.json`). El acceso directo `import.meta.env` no es portable entre ambos contextos.
4. **Solución e intentos fallidos:** se sustituyó el acceso directo por un cast sobre el objeto completo: `const meta = import.meta as ImportMeta & { env?: Record<string, unknown> };` y se lee `meta.env?.VITE_ALLOWED_STORAGE_HOSTS`. **Intentos fallidos:** el access directo y el cast sobre `.env` seguían resolviendo la propiedad antes del cast; se descartó crear un `.d.ts` global que colisionaría con `vite/client`.
5. **Verificación:** `npm run typecheck` exit 0 tras el cambio; `lint` exit 0; unitarias 303/303.
6. **Pendientes:** ninguno funcional. Si el frontend cambia su configuración de tipos, revisar este cast.
7. **Aprendizaje candidato:** en monorepos con `tests/**` compartido entre `tsconfig`s, un módulo importado por tests puede compilarse bajo dos conjuntos de tipos distintos; preferir accesos portables a globals de bundler. (`SOLO_LOCAL`)

### F05T02-D-06 — Regresión de integración aparente en `tests/integration/infra/**`

1. **Identificación:** `F05T02-D-06` · incidente de entorno · `tests/integration/infra/{resources,gsi}.test.ts`.
2. **Problema:** la corrida completa `npx vitest run tests/integration` terminó 95/100 con 5 fallos: buckets/colas/tabla no encontrados en `tests/integration/infra/**`.
3. **Causa:** **DEMOSTRADA.** Esos tests leen recursos **aprovisionados por Terraform** (a diferencia del resto, que crea los suyos). Se levantó el emulador con `docker compose up -d` + `docker cp`, pero no se ejecutó `terraform apply` porque CA-02 no lo requiere y `F05-T01` ya lo había certificado. No es un defecto de producto ni una regresión de HeadObject.
4. **Solución e intentos fallidos:** se repitió la regresión excluyendo únicamente `tests/integration/infra/**`: **21 archivos / 94/94, exit 0**, incluidas todas las pruebas E2E de métricas y persistencia. **Intentos fallidos:** no se simuló el apply ni se modificaron los tests de infra (pertenecen a otro rol y su verificación es competencia de F04/F05-T01).
5. **Verificación:** evidencia `F05-T02-headobject.txt` contiene tanto la corrida completa con los 5 fallos documentados como la corrida corregida 94/94; `typecheck`/`lint` limpios en ambas.
6. **Pendientes:** ninguno para CA-02. Si se requiere la suite 100/100 en el cierre de fase (F05-T05), el Tester debe ejecutar `terraform init/validate/apply -var=is_emulator=true` en la misma sesión Docker.
7. **Aprendizaje candidato:** separar en la evidencia los fallos por prerrequisito de infraestructura de los fallos funcionales evita atribuir incorrectamente una regresión al cambio bajo prueba. (`SOLO_LOCAL`)

---

## 3. Ámbito, gobernanza y handoff

- **Archivos de producto modificados:** `frontend/src/api/jobs.ts`, `backend/src/api/enriched-publisher.ts`. **Tests añadidos:** `tests/unit/frontend/secure-url.test.ts`, `tests/integration/api/enriched-headobject.test.ts`.
- **Anonimización:** 72 archivos en `reports/**` y `docs/**`; 8 addenda; 0 rutas absolutas residuales. No se modificaron reportes del Tester en su contenido sustantivo ni tests de otros roles.
- **Secretos:** ninguno en código, reportes o logs; los literales tipo secreto existentes son fixtures sintéticos documentados en el insumo.
- **Gates:** G-3, G-6/G-6b y G-7 respetados. **G-10 no invocado**: ningún riesgo fue aceptado en nombre de Lino. **G-11 y G-12 no ejecutados**; `temporary/` intacto; sin push/release.
- **Docker:** apagado al terminar (`docker compose down` exit 0, red eliminada); único contenedor restante `dazzling_edison`, ajeno al proyecto y preexistente.
- **Retorno:** se entrega a Architect para revisión de alcance, derivación a Tester independiente y entrega del insumo al rol Auditor. **Este reporte no emite `PASSED` ni cierra `F05-T02`.**
