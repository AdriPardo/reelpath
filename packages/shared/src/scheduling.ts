const DEFAULT_MIN_LEAD_MS = 60_000;

/** Parsea una fecha ISO de publicación programada; null si no es futura válida. */
export function parseScheduledPublishAt(
  value: unknown,
  options?: { minLeadMs?: number },
): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  const minLead = options?.minLeadMs ?? DEFAULT_MIN_LEAD_MS;
  if (parsed.getTime() <= Date.now() + minLead) return null;

  return parsed;
}

export function computePublishDelayMs(scheduledAt: Date): number {
  return Math.max(0, scheduledAt.getTime() - Date.now());
}

export interface PipelineRunMetadata {
  forcedTopic?: string;
  scheduledPublishAt?: string;
  source?: 'upload';
  originalFilename?: string;
}
