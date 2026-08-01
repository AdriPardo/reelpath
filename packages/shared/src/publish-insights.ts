import type { PublicationPlannerConfig } from './publication-planner.js';

/** Mínimo de vídeos con métricas reales para confiar en el override. */
export const PUBLISH_INSIGHTS_MIN_SAMPLES = 5;

export interface PublishBucketMetrics {
  retention: number;
  views: number;
  ctr: number;
}

export interface ChannelPublishInsights {
  sampleCount: number;
  confident: boolean;
  /** Top horas (0–23), mejor primero. */
  bestHours: number[];
  /** Score por día de semana (0=dom … 6=sáb). */
  dayScores: Record<number, number>;
  /** Slots de Shorts sugeridos (si hay señal); vacío = no override. */
  bestShortSlots: Array<{ hour: number; minute: number }>;
  /** Origen mostrado en UI. */
  source: 'heuristic' | 'analytics';
}

/** Score 0–1 a partir de retención / views / CTR (pesos 0.5 / 0.3 / 0.2). */
export function scorePublishBucket(
  metrics: PublishBucketMetrics,
  norms?: { maxViews: number; maxCtr: number },
): number {
  const retention = clamp01(metrics.retention);
  const maxViews = norms?.maxViews && norms.maxViews > 0 ? norms.maxViews : Math.max(metrics.views, 1);
  const maxCtr = norms?.maxCtr && norms.maxCtr > 0 ? norms.maxCtr : Math.max(metrics.ctr, 0.01);
  const viewsN = clamp01(metrics.views / maxViews);
  const ctrN = clamp01(metrics.ctr / maxCtr);
  return 0.5 * retention + 0.3 * viewsN + 0.2 * ctrN;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export function emptyPublishInsights(): ChannelPublishInsights {
  return {
    sampleCount: 0,
    confident: false,
    bestHours: [],
    dayScores: {},
    bestShortSlots: [],
    source: 'heuristic',
  };
}

/**
 * Construye insights a partir de buckets agregados (hora y día).
 * `hourBuckets` / `dayBuckets`: medias ya calculadas por el agregador de analytics.
 */
export function buildPublishInsights(params: {
  sampleCount: number;
  hourBuckets: Map<number, PublishBucketMetrics>;
  dayBuckets: Map<number, PublishBucketMetrics>;
}): ChannelPublishInsights {
  const { sampleCount, hourBuckets, dayBuckets } = params;
  if (sampleCount <= 0 || hourBuckets.size === 0) {
    return emptyPublishInsights();
  }

  const allHourMetrics = [...hourBuckets.values()];
  const maxViews = Math.max(...allHourMetrics.map((m) => m.views), 1);
  const maxCtr = Math.max(...allHourMetrics.map((m) => m.ctr), 0.01);

  const hourScores = [...hourBuckets.entries()]
    .map(([hour, m]) => ({
      hour,
      score: scorePublishBucket(m, { maxViews, maxCtr }),
    }))
    .sort((a, b) => b.score - a.score);

  const dayScores: Record<number, number> = {};
  const dayNorms = {
    maxViews: Math.max(...[...dayBuckets.values()].map((m) => m.views), 1),
    maxCtr: Math.max(...[...dayBuckets.values()].map((m) => m.ctr), 0.01),
  };
  for (const [day, m] of dayBuckets) {
    dayScores[day] = scorePublishBucket(m, dayNorms);
  }

  const bestHours = hourScores.slice(0, 3).map((h) => h.hour);
  const bestShortSlots =
    bestHours.length >= 2
      ? [
          { hour: bestHours[0]!, minute: 0 },
          { hour: bestHours[1]!, minute: 30 },
        ]
      : bestHours.length === 1
        ? [
            { hour: bestHours[0]!, minute: 0 },
            { hour: (bestHours[0]! + 5) % 24, minute: 30 },
          ]
        : [];

  const confident = sampleCount >= PUBLISH_INSIGHTS_MIN_SAMPLES;

  return {
    sampleCount,
    confident,
    bestHours,
    dayScores,
    bestShortSlots,
    source: confident ? 'analytics' : 'heuristic',
  };
}

/**
 * Aplica insights al planner cuando hay confianza.
 * Los días preferidos del usuario se conservan; solo se reordenan por score.
 */
export function applyInsightsToPlannerConfig(
  planner: PublicationPlannerConfig,
  insights: ChannelPublishInsights | null | undefined,
): PublicationPlannerConfig {
  if (!insights?.confident || insights.bestHours.length === 0) {
    return planner;
  }

  const preferredPublishHour = insights.bestHours[0]!;
  const preferredPublishDays = [...planner.preferredPublishDays].sort((a, b) => {
    const sa = insights.dayScores[a] ?? 0;
    const sb = insights.dayScores[b] ?? 0;
    if (sb !== sa) return sb - sa;
    return a - b;
  });

  const shortPreferredSlots =
    insights.bestShortSlots.length > 0 ? insights.bestShortSlots : planner.shortPreferredSlots;

  return {
    ...planner,
    preferredPublishHour,
    preferredPublishDays,
    shortPreferredSlots,
  };
}

/** Día local (YYYY-MM-DD) en timezone restando `leadDays` al instante UTC. */
export function localGenerateOnDate(
  publishAt: Date,
  timeZone: string,
  leadDays: number,
  getZoned: (date: Date, tz: string) => { year: number; month: number; day: number },
): { year: number; month: number; day: number } {
  const lead = Math.max(0, Math.min(3, Math.round(leadDays)));
  const parts = getZoned(publishAt, timeZone);
  const utc = Date.UTC(parts.year, parts.month - 1, parts.day - lead);
  const d = new Date(utc);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

export function sameLocalDate(
  a: { year: number; month: number; day: number },
  b: { year: number; month: number; day: number },
): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

/** True si hoy (local) >= generateOn y el slot de publicación sigue en el futuro. */
export function shouldAutoGenerateForSlot(params: {
  now: Date;
  publishAt: Date;
  timeZone: string;
  leadDays: number;
  getZoned: (date: Date, tz: string) => { year: number; month: number; day: number };
}): boolean {
  const { now, publishAt, timeZone, leadDays, getZoned } = params;
  if (publishAt.getTime() <= now.getTime()) return false;
  const today = getZoned(now, timeZone);
  const generateOn = localGenerateOnDate(publishAt, timeZone, leadDays, getZoned);
  const todayKey = today.year * 10_000 + today.month * 100 + today.day;
  const genKey = generateOn.year * 10_000 + generateOn.month * 100 + generateOn.day;
  return todayKey >= genKey;
}
