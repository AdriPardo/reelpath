---
type: community
cohesion: 0.22
members: 9
---

# Alertas externas (Sentry / Prometheus)

**Cohesion:** 0.22 - loosely connected
**Members:** 9 nodes

## Members
- [[ALERTAS]] - document - docs/ALERTAS.md
- [[Alertas externas (Sentry  Prometheus)]] - document - docs/ALERTAS.md
- [[Checklist de configuración]] - document - docs/ALERTAS.md
- [[Checklist de dashboards]] - document - docs/ALERTAS.md
- [[Ejemplo de `scrape_config`]] - document - docs/ALERTAS.md
- [[Prometheus (API)]] - document - docs/ALERTAS.md
- [[Reglas de alertas (plantillas)]] - document - docs/ALERTAS.md
- [[Reglas recomendadas]] - document - docs/ALERTAS.md
- [[Sentry (API, worker, frontend)]] - document - docs/ALERTAS.md

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Alertas_externas_Sentry_/_Prometheus
SORT file.name ASC
```
