# Despliegue de Reelpath en producción

Guía para publicar Reelpath en un VPS accesible desde cualquier navegador. El enfoque recomendado es **un solo servidor con Docker Compose + Caddy** (HTTPS automático).

## Resumen ejecutivo

| Componente | Cómo se despliega |
|------------|-------------------|
| Frontend (Next.js) | Contenedor Docker, detrás de Caddy |
| API (Express :4000) | Contenedor Docker, detrás de Caddy en `/api/*` |
| Worker (BullMQ + ffmpeg) | Contenedor Docker, siempre activo |
| PostgreSQL | Contenedor Docker, volumen persistente |
| Redis | Contenedor Docker |
| Storage de vídeos | Volumen Docker compartido API + worker |
| HTTPS | Caddy + Let's Encrypt |

**Por qué un VPS y no Vercel+Railway:** el worker necesita ffmpeg, CPU/RAM sostenida y **disco compartido** con la API para servir vídeos. Separar frontend y worker complica storage y sube el coste sin beneficio para un solo operador.

## Requisitos del servidor

- **SO:** Ubuntu 22.04/24.04 o Debian 12
- **RAM:** mínimo 4 GB (recomendado 8 GB para render ffmpeg)
- **Disco:** ≥ 40 GB SSD (vídeos ocupan espacio rápido)
- **Puertos:** 80 y 443 abiertos
- **Software:** Docker Engine + Docker Compose v2

## Arquitectura en producción

```
Internet
   │
   ▼
┌─────────────┐
│   Caddy     │  :443 HTTPS (Let's Encrypt)
│  (proxy)    │
└──────┬──────┘
       │
   ┌───┴────────────────────────────┐
   │                                │
   ▼                                ▼
frontend:3000                  api:4000
(dashboard)                    (/api/*, OAuth)
       │                                │
       └──────────┬─────────────────────┘
                  ▼
            worker (ffmpeg)
                  │
       ┌──────────┴──────────┐
       ▼                     ▼
  postgres:5432          redis:6379
       │
  volumen storage_data (vídeos/assets)
```

Rutas especiales:

- `/api/media/*` → **frontend** (proxy Next.js con cookie JWT para streaming)
- `/api/integrations/youtube/callback` → **API** (OAuth Google)
- Todo lo demás `/` → **frontend**

## Pasos de despliegue

### 1. Provisionar VPS

Opciones recomendadas (julio 2026):

| Proveedor | Plan | ~Coste/mes |
|-----------|------|------------|
| Hetzner CPX31 | 4 vCPU, 8 GB RAM, 80 GB | ~€15 |
| DigitalOcean | 4 GB droplet | ~$24 |
| Hetzner CX32 | 4 vCPU, 8 GB (alternativa) | ~€12 |

### 2. DNS

Crea un registro **A** (y opcionalmente **AAAA**) apuntando tu subdominio al IP del VPS:

```
app.tudominio.com  →  203.0.113.50
```

### 3. Instalar Docker en el VPS

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Cierra sesión y vuelve a entrar
```

### 4. Clonar el repositorio

```bash
git clone https://github.com/TU_USUARIO/autotube.git
cd autotube
```

### 5. Configurar variables de entorno

**Qué archivo usar:**

| Archivo | Cuándo |
|---------|--------|
| `.env.example` | Referencia completa; base para **desarrollo local** (`cp .env.example .env`) |
| `.env.production.example` | Plantilla **producción** en el VPS (`cp .env.production.example .env`) |
| `.env` | Archivo real con secretos (gitignored); nunca commitear |

```bash
cp .env.production.example .env
nano .env   # o vim
```

Variables **obligatorias**:

| Variable | Ejemplo | Notas |
|----------|---------|-------|
| `DOMAIN` | `app.tudominio.com` | Sin `https://` |
| `ACME_EMAIL` | `tu@email.com` | Para certificados Let's Encrypt |
| `POSTGRES_PASSWORD` | (aleatoria) | Cambia el default |
| `AUTH_SECRET` | (≥32 chars aleatorios) | `openssl rand -base64 48` |
| `AUTH_REQUIRED` | `true` | |
| `NEXT_PUBLIC_AUTH_REQUIRED` | `true` | |
| `MOCK_EXTERNAL_APIS` | `false` | |
| `CREDENTIALS_ENCRYPTION_KEY` | (hex 32) | Cifrado BYOK + secretos de plataforma |
| `DEFAULT_ADMIN_PASSWORD` | (segura) | Usuario admin del seed |

API keys (OpenAI/DeepSeek/ElevenLabs/Pexels) y YouTube **Client ID/Secret** se configuran en **Ajustes → Secretos de plataforma** tras el primer login (o `npm run secrets:import-from-env` si migras desde un `.env` antiguo).

