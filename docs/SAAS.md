# Reelpath SaaS — Fase 1 (multi-tenant)

Reelpath puede servir a varias **organizaciones** (clientes). Cada organización tiene usuarios, canales y datos aislados por `organizationId`.

## Modelo de datos

| Entidad | Descripción |
|---------|-------------|
| `Organization` | Cliente SaaS: nombre, slug único, plan (`trial` por defecto) |
| `User` | Cuenta con email/contraseña |
| `OrganizationMember` | Vínculo usuario ↔ org con rol `owner`, `admin` o `member` |
| `Channel` | Pertenece a una org; slug único **por organización** |
| `IntegrationCredential` | Credenciales BYOK YouTube por canal (Fase 2) |

Los pipelines, vídeos y analytics se filtran indirectamente por los canales de la organización autenticada.

## Variables de entorno

### Backend (`.env`)

| Variable | Default | Descripción |
|----------|---------|-------------|
| `AUTH_REQUIRED` | `false` | Si `true`, la API exige JWT en rutas protegidas |
| `AUTH_SECRET` | — | Obligatorio cuando `AUTH_REQUIRED=true` (HS256, ≥32 chars recomendado) |
| `DEFAULT_ADMIN_EMAIL` | `adripardo72@gmail.com` | Admin creado por `db:seed` |
| `DEFAULT_ADMIN_PASSWORD` | `changeme` | Contraseña del admin de seed |
| `PLATFORM_ADMIN_EMAILS` | — | Emails (coma-separados) con acceso al panel `/admin` y a `/api/platform` |

### Frontend

| Variable | Default | Descripción |
|----------|---------|-------------|
| `NEXT_PUBLIC_AUTH_REQUIRED` | `false` | Redirige a `/login` sin cookie `autotube_token` |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | URL de la API |

## Autenticación

- **Login:** `POST /api/auth/login` → JWT (7 días)
- **Sesión:** `GET /api/auth/me` con header `Authorization: Bearer <token>`
- **Registro:** `POST /api/auth/register` crea usuario + organización automática (nombre y slug derivados del email/nombre; el usuario no elige slug). Abierto si `AUTH_REQUIRED=false`; con auth activa solo admin/owner o primera org.

El frontend guarda el token en `localStorage` y en cookie `autotube_token` para el middleware de Next.js.

### Organización automática al registrarse

Cada usuario nuevo recibe una **organización** (límite de tenant) sin pedir nombre ni slug en el formulario:

- **Nombre:** el `name` del usuario si lo indica; si no, la parte local del email capitalizada (`adrian@…` → `Adrian`).
- **Slug:** derivado del email (`adrian`); si ya existe, se añade un sufijo aleatorio (`adrian-a1b2`).

La organización sigue siendo el aislamiento multi-tenant; los **canales** se crean después en la app (`POST /api/channels`).

## Onboarding de un cliente

1. **Registrar cuenta** (dev/staging sin auth estricta). La organización (tenant) se crea sola a partir del email y nombre opcional:
   ```bash
   curl -X POST http://localhost:4000/api/auth/register \
     -H 'Content-Type: application/json' \
     -d '{
       "email": "cliente@empresa.com",
       "password": "secreto-seguro",
       "name": "Cliente XYZ"
     }'
   ```
2. **Iniciar sesión** en `/login` o usar el token devuelto.
3. **Crear canales** en la UI o `POST /api/channels` (requiere token si `AUTH_REQUIRED=true`).
4. **Integraciones por canal**: cada canal gestiona YouTube en `/channels/[id]?tab=integraciones`. YouTube se conecta con OAuth (un clic); el refresh token se guarda en `IntegrationCredential` por canal.

## Integraciones por canal

### Modelo

`IntegrationCredential` almacena credenciales por canal:

| Campo | Descripción |
|-------|-------------|
| `organizationId` | Org propietaria |
| `channelId` | Canal (obligatorio para integraciones de canal) |
| `provider` | `youtube` |
| `data` | JSON con `refreshToken`, `privacyStatus`, etc. |

Índice único `(channelId, provider)` — un registro por proveedor y canal.

Para YouTube, solo se persiste el **refresh token por canal**; `YOUTUBE_CLIENT_ID` y `YOUTUBE_CLIENT_SECRET` son credenciales de la app OAuth a nivel plataforma (**Ajustes → Secretos de plataforma**). El redirect URI sigue en `.env` / `DOMAIN`.

