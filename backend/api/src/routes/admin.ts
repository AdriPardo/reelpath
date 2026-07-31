import { Router } from 'express';
import { loadConfig } from '@autotube/config';
import { prisma } from '@autotube/database';
import { authMiddleware, requirePlatformAdmin } from '../middleware/auth.js';

export const adminRouter = Router();

adminRouter.use(authMiddleware);
adminRouter.use(requirePlatformAdmin);

function startOfUtcMonth(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}

function stripeCustomerUrl(customerId: string | null | undefined): string | null {
  if (!customerId) return null;
  const test = loadConfig().STRIPE_SECRET_KEY?.startsWith('sk_test_');
  const base = test
    ? 'https://dashboard.stripe.com/test/customers'
    : 'https://dashboard.stripe.com/customers';
  return `${base}/${customerId}`;
}

adminRouter.get('/overview', async (_req, res) => {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthStart = startOfUtcMonth(now);

  const [
    activeOrgs,
    totalUsers,
    pipelines24h,
    pipelines7d,
    pipelinesFailed24h,
    videosThisMonth,
    trialOrgs,
    paidOrgs,
    pastDueOrgs,
  ] = await Promise.all([
    prisma.organization.count({ where: { isActive: true } }),
    prisma.user.count(),
    prisma.pipelineRun.count({ where: { createdAt: { gte: dayAgo } } }),
    prisma.pipelineRun.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.pipelineRun.count({
      where: { createdAt: { gte: dayAgo }, status: 'failed' },
    }),
    prisma.video.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.organization.count({ where: { plan: 'trial' } }),
    prisma.organization.count({ where: { plan: { not: 'trial' } } }),
    prisma.organization.count({ where: { billingStatus: 'past_due' } }),
  ]);

  res.json({
    activeOrgs,
    totalUsers,
    pipelines24h,
    pipelines7d,
    pipelinesFailed24h,
    videosThisMonth,
    trialOrgs,
    paidOrgs,
    pastDueOrgs,
  });
});

