# Modelo de datos y contrato de almacenamiento — MediaShrink Cloud

> Estado: contrato congelado para Fase 1 (`F01-T02`, CA-02). La tabla definitiva
> la aprovisiona Terraform en `F04`; en `F01-T02` las pruebas crean y destruyen
> su propia tabla aislada en `aws/aws-emulator`.

## 1. Fuente de verdad

- `docs/sdd/spec.md` §4 (modelo de datos), §6 (estados y errores).
- `docs/sdd/constitution.md` PR-07 (aislamiento), IN-06 (clave con `userId`), IN-09 (retención 30 días).
- `backend/src/contracts/catalog.ts`: catálogo Zod congelado v1 (hash `5d0082f8…`), del que se toman
  `Job`, `ImageRecord`, `computeTtl`, `RETENTION_DAYS = 30` y `TTL_SECONDS = 2.592.000`.
  **La capa de datos no redefine estos tipos**: valida contra `schemas.Job` y `schemas.ImageRecord`.

## 2. Claves e índice por usuario

| Elemento | PK (HASH) | SK (RANGE) | Atributos propios |
|---|---|---|---|
| Job (lote) | `userId` | `jobId` | `status`, `preset`, `formats`, `bytesBefore`, `bytesAfter`, `savingsPct`, `exifStripped`, `createdAt`, `updatedAt`, `ttl`, `itemType = JOB` |
| Imagen (hijo) | `userId` | `IMAGE#<jobId>#<imageId>` | `parentJobId`, `imageId`, `status`, `bytesBefore?`, `bytesAfter?`, `failureReason?`, `exifStripped`, `ttl`, `itemType = IMAGE` |

- **Índice por `userId`:** la propia clave de partición. No se necesita un GSI: todo acceso
  (lectura, escritura, borrado, listado de hijos) empieza por `userId = :u` o por un `GetItem`
  con esa partición. Es la frontera de aislamiento (PR-07, IN-06).
- **Listado de imágenes:** `Query` con `userId = :u AND begins_with(jobId, 'IMAGE#<jobId>#')`
  y filtro `parentJobId = <jobId>`. No se usa `Scan` en la capa de datos.
- **IDs opacos:** `userId`, `jobId` e `imageId` no contienen `#`; ese carácter está reservado
  para la clave compuesta de los hijos. `assertOpaqueId` lo garantiza en la frontera.
- **Sin GSI adicional:** el acceso por `jobId` siempre va acompañado de su `userId` dueño.
  Un `jobId` ajeno no es direccionable: la respuesta es "no encontrado", no `403` (spec §6).

## 3. TTL (30 días)

- `ttl = computeTtl(createdAt) = floor(Date.parse(createdAt)/1000) + 2.592.000` (Unix seconds).
- La tabla habilita `TimeToLiveSpecification { AttributeName: 'ttl', Enabled: true }`.
  DynamoDB activa el TTL de forma asíncrona (`ENABLING` → `ENABLED`); el fixture de pruebas
  espera a `ENABLED` antes de ejecutar las aserciones.
- Cada imagen hijo **hereda el `ttl` del job padre** (`putImage`/`updateImage` lo leen del job),
  de modo que padres e hijos expiran juntos. Un `ttl` incoherente es rechazado por el refinamiento
  `ttl-coherence` del contrato congelado antes de escribir.
- Las métricas usan el refinamiento `savings-coherence`: `savingsPct` debe corresponder a
  `(bytesBefore - bytesAfter) / bytesBefore × 100`; se conservan 0 % y valores negativos.

## 4. Operaciones del almacén (`backend/src/db`)

| Método | Comportamiento |
|---|---|
| `createJob(job)` | Valida con `schemas.Job`; `PutItem` condicionado a que no exista la clave. Duplicado → `JobAlreadyExistsError`. |
| `getJob(userId, jobId)` | `GetItem`; `null` si la clave no existe o no pertenece al usuario. |
| `updateJob(userId, jobId, patch)` | Lee el job del usuario, fusiona, revalida y actualiza. `updatedAt` por defecto = ahora. Sin job → `JobNotFoundError`. |
| `deleteJob(userId, jobId)` | Comprueba propiedad y borra; sin job → `JobNotFoundError` (no borra hijos: usar `deleteJobWithImages`). |
| `putImage(userId, jobId, image)` | Requiere que el job padre exista **para ese `userId`**; hereda su `ttl`. |
| `getImage` / `listImages` | `GetItem` por clave compuesta / `Query` por prefijo, filtrando `parentJobId`. |
| `updateImage` | Comprueba primero el job (aislamiento) y luego la imagen; `ImageNotFoundError` si falta el hijo. |
| `deleteImages` | `Query` + `BatchWrite` en lotes de 25. |
| `deleteJobWithImages` | Borra hijos y job en una operación lógica; útil para borrado manual (spec §5). |

### Aislamiento

Todas las firmas exigen `userId`; no existe una operación que acepte solo `jobId`. Para el usuario B,
un lote de A es indistinguible de uno inexistente: `getJob`/`getImage` → `null`, `updateJob`/
`deleteJob`/`deleteJobWithImages` → `JobNotFoundError`. Las pruebas de `tests/integration/db/
isolation.test.ts` verifican además que los intentos fallidos de B **no alteran** los datos de A
y que A y B pueden usar el mismo `jobId` sin colisión ni fuga.

## 5. Transporte y credenciales

- `createDynamoDbDocumentClient` apunta a `AWS_ENDPOINT_URL` (en local/CI `https://127.0.0.1:9297`)
  con la región configurada y un `https.Agent` que confía en `CA_BUNDLE_PATH`.
- Las credenciales se leen con `fromIni` de `AWS_SHARED_CREDENTIALS_FILE` y `AWS_CONFIG_FILE`
  generados por el emulador en cada arranque (G-3/A-03): **nunca** credenciales fijas ni `:9324`.
- El cliente acepta inyección de `DynamoDBDocumentClient`, lo que permite a las pruebas crear
  tablas efímeras y al resto del backend usar la configuración validada por `loadConfig`.

## 6. Verificación

`npx vitest run tests/integration/db` (19 pruebas: 8 CRUD/hijos, 5 TTL, 6 aislamiento) contra
`aws/aws-emulator`, con `docker compose down` obligatorio al terminar. Evidencia en
`reports/implementation/F01/evidence/F01-T02-*.txt`.
