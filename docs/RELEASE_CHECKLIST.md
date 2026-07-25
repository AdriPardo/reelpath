# Release checklist (go/no-go)

Este documento define guardrails verificables para sacar una release **production-ready**.

> Convención: ejecuta los comandos desde la raíz del repo.

## Go/No-go rápido (5 min)

### 1) Variables de entorno (prod)

- Debe existir `.env` en el servidor, creado desde **`.env.production.example`** (no uses `.env.example` en prod).
- Referencia completa de variables: **`.env.example`** en la raíz del repo.
- En producción, la app **debe fallar al arrancar** si falta algo crítico:
  - `AUTH_REQUIRED=true`
  - `CREDENTIALS_ENCRYPTION_KEY` presente
  - `MOCK_EXTERNAL_APIS=false`
  - `YOUTUBE_CLIENT_ID` + `YOUTUBE_CLIENT_SECRET`
  - Stripe live: si `STRIPE_SECRET_KEY` empieza por `sk_live_`, exige `STRIPE_WEBHOOK_SECRET` + `STRIPE_PRICE_*`

Verificación local (simula prod):

```bash
NODE_ENV=production AUTH_REQUIRED=true MOCK_EXTERNAL_APIS=false CREDENTIALS_ENCRYPTION_KEY=deadbeef YOUTUBE_CLIENT_ID=x YOUTUBE_CLIENT_SECRET=y DATABASE_URL=postgresql://x REDIS_URL=redis://x tsx backend/core/config-system/src/index.ts
```

### 2) Build y tests (CI parity)

```bash
npm ci
npm run build
npm run test -w backend/api
npm run test -w @autotube/shared
```

### 3) Smoke test servicios (docker local)

```bash
docker compose up -d --build
node --version
dotenv -e .env -- tsx scripts/healthcheck.ts
```

### 4) Endpoints de salud

- `GET /health` → 200
- `GET /ready` → 200
- `GET /health/extended` → 200 y `status=ok`
- `GET /metrics` → 200

Ejemplo:

```bash
curl -fsS http://localhost:4000/health | jq .
curl -fsS http://localhost:4000/health/extended | jq .
curl -fsS http://localhost:4000/metrics | head
```

## Checklist completo (pre-deploy)

### Seguridad y hardening

- [ ] `MOCK_EXTERNAL_APIS=false` en prod.
- [ ] `AUTH_REQUIRED=true` y `AUTH_SECRET` aleatorio.
- [ ] `CREDENTIALS_ENCRYPTION_KEY` configurada (32 bytes hex recomendado).
- [ ] Rate-limits activos (API).
- [ ] Headers de seguridad (Helmet) activos.

### Observabilidad

- [ ] Sentry configurado (opcional pero recomendado):
  - [ ] `SENTRY_DSN` presente en API, worker y frontend
  - [ ] `SENTRY_ENVIRONMENT=production`

### Datos: backups y retención

- [ ] Backups automáticos configurados (ver `docs/BACKUPS.md`).
- [ ] Retención configurada y ejecutándose por cron (ver `docs/RETENCION.md`).

### Billing (si aplica)

- [ ] Si Stripe live:
  - [ ] `STRIPE_SECRET_KEY=sk_live_...`
  - [ ] `STRIPE_WEBHOOK_SECRET=whsec_...`
  - [ ] `STRIPE_PRICE_STARTER/PRO/UNLIMITED` configurados
  - [ ] Webhook idempotente (ver tests de `backend/api`)

### Integraciones

- [ ] YouTube OAuth app configurada:
  - [ ] `YOUTUBE_CLIENT_ID`
  - [ ] `YOUTUBE_CLIENT_SECRET`
  - [ ] `YOUTUBE_OAUTH_REDIRECT_URI` correcto (`https://<DOMAIN>/api/integrations/youtube/callback`)

## Checklist post-deploy

- [ ] `docker compose ... up -d` sin reinicios en bucle.
- [ ] `scripts/healthcheck.ts` OK contra dominio público:

```bash
HEALTHCHECK_URL=https://app.tudominio.com tsx scripts/healthcheck.ts
```

