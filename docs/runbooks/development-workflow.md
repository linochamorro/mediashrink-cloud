# Runbook — Flujo de desarrollo local y TDD

## 1. Entorno y variables

1. Copiar `.env.example` a `.env` (nunca versionar `.env`).
2. Levantar `aws/aws-emulator` **solo** cuando se ejecuten pruebas de integración o desarrollo end-to-end. Requiere Docker con motor Linux (Docker Desktop); el emulador no necesita cuenta AWS.

### 1.1 Límites obligatorios (G-7)

`docker-compose.yml` fija para el servicio `aws-emulator` los límites equivalentes a `--memory=2g --cpus="2.0"`:

- `cpus: 2.0` y `deploy.resources.limits.cpus: "2.0"`
- `mem_limit: 2g`, `memswap_limit: 2g` y `deploy.resources.limits.memory: 2g`
- `stop_grace_period: 10s`, `restart: "no"` (apagado limpio, sin reinicios automáticos)

Confirmar los límites efectivos tras arrancar:

```powershell
docker inspect --format 'memory={{.HostConfig.Memory}} nanoCpus={{.HostConfig.NanoCpus}}' mediashrink-aws-emulator
```

Valores esperados: `memory=2147483648` (2 GiB) y `nanoCpus=2000000000` (2.0 CPUs).

### 1.2 Arranque

Desde la raíz del repositorio:

```powershell
docker compose up -d
docker compose ps
docker compose logs --tail=50 aws-emulator
```

El servicio publica **únicamente** `127.0.0.1:9297` (HTTPS). El emulador sirve en ese mismo puerto S3, SQS + DLQ, DynamoDB y STS: **no hay puerto SQS 9324**. El arranque puede tardar hasta 180 s; el healthcheck usa `GET /__admin/health` sobre HTTPS.

### 1.3 Certificado `ca.pem` y HTTPS local

El emulador genera de nuevo el certificado en **cada arranque** y lo escribe, junto con `config` y `emulator_credentials`, dentro de un **volumen named** (`aws-emulator-data`) montado en `/home/emulator/.aws/emulator`; los archivos quedan en `/home/emulator/.aws/emulator/9297/`. Se exportan a `./.local/aws-emulator/` con `docker cp` para exponerlos en la ruta declarada como `CA_BUNDLE_PATH` en `.env.example`. **No se usa un bind mount**: en Windows el montaje enlazado devuelve `Operation not permitted (os error 1)` al crear estos archivos (fix aplicado en la reanudación v2 de F00-T03).

```powershell
# 1) Exportar los archivos generados desde el volumen del contenedor al host
New-Item -ItemType Directory -Force ./.local/aws-emulator | Out-Null
docker cp mediashrink-aws-emulator:/home/emulator/.aws/emulator/9297/ca.pem ./.local/aws-emulator/ca.pem
docker cp mediashrink-aws-emulator:/home/emulator/.aws/emulator/9297/config ./.local/aws-emulator/config
docker cp mediashrink-aws-emulator:/home/emulator/.aws/emulator/9297/emulator_credentials ./.local/aws-emulator/emulator_credentials
Get-Item ./.local/aws-emulator/ca.pem

# 2) Healthcheck HTTPS autenticado con el CA del emulador (usar curl.exe: en
#    PowerShell `curl` es un alias de Invoke-WebRequest)
curl.exe --silent --show-error --fail --cacert ./.local/aws-emulator/ca.pem https://127.0.0.1:9297/__admin/health
```

> **Nota N-01 (volumen named):** al usar un volumen named los archivos `ca.pem`, `config` y `emulator_credentials` se generan dentro del contenedor en cada arranque y **no se reflejan automáticamente en `./.local/aws-emulator/`**. Por tanto, el bloque de `docker cp` de esta sección debe **repetirse en cada arranque** (tras `docker compose up -d` y con el contenedor `healthy`) antes de ejecutar el healthcheck o apuntar los SDK; si no, se usarían un CA y unas credenciales de una sesión anterior. Que el volumen named persista tras `docker compose down` no exime de repetir esta exportación.

El emulador rechaza peticiones firmadas con credenciales que no sean las suyas (se generan en cada arranque y empiezan por `EMULATOR`). Para apuntar los SDK/CLI al emulador, usar los archivos generados en lugar de credenciales fijas:

```powershell
$env:AWS_ENDPOINT_URL = 'https://127.0.0.1:9297'
$env:AWS_REGION = 'us-east-1'
$env:AWS_CA_BUNDLE = './.local/aws-emulator/ca.pem'
$env:NODE_EXTRA_CA_CERTS = './.local/aws-emulator/ca.pem'
$env:AWS_SHARED_CREDENTIALS_FILE = './.local/aws-emulator/emulator_credentials'
$env:AWS_CONFIG_FILE = './.local/aws-emulator/config'
$env:AWS_EC2_METADATA_DISABLED = 'true'
# No definir AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_PROFILE:
# las variables de entorno tienen prioridad sobre el archivo de credenciales.
```

> **Estado de `.env.example` (alineado por el addendum A-03 de `F00-T01`):** ya **no** declara el puerto SQS alternativo ni credenciales fijas. Las colas SQS/DLQ usan sus QueueUrls canónicas `https://sqs.us-east-1.amazonaws.com/000000000000/<cola>` y `AWS_ENDPOINT_URL=https://127.0.0.1:9297` actúa únicamente como **transporte** hacia el emulador; las credenciales se leen de `AWS_SHARED_CREDENTIALS_FILE` / `AWS_CONFIG_FILE` generados por el emulador. **No escribir `:9297` en la QueueUrl**: el host AWS de la QueueUrl es un identificador lógico y sustituirlo por el endpoint rompería la coherencia con el valor que devuelve el emulador (en el SDK JS v3, usar `useQueueUrlAsEndpoint: false`). La afirmación obsoleta que figuraba en versiones anteriores de este runbook (puerto SQS alternativo y credenciales fijas) debe entenderse como **valor obsoleto corregido**, nunca como estado vigente.

