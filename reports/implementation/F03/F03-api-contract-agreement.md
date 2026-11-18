# Acuerdo de integración frontend↔API — F03

- Fecha: 2026-11-17
- Autoridad: Lino autorizó al Architect a acordar un contrato compatible con F01; el detalle siguiente es decisión operativa del Architect.
- Estado: Acordado para coordinación F03; pendiente de adopción/verificación por F02.
- Fuentes: `docs/sdd/spec.md` §5, `docs/sdd/packages/P-02-api-and-worker.md`, `docs/sdd/packages/P-03-frontend-spa.md`, `docs/architecture/04-api-and-component-contract.md`, `frontend/src/api/types.generated.ts` (solo lectura).
- Límite: este documento no modifica el contrato F01 ni prescribe cambios dentro del ámbito F02. El equipo F02 debe confirmar/adoptar el intercambio antes del cierre integral.

## Endpoints y payloads

1. `POST /jobs`
   - Request: `{ preset: Preset, files: Array<{ fileName: string; contentType: string; sizeBytes: number }> }`.
   - Response `201`: `{ job: Job, uploads: Array<{ imageId: string; uploadUrl: string; method: "PUT"; headers?: Record<string, string> }> }`.
   - La SPA sube cada `File` directamente por `PUT uploadUrl`, sin enviar el binario a la API.
2. `POST /jobs/:id/confirm`
   - Request: `{ imageIds: string[] }`.
   - Response: `{ job: Job }`.
3. `GET /jobs`
   - Response: `{ jobs: Job[] }`.
4. `GET /jobs/:id`
   - Response: `{ job: Job, images: ImageRecord[] }`.
5. `GET /jobs/:id/download/:imageId?variant=original|webp|avif|thumbnail`
   - Response JSON: `{ downloadUrl: string, expiresAt: string }`.
   - `original` habilita la comparativa con la fuente; las demás variantes son salidas optimizadas.
6. `GET /jobs/:id/download.zip`
   - Response: archivo ZIP como cuerpo binario, con `Content-Disposition`.
7. `DELETE /jobs/:id`
   - Response: `204 No Content`.

## Invariantes de interoperabilidad

- `Preset`, `Job` e `ImageRecord` se importan de `frontend/src/api/types.generated.ts`; no se duplican ni alteran.
- Las envolturas de transporte (`job`, `jobs`, `images`, `uploads`, `downloadUrl`) son propias de las rutas y no cambian la forma estricta de los contratos de datos F01.
- Todas las rutas privadas usan JWT; la API filtra por `userId` y responde `404` para recursos ajenos.
- La SPA renueva access token una vez ante `401`; ante fallo de refresh limpia sesión y solicita login.
- Descargas firmadas se tratan como URLs temporales; no se persisten en almacenamiento duradero del navegador.

## Confirmación pendiente

F02 debe confirmar este contrato contra su implementación y pruebas. Si F02 encuentra incompatibilidad, debe devolver el punto a Architect/CTO antes de cambiar los tipos congelados o las rutas. Esta coordinación no autoriza a F03 a editar `backend/**` ni a F02 a editar `frontend/**`.


## Addendum de decisión CTO/Lino (2026-11-17)

Lino decidió: **F02 adopta el acuerdo F03** y F03 permanece pendiente hasta que F02 confirme su adopción. Esta decisión no autoriza a F03 a modificar `backend/**`. El dueño de F02 debe ajustar/confirmar el handler y responder con evidencia propia; hasta entonces la interoperabilidad observada sigue `HIGH`/bloqueante y no se cierra F03.
