# Facturación y suscripciones (Stripe)

Reelpath usa planes por organización con límites configurables y Stripe Checkout para cobros.

## Pricing de lanzamiento

### Suscripción

- `Creator` (`starter` en DB/API): `79 EUR/mes` — hasta 8 vídeos/mes (~2 largos/semana)
- `Pro`: `149 EUR/mes` — hasta 16 vídeos/mes
- `Studio` (`unlimited` en DB/API): `399 EUR/mes` — sin límites

### Pago por vídeo suelto

Próximamente (no implementado en esta versión).

## Planes

| ID técnico | Nombre visible | Precio | Límites típicos |
|------------|----------------|--------|-----------------|
| `trial` | Prueba | `0 EUR` | 1 canal, 5 vídeos/mes, 2 generaciones/día, 14 días |
| `starter` | Creator | `79 EUR/mes` | 1 canal, 8 vídeos/mes, 2 generaciones/día |
| `pro` | Pro | `149 EUR/mes` | 3 canales, 16 vídeos/mes, 4 generaciones/día |
| `unlimited` | Studio | `399 EUR/mes` | Sin límites (canales y vídeos ilimitados) |

Los límites se almacenan en `PlanDefinition.limits` (JSON) y se copian a `Organization.planLimits` al activar un plan de pago.

## Variables de entorno

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_UNLIMITED=price_...

