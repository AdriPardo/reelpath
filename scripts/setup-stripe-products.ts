/**
 * Crea productos y precios de suscripción mensual en Stripe (test mode).
 *
 * Uso:
 *   1. Añade STRIPE_SECRET_KEY=sk_test_... a .env
 *   2. npm run stripe:setup
 *   3. Copia las variables que imprime el script a .env
 */

const REELPATH_PLANS = [
  {
    planId: 'starter',
    productName: 'Reelpath Creator',
    description: 'Hasta 8 vídeos/mes — plan Creator',
    amountCents: 7900,
    envKey: 'STRIPE_PRICE_STARTER',
  },
  {
    planId: 'pro',
    productName: 'Reelpath Pro',
    description: 'Hasta 16 vídeos/mes — plan Pro',
    amountCents: 14900,
    envKey: 'STRIPE_PRICE_PRO',
  },
  {
    planId: 'unlimited',
    productName: 'Reelpath Studio',
    description: 'Vídeos y canales ilimitados — plan Studio',
    amountCents: 39900,
    envKey: 'STRIPE_PRICE_UNLIMITED',
  },
] as const;

type StripeList<T> = { data: T[] };
type StripeProduct = { id: string; name: string; metadata?: Record<string, string> };
type StripePrice = {
  id: string;
  unit_amount: number;
  currency: string;
  recurring?: { interval: string };
  active: boolean;
  product: string;
};

async function stripeRequest<T>(
  secretKey: string,
  path: string,
  method: 'GET' | 'POST',
  body?: URLSearchParams,
): Promise<T> {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    ...(body ? { body: body.toString() } : {}),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Stripe ${method} ${path} → ${res.status}: ${text}`);
  }
  return JSON.parse(text) as T;
}

async function findProductByPlanId(secretKey: string, planId: string): Promise<StripeProduct | null> {
  const list = await stripeRequest<StripeList<StripeProduct>>(
    secretKey,
    '/products?limit=100&active=true',
    'GET',
  );
  return list.data.find((p) => p.metadata?.reelpath_plan_id === planId) ?? null;
}

async function findMatchingPrice(
  secretKey: string,
  productId: string,
  amountCents: number,
): Promise<StripePrice | null> {
  const list = await stripeRequest<StripeList<StripePrice>>(
    secretKey,
    `/prices?product=${productId}&active=true&limit=20`,
    'GET',
  );
  return (
    list.data.find(
      (p) =>
        p.unit_amount === amountCents &&
        p.currency === 'eur' &&
        p.recurring?.interval === 'month' &&
        p.active,
    ) ?? null
  );
}

async function createProduct(
  secretKey: string,
  plan: (typeof REELPATH_PLANS)[number],
): Promise<StripeProduct> {
  const body = new URLSearchParams({
    name: plan.productName,
    description: plan.description,
    'metadata[reelpath_plan_id]': plan.planId,
    'metadata[app]': 'reelpath',
  });
  return stripeRequest<StripeProduct>(secretKey, '/products', 'POST', body);
}

async function createPrice(
  secretKey: string,
  productId: string,
  amountCents: number,
  planId: string,
): Promise<StripePrice> {
  const body = new URLSearchParams({
    product: productId,
    currency: 'eur',
    unit_amount: String(amountCents),
    'recurring[interval]': 'month',
    'metadata[reelpath_plan_id]': planId,
  });
  return stripeRequest<StripePrice>(secretKey, '/prices', 'POST', body);
}

async function main() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    console.error('❌ Falta STRIPE_SECRET_KEY en .env');
    console.error('   Obtén una clave de test en https://dashboard.stripe.com/test/apikeys');
    process.exit(1);
  }

  if (!secretKey.startsWith('sk_test_')) {
    console.warn('⚠️  La clave no empieza por sk_test_. ¿Seguro que es modo test?');
  }

  // Claves restringidas no tienen accounts_kyc_basic_read; un listado mínimo de precios basta.
  await stripeRequest<StripeList<StripePrice>>(secretKey, '/prices?limit=1', 'GET');
  console.log('✅ Conectado a Stripe (API accesible)\n');

  const priceIds: Record<string, string> = {};

  for (const plan of REELPATH_PLANS) {
    let product = await findProductByPlanId(secretKey, plan.planId);
    if (product) {
      console.log(`📦 Producto existente: ${product.name} (${product.id})`);
    } else {
      product = await createProduct(secretKey, plan);
      console.log(`✨ Producto creado: ${product.name} (${product.id})`);
    }

    let price = await findMatchingPrice(secretKey, product.id, plan.amountCents);
    if (price) {
      console.log(`💶 Precio existente: ${price.id} (${plan.amountCents / 100} EUR/mes)`);
    } else {
      price = await createPrice(secretKey, product.id, plan.amountCents, plan.planId);
      console.log(`✨ Precio creado: ${price.id} (${plan.amountCents / 100} EUR/mes)`);
    }

    priceIds[plan.envKey] = price.id;
  }

  console.log('\n── Copia estas líneas a tu .env ──\n');
  console.log(`STRIPE_SECRET_KEY=${secretKey}`);
  console.log('STRIPE_WEBHOOK_SECRET=whsec_...  # stripe listen --forward-to localhost:4000/api/billing/webhook');
  for (const plan of REELPATH_PLANS) {
    console.log(`${plan.envKey}=${priceIds[plan.envKey]}`);
  }
  console.log('STRIPE_TAX_ENABLED=false');
  console.log(`FRONTEND_URL=${process.env.FRONTEND_URL ?? 'http://localhost:3000'}`);
  console.log('\n── Siguiente paso ──\n');
  console.log('npm run stripe:verify');
  console.log('stripe listen --forward-to localhost:4000/api/billing/webhook');
}

main().catch((err) => {
  console.error('Error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
