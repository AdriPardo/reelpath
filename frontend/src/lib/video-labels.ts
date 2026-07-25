import { formatDurationReadable } from '@/lib/format-duration';
import { translate, type AppLocale } from '@/lib/i18n';

export function formatVideoLabel(format: string, locale: AppLocale = 'es'): string {
  const key = format === 'long' ? 'videos.format.long' : format === 'shorts' ? 'videos.format.short' : null;
  return key ? translate(locale, key) : format;
}

/** Meta de card: «Largo · 8 min 52 s» */
export function formatVideoMetaLabel(
  format: string,
  durationSec: number,
  locale: AppLocale = 'es',
): string {
  return `${formatVideoLabel(format, locale)} · ${formatDurationReadable(durationSec, locale)}`;
}
