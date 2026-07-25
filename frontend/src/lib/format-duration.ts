import { translate, type AppLocale } from '@/lib/i18n';

/** Duración compacta para chips y reproductor: 2:08, 1:05:30 */
export function formatDurationCompact(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '—';

  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Duración legible con locale: 2 min 8 s / 2 min 8 s */
export function formatDurationReadable(
  seconds: number | null | undefined,
  locale: AppLocale = 'es',
): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '—';

  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  const parts: string[] = [];
  if (h > 0) parts.push(translate(locale, 'common.durationHours', { h }));
  if (m > 0) parts.push(translate(locale, 'common.durationMinutes', { m }));
  if (s > 0 || parts.length === 0) parts.push(translate(locale, 'common.durationSeconds', { s }));

  return parts.join(' ');
}