### API

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/channels/:id/integrations` | Estado YouTube del canal |
| `GET` | `/api/channels/:id/integrations/youtube/connect` | Inicia OAuth (devuelve `{ url }`) |
| `GET` | `/api/integrations/youtube/callback` | Callback de Google (redirect URI fija) |
| `PATCH` | `/api/channels/:id/integrations/:provider` | `connect`, `disconnect`, `update`, `link_from_env` (dev) |

`GET /api/channels` incluye resumen `integrations` por canal para badges en la UI.

### Resolución de credenciales (YouTube)

1. Si existe `IntegrationCredential` con `refreshToken` para el canal → **origen `channel`**
2. Si no → fallback opcional a `YOUTUBE_REFRESH_TOKEN` global en `.env` (solo desarrollo) → **origen `env`**
3. Si ninguna → **origen `none`**

El worker (`youtube-publisher`) lee credenciales del `channelId` del vídeo en runtime.

### UI

- `/channels` — hub con badges YouTube y enlace a integraciones
- `/channels/[id]` — pestañas General, Contenido, **Cuentas** (integraciones)
- **Conectar YouTube** — OAuth con Google; **Desconectar** — borra el token del canal

### Secretos / variables de plataforma (YouTube OAuth)

| Dónde | Obligatoria | Descripción |
|-------|-------------|-------------|
| **UI** Secretos de plataforma → Client ID | Sí (para OAuth) | App Google Cloud |
| **UI** Secretos de plataforma → Client Secret | Sí (para OAuth) | App Google Cloud |
| `.env` `YOUTUBE_OAUTH_REDIRECT_URI` | No | Default: `http://localhost:4000/api/integrations/youtube/callback` (o derivado de `DOMAIN`) |
| `.env` `YOUTUBE_REFRESH_TOKEN` | No | Solo fallback dev; los usuarios conectan por canal en la UI |

Registrar en Google Cloud → URIs de redirección autorizados: la URI de redirect (y la de producción).

## Roadmap

- Rotación de tokens en reposo
- Límites de plan que acoten `maxScenesLong` / imágenes IA por tier

## Migración y seed

```bash
npm install
npm run db:migrate:deploy   # o db:migrate en dev
npm run db:seed
```

El seed crea la org **Reelpath Demo** (`autotube-demo`), el usuario admin y asigna el canal demo existente.

## Habilitar auth en producción

```bash
# Backend
AUTH_REQUIRED=true
AUTH_SECRET=<genera-un-secreto-largo-aleatorio>

# Frontend
NEXT_PUBLIC_AUTH_REQUIRED=true
NEXT_PUBLIC_API_URL=https://api.tudominio.com
```

Reinicia API y frontend. Los usuarios deben iniciar sesión; las rutas de sistema exigen rol `owner` o `admin`.

## Compatibilidad local

Con `AUTH_REQUIRED=false`, el desarrollo local funciona **sin login**. Con `AUTH_REQUIRED=true` (como ahora para pruebas), hay que entrar en `/login`.

## Configuración: canal > organización > defaults de código

Resolución de preferencias de **producto/coste**: **canal → organización → defaults de código** (`PRODUCT_DEFAULTS`).

Infraestructura vive en **`.env`**. API keys de IA: **Atlas envFrom** (preferido) → **PlatformSecret** (fallback). YouTube Client ID/Secret: **Admin → Infra** (`PlatformSecret`). Preferencias de producto: **canal → organización → defaults de código**.

| Qué | Dónde | Motivo |
|-----|--------|--------|
| `DATABASE_URL`, `REDIS_URL`, `STORAGE_PATH`, S3/CDN | **`.env`** | Infra de la instancia |
| `AUTH_SECRET`, `AUTH_REQUIRED`, `CREDENTIALS_ENCRYPTION_KEY` | **`.env`** (Atlas envFrom) | Seguridad de plataforma |
| `WORKER_CONCURRENCY`, `FFMPEG_THREADS` / `CONCURRENCY` / `PRESET` | **`.env`** | Capacidad CPU compartida (Atlas) |
| `YOUTUBE_OAUTH_REDIRECT_URI` (o `DOMAIN`) | **`.env`** | Callback público de OAuth |
| YouTube OAuth app (`CLIENT_ID` / `SECRET`) | **BD** `PlatformSecret` (ops Admin → Infra) | App OAuth compartida |
| API keys plataforma (OpenAI, DeepSeek, ElevenLabs, Pexels) | **Atlas env** → **BD** `PlatformSecret` fallback | Sin BYOK end-user |
| YouTube refresh token + `privacyStatus` | **BD** `IntegrationCredential` (por canal) | Cada canal publica en su cuenta |
| LLM / TTS / tope escenas / calidad / voces | **BD** `Organization` (+ UI Ajustes) | Defaults del cliente (sin paste de keys) |
| Formato, tono, review, Shorts, planner, TTS, escenas, IA | **BD** `Channel.config` | Preferencias por canal YouTube |
| `MOCK_EXTERNAL_APIS` | **`.env`** | Solo desarrollo |

