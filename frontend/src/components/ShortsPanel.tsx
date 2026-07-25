import { getLocale, getTranslations } from 'next-intl/server';
import { ShortsClipsSection } from '@/components/ShortsClipsSection';
import { fetchVideoClips, type VideoClip } from '@/lib/clips';
import type { ShortsMode } from '@autotube/shared';

interface ShortsPanelProps {
  videoId: string;
  shortsMode?: ShortsMode;
  shortsPerVideo?: number;
  longShortsFromVideo?: number;
  publishYoutubeShorts?: boolean;
  /** Clips precargados (p. ej. desde detalle de pipeline). */
  initialClips?: VideoClip[];
}

export async function ShortsPanel({
  videoId,
  shortsMode,
  shortsPerVideo,
  longShortsFromVideo,
  publishYoutubeShorts,
  initialClips,
}: ShortsPanelProps) {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: 'videos' });

  let clips: VideoClip[] = initialClips ?? [];
  let loadError = false;

  if (!initialClips) {
    try {
      clips = await fetchVideoClips(videoId);
    } catch {
      loadError = true;
    }
  }

  if (loadError) {
    return (
      <section className="card shorts-clips-panel">
        <h3>{t('shorts.title')}</h3>
        <p className="pipeline-error text-sm">{t('clips.loadError')}</p>
      </section>
    );
  }

  const sourceClips = clips.filter((c) => c.platform === 'short_source');
  if (sourceClips.length === 0 && publishYoutubeShorts === false) {
    return null;
  }

  return (
    <ShortsClipsSection
      videoId={videoId}
      clips={clips}
      shortsMode={shortsMode}
      shortsPerVideo={shortsPerVideo}
      longShortsFromVideo={longShortsFromVideo}
      locale={locale}
      emptyMessage={publishYoutubeShorts ? t('shorts.autoEmpty') : undefined}
    />
  );
}
