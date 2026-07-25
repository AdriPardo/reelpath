import type { ChannelConfig } from './types.js';

/** Configuración efectiva del planificador (defaults incluidos). */
export interface PublicationPlannerConfig {
  timezone: string;
  publishPlannerEnabled: boolean;
  maxLongsPerWeek: number;
  preferredPublishHour: number;
  preferredPublishDays: number[];
  minDaysBetweenLongs: number;
  shortPreferredSlots: Array<{ hour: number; minute: number }>;
}

export interface ScheduledVideoRef {
  videoId: string;
  scheduledAt: Date;
  title?: string;
}

export interface ShortSlotPlan {
  orderIndex: number;
  scheduledAt: Date;
  label: string;
}

export interface VideoPublicationPlan {
  videoId: string;
  title?: string;
  scheduledAt: Date;
  recommendation: string;
  shorts: ShortSlotPlan[];
  slotFeedback?: PlannerSlotFeedback | null;
}

export interface PlannerSlotFeedback {
  message: string;
  severity: 'info' | 'warning';
}

export interface PublicationCalendar {
  channelTimezone: string;
  plannerEnabled: boolean;
  entries: VideoPublicationPlan[];
  nextAvailableSlot: Date | null;
  plannerFeedback?: PlannerSlotFeedback[];
}

const DEFAULT_TIMEZONE = 'Europe/Madrid';
const DEFAULT_PREFERRED_DAYS = [5]; // viernes
const DEFAULT_PREFERRED_HOUR = 19;
const DEFAULT_MAX_LONGS_PER_WEEK = 1;
const DEFAULT_SHORT_SLOTS = [
  { hour: 12, minute: 30 },
  { hour: 19, minute: 0 },
];
const MIN_LEAD_MS = 60_000;
const MAX_SEARCH_DAYS = 56;

const DAY_NAMES_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** Resuelve la config del planificador con defaults. */
export function resolvePlannerConfig(config: ChannelConfig): PublicationPlannerConfig {
  const maxLongsPerWeek = clampInt(config.maxLongsPerWeek ?? DEFAULT_MAX_LONGS_PER_WEEK, 1, 7);
  const minDaysBetweenLongs = clampInt(
    config.minDaysBetweenLongs ?? Math.ceil(7 / maxLongsPerWeek),
    1,
    14,
  );

  return {
    timezone: config.timezone?.trim() || DEFAULT_TIMEZONE,
    publishPlannerEnabled: config.publishPlannerEnabled === true,
    maxLongsPerWeek,
    preferredPublishHour: clampInt(config.preferredPublishHour ?? DEFAULT_PREFERRED_HOUR, 0, 23),
    preferredPublishDays: normalizePreferredDays(config.preferredPublishDays),
    minDaysBetweenLongs,
    shortPreferredSlots: normalizeShortSlots(config.shortPreferredSlots),
  };
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function normalizePreferredDays(days: number[] | undefined): number[] {
  if (!days?.length) return [...DEFAULT_PREFERRED_DAYS];
  const normalized = [...new Set(days.map((d) => clampInt(d, 0, 6)))].sort((a, b) => a - b);
  return normalized.length > 0 ? normalized : [...DEFAULT_PREFERRED_DAYS];
}

function normalizeShortSlots(
  slots: Array<{ hour: number; minute: number }> | undefined,
): Array<{ hour: number; minute: number }> {
  if (!slots?.length) return [...DEFAULT_SHORT_SLOTS];
  const normalized = slots
    .map((s) => ({ hour: clampInt(s.hour, 0, 23), minute: clampInt(s.minute, 0, 59) }))
    .filter((s, i, arr) => arr.findIndex((x) => x.hour === s.hour && x.minute === s.minute) === i);
  return normalized.length > 0 ? normalized : [...DEFAULT_SHORT_SLOTS];
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
}

function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0';
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')) % 24,
    minute: Number(get('minute')),
    weekday: weekdayMap[get('weekday')] ?? 0,
  };
}