**Hoy:** Atlas inyecta AI keys vía envFrom; PlatformSecret = fallback; panel keys solo ops. Worker aplica `channel > org > código` (producto) y keys `env > PlatformSecret > leftover org`.

**Objetivo al vender:** el operador configura secrets en Atlas; cada cliente elige coste/calidad en UI sin pegar API keys.

## Coste por vídeo (APIs)

Objetivo típico con defaults cost-efficient: **€0.20–0.80 / vídeo largo** (vs ~€5 si ElevenLabs + DALL·E high en 20 escenas).

| Concepto | Caro (~€5) | Cost-efficient |
|----------|------------|----------------|
| Chat LLM (ideas + guion) | gpt-4o / gpt-4o-mini | **DeepSeek** `deepseek-v4-pro` (mejor calidad; flash sigue disponible vía `DEEPSEEK_MODEL`) |
| TTS | ElevenLabs (~€1–3 / 8 min) | **Edge TTS** (gratis) |
| Imágenes | gpt-image high × 20 escenas | **Off** + Pexels/stock; tope IA por canal/org (default 4) |
| Escenas | 20 | **6–8** (default de código / override canal) |
| Shorts | `dedicated` (regenera TTS/IA) | **`split`** (reusa audio/vídeo del long) |
| FFmpeg | medium + todos los cores | **`veryfast` + `FFMPEG_THREADS=2` + concurrency 1** |

### Variables clave (solo infra)

```bash
WORKER_CONCURRENCY=1
FFMPEG_PRESET=veryfast
FFMPEG_THREADS=2
FFMPEG_CONCURRENCY=1
FFMPEG_FORCE_CUT_TRANSITIONS=true
YOUTUBE_OAUTH_REDIRECT_URI=https://app.tudominio.com/api/integrations/youtube/callback
CREDENTIALS_ENCRYPTION_KEY=...   # openssl rand -hex 32
MOCK_EXTERNAL_APIS=false         # producción
```

API keys y YouTube Client ID/Secret: **Ajustes → Secretos de plataforma** (o `npm run secrets:import-from-env` una vez si migras desde `.env` legacy).

**Qué usa DeepSeek:** ideas, guion/outline/chunks, títulos, descripciones, prompts de escena, teasers.
**Qué sigue en OpenAI (si está activo):** imágenes DALL·E/gpt-image, TTS OpenAI (solo fallback).
**TTS / escenas / IA:** se configuran en **canal** (y defaults de org en Ajustes), no en `.env`.

Ahorro LLM estimado (guion long ~50–150k tokens totales entre llamadas): gpt-4o-mini ~$0.15–0.50 → DeepSeek Pro/Flash ~$0.02–0.15 (Pro más caro que Flash, sigue muy por debajo de GPT).

## Páginas legales públicas

Las URLs legales viven en el frontend Next.js (`FRONTEND_URL`). Sustituye `<domain>` por el valor de `FRONTEND_URL` en producción (sin barra final).

| Ruta | Contenido |
|------|-----------|
| `/` | Homepage pública Reelpath (sin sesión) o panel (con sesión) |
| `/privacy-policy` | Política de privacidad |
| `/terms-of-service` | Términos de servicio |
| `/privacy`, `/terms`, `/landing` | Redirección permanente a las rutas canónicas |

Requisitos:

- El `<title>` de la homepage y el H1 visible deben ser exactamente **Reelpath**.
- Títulos de páginas legales: **Reelpath Privacy Policy** y **Reelpath Terms of Service**.
- Los documentos legales mencionan **Reelpath** y cubren integración YouTube (OAuth, publicación de vídeos y Shorts).
- Los enlaces del footer (homepage, login, registro) deben apuntar a `/privacy-policy` y `/terms-of-service`.
