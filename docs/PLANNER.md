# Planificador de publicación (Publication Planner)

Módulo para maximizar visualizaciones programando vídeos largos y Shorts en horarios óptimos (heurística ES/LATAM + override por analytics del canal).

## Estado actual

| Componente | Ubicación | Estado |
|------------|-----------|--------|
| Tipos + config canal | `packages/shared`, `config-system` | ✅ |
| Cálculo de slots | `packages/shared/src/publication-planner.ts` | ✅ |
| Insights analytics | `publish-insights.ts` + `deriveChannelPublishInsights` | ✅ |
| API calendario | `GET /api/channels/:id/publication-plan` | ✅ |
| Auto-schedule al aprobar / trigger | `resolveChannelAutoPublishAt` | ✅ |
| Shorts con horarios | worker + youtube-publisher | ✅ |
| Auto-generación con margen | worker sweep horario | ✅ |
| UI config + calendario | Planificación del canal | ✅ |

## Configuración por canal (`ChannelConfig`)

| Campo | Default | Descripción |
|-------|---------|-------------|
| `publishPlannerEnabled` | `false` | Activa asignación automática de fechas |
| `timezone` | `Europe/Madrid` | Zona horaria IANA |
| `maxLongsPerWeek` | `1` | Máximo de largos por semana ISO |
| `preferredPublishHour` | `19` | Hora local heurística (0-23); se sustituye si hay insights confidentes |
| `preferredPublishDays` | `[5]` | Días preferidos (0=dom … 6=sáb). Hard filter |
| `minDaysBetweenLongs` | `ceil(7/maxLongsPerWeek)` | Separación mínima entre largos |
| `shortPreferredSlots` | `[{12:30}, {19:00}]` | Horarios Shorts extra |
| `autoGenerateEnabled` | `false` | Dispara pipelines solos según el planificador |
| `autoGenerateLeadDays` | `1` | Días de margen antes del slot (0–3) |

## Insights (analytics → slots)

Con ≥ **5** vídeos con `AnalyticsSnapshot` real:

1. Se puntúa cada hora/día (retención 50% + views 30% + CTR 20%).
2. `preferredPublishHour` → mejor hora del canal.
3. `preferredPublishDays` se **reordenan** por score (no se eliminan días marcados).
4. Shorts pueden heredar slots derivados de las mejores horas.

Sin suficientes datos se usa la heurística ES/LATAM (viernes ~19:00, Shorts 12:30/19:00).

## Auto-generación con margen

```
Sweep horario (BullMQ maintenance)
  → canales autoGenerateEnabled + publishPlannerEnabled
  → próximo slot (planner + insights)
  → si hoy >= slot − leadDays y no hay pipeline/vídeo para ese día
  → enqueuePipeline(metadata.scheduledPublishAt = slot)
```

- Máximo **1** pipeline nuevo por canal por pasada.
- Idempotencia: no repite si ya hay vídeo programado ese día local o un run `source=auto_generate` reciente para el mismo slot.
- Requiere YouTube conectado si `publishYoutube !== false`.
- Admin: `POST /api/admin/auto-generate/run`
- Script: `npx tsx scripts/auto-generate-sweep.ts`

Ejemplo: viernes 19:00 + margen 1 → se genera el **jueves**.

## Integración pipeline

```
Usuario aprueba / dispara / auto-generate
  ├─ ¿Fecha manual? → usar manual
  └─ ¿publishPlannerEnabled? → computeNextPublishSlot(+insights)
       └─ metadata.scheduledPublishAt / Video.scheduledPublishAt

publish_youtube_shorts
  ├─ ¿publishPlannerEnabled? → computeShortPublishSlots(+insights)
  └─ else → intervalDays
```

## API

### `GET /api/channels/:id/publication-plan`

Incluye `insights` / `insightsSource` (`heuristic` | `analytics`) y feedback de retención por slot.

### `POST /api/admin/auto-generate/run`

Encola un sweep inmediato (platform admin).

## Fuera de alcance (aún)

- Reprogramar vídeos ya en YouTube si cambian analytics.
- Métricas YouTube Analytics `dayOfWeek×hour` con scope extra (usamos snapshots propios).
