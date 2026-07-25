import { loadConfig, type AppConfig } from '@autotube/config';
import { prisma } from '@autotube/database';

export const PAID_PLAN_IDS = ['starter', 'pro', 'unlimited'] as const;
export type PaidPlanId = (typeof PAID_PLAN_IDS)[number];
export type BillingStatus = 'active' | 'past_due' | 'canceled';

export type PlanChangeAction =
  | { action: 'same_plan'; message: string }
  | { action: 'change_plan'; subscriptionId: string; newPriceId: string }
  | { action: 'checkout'; priceId: string };

export function isPaidPlanId(planId: string | undefined): planId is PaidPlanId {
  return !!planId && (PAID_PLAN_IDS as readonly string[]).includes(planId);
}

export function resolvePlanChangeAction(params: {
  hasActiveSubscription: boolean;
  currentPlanId: string;
  targetPlanId: PaidPlanId;
  stripeSubscriptionId?: string | null;
  targetPriceId: string;
}): PlanChangeAction {
  if (params.hasActiveSubscription) {
    if (params.currentPlanId === params.targetPlanId) {
      return { action: 'same_plan', message: 'Ya tienes este plan' };
    }
    if (!params.stripeSubscriptionId) {
      return { action: 'checkout', priceId: params.targetPriceId };
    }
    return {
      action: 'change_plan',
      subscriptionId: params.stripeSubscriptionId,
      newPriceId: params.targetPriceId,
    };
  }
  return { action: 'checkout', priceId: params.targetPriceId };
}

export function mapStripeSubscriptionStatus(status: string): BillingStatus | null {
  if (status === 'active' || status === 'trialing') return 'active';
  if (status === 'past_due') return 'past_due';
  if (status === 'canceled' || status === 'unpaid' || status === 'incomplete_expired') {
    return 'canceled';
  }
  return null;
}

export function stripeNotConfiguredResponse() {
  return {
    error: 'Stripe no configurado',
    hint: 'Define STRIPE_SECRET_KEY, STRIPE_PRICE_* y STRIPE_WEBHOOK_SECRET en .env. Ver docs/BILLING.md',
  };
}

