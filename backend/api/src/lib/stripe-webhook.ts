import crypto from 'node:crypto';
import { prisma } from '@autotube/database';
import type { PlanLimits } from './plan-limits.js';
import {
  claimWebhookEvent,
  isPaidPlanId,
  mapStripeSubscriptionStatus,
  resolvePlanIdFromPrice,
  type BillingStatus,
  type PaidPlanId,
} from './billing-stripe.js';

type StripeEvent = {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
};

export function verifyStripeSignature(payload: Buffer, signatureHeader: string, secret: string): boolean {
  const parts = signatureHeader.split(',').map((p) => p.trim());
  const timestamp = parts.find((p) => p.startsWith('t='))?.slice(2);
  const signature = parts.find((p) => p.startsWith('v1='))?.slice(3);
  if (!timestamp || !signature) return false;

  const signedPayload = `${timestamp}.${payload.toString('utf8')}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

function parseStripeEvent(payload: Buffer): StripeEvent {
  return JSON.parse(payload.toString('utf8')) as StripeEvent;
}

function readMetadata(obj: Record<string, unknown>): { organizationId?: string; planId?: string } {
  const metadata = obj.metadata;
  if (!metadata || typeof metadata !== 'object') return {};
  const m = metadata as Record<string, unknown>;
  return {
    organizationId: typeof m.organizationId === 'string' ? m.organizationId : undefined,
    planId: typeof m.planId === 'string' ? m.planId : undefined,
  };
}

function coerceLimits(value: unknown): PlanLimits {
  if (value && typeof value === 'object') return value as PlanLimits;
  return {};
}

function readPeriodEnd(obj: Record<string, unknown>): Date | undefined {
  const end = obj.current_period_end;
  if (typeof end === 'number') return new Date(end * 1000);
  return undefined;
}

async function applyPaidPlan(
  orgId: string,
  planId: PaidPlanId,
  options?: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    billingStatus?: BillingStatus;
    subscriptionRenewsAt?: Date;
  },
) {
  const plan = await prisma.planDefinition.findUnique({ where: { id: planId } });
  if (!plan) {
    console.warn(`[stripe-webhook] Plan ${planId} no encontrado para org ${orgId}`);
    return;
  }

  await prisma.organization.update({
    where: { id: orgId },
    data: {
      plan: planId,
      planLimits: coerceLimits(plan.limits) as object,
      trialEndsAt: null,
      billingStatus: options?.billingStatus ?? 'active',
      ...(options?.subscriptionRenewsAt ? { subscriptionRenewsAt: options.subscriptionRenewsAt } : {}),
      ...(options?.stripeCustomerId ? { stripeCustomerId: options.stripeCustomerId } : {}),
      ...(options?.stripeSubscriptionId ? { stripeSubscriptionId: options.stripeSubscriptionId } : {}),
    },
  });
}

async function downgradeOrg(orgId: string) {
  const trialPlan = await prisma.planDefinition.findUnique({ where: { id: 'trial' } });
  await prisma.organization.update({
    where: { id: orgId },
    data: {
      plan: 'trial',
      planLimits: trialPlan ? (coerceLimits(trialPlan.limits) as object) : undefined,
      stripeSubscriptionId: null,
      billingStatus: 'canceled',
      subscriptionRenewsAt: null,
      trialEndsAt: new Date(),
    },
  });
}

async function findOrgByStripeIds(customerId?: string, subscriptionId?: string) {
  if (subscriptionId) {
    const bySub = await prisma.organization.findFirst({ where: { stripeSubscriptionId: subscriptionId } });
    if (bySub) return bySub;
  }
  if (customerId) {
    return prisma.organization.findFirst({ where: { stripeCustomerId: customerId } });
  }
  return null;
}

async function handleCheckoutCompleted(session: Record<string, unknown>) {
  const { organizationId, planId } = readMetadata(session);
  if (!organizationId || !planId || !isPaidPlanId(planId)) {
    console.warn('[stripe-webhook] checkout.session.completed sin metadata válida');
    return;
  }

  const customerId = typeof session.customer === 'string' ? session.customer : undefined;
  const subscriptionId = typeof session.subscription === 'string' ? session.subscription : undefined;

  const org = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!org) {
    console.warn(`[stripe-webhook] Org ${organizationId} no encontrada`);
    return;
  }

  if (
    org.stripeSubscriptionId === subscriptionId &&
    org.plan === planId &&
    org.stripeCustomerId === customerId
  ) {
    return;
  }

  await applyPaidPlan(organizationId, planId, {
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    billingStatus: 'active',
  });
}

async function handleSubscriptionUpdated(subscription: Record<string, unknown>) {
  const status = typeof subscription.status === 'string' ? subscription.status : '';
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : undefined;
  const subscriptionId = typeof subscription.id === 'string' ? subscription.id : undefined;
  const { organizationId: metaOrgId, planId: metaPlanId } = readMetadata(subscription);
  const billingStatus = mapStripeSubscriptionStatus(status);
  const subscriptionRenewsAt = readPeriodEnd(subscription);

  let orgId = metaOrgId;
  if (!orgId) {
    const org = await findOrgByStripeIds(customerId, subscriptionId);
    orgId = org?.id;
  }
  if (!orgId) {
    console.warn('[stripe-webhook] subscription.updated sin org asociada');
    return;
  }

  if (status === 'canceled' || status === 'unpaid' || status === 'incomplete_expired') {
    await downgradeOrg(orgId);
    return;
  }

  if (status === 'past_due') {
    await prisma.organization.update({
      where: { id: orgId },
      data: {
        billingStatus: 'past_due',
        ...(subscriptionRenewsAt ? { subscriptionRenewsAt } : {}),
      },
    });
    const { notifyPaymentFailed } = await import('./billing-email.js');
    void notifyPaymentFailed(orgId);
    return;
  }

  if (status !== 'active' && status !== 'trialing') return;

  let planId = isPaidPlanId(metaPlanId) ? metaPlanId : null;
  if (!planId) {
    const items = subscription.items as { data?: Array<{ price?: { id?: string } }> } | undefined;
    const priceId = items?.data?.[0]?.price?.id;
    planId = await resolvePlanIdFromPrice(priceId);
  }
  if (!planId) return;

  await applyPaidPlan(orgId, planId, {
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    billingStatus: billingStatus ?? 'active',
    subscriptionRenewsAt,
  });
}

async function handleSubscriptionDeleted(subscription: Record<string, unknown>) {
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : undefined;
  const subscriptionId = typeof subscription.id === 'string' ? subscription.id : undefined;
  const { organizationId: metaOrgId } = readMetadata(subscription);

  let orgId = metaOrgId;
  if (!orgId) {
    const org = await findOrgByStripeIds(customerId, subscriptionId);
    orgId = org?.id;
  }
  if (!orgId) return;

  await downgradeOrg(orgId);
}

async function handleInvoicePaymentFailed(invoice: Record<string, unknown>) {
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : undefined;
  const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : undefined;
  const org = await findOrgByStripeIds(customerId, subscriptionId);
  if (!org) return;

  await prisma.organization.update({
    where: { id: org.id },
    data: { billingStatus: 'past_due' },
  });

  const { notifyPaymentFailed } = await import('./billing-email.js');
  void notifyPaymentFailed(org.id);

  console.warn(
    JSON.stringify({
      event: 'invoice.payment_failed',
      orgId: org.id,
      customerId,
      subscriptionId,
      billingStatus: 'past_due',
    }),
  );
}

async function dispatchStripeEvent(event: StripeEvent): Promise<void> {
  const obj = event.data.object;

  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(obj);
      break;
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(obj);
      break;
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(obj);
      break;
    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(obj);
      break;
    default:
      break;
  }
}

export async function handleStripeWebhook(
  payload: Buffer,
  signatureHeader: string | undefined,
  deps?: {
    webhookSecret?: string;
    claimEvent?: (eventId: string) => Promise<boolean>;
  },
): Promise<void> {
  const webhookSecret = deps?.webhookSecret;
  if (!webhookSecret) {
    const { loadConfig } = await import('@autotube/config');
    const config = loadConfig();
    if (!config.STRIPE_WEBHOOK_SECRET) {
      throw new Error('STRIPE_WEBHOOK_SECRET no configurado');
    }
    return handleStripeWebhook(payload, signatureHeader, {
      ...deps,
      webhookSecret: config.STRIPE_WEBHOOK_SECRET,
    });
  }

  if (!signatureHeader || !verifyStripeSignature(payload, signatureHeader, webhookSecret)) {
    throw new Error('Firma de webhook inválida');
  }

  const event = parseStripeEvent(payload);
  const claim = deps?.claimEvent ?? ((eventId: string) => claimWebhookEvent(eventId));
  const isNew = await claim(event.id);
  if (!isNew) {
    console.info(`[stripe-webhook] Evento ${event.id} ya procesado, omitiendo`);
    return;
  }

  await dispatchStripeEvent(event);
}