### 1.4 Apagado

```powershell
docker compose down
docker compose ps
```

`docker compose down` detiene y elimina el contenedor `mediashrink-aws-emulator`; la red y el contenedor no quedan en ejecución. El **volumen named** `aws-emulator-data` persiste tras `down` (no es un contenedor ni una red, por lo que no rompe el apagado limpio de G-7) y puede eliminarse con `docker compose down -v` si se desea un estado totalmente limpio. La carpeta `./.local/aws-emulator/` se conserva (contiene el último `ca.pem` y credenciales **efímeras** del emulador; no son secretos reales, pero tampoco deben versionarse: ver A-05 / F00-T05).

> **Nota de verificación (F00-T03 v2):** estos comandos se ejecutaron en vivo con Docker Desktop (engine 29.9.3, Compose v5.7.0) bajo G-7. Evidencia real en `reports/implementation/F00/evidence/F00-T03-{config,up,inspect,healthcheck,down}.txt`. El Tester debe repetirlos con evidencia propia antes de emitir dictamen; la auditoría estática v1 (`F00-T03-config-audit.txt`) queda como historial, no como sustituto de la integración.

## 2. Ciclo SDD + TDD

1. Toda funcionalidad nueva parte del paquete `docs/sdd/packages/P-xx.md` y su contrato `-task.md`.
2. Implementar primero las pruebas en `tests/` (`RED`), luego el código mínimo (`GREEN`) y refactorizar (`REFACTOR`).
3. En tests unitarios e integración usar fixtures pequeños (`100x100` px) para mantener ejecución rápida y bajo consumo de CPU.

## 3. Proveniencia de la imagen (A-02)

**AWS no publica una imagen oficial preconstruida de `aws/aws-emulator`.** El AWS News Blog (11-Nov-2026) indica que en macOS/Windows se construye una imagen desde el Dockerfile corto de la documentación ("We don't publish a ready-made image"). Por ello, este proyecto ejecuta una imagen pública de **terceros**:

| Campo | Valor |
|---|---|
| Registro / repositorio | `ghcr.io/xsavikx/aws-emulator` (comunidad; **no es una imagen oficial de AWS**) |
| Tag de origen | `1.0.491.1` (corresponde al upstream `aws/aws-emulator` 1.0.491.1) |
| Digest fijado (A-01) | `sha256:9cd91ae8a722eaf518a26135955d4b8f2a5a4c6c60062278740ec59f68368376` — índice OCI multi-arch (amd64 + arm64) |
| Referencia en `docker-compose.yml` | `ghcr.io/xsavikx/aws-emulator@sha256:9cd91ae8...68376` |

**Usuario efectivo del contenedor (N-01):** el usuario con el que corre el emulador no se fija en el compose: procede del `USER 1000:1000` **declarado por la propia imagen** (verificado con `docker image inspect`). Por eso se retiró la directiva `user:` de `docker-compose.yml` en la reanudación v2: era redundante y además dependía de `${UID_GID}`. Quitarla **no cambia el usuario efectivo ni debilita la seguridad**: `docker inspect` en vivo confirmó `user=1000:1000`. Cualquier cambio de imagen obliga a reverificar este valor.

La imagen empaqueta el paquete oficial de AWS verificado por SHA-256 y firma del proveedor. Se fija por **digest inmutable** (no por tag) para impedir la republicación silenciosa del tag; el nombre del tag se conserva solo como documentación de procedencia.

### Cómo comprobar el digest

```powershell
# 1) Resolver hoy el digest publicado para el tag de origen
docker buildx imagetools inspect ghcr.io/xsavikx/aws-emulator:1.0.491.1

# 2) Confirmar la referencia fijada y sus RepoDigests tras descargarla
docker pull ghcr.io/xsavikx/aws-emulator@sha256:9cd91ae8a722eaf518a26135955d4b8f2a5a4c6c60062278740ec59f68368376
docker image inspect --format '{{json .RepoDigests}}' ghcr.io/xsavikx/aws-emulator@sha256:9cd91ae8a722eaf518a26135955d4b8f2a5a4c6c60062278740ec59f68368376
```

El campo `Digest:` del paso 1 debe coincidir con el digest fijado en el compose. Si el mantenedor publica una versión nueva, el digest cambiará: **no se actualiza automáticamente**.

### Responsable de la actualización

El **Developer propietario del contenedor** (en esta fase `F00-T03`; en fases posteriores quien herede `docker-compose.yml`) es responsable de: (1) revisar nuevas versiones del upstream/mantenedor, (2) resolver y verificar el nuevo digest con los comandos anteriores, (3) actualizar el digest tanto en `docker-compose.yml` como en esta sección del runbook, y (4) dejar evidencia del cambio en `reports/implementation/F00/evidence/`. Todo cambio de imagen exige una nueva verificación de `CA-03` por el Tester. Conservar una imagen con digest desactualizado no se da por aceptado de forma implícita: requiere decisión expresa de Lino (G-10).

> La dependencia de terceros queda registrada además en `ADR-001` Decisión 4 y en la cabecera de `docker-compose.yml`; esta sección la hace visible a quien solo consulte el runbook (repositorio público, G-6b).
