import { Router } from 'express';
import { z } from 'zod';
import { loadConfig } from '@autotube/config';
import { prisma } from '@autotube/database';
import {
  createBillingPortalSession,
  createCheckoutSession,
  fetchStripeSubscription,
  isActiveStripeSubscription,
  resolvePlanChangeAction,
  resolveStripePriceId,
  stripeNotConfiguredResponse,
  updateStripeSubscriptionPlan,
} from '../lib/billing-stripe.js';
import { authMiddleware, orgScope, requireAdmin } from '../middleware/auth.js';

export const billingRouter = Router();

billingRouter.use(authMiddleware);

billingRouter.get('/plans', async (_req, res) => {
  const plans = await prisma.planDefinition.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
  res.json(plans);
});

const planIdSchema = z.object({
  planId: z.enum(['starter', 'pro', 'unlimited']),
});

async function loadOrgAndPlan(orgId: string, planId: string) {
  const [org, plan] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId } }),
    prisma.planDefinition.findUnique({ where: { id: planId } }),
  ]);
  return { org, plan };
}

async function resolveActiveSubscription(org: {
  stripeSubscriptionId: string | null;
}) {
  if (!org.stripeSubscriptionId) {
    return { hasActiveSubscription: false, subscription: null };
  }
  const subscription = await fetchStripeSubscription(org.stripeSubscriptionId);
  return {
    hasActiveSubscription: isActiveStripeSubscription(subscription),
    subscription,
  };
}

billingRouter.post('/portal', requireAdmin, async (req, res) => {
  const config = loadConfig();
  const orgId = orgScope(req);
  if (!orgId) {
    return res.status(400).json({ error: 'Se requiere autenticación' });
  }

  if (!config.STRIPE_SECRET_KEY) {
    return res.status(503).json(stripeNotConfiguredResponse());
  }

  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) {
    return res.status(404).json({ error: 'Organización no encontrada' });
  }

  if (!org.stripeCustomerId) {
    return res.status(400).json({
      error: 'No hay cliente de Stripe asociado a tu organización',
      hint: 'Completa un checkout de suscripción antes de gestionar la facturación.',
    });
  }

  const portal = await createBillingPortalSession(org.stripeCustomerId);
  if (!portal.ok) {
    return res.status(portal.status).json({ error: 'Error al abrir el portal de facturación', detail: portal.detail });
  }

  res.json({ url: portal.url });
});

billingRouter.post('/change-plan', requireAdmin, async (req, res) => {
  const config = loadConfig();
  const orgId = orgScope(req);
  if (!orgId) {
    return res.status(400).json({ error: 'Se requiere autenticación' });
  }

  const body = planIdSchema.parse(req.body);
  const { org, plan } = await loadOrgAndPlan(orgId, body.planId);
  if (!org) {
    return res.status(404).json({ error: 'Organización no encontrada' });
  }
  if (!plan) {
    return res.status(404).json({ error: 'Plan no encontrado' });
  }

  if (!config.STRIPE_SECRET_KEY) {
    return res.status(503).json({
      ...stripeNotConfiguredResponse(),
      plan: { id: plan.id, name: plan.name, limits: plan.limits },
    });
  }

  const stripePriceId = resolveStripePriceId(config, body.planId, plan.stripePriceId);
  if (!stripePriceId) {
    return res.status(400).json({
      error: `Falta price ID de Stripe para el plan ${body.planId}`,
      hint: `Define STRIPE_PRICE_${body.planId.toUpperCase()} en .env`,
    });
  }

  const { hasActiveSubscription } = await resolveActiveSubscription(org);
  const action = resolvePlanChangeAction({
    hasActiveSubscription,
    currentPlanId: org.plan,
    targetPlanId: body.planId,
    stripeSubscriptionId: org.stripeSubscriptionId,
    targetPriceId: stripePriceId,
  });

  if (action.action === 'same_plan') {
    return res.status(409).json({ error: action.message });
  }

  if (action.action === 'change_plan') {
    const updated = await updateStripeSubscriptionPlan({
      subscriptionId: action.subscriptionId,
      newPriceId: action.newPriceId,
      organizationId: orgId,
      planId: body.planId,
    });
    if (!updated.ok) {
      return res.status(updated.status).json({ error: 'No se pudo cambiar el plan', detail: updated.detail });
    }

    const targetPlan = await prisma.planDefinition.findUnique({ where: { id: body.planId } });
    if (targetPlan) {
      await prisma.organization.update({
        where: { id: orgId },
        data: {
          plan: body.planId,
          planLimits: targetPlan.limits as object,
          billingStatus: 'active',
        },
      });
    }

    return res.json({ updated: true, planId: body.planId });
  }

  const checkout = await createCheckoutSession({
    orgId,
    planId: body.planId,
    stripePriceId: action.priceId,
    customerId: org.stripeCustomerId,
    customerEmail: req.auth!.email,
  });
  if (!checkout.ok) {
    return res.status(checkout.status).json({ error: 'Error al crear sesión de Stripe', detail: checkout.detail });
  }

  res.json({ sessionId: checkout.sessionId, url: checkout.url });
});

