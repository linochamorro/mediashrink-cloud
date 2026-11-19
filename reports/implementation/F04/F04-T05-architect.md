# Cierre de tarea (Architect) — `F04-T05`

| Campo | Valor |
|---|---|
| **Tarea** | `F04-T05` — CI de integración contra emulador + `terraform apply` |
| **Fase / paquete** | Fase 4 — `docs/sdd/packages/P-04-terraform-and-ci.md` |
| **Versión / Loop usado** | `v1 — Loop 1/3` |
| **Dictamen Tester** | **`PASSED`** (`F04-T05-tester.md`: 6/6 tests, guardias no vacuas, CI `success`) |
| **Dictamen Auditor** | **`READY_WITH_CONCERNS`** (`F04-T05-auditor.md`: 0 CRITICAL/HIGH, sin bloqueantes) |
| **Estado** | `CERRADA — PASSED` · CI run `44312560558` `success` |

## 1. Revisión de aceptación reforzada (§3.2)

| Requisito | Evidencia Tester | Límite | Estado |
|---|---|---|---|
| `CA-05` CI con emulador + `terraform apply` | Sesión única `up→cp→healthcheck→fmt/init/validate/plan/apply→tests→down`, exit 0; `Apply complete! 11 added, 0 changed, 0 destroyed` | Emulador local, sin AWS real | **CUMPLIDO** |
| Tests de infra reales | 3 archivos / 6/6: buckets+lifecycle+CORS, cola+DLQ+`maxReceiveCount` numérico, tabla+TTL, IAM | Cobertura de recursos declarados | **CUMPLIDO** |
| Guardias | `GSI_COUNT: 0` y retención 30/2.592.000 en cuatro fuentes; 7/7 divergencias detectadas y 2/2 GSI>0 rechazadas (no vacuas) | `F04T03-A-03` solo se cierra parcialmente (falta default runtime de `config/index.ts`, competencia CTO) | **CUMPLIDO** |
| CI real | `gh run view 44312560558` → `success`, 14/14 pasos; run `44311817714` `failure` por SDKs ausentes, documentado append-only | `--no-save` temporal (P-4) | **CUMPLIDO** |
| G-7 y ámbito | 2 GiB/2.0, `user=1000:1000`, `if: always()` en el apagado, `docker ps -a` vacío; 9 `.tf` con blob-hash idéntico, 0 manifiestos tocados, `HEAD==origin/main` sin force push | Cobertura Git INDICATIVE en Auditor, confirmada por Tester | **CUMPLIDO** |

Hallazgos no bloqueantes: P-2 (`.tf` de T01–T04 incluidos sin cambio, necesarios para el apply), P-4 (`npm install --no-save` de SDKs S3/SQS hasta que F02 publique manifiestos, A-03 LOW), A-06 INFO (3 evidencias T05 reintroducen `<PROJECT_ROOT>/...` en el banner de Vitest → ampliar anonimización P4 en F05). Ninguno aceptado como riesgo (sin G-10).

## 2. Cierre
`F04-T05` queda **`CERRADA — PASSED`**. No se actualizan `STATE.md` ni `tasks.md` (CTO consolida al retorno). Con las cinco tareas en `PASSED`, la Fase 4 se cierra con el informe `reports/verification/F04-architect.md` y `F04-coordination.md` se cierra con `FASE_COMPLETA`.

---

## Addendum de anonimización P4 (F05-T02, 2026-11-18)

En el marco de la tarea `F05-T02` (política P4 / G-6b) se sustituyeron las rutas
absolutas del entorno de desarrollo por marcadores: `<PROJECT_ROOT>`,
`<LAB_ROOT>`, `<DOCKER_CLI_DIR>`, `<TF_CLI_DIR>`, `<NPM_CACHE_DIR>` y
`<USER_HOME>`. La sustitución fue **mecánica y exclusiva de esas rutas**: no se
modificaron hallazgos, severidades, cifras, conclusiones ni el historial
append-only. Este addendum conserva la trazabilidad del reemplazo.