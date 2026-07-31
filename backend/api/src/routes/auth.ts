import { Router } from 'express';
import { z } from 'zod';
import { buildWelcomeEmail, isPlatformAdminEmail, loadConfig, sendEmail } from '@autotube/config';
import { prisma } from '@autotube/database';
import { hashPassword, signToken, verifyPassword } from '../lib/auth.js';
import { clearAuthCookies, setAuthCookies } from '../lib/auth-cookie.js';
import { maybeSendTrialEndingEmail } from '../lib/billing-email.js';
import { resolveLocale, type ApiLocale } from '../lib/i18n.js';
import { parseAuthMiddleware, requireAuth } from '../middleware/auth.js';
import { authRateLimiter } from '../middleware/rate-limit.js';

export const authRouter = Router();

authRouter.use(parseAuthMiddleware);

function normalizeLocale(locale: string | null | undefined): ApiLocale {
  return locale === 'en' ? 'en' : 'es';
}

function serializeUser(user: {
  id: string;
  email: string;
  name: string | null;
  locale: string;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    locale: normalizeLocale(user.locale),
  };
}

function serializeOrganization(org: {
  id: string;
  name: string;
  slug: string;
  plan: string;
  planLimits: unknown;
  trialEndsAt: Date | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  billingStatus?: string | null;
  subscriptionRenewsAt?: Date | null;
}) {
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    plan: org.plan,
    planLimits: org.planLimits ?? null,
    trialEndsAt: org.trialEndsAt?.toISOString() ?? null,
    stripeCustomerId: org.stripeCustomerId ?? null,
    stripeSubscriptionId: org.stripeSubscriptionId ?? null,
    billingStatus: org.billingStatus ?? null,
    subscriptionRenewsAt: org.subscriptionRenewsAt?.toISOString() ?? null,
  };
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post('/login', authRateLimiter, async (req, res) => {
  const body = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
  if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
    return res.status(401).json({ error: 'Email o contraseña incorrectos' });
  }

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: user.id },
    include: { organization: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!membership) {
    return res.status(403).json({ error: 'Usuario sin organización asignada' });
  }

  const token = await signToken({
    userId: user.id,
    organizationId: membership.organizationId,
    role: membership.role as 'owner' | 'admin' | 'member',
    email: user.email,
  });

  setAuthCookies(res, token);
  res.json({
    token,
    user: serializeUser(user),
    organization: serializeOrganization(membership.organization),
    role: membership.role,
    isPlatformAdmin: isPlatformAdminEmail(user.email),
  });
});

authRouter.post('/logout', (_req, res) => {
  clearAuthCookies(res);
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const auth = req.auth!;
  const [user, membership] = await Promise.all([
    prisma.user.findUnique({ where: { id: auth.userId } }),
    prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: auth.organizationId,
          userId: auth.userId,
        },
      },
      include: { organization: true },
    }),
  ]);

  if (!user || !membership) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }

  void maybeSendTrialEndingEmail({
    organizationId: membership.organization.id,
    userEmail: user.email,
    userName: user.name,
    userLocale: user.locale,
    trialEndsAt: membership.organization.trialEndsAt,
    plan: membership.organization.plan,
  });

  res.json({
    user: serializeUser(user),
    organization: serializeOrganization(membership.organization),
    role: membership.role,
    isPlatformAdmin: isPlatformAdminEmail(user.email),
  });
});

const updateMeSchema = z.object({
  name: z.string().max(120).optional(),
  password: z.string().min(6).optional(),
  currentPassword: z.string().min(1).optional(),
  locale: z.enum(['es', 'en']).optional(),
});

