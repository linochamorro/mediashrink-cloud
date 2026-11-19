# Retorno Architect — `F05-H01` (H-01 Opción A) + verificación defensiva + push G-6 — MediaShrink Cloud

| Campo | Valor |
|---|---|
| **Fecha** | `2026-11-19` (America/Lima) |
| **Architect** | OpenCode — MediaShrink Cloud |
| **Alcance** | Corrección `H-01` (Opción A, autorizada) + hardening defensivo + push de avances |
| **Gates** | **H-01 AUTORIZADA** (ejecutada) · **G-6/G-6b** push autorizado (ejecutado) · **G-7** (apagado al terminar) · **G-12 RETENIDO — NO ejecutado** (sin `F05-T06`, sin cierre final) |
| **Veredicto** | **`PASSED (loop 2/3)`** · Tester `PASSED` en addendum · Auditor `READY_WITH_CONCERNS` |
| **Push** | Commit + push a `main` en `linochamorro/mediashrink-cloud` · CI verificada (ver §5) |

---

## 1. H-01 Opción A — seed escribe en `DYNAMODB_TABLE_JOBS`

| Aspecto | Resultado |
|---|---|
| Causa raíz del `401` (P-01, loop 1/3) | `putUserIfAbsent` solo hacía `Put` del perfil `{userId, USER#PROFILE}`; `findByEmail` exige el índice `{email normalizado, USER#EMAIL}` con `ownerUserId`, que nunca se creaba |
| Corrección (loop 2/3, TDD RED→GREEN 8/8) | El seed escribe perfil + índice con `TransactWrite` condicional, réplica exacta de `user-store-adapter.ts:111-123` (sin `ttl`); `normalizeEmail` del backend; si se cancela (re-seed o perfil legado), asegura el índice con `Put` condicional |
| Rastro de la tabla efímera | `grep mediashrink-seed-demo\|SEED_TABLE_NAME tools/scripts/seed/` → **0 coincidencias** |
| Respeto a Terraform | `ensureSeedTable` ante tabla existente (`PROVISIONED` + TTL de Terraform): `DescribeTable` OK → retorna `false` sin tocar billing/claves/TTL; solo crea si está ausente |
| Verificación viva del Tester (pila fresca, propia) | `terraform apply` **11 added** → `npm run seed` 3/3/6 en `mediashrink-jobs` → **login Ana/Bruno/Carla → 200** + `GET /jobs` con su `demo-job-*` → 2.º seed 0 creados (12→12, mismos IDs) → logins 200 de nuevo |
| Suite | typecheck/lint/build 0 · **unit 310/310 (34 f.)** · **integración 102/102 (24 f.)** — cifras propias del Tester |

El `NO-PASSED` de v1 se conservó append-only en `F05-H01-tester.md` (§7 addendum `PASSED`).

## 2. Hardening defensivo de seguridad

| Medida | Resultado |
|---|---|
| Cabeceras globales (`backend/src/api/security.ts`, cableado en `app.ts` antes de todas las rutas) | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` en **7/7** clases (200/201/400/401/404/429/413), verificado en vivo |
| Tope de body JSON | `bodyLimit` **1 MiB** → body ~1,1 MiB devuelve **413 `{error:{code:'PAYLOAD_TOO_LARGE'}}`** con cabeceras; bajo el límite pasa (201) |
| Sin regresión | Login válido 200, mala credencial 401 idéntico (sin oráculo), rate-limit 5/60s intacto (5×401 → 429 + `retry-after`) |
| `npm audit --omit=dev` | **0 CRITICAL, 2 HIGH** (ver §3) |

## 3. Auditoría — `READY_WITH_CONCERNS` (`reports/audits/F05/F05-H01-auditor.md`)

- **0 CRITICAL/HIGH propios, 0 secretos, 0 bloqueantes.** Cobertura `SUFFICIENT` (estático) / `LIMITED` (vivo ajeno).
- **Los 2 HIGH no bloquean el push G-6** (entorno local/emulador, G-12 retenido), con tracking obligatorio pre-G-12:
  - **AUD-03** `sharp` (libvips/libheif/librsvg, HIGH heredada): explotable en principio (el worker procesa imágenes no confiables); el tope 1 MiB no lo mitiga. Exige **bump `sharp@0.35.5` + suite worker/antiBomb antes de G-12**.
  - **AUD-04** `zod <4.6.6` (DoS de memoria, residual LOW-MEDIUM): el tope 1 MiB antes de Zod mitiga parcialmente sin eliminar el vector. Exige **upgrade mayor con control de cambios del CTO** (contratos congelados) **antes de G-12**.
- Desviación literal de `CA-H01.3` («0 HIGH») documentada con plan, **sin G-10**.
- Hallazgos LOW/INFO: AUD-01 colisión seed↔real en tabla compartida (mitigación: reservar prefijo `demo-` + pre-chequeo); AUD-02 `ensureSeedTable` crea con `PAY_PER_REQUEST` si la tabla falta (propuesta fail-closed); AUD-05 sin CSP/HSTS (correcto para emulador; solo para despliegue real).
- Herencia F05-T02 intacta (allowlist prod, ETag, IAM único, `cors_origin`, `is_emulator`, `USER#` sin `ttl`, billing, `@v4`, ESLint 8, `CONFIRM_INCONSISTENT`): nada del cambio lo empeora. **G-10 no invocado.**

## 4. Higiene pre-push (verificación propia del Architect)

- `temporary/` **inexistente**; `.env` y `.local/` ignorados (`git check-ignore -v`); **0 secretos reales** en el diff (los 17 hits del escaneo son prosa de auditoría F04 «0 AKIA/ASIA», no claves; las contraseñas demo son sintéticas versionadas, no secretos G-3).
- **P4:** 1 hit en fichero nuevo ajeno (`docs/runbooks/manual-qa-guide-lino.md:11`, guía manual para Lino de la sesión concurrente) → **corregido por el Architect** a «la carpeta que contiene este repositorio» (una línea, documentado aquí); re-escaneo 0 hits. No se tocaron otros ficheros ajenos.
- Árbol: 204 ítems (etapas F02–F05 revisadas por sus propios loops + este cambio); `STATE.md`/`tasks.md` sin tocar (CTO consolida).

## 5. Push G-6 y CI

| Paso | Resultado |
|---|---|
| `git pull --ff-only` | Sin conflictos |
| Commit + push a `main` (`linochamorro/mediashrink-cloud`) | Sin `--force` |
| Run CI en GitHub Actions | Verificado en verde tras el push (ver dictamen en el mensaje de retorno) |
| Docker | `docker compose down` exit 0; `ps -a` solo `dazzling_edison` (ajeno) |

## 6. Pendientes para el CTO/Lino (antes de G-12)

1. **Pruebas manuales de Lino** con `docs/runbooks/manual-qa-guide-lino.md` (10 pruebas, usa las cuentas seed ya funcionales tras H-01).
2. **Pre-G-12 obligatorio:** bump `sharp@0.35.5` + suite antiBomb; upgrade `zod` con control de cambios; decisiones AUD-01/AUD-02 (prefijo `demo-`, fail-closed en `ensureSeedTable`).
3. **G-12** solo tras (1) y (2): `F05-T06` (push final + `FASE_COMPLETA`).

---

**Estado del retorno:** `F05-H01 CERRADA — PASSED (loop 2/3)`, avances publicados bajo G-6 con CI verde. **G-12 retenido:** no se declara `F05-T06` ni cierre final; Lino ejecuta sus pruebas manuales primero.
