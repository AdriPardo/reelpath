import { prisma } from '@autotube/database';
import { t, type ApiLocale } from './i18n.js';

export interface PlanLimits {
  maxChannels?: number | null;
  maxVideosPerMonth?: number | null;
  maxPipelinesPerDay?: number | null;
  trialDays?: number;
  unlimited?: boolean;
}

export class PlanLimitError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.name = 'PlanLimitError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

function coerceLimits(value: unknown): PlanLimits {
  if (value && typeof value === 'object') {
    return value as PlanLimits;
  }
  return {};
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

/**
 * Resuelve los límites de plan efectivos de una organización.
 * Prioriza los límites guardados en la organización y, si no existen,
 * recurre a la definición del plan actual.
 */
export async function resolveOrgPlanLimits(orgId: string): Promise<PlanLimits> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { plan: true, planLimits: true },
  });
  if (!org) return {};

  if (org.planLimits && typeof org.planLimits === 'object') {
    return coerceLimits(org.planLimits);
  }

  const plan = await prisma.planDefinition.findUnique({ where: { id: org.plan } });
  return coerceLimits(plan?.limits);
}

export async function countOrgPipelinesToday(orgId: string): Promise<number> {
  const since = startOfUtcDay(new Date());
  return prisma.pipelineRun.count({
    where: {
      createdAt: { gte: since },
      channel: { organizationId: orgId },
    },
  });
}

export async function countOrgVideosThisMonth(orgId: string): Promise<number> {
  const since = startOfUtcMonth(new Date());
  const channels = await prisma.channel.findMany({
    where: { organizationId: orgId },
    select: { id: true },
  });
  if (channels.length === 0) return 0;
  return prisma.video.count({
    where: {
      createdAt: { gte: since },
      channelId: { in: channels.map((c) => c.id) },
    },
  });
}

export function isTrialExpired(plan: string, trialEndsAt: Date | null | undefined): boolean {
  if (plan !== 'trial') return false;
  if (!trialEndsAt) return false;
  return trialEndsAt.getTime() < Date.now();
}

export function trialDaysRemaining(trialEndsAt: Date | null | undefined): number | null {
  if (!trialEndsAt) return null;
  const ms = trialEndsAt.getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

async function loadOrgBilling(orgId: string) {
  return prisma.organization.findUnique({
    where: { id: orgId },
    select: { plan: true, trialEndsAt: true, isActive: true },
  });
}

function assertTrialActive(
  plan: string,
  trialEndsAt: Date | null | undefined,
  locale: ApiLocale = 'es',
): void {
  if (!isTrialExpired(plan, trialEndsAt)) return;
  throw new PlanLimitError(t('api.errors.trialExpired', locale), 402, 'TRIAL_EXPIRED');
}

/**
 * Verifica que la organización puede iniciar una nueva generación (pipeline).
 */
export async function assertOrgCanTriggerPipeline(
  orgId: string,
  locale: ApiLocale = 'es',
): Promise<void> {
  const org = await loadOrgBilling(orgId);
  if (!org) {
    throw new PlanLimitError(t('api.errors.orgNotFound', locale), 404, 'ORG_NOT_FOUND');
  }
  if (!org.isActive) {
    throw new PlanLimitError(t('api.errors.orgInactive', locale), 403, 'ORG_INACTIVE');
  }

  const limits = await resolveOrgPlanLimits(orgId);
  if (limits.unlimited) return;

  assertTrialActive(org.plan, org.trialEndsAt, locale);

  if (typeof limits.maxPipelinesPerDay === 'number') {
    const today = await countOrgPipelinesToday(orgId);
    if (today >= limits.maxPipelinesPerDay) {
      throw new PlanLimitError(
        t('api.errors.pipelineDailyLimit', locale, { limit: limits.maxPipelinesPerDay }),
        403,
        'PIPELINE_DAILY_LIMIT',
      );
    }
  }

  if (typeof limits.maxVideosPerMonth === 'number') {
    const monthCount = await countOrgVideosThisMonth(orgId);
    if (monthCount >= limits.maxVideosPerMonth) {
      throw new PlanLimitError(
        t('api.errors.videoMonthlyLimit', locale, { limit: limits.maxVideosPerMonth }),
        403,
        'VIDEO_MONTHLY_LIMIT',
      );
    }
  }
}

/**
 * Verifica que la organización puede aprobar o publicar vídeos.
 */
export async function assertOrgCanPublish(
  orgId: string,
  locale: ApiLocale = 'es',
): Promise<void> {
  const org = await loadOrgBilling(orgId);
  if (!org) {
    throw new PlanLimitError(t('api.errors.orgNotFound', locale), 404, 'ORG_NOT_FOUND');
  }
  if (!org.isActive) {
    throw new PlanLimitError(t('api.errors.orgInactive', locale), 403, 'ORG_INACTIVE');
  }

  const limits = await resolveOrgPlanLimits(orgId);
  if (limits.unlimited) return;

  assertTrialActive(org.plan, org.trialEndsAt, locale);
}
