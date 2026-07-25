const DEFAULT_TIMEZONE = 'Europe/Madrid';

export function resolveChannelTimezone(
  channel?: { config?: Record<string, unknown>; timezone?: string } | null,
): string {
  const direct = channel?.timezone;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  const fromConfig = channel?.config?.timezone;
  if (typeof fromConfig === 'string' && fromConfig.trim()) return fromConfig.trim();
  return DEFAULT_TIMEZONE;
}

function localeTag(locale?: string): string {
  if (locale === 'en') return 'en-US';
  return 'es-ES';
}

function formatPublishDateLocal(iso: string, timeZone?: string, locale?: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  const tz = timeZone?.trim() || DEFAULT_TIMEZONE;
  return date.toLocaleString(localeTag(locale), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: tz,
  });
}

/** Fecha corta para badges, p. ej. «17 jul 2026, 19:00». */
export function formatPublishDateShort(iso: string, timeZone?: string, locale?: string): string {
  return formatPublishDateLocal(iso, timeZone, locale);
}

/** Fecha legible con zona horaria del canal. */
export function formatPublishDate(iso: string, timeZone?: string, locale?: string): string {
  const local = formatPublishDateLocal(iso, timeZone, locale);
  if (local === iso) return iso;
  const tz = timeZone?.trim() || DEFAULT_TIMEZONE;
  return `${local} (${tz})`;
}

/** Formatea fecha/hora con locale de la app. */
export function formatDateTime(iso: string, locale?: string, options?: Intl.DateTimeFormatOptions): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(localeTag(locale), options);
}

/** Formatea números con locale de la app. */
export function formatNumber(value: number, locale?: string): string {
  return value.toLocaleString(localeTag(locale));
}
