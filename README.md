# Reelpath

Plataforma SaaS de generación y publicación automatizada de vídeos para YouTube.

## Arquitectura

Ver [ARCHITECTURE.md](./ARCHITECTURE.md) para el diseño completo del sistema.

```
autotube/
├── backend/
│   ├── api/                 # REST Gateway (Express)
│   ├── core/
│   │   ├── config-system/   # Config tipada + env
│   │   ├── database/        # Prisma + PostgreSQL
│   │   ├── job-queue/       # BullMQ + Redis
│   │   ├── llm/             # OpenAI + mocks
│   │   ├── prompt-engine/   # Prompts versionados + A/B
│   │   └── template-engine/ # Templates JSON de vídeo
│   └── services/
│       ├── idea-generator/
│       ├── script-generator/
│       ├── media-generator/
│       ├── video-renderer/    # FFmpeg pipeline
│       ├── youtube-publisher/
│       ├── analytics/
│       └── content-scorer/  # Score de viralidad
├── worker/                  # Pipeline orchestrator
├── frontend/                # Next.js dashboard
├── packages/shared/         # Tipos compartidos
└── infrastructure/          # Docker, nginx, deploy
```

## Quick Start (desarrollo local)

### Requisitos

- Node.js 20+
- Docker & Docker Compose
- FFmpeg (opcional, para render real)

### 1. Infraestructura

Plantillas de entorno en la raíz: **`.env.example`** (local) y **`.env.production.example`** (VPS). El archivo `.env` real nunca se commitea.

```bash
cp .env.example .env
docker compose up -d postgres redis
```

### 2. Dependencias y DB

```bash
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
```

### 3. Pipeline demo (E2E sin Redis)

```bash
npm run pipeline:demo
```

Ejecuta: **ideas → selección → guion A/B → TTS/imágenes → render FFmpeg**

### 4. Stack completo

```bash
npm run dev
```

- API: http://localhost:4000
- Dashboard: http://localhost:3000
- Worker: procesa jobs de BullMQ

### 5. Trigger vía API

```bash
curl -X POST http://localhost:4000/api/pipelines/trigger \
  -H 'Content-Type: application/json' \
  -d '{"channelId":"<CHANNEL_ID>"}'
```

## Docker (producción VPS)

Guía completa: **[docs/DEPLOY.md](./docs/DEPLOY.md)**

```bash
cp .env.production.example .env
# Edita DOMAIN, AUTH_SECRET, API keys…
chmod +x infrastructure/scripts/deploy-prod.sh
./infrastructure/scripts/deploy-prod.sh
```

Desarrollo local con Docker:

```bash
chmod +x infrastructure/scripts/deploy.sh
./infrastructure/scripts/deploy.sh
```

Con nginx reverse proxy (sin Caddy/SSL automático):

```bash
docker compose -f docker-compose.yml -f infrastructure/docker/docker-compose.prod.yml up -d
```

## Pricing de lanzamiento

Reelpath ya deja visible en producto una propuesta comercial inicial:

- `19 EUR` por vídeo largo
- `29 EUR` por pack de vídeo largo + 6 Shorts
- `79 EUR/mes` plan Creator
- `149 EUR/mes` plan Pro
- `399 EUR/mes` plan Studio

La landing pública muestra estos precios y la guía operativa está en [`docs/BILLING.md`](./docs/BILLING.md).

## Diferenciadores implementados

| Feature | Ubicación |
|---------|-----------|
| Prompt Engine versionado + A/B | `backend/core/prompt-engine` |
| Content Scoring System | `backend/services/content-scorer` |
| Template system JSON | `backend/core/template-engine` |
| Multi-channel | `Channel` model + API |
| Human-in-the-loop | Review queue + approve/reject |
| Feedback loop | `analytics` → `promptEngine.recordAbResult` |

## Variables de entorno

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis para BullMQ |
| `OPENAI_API_KEY` | OpenAI (mock si vacío) |
| `MOCK_EXTERNAL_APIS` | `true` para dev sin APIs externas |
| `STORAGE_PATH` | Directorio de assets/vídeos |

## n8n (opcional)

```bash
docker compose --profile n8n up -d
```

n8n puede llamar `POST /api/pipelines/trigger` como capa de orquestación externa.

## Licencia

Privado — Reelpath Platform