/** Convierte una fecha/hora local en la zona horaria del canal a UTC. */
export function zonedLocalToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  let utcMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  for (let i = 0; i < 4; i++) {
    const zoned = getZonedParts(new Date(utcMs), timeZone);
    const desiredLocalMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
    const actualLocalMs = Date.UTC(
      zoned.year,
      zoned.month - 1,
      zoned.day,
      zoned.hour,
      zoned.minute,
      0,
      0,
    );
    utcMs += desiredLocalMs - actualLocalMs;
  }
  return new Date(utcMs);
}

function addDaysToZonedDate(
  parts: Pick<ZonedParts, 'year' | 'month' | 'day'>,
  days: number,
): Pick<ZonedParts, 'year' | 'month' | 'day'> {
  const d = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function isoWeekKey(date: Date, timeZone: string): string {
  const p = getZonedParts(date, timeZone);
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${week}`;
}

function countLongsInWeek(scheduled: Date[], weekKey: string, timeZone: string): number {
  return scheduled.filter((d) => isoWeekKey(d, timeZone) === weekKey).length;
}

function isSlotAllowed(
  candidate: Date,
  existingScheduled: Date[],
  planner: PublicationPlannerConfig,
): boolean {
  const tz = planner.timezone;

  for (const existing of existingScheduled) {
    const diffDays = Math.abs(candidate.getTime() - existing.getTime()) / 86_400_000;
    if (diffDays < planner.minDaysBetweenLongs) return false;
  }

  const weekKey = isoWeekKey(candidate, tz);
  if (countLongsInWeek(existingScheduled, weekKey, tz) >= planner.maxLongsPerWeek) {
    return false;
  }

  return true;
}

/**
 * Calcula el próximo hueco óptimo para publicar un vídeo largo.
 * Reglas MVP: días preferidos + hora en timezone del canal, sin saturar la semana.
 */
export function computeNextPublishSlot(
  config: ChannelConfig,
  existingScheduledVideos: Date[],
  options?: { referenceDate?: Date; minLeadMs?: number },
): Date {
  const planner = resolvePlannerConfig(config);
  const now = options?.referenceDate ?? new Date();
  const minLead = options?.minLeadMs ?? MIN_LEAD_MS;
  const earliest = new Date(now.getTime() + minLead);

  const startParts = getZonedParts(earliest, planner.timezone);
  let cursor = { year: startParts.year, month: startParts.month, day: startParts.day };

  for (let dayOffset = 0; dayOffset < MAX_SEARCH_DAYS; dayOffset++) {
    const dateParts = addDaysToZonedDate(cursor, dayOffset);
    const weekday = getZonedParts(
      zonedLocalToUtc(dateParts.year, dateParts.month, dateParts.day, 12, 0, planner.timezone),
      planner.timezone,
    ).weekday;

    if (!planner.preferredPublishDays.includes(weekday)) continue;

    const candidate = zonedLocalToUtc(
      dateParts.year,
      dateParts.month,
      dateParts.day,
      planner.preferredPublishHour,
      0,
      planner.timezone,
    );

    if (candidate.getTime() < earliest.getTime()) continue;
    if (!isSlotAllowed(candidate, existingScheduledVideos, planner)) continue;

    return candidate;
  }

  // Fallback: una semana después del último programado o desde ahora
  const last =
    existingScheduledVideos.length > 0
      ? new Date(Math.max(...existingScheduledVideos.map((d) => d.getTime())))
      : earliest;
  const fallbackParts = getZonedParts(
    new Date(last.getTime() + planner.minDaysBetweenLongs * 86_400_000),
    planner.timezone,
  );
  return zonedLocalToUtc(
    fallbackParts.year,
    fallbackParts.month,
    fallbackParts.day,
    planner.preferredPublishHour,
    0,
    planner.timezone,
  );
}

/** Horarios óptimos para Shorts (índice 0 = mismo momento que el largo). */
export function computeShortPublishSlots(
  baseTime: Date,
  shortCount: number,
  config: ChannelConfig,
): Date[] {
  if (shortCount <= 0) return [];
  if (shortCount === 1) return [baseTime];

  const planner = resolvePlannerConfig(config);
  const slots: Date[] = [baseTime];
  const baseParts = getZonedParts(baseTime, planner.timezone);
  let previous = baseTime;

  for (let i = 1; i < shortCount; i++) {
    const template = planner.shortPreferredSlots[(i - 1) % planner.shortPreferredSlots.length];
    const candidate = findNextShortSlot(baseParts, template, planner.timezone, previous);
    slots.push(candidate);
    previous = candidate;
  }

  return slots;
}

function findNextShortSlot(
  baseParts: Pick<ZonedParts, 'year' | 'month' | 'day'>,
  template: { hour: number; minute: number },
  timeZone: string,
  after: Date,
): Date {
  for (let dayOffset = 0; dayOffset <= 14; dayOffset++) {
    const dateParts = addDaysToZonedDate(baseParts, dayOffset);
    const candidate = zonedLocalToUtc(
      dateParts.year,
      dateParts.month,
      dateParts.day,
      template.hour,
      template.minute,
      timeZone,
    );
    // Al menos 30 min después del slot anterior
    if (candidate.getTime() >= after.getTime() + 30 * 60_000) {
      return candidate;
    }
  }
  return new Date(after.getTime() + 86_400_000);
}

function formatRecommendation(date: Date, timeZone: string): string {
  const parts = getZonedParts(date, timeZone);
  const dayName = DAY_NAMES_ES[parts.weekday] ?? 'día';
  const hh = String(parts.hour).padStart(2, '0');
  const mm = String(parts.minute).padStart(2, '0');
  return `Publica el ${dayName} a las ${hh}:${mm} (${timeZone})`;
}

function formatShortLabel(date: Date, timeZone: string, orderIndex: number): string {
  const parts = getZonedParts(date, timeZone);
  const dayName = DAY_NAMES_ES[parts.weekday] ?? 'día';
  const hh = String(parts.hour).padStart(2, '0');
  const mm = String(parts.minute).padStart(2, '0');
  if (orderIndex === 0) return `Short ${orderIndex + 1}: con el vídeo largo`;
  return `Short ${orderIndex + 1}: ${dayName} ${hh}:${mm}`;
}

/**
 * Construye un calendario de publicación para vídeos en cola sin fecha asignada.
 */
export function buildPublicationCalendar(
  config: ChannelConfig,
  videosInQueue: ScheduledVideoRef[],
  options?: {
    shortCountPerVideo?: number;
    referenceDate?: Date;
  },
): PublicationCalendar {
  const planner = resolvePlannerConfig(config);
  const shortCount = options?.shortCountPerVideo ?? resolveDefaultShortCount(config);

  if (!planner.publishPlannerEnabled) {
    return {
      channelTimezone: planner.timezone,
      plannerEnabled: false,
      entries: [],
      nextAvailableSlot: null,
    };
  }

  const alreadyScheduled = videosInQueue.filter(
    (v) => v.scheduledAt.getTime() > Date.now(),
  );
  const unscheduled = videosInQueue.filter(
    (v) => !v.scheduledAt || v.scheduledAt.getTime() <= Date.now(),
  );

  const assigned: Date[] = alreadyScheduled.map((v) => v.scheduledAt);
  const entries: VideoPublicationPlan[] = [];

  for (const video of alreadyScheduled) {
    const shortDates = computeShortPublishSlots(video.scheduledAt, shortCount, config);
    entries.push({
      videoId: video.videoId,
      title: video.title,
      scheduledAt: video.scheduledAt,
      recommendation: formatRecommendation(video.scheduledAt, planner.timezone),
      shorts: shortDates.map((d, i) => ({
        orderIndex: i,
        scheduledAt: d,
        label: formatShortLabel(d, planner.timezone, i),
      })),
    });
  }

  for (const video of unscheduled) {
    const slot = computeNextPublishSlot(config, assigned, {
      referenceDate: options?.referenceDate,
    });
    assigned.push(slot);

    const shortDates = computeShortPublishSlots(slot, shortCount, config);
    entries.push({
      videoId: video.videoId,
      title: video.title,
      scheduledAt: slot,
      recommendation: formatRecommendation(slot, planner.timezone),
      shorts: shortDates.map((d, i) => ({
        orderIndex: i,
        scheduledAt: d,
        label: formatShortLabel(d, planner.timezone, i),
      })),
    });
  }

  const nextAvailableSlot = computeNextPublishSlot(config, assigned, {
    referenceDate: options?.referenceDate,
  });

  return {
    channelTimezone: planner.timezone,
    plannerEnabled: true,
    entries,
    nextAvailableSlot,
  };
}

export function resolveDefaultShortCount(config: ChannelConfig): number {
  if (!config.publishYoutubeShorts) return 0;
  if (config.shortsMode === 'split') {
    return config.longShortsFromVideo ?? 2;
  }
  const perVideo = config.shortsPerVideo ?? 1;
  if (config.shortsMode === 'mixed') return Math.max(1, perVideo);
  return perVideo;
}

/**
 * Si el planificador está activo y no hay fecha explícita, devuelve el próximo slot óptimo.
 */
export function resolveAutoScheduledPublishAt(
  config: ChannelConfig,
  explicit: Date | null | undefined,
  existingScheduled: Date[],
): Date | null {
  if (explicit) return explicit;
  if (!resolvePlannerConfig(config).publishPlannerEnabled) return null;
  return computeNextPublishSlot(config, existingScheduled);
}

/** Retención media por hora de publicación (0-23) en timezone del canal. */
export type RetentionByPublishHour = Map<number, { avgRetention: number; sampleCount: number }>;

const LOW_RETENTION_RATIO = 0.8;

/**
 * Si la retención histórica de un slot es baja vs la media del canal, sugiere otro horario.
 */
export function evaluateSlotRetentionFeedback(params: {
  slot: Date;
  channelTimezone: string;
  channelAvgRetention: number;
  retentionByHour: RetentionByPublishHour;
}): PlannerSlotFeedback | null {
  const { slot, channelTimezone, channelAvgRetention, retentionByHour } = params;
  if (channelAvgRetention <= 0 || retentionByHour.size === 0) return null;

  const hour = getZonedParts(slot, channelTimezone).hour;
  const bucket = retentionByHour.get(hour);
  if (!bucket || bucket.sampleCount < 1) return null;

  if (bucket.avgRetention >= channelAvgRetention * LOW_RETENTION_RATIO) return null;

  const channelPct = Math.round(channelAvgRetention * 100);
  const slotPct = Math.round(bucket.avgRetention * 100);
  return {
    severity: 'warning',
    message: `La retención a las ${String(hour).padStart(2, '0')}:00 (${slotPct}%) está por debajo de la media del canal (${channelPct}%). Considera otro slot.`,
  };
}

/** Enriquece entradas del calendario con feedback de retención por slot. */
export function applyRetentionFeedbackToCalendar(
  calendar: PublicationCalendar,
  channelAvgRetention: number,
  retentionByHour: RetentionByPublishHour,
): PublicationCalendar {
  if (!calendar.plannerEnabled || calendar.entries.length === 0) {
    return calendar;
  }

  const entries = calendar.entries.map((entry) => ({
    ...entry,
    slotFeedback: evaluateSlotRetentionFeedback({
      slot: entry.scheduledAt,
      channelTimezone: calendar.channelTimezone,
      channelAvgRetention,
      retentionByHour,
    }),
  }));

  const plannerFeedback = entries
    .map((e) => e.slotFeedback)
    .filter((f): f is PlannerSlotFeedback => f != null);

  return { ...calendar, entries, plannerFeedback };
}
