/**
 * Verifica que las variables de Stripe estén presentes y que los price IDs sean válidos.
 *
 * Uso: npm run stripe:verify
 */

const REQUIRED_VARS = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_STARTER',
  'STRIPE_PRICE_PRO',
  'STRIPE_PRICE_UNLIMITED',
] as const;

const EXPECTED_PRICES: Record<string, { planId: string; name: string; amountCents: number }> = {
  STRIPE_PRICE_STARTER: { planId: 'starter', name: 'Creator', amountCents: 7900 },
  STRIPE_PRICE_PRO: { planId: 'pro', name: 'Pro', amountCents: 14900 },
  STRIPE_PRICE_UNLIMITED: { planId: 'unlimited', name: 'Studio', amountCents: 39900 },
};

type StripePrice = {
  id: string;
  active: boolean;
  unit_amount: number | null;
  currency: string;
  recurring?: { interval: string } | null;
  product: string | { id: string; name?: string };
};

async function stripeGet<T>(secretKey: string, path: string): Promise<T> {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${path} → ${res.status}: ${text}`);
  }
  return JSON.parse(text) as T;
}

function ok(msg: string) {
  console.log(`✅ ${msg}`);
}

function warn(msg: string) {
  console.log(`⚠️  ${msg}`);
}

function fail(msg: string) {
  console.log(`❌ ${msg}`);
}

async function main() {
  let errors = 0;

  console.log('Verificando configuración de Stripe para Reelpath\n');

  for (const key of REQUIRED_VARS) {
    const value = process.env[key];
    if (!value?.trim()) {
      fail(`${key} no definido`);
      errors++;
    } else {
      ok(`${key} presente`);
    }
  }

  const frontendUrl = process.env.FRONTEND_URL;
  if (!frontendUrl) {
    warn('FRONTEND_URL no definido (default en código: http://localhost:3000)');
  } else {
    ok(`FRONTEND_URL=${frontendUrl}`);
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    console.log('\nCorrige las variables faltantes y vuelve a ejecutar.');
    process.exit(1);
  }

  if (!secretKey.startsWith('sk_test_')) {
    warn('STRIPE_SECRET_KEY no es sk_test_ — parece modo live');
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? '';
  if (webhookSecret && !webhookSecret.startsWith('whsec_')) {
    warn('STRIPE_WEBHOOK_SECRET no empieza por whsec_');
  }

  // Claves restringidas no tienen accounts_kyc_basic_read; validamos conectividad vía precios.
  try {
    await stripeGet<{ data: unknown[] }>(secretKey, '/prices?limit=1');
    ok('API Stripe accesible');
  } catch (err) {
    fail(`No se pudo conectar a Stripe: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }

  console.log('\nValidando price IDs:\n');

  for (const [envKey, expected] of Object.entries(EXPECTED_PRICES)) {
    const priceId = process.env[envKey];
    if (!priceId) continue;

    try {
      const price = await stripeGet<StripePrice>(secretKey, `/prices/${priceId}`);
      if (!price.active) {
        fail(`${envKey} (${priceId}) está inactivo en Stripe`);
        errors++;
        continue;
      }
      if (price.currency !== 'eur') {
        warn(`${envKey}: moneda ${price.currency}, se esperaba eur`);
      }
      if (price.recurring?.interval !== 'month') {
        warn(`${envKey}: intervalo ${price.recurring?.interval ?? 'n/a'}, se esperaba month`);
      }
      if (price.unit_amount !== expected.amountCents) {
        warn(
          `${envKey} (${expected.name}): ${(price.unit_amount ?? 0) / 100} EUR/mes, se esperaban ${expected.amountCents / 100} EUR/mes`,
        );
      } else {
        ok(`${envKey} → ${priceId} (${expected.name}, ${expected.amountCents / 100} EUR/mes)`);
      }
    } catch (err) {
      fail(`${envKey} (${priceId}): ${err instanceof Error ? err.message : err}`);
      errors++;
    }
  }

  console.log('\n── Checklist manual (Dashboard) ──\n');
  console.log('□ Customer Portal activado: Settings → Billing → Customer portal');
  console.log('□ Webhook endpoint (producción): POST /api/billing/webhook');
  console.log('  Eventos: checkout.session.completed, customer.subscription.updated,');
  console.log('           customer.subscription.deleted, invoice.payment_failed');
  console.log('□ (Opcional) Stripe Tax si STRIPE_TAX_ENABLED=true');

  console.log('\n── Prueba local ──\n');
  console.log('stripe listen --forward-to localhost:4000/api/billing/webhook');
  console.log('Luego inicia sesión como admin → Ajustes → elegir plan → Checkout');

  if (errors > 0) {
    console.log(`\n❌ ${errors} error(es). Ejecuta: npm run stripe:setup`);
    process.exit(1);
  }

  console.log('\n✅ Configuración de Stripe lista para pruebas.');
}

main().catch((err) => {
  console.error('Error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