Asegúrate de que `NEXT_PUBLIC_API_URL` y `FRONTEND_URL` usan `https://` + tu `DOMAIN`.

> **Importante:** no definas `NODE_ENV=development` en `.env` de producción. Next.js fija `NODE_ENV=production` en el build del frontend; un valor distinto en `.env` rompe `next build`. En local, el script de build del frontend ya fuerza `NODE_ENV=production`.

### 6. Google Cloud — OAuth YouTube

1. [Google Cloud Console](https://console.cloud.google.com) → nuevo proyecto o existente
2. Activar **YouTube Data API v3** y **YouTube Analytics API**
3. **Pantalla de consentimiento OAuth** → tipo Externo → añadir scopes `youtube.upload`, `youtube`, `yt-analytics.readonly` → añadir tu email como tester (hasta publicar la app)
4. **Credenciales** → **Crear credenciales** → **ID de cliente de OAuth 2.0** → tipo **Aplicación web**
5. **URI de redirección autorizados:**
   ```
   https://app.tudominio.com/api/integrations/youtube/callback
   ```
6. Copia Client ID y Client Secret a `.env`

> Los usuarios conectan su canal YouTube desde la UI (`/channels/[id]` → Cuentas). El refresh token se guarda en la base de datos por canal. Para ver métricas reales (vistas, CTR, tiempo de visualización), la conexión debe incluir el scope **YouTube Analytics** (`yt-analytics.readonly`). Si conectaste antes de activar Analytics, reconecta en **Cuentas**.

### 6b. Analíticas YouTube (MVP)

- Pestaña **Analíticas** en cada canal: resumen, tabla por vídeo y sincronización manual.
- En vídeos publicados, panel de métricas en la ficha del vídeo.
- Con `MOCK_EXTERNAL_APIS=true` (desarrollo) las métricas son simuladas y **los guiones se generan en local sin llamar a OpenAI** (coste $0).
- En producción: `MOCK_EXTERNAL_APIS=false`, OAuth con scope Analytics y al menos un vídeo publicado en YouTube.

### Probar pipelines sin gastar (desarrollo local)

En tu `.env`:

```bash
MOCK_EXTERNAL_APIS=true
# Opcional: quita OPENAI_API_KEY o déjala vacía
```

Reinicia **worker** y **API** tras cambiar `.env`. Verás en logs `[script] MOCK — sin coste API`. El frontend muestra un aviso solo cuando `MOCK_EXTERNAL_APIS=false` y hay API real configurada.

### 7. Desplegar

```bash
chmod +x infrastructure/scripts/deploy-prod.sh
./infrastructure/scripts/deploy-prod.sh
```

O manualmente:

```bash
docker compose -f docker-compose.yml -f infrastructure/docker/docker-compose.prod.yml build
docker compose -f docker-compose.yml -f infrastructure/docker/docker-compose.prod.yml up -d
```

### 8. Verificar

```bash
curl -s https://app.tudominio.com/health
# {"status":"ok","service":"reelpath-api"}

curl -s https://app.tudominio.com/ready
# {"status":"ready"}
```

Abre `https://app.tudominio.com/login`, inicia sesión con el admin del seed y crea un canal.

### 9. Conectar YouTube y generar el primer vídeo

1. `/channels` → crear canal
2. Pestaña **Cuentas** → **Conectar YouTube**
3. `/pipelines` → lanzar pipeline
4. Revisa el worker: `docker compose -f docker-compose.yml -f infrastructure/docker/docker-compose.prod.yml logs -f worker`

## Comandos útiles

```bash
COMPOSE="docker compose -f docker-compose.yml -f infrastructure/docker/docker-compose.prod.yml"

# Logs
$COMPOSE logs -f api worker

# Migraciones tras un git pull
$COMPOSE run --rm api sh -c "npm run migrate:deploy -w @autotube/database"

# Reiniciar tras cambiar .env
$COMPOSE up -d --build

# Backup Postgres
$COMPOSE exec postgres pg_dump -U autotube autotube > backup.sql

# Espacio en storage
$COMPOSE exec api du -sh /app/storage
```

## Desarrollo local vs producción

| | Local | Producción |
|---|-------|------------|
| Compose | `docker compose up` | `docker compose -f docker-compose.yml -f infrastructure/docker/docker-compose.prod.yml up` |
| HTTPS | No | Caddy automático |
| Auth | `AUTH_REQUIRED=false` opcional | `true` obligatorio |
| API URL frontend | `http://localhost:4000` | `https://tu-dominio` |
| Deploy script | `infrastructure/scripts/deploy.sh` | `infrastructure/scripts/deploy-prod.sh` |

## Páginas legales y marketing

Las páginas públicas (homepage, `/privacy-policy`, `/terms-of-service`) se sirven desde el frontend Next.js en `FRONTEND_URL`. No hay sitio estático separado.

## Alternativas consideradas

### Opción B: Vercel (frontend) + Railway/Fly (API+worker)

- **Pros:** deploy frontend muy cómodo
- **Contras:** storage compartido entre API y worker requiere S3; worker con ffmpeg caro en Railway; CORS y dos dominios; más configuración
- **Veredicto:** solo si ya tienes S3 y CI/CD maduro

### Opción A/C unificadas: VPS + Docker

- **Pros:** un `docker compose up`, storage local, un dominio, coste predecible
- **Contras:** tú gestionas el servidor (actualizaciones, backups)
- **Veredicto:** **recomendado** para comodidad sin over-engineering

## Coste mensual estimado

| Concepto | Coste |
|----------|-------|
| VPS 8 GB (Hetzner CPX31) | ~€12–15 |
| Dominio `.com` | ~€1/mes (anualizado) |
| OpenAI (10 vídeos cortos/mes) | ~$2–10 |
| ElevenLabs (opcional) | $0–22 |
| **Total infra** | **~€15–20/mes** + APIs variables |

## Riesgos y limitaciones

1. **Worker pesado:** render ffmpeg puede tardar minutos y usar 2–4 GB RAM. Un VPS pequeño (2 GB) fallará en vídeos largos.
2. **Storage:** el volumen Docker crece sin límite. Programa limpieza (`npm run storage:cleanup` o endpoint `/api/system/storage`).
3. **OAuth Google:** en modo "testing" solo cuentas autorizadas pueden conectar YouTube. Para usuarios externos, publica la pantalla de consentimiento.
4. **Backups:** no hay backup automático; haz dump de Postgres y copia del volumen `storage_data` periódicamente.

### Object storage S3 (opcional)

Por defecto los vídeos se guardan en el volumen local `STORAGE_PATH` (compartido API + worker). Para réplica externa o despliegues sin disco compartido, configura S3-compatible:

| Variable | Ejemplo | Notas |
|----------|---------|-------|
| `S3_ENDPOINT` | `https://s3.eu-west-1.amazonaws.com` | O MinIO, R2, etc. |
| `S3_BUCKET` | `reelpath-media` | |
| `S3_ACCESS_KEY` | | |
| `S3_SECRET_KEY` | | |
| `S3_REGION` | `auto` | Opcional |

Comportamiento MVP:

- **Escritura:** siempre en disco local (ffmpeg) y espejo asíncrono a S3.
- **Lectura:** si falta el archivo local, la API lo descarga de S3 bajo demanda al hacer streaming.

Sin las cuatro variables obligatorias (`S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`) el backend usa solo almacenamiento local.
5. **Un solo nodo:** sin alta disponibilidad; caída del VPS = app caída.
6. **Edge TTS en Docker:** funciona pero depende de red saliente a Microsoft; ElevenLabs/OpenAI son más predecibles en servidor.
7. **Worker tras cambios de código:** el worker de BullMQ carga `@autotube/script-generator` y otros paquetes en memoria al arrancar. Tras actualizar lógica de guiones, duración o pipeline, **reinicia el worker** o los cambios no se aplican hasta el próximo reinicio.

### Desarrollo local

Tras cambiar `packages/shared`, `@autotube/script-generator` o el worker:

```bash
npm run build -w @autotube/shared -w @autotube/script-generator -w worker
npm run db:seed   # corrige targetDurationMinSec y config de canales demo
# Reinicia el proceso worker (Ctrl+C y npm run dev:worker, o el script que uses)
```

Si un pipeline falla con «debe superar 10 minutos» pero el canal debería tener piso de 8 min, ejecuta `npm run db:seed` para actualizar `targetDurationMinSec: 480` en canales demo y reinicia el worker.

### Esquema Prisma tras `git pull` (desarrollo local)

Si el código incluye nuevas migraciones en `backend/core/database/prisma/migrations/` (por ejemplo campos de analytics en `AnalyticsSnapshot`), la API puede fallar con errores del tipo *«column X does not exist»* aunque el cliente Prisma ya esté generado.

Desde la raíz del repo, con Postgres en marcha (`docker compose up -d postgres`):

```bash
npm run db:migrate:deploy
npm run db:generate
```

Reinicia la API/worker si ya estaban corriendo (`npm run dev`).

**Si `db:migrate:deploy` falla** (BD desincronizada, permisos, etc.), puedes aplicar el SQL de la migración pendiente a mano. Ejemplo para `20250712120000_youtube_analytics_fields`:

```bash
psql "$DATABASE_URL" -f backend/core/database/prisma/migrations/20250712120000_youtube_analytics_fields/migration.sql
# o con el puerto local por defecto:
PGPASSWORD=autotube psql -h localhost -p 5433 -U autotube -d autotube \
  -f backend/core/database/prisma/migrations/20250712120000_youtube_analytics_fields/migration.sql
```

Luego marca la migración como aplicada con `prisma migrate resolve --applied 20250712120000_youtube_analytics_fields` (desde el workspace `@autotube/database`, con `.env` cargado) o vuelve a ejecutar `npm run db:migrate:deploy` si el resto del historial está al día.

En **producción**, el equivalente sigue siendo el bloque de «Migraciones tras un git pull» en [Comandos útiles](#comandos-útiles); opcionalmente ejecuta también `npm run db:generate` dentro del contenedor si reconstruyes imágenes sin regenerar el cliente en el build.

## Stripe (facturación opcional)

Ver [BILLING.md](./BILLING.md) para el detalle. En producción, además de las claves en `.env`:

```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_UNLIMITED=price_...
STRIPE_TAX_ENABLED=false   # true si tienes Stripe Tax configurado
```

1. Webhook en Stripe Dashboard: `https://TU_DOMINIO/api/billing/webhook` (eventos de suscripción e `invoice.payment_failed`).
2. Activa el **Customer portal** en Stripe Dashboard.
3. Tras desplegar código con migraciones de billing: `npm run db:migrate:deploy` (incluye `StripeWebhookEvent`, `billingStatus`, `subscriptionRenewsAt`).

## Checklist de producción (GTM)

Antes de abrir registro público o cobrar clientes, verifica:

- [ ] **SMTP Brevo** (u otro): `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` — ver [EMAIL.md](./EMAIL.md)
- [ ] **`CREDENTIALS_ENCRYPTION_KEY`**: genera con `openssl rand -hex 32` (cifrado BYOK + secretos de plataforma)
- [ ] **OAuth Google / YouTube**: proyecto GCP, consent screen, redirect URI `https://TU_DOMINIO/api/integrations/youtube/callback`
- [ ] **Secretos de plataforma** (UI owner): YouTube Client ID/Secret + DeepSeek/OpenAI (y opcional ElevenLabs/Pexels)
- [ ] **Stripe webhook**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, precios y portal — ver [BILLING.md](./BILLING.md)
- [ ] **`MOCK_EXTERNAL_APIS=false`** en producción (TTS, imágenes y YouTube reales)
- [ ] Health check: `https://TU_DOMINIO/health`
- [ ] Pipeline de prueba end-to-end con revisión y publicación

## Checklist del usuario (fuera del repo)

- [ ] Crear cuenta en Hetzner/DigitalOcean (o VPS preferido)
- [ ] Registrar dominio y apuntar DNS al VPS
- [ ] Instalar Docker en el VPS
- [ ] Clonar repo y copiar `.env.production.example` → `.env`
- [ ] Generar `AUTH_SECRET` (`openssl rand -base64 48`) y `CREDENTIALS_ENCRYPTION_KEY`
- [ ] Crear proyecto Google Cloud + OAuth web + redirect URI de producción
- [ ] Ejecutar `./infrastructure/scripts/deploy-prod.sh`
- [ ] Verificar `https://TU_DOMINIO/health`
- [ ] Login admin → Ajustes → Secretos de plataforma (Client ID/Secret + API keys)
- [ ] Conectar canal YouTube vía OAuth
- [ ] Lanzar pipeline de prueba
- [ ] (Opcional) Configurar backup cron de Postgres
- [ ] (Opcional) Cron retención de storage de pipelines antiguos:

```cron
# Diario 3:00 AM — elimina archivos de pipelines completados hace >30 días
0 3 * * * cd /opt/reelpath && RETENTION_DAYS=30 npm run retention:cleanup >> /var/log/reelpath-retention.log 2>&1
```

- [ ] (Opcional) Escalar workers: `docker compose ... up -d --scale worker=2` con `WORKER_CONCURRENCY=1`
- [ ] Revisar encoding VPS: `FFMPEG_PRESET=veryfast`, `FFMPEG_THREADS=2`, `FFMPEG_CONCURRENCY=1` (ver `.env.production.example`)
- [ ] (Opcional) Stripe: productos, precios, webhook, portal de cliente y variables en `.env`

## Archivos de infraestructura

| Archivo | Propósito |
|---------|-----------|
| `docker-compose.yml` | Stack base (dev + prod) |
| `infrastructure/docker/docker-compose.prod.yml` | Override producción: Caddy, sin puertos expuestos, env |
| `infrastructure/caddy/Caddyfile` | Proxy HTTPS + enrutamiento |
| `infrastructure/nginx/nginx.conf` | Alternativa nginx (sin SSL auto) |
| `infrastructure/docker/Dockerfile.*` | Imágenes multi-stage (ffmpeg en API/worker) |
| `infrastructure/scripts/deploy-prod.sh` | Script de despliegue producción |
| `.env.production.example` | Plantilla de variables para producción |
| `.env.example` | Referencia completa de variables (desarrollo local) |
