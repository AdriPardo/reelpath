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

Para YouTube, solo se persiste el **refresh token por canal**; `YOUTUBE_CLIENT_ID` y `YOUTUBE_CLIENT_SECRET` son credenciales de la app OAuth a nivel plataforma (`.env` del servidor).

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

### Variables de plataforma (YouTube OAuth)

| Variable | Obligatoria | Descripción |
|----------|-------------|-------------|
| `YOUTUBE_CLIENT_ID` | Sí (para OAuth) | Client ID de la app Google Cloud |
| `YOUTUBE_CLIENT_SECRET` | Sí (para OAuth) | Client secret |
| `YOUTUBE_OAUTH_REDIRECT_URI` | No | Default: `http://localhost:4000/api/integrations/youtube/callback` |
| `YOUTUBE_REFRESH_TOKEN` | No | Solo fallback dev; los usuarios conectan por canal en la UI |

Registrar en Google Cloud → URIs de redirección autorizados: la URI anterior (y la de producción).

## Roadmap

- Rotación y cifrado de tokens en reposo
- BYOK de OpenAI/ElevenLabs a nivel organización

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

## Configuración: `.env` vs base de datos

Al vender el servicio, no todo debe vivir en `.env`. Regla práctica:

| Qué | Dónde | Motivo |
|-----|--------|--------|
| `DATABASE_URL`, `REDIS_URL`, `STORAGE_PATH` | **`.env` del servidor** | Infraestructura de la instancia Reelpath |
| `AUTH_SECRET`, `AUTH_REQUIRED` | **`.env` del servidor** | Seguridad de la plataforma |
| `FRONTEND_URL`, `API_PORT` | **`.env` del servidor** | Despliegue |
| YouTube OAuth (tokens) | **BD** (`IntegrationCredential`, por org o canal) | Cada cliente publica en su cuenta |
| OpenAI / ElevenLabs API keys | **BD por organización** (BYOK) o `.env` si la plataforma paga | Facturación y aislamiento |
| `Channel.config` (formato, review, Shorts YouTube…) | **BD** (`Channel.config` JSON) | Ya está; preferencias por canal |
| Defaults globales (`DEFAULT_REVIEW_REQUIRED`, límites) | **`.env` o tabla `Organization.settings`** | Fallback de plataforma vs plan del cliente |
| `MOCK_EXTERNAL_APIS` | **`.env`** | Solo desarrollo |

**Hoy (fase 2):** la UI y API gestionan integraciones por canal en BD; workers siguen usando `.env` como fallback hasta Fase 3.

**Objetivo al vender:** el operador de Reelpath solo configura infra en `.env`; cada cliente conecta YouTube desde la UI y opcionalmente sus propias API keys de IA.

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
