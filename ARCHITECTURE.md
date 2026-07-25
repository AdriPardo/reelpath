# Reelpath — Arquitectura del Sistema

## Visión

Reelpath es una plataforma SaaS multi-tenant para generación, revisión y publicación automatizada de vídeos en YouTube. El diseño prioriza **modularidad**, **observabilidad** y **extensibilidad** sobre un monolito modular que puede evolucionar a microservicios sin reescritura.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (Next.js)                                │
│  Dashboard · Canales · Vídeos · Review Queue · Métricas                    │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │ REST / SSE
┌───────────────────────────────────▼─────────────────────────────────────────┐
│                           API GATEWAY (Express)                             │
│  Auth · Rate limit · Validación · Orquestación de pipelines                 │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────┐         ┌─────────────────┐         ┌─────────────────┐
│  PostgreSQL   │         │  Redis (BullMQ) │         │  Object Storage │
│  Estado +     │         │  Job queues +   │         │  Assets (local/ │
│  Analytics    │         │  Pub/Sub events │         │  S3-compatible) │
└───────────────┘         └────────┬────────┘         └─────────────────┘
                                   │
                          ┌────────▼────────┐
                          │     WORKER      │
                          │ Pipeline runner │
                          └────────┬────────┘
                                   │
     ┌─────────────┬───────────────┼───────────────┬─────────────┐
     ▼             ▼               ▼               ▼             ▼
 Idea Gen    Script Gen      Media Gen      Video Render   Publisher
     │             │               │               │             │
     └─────────────┴───────────────┴───────────────┴─────────────┘
                                   │
                          ┌────────▼────────┐
                          │   CORE LAYER    │
                          │ Prompt Engine   │
                          │ Content Scorer  │
                          │ Config System   │
                          │ Job Queue       │
                          └─────────────────┘
```

## Principios de diseño

| Principio | Implementación |
|-----------|----------------|
| **Separation of concerns** | Cada servicio tiene una responsabilidad única; comunicación vía cola o contratos tipados |
| **Human-in-the-loop minimal** | Estados `pending_review` → `approved`/`rejected`; el usuario solo decide |
| **Prompts como código versionado** | Prompt Engine con versiones, A/B de hooks, feedback loop |
| **Templates intercambiables** | JSON schema para timeline, assets y render config |
| **Multi-canal nativo** | `Channel` como entidad raíz; prompts, templates y métricas por canal |
| **Fail-safe & retry** | BullMQ con backoff, dead-letter queue, idempotencia por `pipelineRunId` |
| **Provider abstraction** | Interfaces para LLM, TTS, imágenes, YouTube; mocks en dev |

## Capas del sistema

### 1. API Gateway (`backend/api`)

- REST sobre Express + Zod validation
- Endpoints: canales, pipelines, vídeos, review, analytics, billing
- No contiene lógica de negocio; delega a servicios y encola jobs

### 2. Core Layer (`backend/core`)

#### Prompt Engine
- Almacena prompts versionados (DB + seed files)
- Resolución: `channelId + promptType + version | "latest" | A/B variant`
- Registra resultados de A/B (hook variant → retention proxy)
- Feedback loop: ajusta pesos de variantes según analytics

#### Job Queue
- BullMQ sobre Redis
- Colas: `pipeline`, `media`, `render`, `publish`, `analytics`
- Orquestador de pipeline como state machine

#### Config System
- Variables de entorno tipadas
- Config por canal (niche, format, autoPublish, reviewRequired)
- Feature flags

#### Content Scorer
- Score de viralidad estimada (0–100) basado en:
  - Hook strength (heurísticas + LLM opcional)
  - Trend alignment
  - Niche fit
  - Title/description SEO score
- Usado en selección automática de ideas

### 3. Services (`backend/services`)

Cada servicio expone funciones puras + adaptadores; el worker las invoca secuencialmente.

| Servicio | Input | Output | Dependencias |
|----------|-------|--------|--------------|
| **idea-generator** | niche, trends, count | Idea[] con scores | Prompt Engine, OpenAI, TrendProvider |
| **script-generator** | Idea, format, variants | Script + A/B hooks | Prompt Engine, OpenAI |
| **media-generator** | Script, template | audio, images, subtitles | TTS, ImageProvider, template |
| **video-renderer** | assets, timeline, template | video file | FFmpeg, template engine |
| **youtube-publisher** | video, metadata | youtubeVideoId | YouTube Data API |
| **analytics** | channelId, videoId | metrics, insights | YouTube Analytics API (mock inicial) |

### 4. Worker (`worker`)

Procesa jobs de la cola `pipeline`. State machine:

```
scheduled → ideas_generated → idea_selected → script_generated
  → media_generated → video_rendered → pending_review | approved
  → published → analytics_synced → completed
