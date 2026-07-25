import { translate, type AppLocale } from '@/lib/i18n';

export interface PlanLimits {
  maxChannels?: number | null;
  maxVideosPerMonth?: number | null;
  maxPipelinesPerDay?: number | null;
  trialDays?: number;
  unlimited?: boolean;
}

export interface PlanDefinition {
  id: string;
  name: string;
  description: string | null;
  priceMonthlyCents: number | null;
  limits: PlanLimits;
  sortOrder: number;
}

export function planLimitsToBullets(limits: PlanLimits, locale: AppLocale | string = 'es'): string[] {
  const loc = locale === 'en' ? 'en' : 'es';
  if (limits.unlimited) {
    return [
      translate(loc, 'settings.plan.unlimitedChannels'),
      translate(loc, 'settings.plan.unlimitedVideos'),
    ];
  }

  const bullets: string[] = [];

  if (limits.maxChannels != null) {
    bullets.push(
      translate(loc, limits.maxChannels === 1 ? 'settings.plan.channelCount' : 'settings.plan.channelsCount', {
        count: limits.maxChannels,
      }),
    );
  }
  if (limits.maxVideosPerMonth != null) {
    bullets.push(translate(loc, 'settings.plan.videosPerMonth', { count: limits.maxVideosPerMonth }));
  }
  if (limits.maxPipelinesPerDay != null) {
    bullets.push(translate(loc, 'settings.plan.pipelinesPerDay', { count: limits.maxPipelinesPerDay }));
  }
  if (limits.trialDays != null) {
    bullets.push(translate(loc, 'settings.plan.trialDays', { count: limits.trialDays }));
  }

  return bullets.length > 0 ? bullets : [translate(loc, 'settings.plan.noLimitsConfigured')];
}

export function formatPlanLimitsSummary(limits: PlanLimits, locale: AppLocale | string = 'es'): string {
  const loc = locale === 'en' ? 'en' : 'es';
  if (limits.unlimited) {
    return translate(loc, 'settings.plan.unlimitedSummary');
  }

  const parts: string[] = [];

  if (limits.maxChannels != null) {
    parts.push(
      translate(loc, limits.maxChannels === 1 ? 'settings.plan.channelCount' : 'settings.plan.channelsCount', {
        count: limits.maxChannels,
      }),
    );
  }
  if (limits.maxVideosPerMonth != null) {
    parts.push(translate(loc, 'settings.plan.videosPerMonthShort', { count: limits.maxVideosPerMonth }));
  }
  if (limits.trialDays != null) {
    parts.push(translate(loc, 'settings.plan.trialDays', { count: limits.trialDays }));
  }

  return parts.join(', ') || translate(loc, 'settings.plan.noLimitsConfigured');
}

export function formatPlanPrice(cents: number | null, locale: AppLocale | string = 'es'): string {
  if (cents == null || cents === 0) return translate(locale === 'en' ? 'en' : 'es', 'settings.plan.free');
  return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function trialDaysRemaining(trialEndsAt: string | null | undefined): number | null {
  if (!trialEndsAt) return null;
  const end = new Date(trialEndsAt).getTime();
  if (Number.isNaN(end)) return null;
  const ms = end - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}