authRouter.patch('/me', requireAuth, async (req, res) => {
  const body = updateMeSchema.parse(req.body);

  if (body.password !== undefined && !body.currentPassword) {
    return res.status(400).json({ error: 'La contraseña actual es obligatoria' });
  }

  if (body.name === undefined && body.password === undefined && body.locale === undefined) {
    return res.status(400).json({ error: 'No hay cambios que guardar' });
  }

  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }

  const data: { name?: string | null; passwordHash?: string; locale?: ApiLocale } = {};

  if (body.name !== undefined) {
    const trimmed = body.name.trim();
    data.name = trimmed || null;
  }

  if (body.locale !== undefined) {
    data.locale = body.locale;
  }

  if (body.password !== undefined) {
    if (!(await verifyPassword(body.currentPassword!, user.passwordHash))) {
      return res.status(401).json({ error: 'La contraseña actual es incorrecta' });
    }
    data.passwordHash = await hashPassword(body.password);
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data,
  });

  res.json({
    user: serializeUser(updated),
  });
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1).optional(),
  locale: z.enum(['es', 'en']).optional(),
});

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function deriveOrganizationName(name: string | undefined, email: string): string {
  if (name?.trim()) return name.trim();
  const localPart = email.split('@')[0] ?? 'usuario';
  return localPart.charAt(0).toUpperCase() + localPart.slice(1);
}

function randomSlugSuffix(): string {
  return Math.random().toString(36).slice(2, 6);
}

async function ensureUniqueOrgSlug(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  emailLocalPart: string,
): Promise<string> {
  const base = slugify(emailLocalPart) || 'usuario';
  let slug = base;

  for (let attempt = 0; attempt < 12; attempt++) {
    const existing = await tx.organization.findUnique({ where: { slug } });
    if (!existing) return slug;

    const suffix = randomSlugSuffix();
    slug = `${base.slice(0, 48 - suffix.length - 1)}-${suffix}`;
  }

  return `org-${Date.now().toString(36)}`;
}

authRouter.post('/register', authRateLimiter, async (req, res) => {
  const config = loadConfig();
  const body = registerSchema.parse(req.body);
  const email = body.email.toLowerCase();

  const userCount = await prisma.user.count();
  // E2E needs open registration across parallel workers; production still locks after bootstrap.
  if (config.AUTH_REQUIRED && userCount > 0 && process.env.E2E_TESTS !== 'true') {
    if (!req.auth || (req.auth.role !== 'owner' && req.auth.role !== 'admin')) {
      return res.status(403).json({ error: 'Registro deshabilitado' });
    }
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return res.status(409).json({ error: 'El email ya está registrado' });
  }

  const passwordHash = await hashPassword(body.password);
  const locale = resolveLocale({
    queryLocale: body.locale,
    acceptLanguage:
      typeof req.headers['accept-language'] === 'string' ? req.headers['accept-language'] : undefined,
  });

  const trialPlan = await prisma.planDefinition.findUnique({ where: { id: 'trial' } });

  const result = await prisma.$transaction(async (tx) => {
    const organizationName = deriveOrganizationName(body.name, email);
    const emailLocalPart = email.split('@')[0] ?? 'usuario';
    const organizationSlug = await ensureUniqueOrgSlug(tx, emailLocalPart);

    const organization = await tx.organization.create({
      data: {
        name: organizationName,
        slug: organizationSlug,
        plan: 'trial',
        planLimits: trialPlan?.limits ?? undefined,
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });

    const user = await tx.user.create({
      data: {
        email,
        passwordHash,
        name: body.name,
        locale,
      },
    });

    await tx.organizationMember.create({
      data: {
        organizationId: organization.id,
        userId: user.id,
        role: 'owner',
      },
    });

    return { organization, user };
  });

  const token = await signToken({
    userId: result.user.id,
    organizationId: result.organization.id,
    role: 'owner',
    email: result.user.email,
  });

  const welcome = buildWelcomeEmail({
    userName: result.user.name,
    dashboardUrl: `${config.FRONTEND_URL}/${locale}/`,
    locale,
  });
  void sendEmail({
    to: result.user.email,
    templateId: 'welcome',
    ...welcome,
  }).catch((err) => {
    console.warn('[auth/register] No se pudo enviar email de bienvenida:', err);
  });

  setAuthCookies(res, token);
  res.status(201).json({
    token,
    user: serializeUser(result.user),
    organization: serializeOrganization(result.organization),
    role: 'owner',
    isPlatformAdmin: isPlatformAdminEmail(result.user.email),
  });
});
