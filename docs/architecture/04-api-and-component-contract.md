# 04 — Contratos de API y componentes (congelados en Fase 1)

> Estado: **congelado** en `F01-T01` · versión `1.0.0` · hash del catálogo `5d0082f8d97e0329862739123b7599c75ff7261834430039fa6e815bf68d626d`.
> La implementación HTTP de las rutas pertenece a Fase 2 (`F02`); este documento define solo los contratos de datos.

## 1. Fuente única y mecanismo de generación

| Elemento | Ruta | Rol |
|---|---|---|
| Catálogo canónico | `<PROJECT_ROOT>/backend/src/contracts/catalog.ts` | Única fuente de verdad: definiciones, versiones, restricciones y reglas de coherencia. |
| Validadores Zod | `<PROJECT_ROOT>/backend/src/contracts/zod-schemas.ts` | Materializan el catálogo en esquemas estrictos (`buildSchema`). |
| Generador | `<PROJECT_ROOT>/backend/src/contracts/generate.ts` | Emite tipos planos de forma determinista. |
| Tipos del frontend | `<PROJECT_ROOT>/frontend/src/api/types.generated.ts` | **Generado**: el frontend lo consume; no se edita a mano ni se redefinen sus tipos. |
| Puerta pública | `<PROJECT_ROOT>/backend/src/contracts/index.ts` | Esquemas, constantes y tipos inferidos para backend y tests. |

Regenerar (salida byte a byte reproducible):

```sh
npm run generate:types --workspace=@mediashrink/backend
```

La cabecera del archivo generado registra versión y hash SHA-256 del catálogo. El test
`tests/unit/contracts.test.ts` verifica: (a) que el archivo generado coincide con
`generateTypes()`, (b) que declara exactamente los 14 contratos y (c) que ningún otro archivo
de `frontend/src/**` redefine esos tipos ni importa del backend. Cualquier cambio en el
catálogo sin regenerar rompe la congelación.

## 2. Contratos congelados

Todos son `v1` dentro de la versión global `1.0.0`.

| Contrato | Forma | Contenido / regla |
|---|---|---|
| `RegisterInput` | objeto | `email` (formato correo), `password` (8–128 chars). |
| `LoginInput` | objeto | `email` (formato correo), `password` (no vacío). |
| `RefreshInput` | objeto | `refreshToken` (no vacío). |
| `TokenPair` | objeto | `accessToken`, `refreshToken`, `tokenType: 'Bearer'`, `expiresIn` (entero > 0). |
| `AuthenticatedUser` | objeto | `userId` (obligatorio, clave de aislamiento), `email`, `createdAt` (ISO 8601). |
| `Preset` | enum | `HIGH` \| `BALANCED` \| `MAX_COMPRESSION` — exactamente tres (IN-02). |
| `JobStatus` | enum | `PENDING`, `PROCESSING`, `COMPLETED`, `PARTIAL`, `FAILED`. |
| `OutputFormat` | enum | `webp`, `avif`. |
| `ImageRecord` | objeto | `imageId`, `status`, `bytesBefore?`, `bytesAfter?`, `failureReason?`, `exifStripped`. |
| `JobMetrics` | objeto | `bytesBefore`, `bytesAfter`, `savingsPct`, `exifStripped` + coherencia de ahorro. |
| `Job` | objeto | `jobId`, `userId`, `name?` (opcional, ≤ 80 caracteres), `status`, `preset`, `formats`, métricas, `createdAt`, `updatedAt`, `ttl` + coherencia de ahorro y TTL. |
| `LimitsConfig` | objeto | `maxFileSizeMb`, `maxImagesPerBatch`, `maxPixels` (enteros > 0), leídos desde `AppConfig.limits`. |
| `AwsTransport` | objeto | `region`, `accountId` (12 dígitos), `endpointUrl`, `queueUrl`, `dlqUrl` + regla de colas canónicas. |
| `RetentionPolicy` | objeto | `retentionDays: 30`, `ttlSeconds: 2592000` (literales). |

## 3. Reglas de validación y coherencia

- **Estructura estricta:** todos los objetos rechazan claves desconocidas (`z.object(...).strict()`).
- **Presets/estados/formatos:** conjuntos cerrados; `formats` debe contener `webp` y `avif`, sin duplicados (IN-01).
- **Métricas honestas (PR-12):** `savingsPct = (bytesBefore − bytesAfter) / bytesBefore × 100` con tolerancia de `0.01`; si `bytesBefore = 0`, el porcentaje debe ser `0`. Se aceptan explícitamente `0 %` y valores negativos.
- **TTL (IN-09):** `ttl = floor(createdAt / 1000) + 2592000` (30 días); la retención de S3 y DynamoDB usa el mismo valor.
- **Límites (IN-07):** los valores se validan tal como los expone `backend/src/config/index.ts`; el catálogo no duplica constantes de configuración.
- **Transporte AWS (A-03):** las QueueUrls conservan el host AWS canónico `https://sqs.<región>.amazonaws.com/<cuenta>/<cola>`; `AWS_ENDPOINT_URL` es el transporte. Se rechaza `:9324` (puerto retirado) y cualquier QueueUrl fabricada con `:9297` o con el host del endpoint.
- **Privacidad (PR-01):** `exifStripped` es obligatorio en imágenes, métricas y jobs; la eliminación efectiva de metadatos se verifica en las reglas puras de `F01-T05`.

## 4. Superficie entre componentes

- El backend valida entra/salidas con `schemas` desde `backend/src/contracts/index.ts`. Las rutas HTTP de `spec.md` §5 (`/auth/*`, `/jobs*`) se implementan en `F02` usando estos esquemas, sin redefinirlos.
- El frontend importa tipos desde `frontend/src/api/types.generated.ts` (por ejemplo `Job`, `JobStatus`, `Preset`). No declara `type`/`interface` con esos nombres ni importa desde `backend/`.
- Fase 2 y Fase 3 pueden trabajar en paralelo sobre el mismo contrato congelado: cualquier cambio de forma exige subir versión y regenerar.

## 5. Reglas de congelación y cambio

1. `CONTRACTS_VERSION` sigue `MAJOR.MINOR.PATCH`. Cambios que rompen forma o semántica → `MAJOR`, nuevo hash y revalidación de las fases consumidoras. Adiciones retrocompatibles → `MINOR`; correcciones documentales → `PATCH`.
2. Toda modificación del catálogo debe regenerar `types.generated.ts` en el mismo cambio y ejecutar `npx vitest run tests/unit/contracts.test.ts`, `npm run typecheck` y `npm run lint`.
3. El test de sincronía y el de no duplicación son parte del contrato: no se relajan para acomodar cambios.
4. Sin secretos ni rutas absolutas en artefactos: la cabecera generada usa el marcador `<PROJECT_ROOT>`.

## 6. Evidencia

`reports/implementation/F01/evidence/F01-T01-{red,green,refactor,freeze,typecheck,lint,regression}.txt`
y el reporte `reports/implementation/F01/F01-T01-developer.md`.