export async function stripeRequest<T>(
  path: string,
  params: URLSearchParams | null,
  method: 'GET' | 'POST' = 'POST',
): Promise<{ ok: true; data: T } | { ok: false; status: number; detail: string }> {
  const config = loadConfig();
  if (!config.STRIPE_SECRET_KEY) {
    return { ok: false, status: 503, detail: 'STRIPE_SECRET_KEY no configurado' };
  }

  const url = `https://api.stripe.com/v1${path}`;
  const stripeRes = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${config.STRIPE_SECRET_KEY}`,
      ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    ...(method === 'POST' && params ? { body: params.toString() } : {}),
  });

  const text = await stripeRes.text();
  if (!stripeRes.ok) {
    return { ok: false, status: stripeRes.status, detail: text };
  }

  return { ok: true, data: JSON.parse(text) as T };
}

export function resolveStripePriceId(
  config: AppConfig,
  planId: PaidPlanId,
  planStripePriceId?: string | null,
): string | undefined {
  const priceEnvKey = `STRIPE_PRICE_${planId.toUpperCase()}` as keyof AppConfig;
  return (config[priceEnvKey] as string | undefined) ?? planStripePriceId ?? undefined;
}

export async function resolvePlanIdFromPrice(priceId: string | undefined): Promise<PaidPlanId | null> {
  if (!priceId) return null;
  const config = loadConfig();
  const envMap: Record<PaidPlanId, string | undefined> = {
    starter: config.STRIPE_PRICE_STARTER,
    pro: config.STRIPE_PRICE_PRO,
    unlimited: config.STRIPE_PRICE_UNLIMITED,
  };
  for (const planId of PAID_PLAN_IDS) {
    if (envMap[planId] === priceId) return planId;
  }
  const plan = await prisma.planDefinition.findFirst({
    where: { stripePriceId: priceId, isActive: true },
    select: { id: true },
  });
  if (plan && isPaidPlanId(plan.id)) return plan.id;
  return null;
}

type StripeSubscription = {
  id: string;
  status: string;
  customer: string;
  current_period_end?: number;
  items?: { data?: Array<{ id: string; price?: { id?: string } }> };
  metadata?: Record<string, string>;
};

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing']);

export async function fetchStripeSubscription(
  subscriptionId: string,
): Promise<StripeSubscription | null> {
  const result = await stripeRequest<StripeSubscription>(
    `/subscriptions/${subscriptionId}`,
    null,
    'GET',
  );
  if (!result.ok) return null;
  return result.data;
}

export function isActiveStripeSubscription(subscription: StripeSubscription | null): boolean {
  return !!subscription && ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status);
}

export async function updateStripeSubscriptionPlan(params: {
  subscriptionId: string;
  newPriceId: string;
  organizationId: string;
  planId: PaidPlanId;
}): Promise<{ ok: true } | { ok: false; status: number; detail: string }> {
  const subscription = await fetchStripeSubscription(params.subscriptionId);
  if (!subscription) {
    return { ok: false, status: 404, detail: 'Suscripción no encontrada en Stripe' };
  }

  const itemId = subscription.items?.data?.[0]?.id;
  if (!itemId) {
    return { ok: false, status: 502, detail: 'La suscripción no tiene items de facturación' };
  }

  const body = new URLSearchParams({
    'items[0][id]': itemId,
    'items[0][price]': params.newPriceId,
    proration_behavior: 'create_prorations',
    'metadata[organizationId]': params.organizationId,
    'metadata[planId]': params.planId,
  });

  const result = await stripeRequest<StripeSubscription>(
    `/subscriptions/${params.subscriptionId}`,
    body,
  );
  if (!result.ok) {
    return { ok: false, status: 502, detail: result.detail };
  }
  return { ok: true };
}

export function appendCheckoutTaxParams(params: URLSearchParams, config: AppConfig): void {
  if (config.STRIPE_TAX_ENABLED) {
    params.set('automatic_tax[enabled]', 'true');
    params.set('tax_id_collection[enabled]', 'true');
  }
}

export async function createCheckoutSession(params: {
  orgId: string;
  planId: PaidPlanId;
  stripePriceId: string;
  customerId?: string | null;
  customerEmail?: string;
}): Promise<{ ok: true; sessionId: string; url: string } | { ok: false; status: number; detail: string }> {
  const config = loadConfig();
  const body = new URLSearchParams({
    mode: 'subscription',
    'line_items[0][price]': params.stripePriceId,
    'line_items[0][quantity]': '1',
    success_url: `${config.FRONTEND_URL}/settings?billing=success`,
    cancel_url: `${config.FRONTEND_URL}/settings?billing=cancel`,
    'metadata[organizationId]': params.orgId,
    'metadata[planId]': params.planId,
    'subscription_data[metadata][organizationId]': params.orgId,
    'subscription_data[metadata][planId]': params.planId,
  });

  if (params.customerId) {
    body.set('customer', params.customerId);
  } else if (params.customerEmail) {
    body.set('customer_email', params.customerEmail);
  }

  appendCheckoutTaxParams(body, config);

  const result = await stripeRequest<{ id: string; url: string }>(
    '/checkout/sessions',
    body,
  );
  if (!result.ok) {
    return { ok: false, status: 502, detail: result.detail };
  }
  return { ok: true, sessionId: result.data.id, url: result.data.url };
}

export async function createBillingPortalSession(
  customerId: string,
): Promise<{ ok: true; url: string } | { ok: false; status: number; detail: string }> {
  const config = loadConfig();
  const body = new URLSearchParams({
    customer: customerId,
    return_url: `${config.FRONTEND_URL}/settings?billing=portal`,
  });

  const result = await stripeRequest<{ url: string }>('/billing_portal/sessions', body);
  if (!result.ok) {
    return { ok: false, status: 502, detail: result.detail };
  }
  return { ok: true, url: result.data.url };
}

export type WebhookEventStore = {
  create(event: { data: { eventId: string } }): Promise<unknown>;
};

export async function claimWebhookEvent(
  eventId: string,
  store: WebhookEventStore = prisma.stripeWebhookEvent,
): Promise<boolean> {
  try {
    await store.create({ data: { eventId } });
    return true;
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === 'P2002') return false;
    throw err;
  }
}
