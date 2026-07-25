import type { ShortsMode } from '@autotube/shared';
import { resolveLongShortsFromVideo, resolveMixedShortsCounts } from '@autotube/shared';
import { translate, type AppLocale } from '@/lib/i18n';

export function clipKindLabel(
  partIndex: number,
  shortsMode?: ShortsMode,
  shortsPerVideo?: number,
  longShortsFromVideo?: number,
  locale: AppLocale = 'es',
): string {
  if (shortsMode === 'mixed') {
    const { splitCount } = resolveMixedShortsCounts({ shortsPerVideo, longShortsFromVideo });
    if (partIndex < splitCount) {
      return splitCount > 1
        ? translate(locale, 'videos.clips.kind.cutFromLongN', { n: partIndex + 1, total: splitCount })
        : translate(locale, 'videos.clips.kind.cutFromLong');
    }
    return translate(locale, 'videos.clips.kind.teaser');
  }
  if (shortsMode === 'dedicated') return translate(locale, 'videos.clips.kind.teaser');
  const fromLong = resolveLongShortsFromVideo(longShortsFromVideo);
  if (fromLong != null) return translate(locale, 'videos.clips.kind.partN', { n: partIndex + 1 });
  return translate(locale, 'videos.clips.kind.vertical');
}

export function shortsSectionTitle(shortsMode?: ShortsMode, locale: AppLocale = 'es'): string {
  if (shortsMode === 'mixed') return translate(locale, 'videos.shorts.mixedTitle');
  if (shortsMode === 'dedicated') return translate(locale, 'videos.shorts.dedicatedTitle');
  return translate(locale, 'videos.shorts.title');
}
