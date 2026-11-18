# F03-T01 — SPA, router, español y tema persistente

- Versión: 1.0 · Fase: F03 · Prioridad: P1 · Loop: 1/3
- Estado inicial: READY sujeto a aprobación visual para pantallas definitivas.
- Fuentes: AGENTS.md; STATE.md; docs/sdd/constitution.md, spec.md, plan.md, tasks.md; docs/sdd/packages/P-03-frontend-spa.md; docs/architecture/04-api-and-component-contract.md; frontend/src/api/types.generated.ts (solo lectura).
- Owner: Designer · Riesgo: 1
- Alcance: frontend/src/** (excepto types.generated.ts), frontend/index.html, frontend/public/**, tests/unit/frontend/**
- Exclusiones: backend/**; infra/terraform/**; .github/**; frontend/src/api/types.generated.ts; package.json/package-lock.json raíz; STATE.md; docs/sdd/tasks.md; Docker y servicios reales.
- Criterio de aceptación: CA-01: SPA navegable en español; tema Claro inicial y selector Claro/Dark persistido entre recargas; accesible por teclado y adaptable.
- Evidencia esperada: reports/implementation/F03/evidence/F03-T01-{red,green,refactor,verification}.txt y reporte propio del rol. Para T06, evidencia Playwright propia contra mock server determinista.
- Hitos: (1) contrato/alcance confirmado, (2) implementación + RED/GREEN/REFACTOR, (3) handoff Tester independiente. Architect revisa cambios y evidencia, no implementa ni ejecuta pruebas.
- Revisión de alcance: contratos F01 congelados; cualquier discrepancia material de API retorna NEEDS_CONTEXT a CTO antes de asumir formas.