billingRouter.post('/checkout', requireAdmin, async (req, res) => {
  const config = loadConfig();
  const orgId = orgScope(req);
  if (!orgId) {
    return res.status(400).json({ error: 'Se requiere autenticación' });
  }

  const body = planIdSchema.parse(req.body);
  const { org, plan } = await loadOrgAndPlan(orgId, body.planId);
  if (!org) {
    return res.status(404).json({ error: 'Organización no encontrada' });
  }
  if (!plan) {
    return res.status(404).json({ error: 'Plan no encontrado' });
  }

  if (!config.STRIPE_SECRET_KEY) {
    return res.status(503).json({
      ...stripeNotConfiguredResponse(),
      plan: { id: plan.id, name: plan.name, limits: plan.limits },
    });
  }

  const stripePriceId = resolveStripePriceId(config, body.planId, plan.stripePriceId);
  if (!stripePriceId) {
    return res.status(400).json({
      error: `Falta price ID de Stripe para el plan ${body.planId}`,
      hint: `Define STRIPE_PRICE_${body.planId.toUpperCase()} en .env`,
    });
  }

  const { hasActiveSubscription } = await resolveActiveSubscription(org);
  const action = resolvePlanChangeAction({
    hasActiveSubscription,
    currentPlanId: org.plan,
    targetPlanId: body.planId,
    stripeSubscriptionId: org.stripeSubscriptionId,
    targetPriceId: stripePriceId,
  });

  if (action.action === 'same_plan') {
    return res.status(409).json({ error: action.message });
  }

  if (action.action === 'change_plan') {
    return res.status(409).json({
      error: 'Ya tienes una suscripción activa',
      hint: 'Usa el cambio de plan en lugar de crear un nuevo checkout.',
      useChangePlan: true,
    });
  }

  const checkout = await createCheckoutSession({
    orgId,
    planId: body.planId,
    stripePriceId,
    customerId: org.stripeCustomerId,
    customerEmail: req.auth!.email,
  });
  if (!checkout.ok) {
    return res.status(checkout.status).json({ error: 'Error al crear sesión de Stripe', detail: checkout.detail });
  }

  res.json({ sessionId: checkout.sessionId, url: checkout.url });
});

billingRouter.get('/subscription', requireAdmin, async (req, res) => {
  const config = loadConfig();
  const orgId = orgScope(req);
  if (!orgId) {
    return res.status(400).json({ error: 'Se requiere autenticación' });
  }

  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) {
    return res.status(404).json({ error: 'Organización no encontrada' });
  }

  if (!org.stripeSubscriptionId || !config.STRIPE_SECRET_KEY) {
    return res.json({
      hasSubscription: false,
      plan: org.plan,
      billingStatus: org.billingStatus,
      renewsAt: org.subscriptionRenewsAt?.toISOString() ?? null,
    });
  }

  const subscription = await fetchStripeSubscription(org.stripeSubscriptionId);
  const renewsAt =
    subscription?.current_period_end != null
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : org.subscriptionRenewsAt?.toISOString() ?? null;

  res.json({
    hasSubscription: isActiveStripeSubscription(subscription),
    plan: org.plan,
    billingStatus: org.billingStatus,
    stripeStatus: subscription?.status ?? null,
    renewsAt,
  });
});
