# Planificador de publicación (Publication Planner)

Módulo MVP para maximizar visualizaciones programando vídeos largos y Shorts en horarios óptimos para audiencia hispanohablante (ES/LATAM).

## Estado actual (MVP)

| Componente | Ubicación | Estado |
|------------|-----------|--------|
| Tipos + config canal | `packages/shared/src/types.ts`, `config-system` | ✅ |
| Servicio de cálculo | `packages/shared/src/publication-planner.ts` | ✅ |
| API calendario | `GET /api/channels/:id/publication-plan` | ✅ |
| Auto-schedule al aprobar | `POST /api/videos/:id/approve` | ✅ |
| Auto-schedule al disparar pipeline | `POST /api/pipelines/trigger` | ✅ |
| Shorts con horarios óptimos | `worker/pipeline.ts` + `youtube-publisher/shorts.ts` | ✅ |
| UI config + calendario | `ChannelSettingsForm`, pestaña Planificación | ✅ |
| Feedback analytics → horarios | — | 🔜 Fase 2 |

## Configuración por canal (`ChannelConfig`)

| Campo | Default | Descripción |
|-------|---------|-------------|
| `publishPlannerEnabled` | `false` | Activa asignación automática de fechas |
| `timezone` | `Europe/Madrid` | Zona horaria IANA |
| `maxLongsPerWeek` | `1` | Máximo de largos por semana ISO |
| `preferredPublishHour` | `19` | Hora local para vídeos largos (0-23) |
| `preferredPublishDays` | `[5]` | Días preferidos (0=dom … 6=sáb). Varios días = varios slots/semana |
| `minDaysBetweenLongs` | `ceil(7/maxLongsPerWeek)` | Separación mínima entre largos |
| `shortPreferredSlots` | `[{12:30}, {19:00}]` | Horarios para Shorts extra |

### Estrategia recomendada (2 largos/semana + monetización)

Canales seed (`fraude-corporativo`, `curiosidades-historia`) usan:

| Parámetro | Valor | Motivo |
|-----------|-------|--------|
| `maxLongsPerWeek` | `2` | Ritmo sostenible para monetización |
| `preferredPublishDays` | `[2, 5]` | Martes y viernes 19:00 — prime time ES |
| `minDaysBetweenLongs` | `3` | Espacio entre martes→viernes |
| `shortsMode` | `mixed` | Cortes del largo + teasers funnel |
| `shortsPerVideo` | `6` | 3 cortes + 3 teasers promocionales |
| `longShortsFromVideo` | `3` | Partes distribuidas (inicio/medio/final) |
| `shortsPublishIntervalDays` | `1` | Un Short por día tras el largo (~6 días de embudo) |
| `reviewRequired` | `true` | Control de calidad antes de publicar |

No hace falta `publishPlannerSlots`: varios días se modelan con `preferredPublishDays` + `maxLongsPerWeek`.

## Algoritmo MVP

### Vídeos largos — `computeNextPublishSlot()`

1. Partir de `now + 60s` (margen mínimo de YouTube).
2. Buscar el próximo día en `preferredPublishDays` a `preferredPublishHour:00` en `timezone`.
3. Validar restricciones:
   - No más de `maxLongsPerWeek` largos en la misma semana ISO.
   - Al menos `minDaysBetweenLongs` desde otro largo programado.
4. Si no hay hueco en 56 días, fallback: último programado + `minDaysBetweenLongs`.

### Shorts — `computeShortPublishSlots()`

- **Short 0**: mismo momento que el vídeo largo.
- **Shorts 1+**: recorre `shortPreferredSlots` (12:30, 19:00) en días siguientes, con mínimo 30 min entre slots.

### Calendario — `buildPublicationCalendar()`

- Incluye vídeos en cola (`pending`, `approved`, `scheduled`).
- Vídeos ya programados: muestra fecha actual + Shorts derivados.
- Vídeos sin fecha: propone slots secuenciales respetando restricciones.

## Integración pipeline

```
Usuario aprueba/dispara pipeline
  ├─ ¿Fecha manual? → usar manual (prioridad)
  └─ ¿publishPlannerEnabled? → computeNextPublishSlot()
       └─ metadata.scheduledPublishAt / Video.scheduledPublishAt

publish_youtube_shorts
  ├─ ¿publishPlannerEnabled? → computeShortPublishSlots()
  └─ else → intervalDays (comportamiento anterior)
```

**Compatibilidad:** scheduling manual sigue funcionando; el planificador solo actúa cuando no hay fecha explícita.

## API

### `GET /api/channels/:id/publication-plan`

```json
{
  "channelTimezone": "Europe/Madrid",
  "plannerEnabled": true,
  "nextAvailableSlot": "2026-07-17T17:00:00.000Z",
  "entries": [
    {
      "videoId": "clx…",
      "title": "El misterio de…",
      "scheduledAt": "2026-07-17T17:00:00.000Z",
      "recommendation": "Publica el viernes a las 19:00 (Europe/Madrid)",
      "shorts": [
        { "orderIndex": 0, "scheduledAt": "…", "label": "Short 1: con el vídeo largo" },
        { "orderIndex": 1, "scheduledAt": "…", "label": "Short 2: sábado 12:30" }
      ]
    }
  ]
}
```

## Fase 2 — Analytics feedback loop

Cuando haya suficientes `AnalyticsSnapshot` reales:

1. **`deriveBestPublishHours(channelId)`**
   - Agrupar snapshots por hora de publicación (`publishedAt`).
   - Ponderar por views, CTR, retención.
   - Devolver top 3 horas por tipo (largo / short).

2. **Override dinámico**
   - Si confianza > umbral (≥5 vídeos con datos reales), sustituir `preferredPublishHour` heurístico.

3. **YouTube Analytics API**
   - Métrica `views` por `dayOfWeek` + `hour` (requiere scope ampliado).
   - Guardar en `ChannelAnalyticsProfile` (modelo futuro).

4. **Ajuste post-publicación**
   - Job semanal que reprograma vídeos aún no publicados si analytics cambian.

## Investigación de referencia (ES/LATAM)

| Tipo | Horario recomendado | Fuente |
|------|---------------------|--------|
| Vídeo largo | Viernes 18:00–20:00 CET | Prime time fin de semana |
| Short 1 | Con el largo | Maximiza impulso inicial |
| Short 2+ | 12:30 / 19:00 local | Mediodía + tarde (móvil) |

Defaults del MVP alineados con estas heurísticas; se refinan con datos reales del canal en Fase 2.

## Tests recomendados

Estos checks ya están cubiertos en `packages/shared/src/publication-planner*.test.ts` (Vitest) y se ejecutan con `npm run test -w @autotube/shared`:

- `computeNextPublishSlot` respeta `maxLongsPerWeek` y `minDaysBetweenLongs`.
- `zonedLocalToUtc` con DST (Europe/Madrid marzo/octubre).
- Manual override no es sobreescrito por planner.
- Shorts usan slots del planner solo cuando `publishPlannerEnabled=true`.