adminRouter.get('/organizations', async (req, res) => {
  const plan = typeof req.query.plan === 'string' ? req.query.plan.trim() : '';
  const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const monthStart = startOfUtcMonth();

  const where = {
    ...(plan ? { plan } : {}),
    ...(status ? { billingStatus: status } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' as const } },
            { slug: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const orgs = await prisma.organization.findMany({
    where,
    include: {
      _count: { select: { channels: true, members: true } },
      channels: { select: { id: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  const channelToOrg = new Map<string, string>();
  for (const org of orgs) {
    for (const ch of org.channels) {
      channelToOrg.set(ch.id, org.id);
    }
  }

  const channelIds = [...channelToOrg.keys()];
  const videoCounts = channelIds.length
    ? await prisma.video.groupBy({
        by: ['channelId'],
        where: {
          channelId: { in: channelIds },
          createdAt: { gte: monthStart },
        },
        _count: { _all: true },
      })
    : [];

  const videosByOrg = new Map<string, number>();
  for (const row of videoCounts) {
    const orgId = channelToOrg.get(row.channelId);
    if (!orgId) continue;
    videosByOrg.set(orgId, (videosByOrg.get(orgId) ?? 0) + row._count._all);
  }

  res.json({
    organizations: orgs.map((org) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      plan: org.plan,
      billingStatus: org.billingStatus,
      stripeCustomerId: org.stripeCustomerId,
      stripeSubscriptionId: org.stripeSubscriptionId,
      stripeCustomerUrl: stripeCustomerUrl(org.stripeCustomerId),
      trialEndsAt: org.trialEndsAt?.toISOString() ?? null,
      isActive: org.isActive,
      channelCount: org._count.channels,
      memberCount: org._count.members,
      videosThisMonth: videosByOrg.get(org.id) ?? 0,
      createdAt: org.createdAt.toISOString(),
    })),
  });
});

adminRouter.get('/organizations/:id', async (req, res) => {
  const id = req.params.id;
  const monthStart = startOfUtcMonth();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const org = await prisma.organization.findUnique({
    where: { id },
    include: {
      members: {
        include: {
          user: { select: { id: true, email: true, name: true, createdAt: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
      channels: {
        select: { id: true, name: true, slug: true, isActive: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!org) {
    return res.status(404).json({ error: 'Organización no encontrada' });
  }

  const channelIds = org.channels.map((c) => c.id);

  const [videosThisMonth, pipelines24h, pipelinesFailed24h] = await Promise.all([
    channelIds.length
      ? prisma.video.count({
          where: { channelId: { in: channelIds }, createdAt: { gte: monthStart } },
        })
      : 0,
    channelIds.length
      ? prisma.pipelineRun.count({
          where: { channelId: { in: channelIds }, createdAt: { gte: dayAgo } },
        })
      : 0,
    channelIds.length
      ? prisma.pipelineRun.count({
          where: {
            channelId: { in: channelIds },
            createdAt: { gte: dayAgo },
            status: 'failed',
          },
        })
      : 0,
  ]);

  res.json({
    id: org.id,
    name: org.name,
    slug: org.slug,
    plan: org.plan,
    billingStatus: org.billingStatus,
    stripeCustomerId: org.stripeCustomerId,
    stripeSubscriptionId: org.stripeSubscriptionId,
    stripeCustomerUrl: stripeCustomerUrl(org.stripeCustomerId),
    trialEndsAt: org.trialEndsAt?.toISOString() ?? null,
    subscriptionRenewsAt: org.subscriptionRenewsAt?.toISOString() ?? null,
    isActive: org.isActive,
    createdAt: org.createdAt.toISOString(),
    videosThisMonth,
    pipelines24h,
    pipelinesFailed24h,
    members: org.members.map((m) => ({
      role: m.role,
      joinedAt: m.createdAt.toISOString(),
      user: {
        id: m.user.id,
        email: m.user.email,
        name: m.user.name,
        createdAt: m.user.createdAt.toISOString(),
      },
    })),
    channels: org.channels.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      isActive: c.isActive,
      createdAt: c.createdAt.toISOString(),
    })),
  });
});

adminRouter.get('/users', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

  const users = await prisma.user.findMany({
    where: q
      ? {
          OR: [
            { email: { contains: q, mode: 'insensitive' } },
            { name: { contains: q, mode: 'insensitive' } },
          ],
        }
      : undefined,
    include: {
      memberships: {
        include: {
          organization: { select: { id: true, name: true, slug: true, plan: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  res.json({
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      locale: u.locale,
      createdAt: u.createdAt.toISOString(),
      organizations: u.memberships.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        slug: m.organization.slug,
        plan: m.organization.plan,
        role: m.role,
      })),
    })),
  });
});

adminRouter.get('/billing', async (_req, res) => {
  const orgs = await prisma.organization.findMany({
    where: {
      OR: [
        { stripeCustomerId: { not: null } },
        { stripeSubscriptionId: { not: null } },
        { billingStatus: { in: ['past_due', 'active', 'canceled', 'trialing'] } },
        { plan: { not: 'trial' } },
      ],
    },
    orderBy: { updatedAt: 'desc' },
    take: 500,
  });

  const recentEvents = await prisma.stripeWebhookEvent.findMany({
    orderBy: { processedAt: 'desc' },
    take: 30,
  });

  res.json({
    organizations: orgs.map((org) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      plan: org.plan,
      billingStatus: org.billingStatus,
      stripeCustomerId: org.stripeCustomerId,
      stripeSubscriptionId: org.stripeSubscriptionId,
      stripeCustomerUrl: stripeCustomerUrl(org.stripeCustomerId),
      trialEndsAt: org.trialEndsAt?.toISOString() ?? null,
      subscriptionRenewsAt: org.subscriptionRenewsAt?.toISOString() ?? null,
      updatedAt: org.updatedAt.toISOString(),
    })),
    recentWebhookEvents: recentEvents.map((e) => ({
      id: e.id,
      eventId: e.eventId,
      processedAt: e.processedAt.toISOString(),
    })),
    note: 'Detalle de cargos e invoices en Stripe Dashboard',
  });
});