```

Cada transición persiste estado en PostgreSQL y emite eventos.

### 5. Frontend (`frontend`)

Next.js App Router:
- `/channels` — CRUD canales, config niche/template, modo visual (stock/IA/mixto)
- `/videos` — listado, estados, preview, badges de origen visual
- `/review` — cola approve/reject
- `/analytics` — CTR, views, retention proxy
- `/settings` — plan, equipo, BYOK OpenAI, integraciones

> **Nota:** La UI de gestión de prompts versionados (`/prompts`) está pendiente; los prompts se resuelven vía Prompt Engine en backend.

### 6. Infrastructure (`infrastructure`)

- `docker-compose.yml` — postgres, redis, api, worker, frontend
- Dockerfiles multi-stage
- nginx reverse proxy para VPS
- Scripts de deploy

## Modelo de datos (resumen)

```
Channel ──┬── PipelineRun ──┬── VideoIdea
          │                 ├── Script (variants A/B)
          │                 ├── MediaAsset[]
          │                 └── Video (render output)
          ├── PromptBinding (channel → prompt version)
          ├── VideoTemplate
          └── AnalyticsSnapshot

PromptVersion ── PromptVariant (A/B hooks)
TrendSnapshot (simulado)
```

## Pipeline end-to-end

1. **Scheduler** (cron job / API trigger) crea `PipelineRun` para canal activo
2. **Idea Generator** produce N ideas; **Content Scorer** las rankea
3. **Selector** elige top-1 (configurable threshold)
4. **Script Generator** crea guion + variantes de hook
5. **Media Generator** TTS por escena, stock Pexels o imágenes IA (DALL-E), SRT; metadata `visualOrigin` por escena
6. **Video Renderer** aplica template JSON → FFmpeg
7. Si `reviewRequired`: estado `pending_review`; si no, auto-approve
8. **Publisher** sube a YouTube (o mock)
9. **Analytics** poll métricas periódicamente
10. **Feedback loop** actualiza pesos A/B en Prompt Engine

## Extensibilidad: nuevos formatos de vídeo

1. Añadir template JSON en `backend/core/templates/`
2. Registrar en `VideoTemplateRegistry`
3. Configurar canal con `templateId` + `aspectRatio`
4. Opcional: nuevo prompt type en Prompt Engine

No requiere cambios en el pipeline core.

## Seguridad y producción

- Secrets vía env / Docker secrets
- OAuth2 YouTube por canal (tokens encriptados en DB)
- Rate limiting en API
- Health checks: `/health`, `/ready`
- Logs estructurados (pino)
- Migraciones Prisma en deploy

## n8n (opcional)

n8n puede actuar como capa de **orchestración externa** para triggers no-core (webhooks, integraciones Zapier-style). El pipeline principal vive en BullMQ para control fino, retries y observabilidad. n8n puede llamar `POST /api/pipelines/trigger` como complemento.

## Evolución a microservicios

Cada carpeta en `backend/services/*` ya es un paquete npm independiente. Extracción:

1. Publicar contratos en `@autotube/shared`
2. Reemplazar invocación directa por HTTP/gRPC
3. Cola dedicada por servicio
4. Sin cambios en frontend ni schema de DB