# Opcional: impuestos automáticos y recogida de NIF/CIF en Checkout
STRIPE_TAX_ENABLED=false
```

Opcionalmente define `stripePriceId` en cada fila de `PlanDefinition` (seed).

Con `STRIPE_TAX_ENABLED=true`, las sesiones de Checkout activan `automatic_tax` y `tax_id_collection`. Requiere configurar Stripe Tax en el Dashboard.

## API

- `GET /api/billing/plans` — lista planes activos (requiere auth)
- `POST /api/billing/checkout` — crea sesión Stripe Checkout si no hay suscripción activa (requiere admin)
- `POST /api/billing/change-plan` — cambia plan con prorrateo si ya hay suscripción activa; si no, redirige a Checkout (requiere admin)
- `POST /api/billing/portal` — abre el portal de cliente Stripe para gestionar suscripción y facturas (requiere admin y `stripeCustomerId`)
- `GET /api/billing/subscription` — estado de suscripción y próxima renovación (requiere admin)
- `POST /api/billing/webhook` — eventos Stripe (sin auth JWT; verificación por firma)

Body de checkout / change-plan:

```json
{ "planId": "starter" }
```

Respuesta checkout:

```json
{ "sessionId": "cs_...", "url": "https://checkout.stripe.com/..." }
```

Respuesta change-plan (suscripción existente):

```json
{ "updated": true, "planId": "pro" }
```

Respuesta portal:

```json
{ "url": "https://billing.stripe.com/..." }
```

### Cambio de plan seguro

- Si la organización ya tiene una suscripción activa en Stripe **al mismo plan** → `409` con mensaje «Ya tienes este plan».
- Si tiene suscripción activa **a otro plan** → `POST /api/billing/change-plan` actualiza la suscripción vía API (`proration_behavior: create_prorations`) sin crear un segundo Checkout.
- Si no hay suscripción activa → flujo Checkout habitual.

El endpoint `POST /api/billing/checkout` rechaza crear un segundo Checkout si ya hay suscripción activa (`useChangePlan: true` en la respuesta).

### Portal de cliente

Requiere `Organization.stripeCustomerId` (se guarda tras el primer checkout). Return URL: `{FRONTEND_URL}/settings?billing=portal`.

## Webhooks

Registra en Stripe Dashboard (o `stripe listen` en local):

```
POST https://tu-dominio/api/billing/webhook
```

Eventos manejados:

- `checkout.session.completed` — activa plan, guarda `stripeCustomerId` y `stripeSubscriptionId`
- `customer.subscription.updated` — sincroniza plan, `billingStatus`, `subscriptionRenewsAt` o downgrade si cancelado
- `customer.subscription.deleted` — vuelve a trial expirado
- `invoice.payment_failed` — marca `billingStatus: past_due` y log estructurado

### Idempotencia

Los eventos se registran en `StripeWebhookEvent` (`eventId` único). Si Stripe reenvía el mismo evento, se omite el procesamiento.

### Estado de facturación en la organización

| Campo | Valores | Uso |
|-------|---------|-----|
| `billingStatus` | `active`, `past_due`, `canceled` | Banner en dashboard/ajustes si `past_due` |
| `subscriptionRenewsAt` | fecha ISO | Próxima renovación en el panel de plan |

Desarrollo local:

```bash
stripe listen --forward-to localhost:4000/api/billing/webhook
```

Copia el `whsec_...` que imprime Stripe CLI a `STRIPE_WEBHOOK_SECRET`.

## Configuración inicial

### Opción A — Script automático (recomendado)

1. Obtén `STRIPE_SECRET_KEY=sk_test_...` en [API keys (test)](https://dashboard.stripe.com/test/apikeys).
2. Añádela a `.env` (variables Stripe comentadas en `.env.example`, sección billing).
3. Crea productos y precios:

```bash
npm run stripe:setup
```

El script crea (o reutiliza) tres productos recurrentes mensuales en EUR:

| Plan API | Producto Stripe | Precio |
|----------|-----------------|--------|
| `starter` | Reelpath Creator | 79 EUR/mes |
| `pro` | Reelpath Pro | 149 EUR/mes |
| `unlimited` | Reelpath Studio | 399 EUR/mes |

Cada producto lleva `metadata.reelpath_plan_id` para evitar duplicados al reejecutar.

4. Copia las variables que imprime el script a `.env`.
5. Verifica:

```bash
npm run stripe:verify
```

### Opción B — MCP de Stripe en Cursor

Si tienes el plugin/MCP `stripe` conectado en Cursor:

1. Autentica el servidor MCP (`mcp_auth` si el estado lo requiere).
2. Lista productos existentes con metadata `reelpath_plan_id`.
3. Crea los tres productos y precios mensuales EUR si no existen.
4. Pega los `price_...` en `.env`.

Si el MCP no tiene permisos de escritura, usa la opción A o el Dashboard manual.

### Opción C — Stripe Dashboard (manual)

1. Crea productos **Reelpath Creator** (79 EUR/mes), **Reelpath Pro** (149 EUR/mes) y **Reelpath Studio** (399 EUR/mes).
2. Tipo: suscripción recurrente mensual, moneda EUR.
3. Copia los Price IDs a `.env`:

```env
STRIPE_PRICE_STARTER=price_...   # Creator
STRIPE_PRICE_PRO=price_...       # Pro
STRIPE_PRICE_UNLIMITED=price_... # Studio
```

### Pasos comunes (todas las opciones)

1. **Webhook local** — instala [Stripe CLI](https://stripe.com/docs/stripe-cli) y ejecuta:

```bash
stripe listen --forward-to localhost:4000/api/billing/webhook
```

Copia el `whsec_...` a `STRIPE_WEBHOOK_SECRET`.

2. **Customer portal** — en Stripe → Settings → Billing → [Customer portal](https://dashboard.stripe.com/test/settings/billing/portal):
   - Activa el portal.
   - Permite cancelar y cambiar plan (recomendado).
   - Guarda cambios.

3. **Webhook en producción** — endpoint `POST https://tu-dominio/api/billing/webhook` con eventos:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`

4. (Opcional) Activa **Stripe Tax** si usas `STRIPE_TAX_ENABLED=true`.

Las URLs de éxito/cancelación las define el API con `FRONTEND_URL/settings?billing=...`.

## Enforcement de límites

La API aplica límites en:

- `POST /api/channels` — `maxChannels`
- `POST /api/pipelines/trigger` — `maxPipelinesPerDay`, `maxVideosPerMonth`, trial expirado
- `POST /api/videos/:id/approve` (y republicar) — trial expirado

Respuestas `402` (trial expirado) o `403` (límite alcanzado) con mensaje en español.

## Migración y seed

```bash
npm run db:migrate
npm run db:seed
```

La migración `20250713180000_stripe_billing_status` añade `billingStatus`, `subscriptionRenewsAt` y la tabla `StripeWebhookEvent`.

## Notas

- El plan `trial` se asigna automáticamente en `POST /api/auth/register`.
- Los IDs técnicos `starter` y `unlimited` se mantienen por compatibilidad; en producto se muestran como **Creator** y **Studio**.
- El marketing (`frontend/src/lib/pricing.ts`) usa los mismos IDs que la API.
- Tras `?billing=success` en ajustes, el frontend refresca la sesión y los planes automáticamente.
