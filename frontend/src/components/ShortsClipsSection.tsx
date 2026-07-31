import { ShortClipActions } from '@/components/ShortClipActions';
import { MarkClipPublishedButton } from '@/components/MarkClipPublishedButton';
import { RepublishShortsButton } from '@/components/RepublishShortsButton';
import { clipKindLabel, shortsSectionTitle } from '@/lib/clip-labels';
import { formatDurationCompact } from '@/lib/format-duration';
import { translate, type AppLocale } from '@/lib/i18n';
import type { VideoClip } from '@/lib/clips';
import type { ShortsMode } from '@autotube/shared';

function shortUrl(clip: VideoClip): string | null {
  if (!clip.externalId || clip.externalId.startsWith('mock_')) return null;
  return `https://www.youtube.com/shorts/${clip.externalId}`;
}

function formatScheduledDate(value: string, locale: AppLocale): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(locale === 'en' ? 'en-GB' : 'es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface ShortsClipsSectionProps {
  videoId: string;
  clips: VideoClip[];
  shortsMode?: ShortsMode;
  shortsPerVideo?: number;
  longShortsFromVideo?: number;
  emptyMessage?: string;
  subtitle?: string;
  locale?: AppLocale | string;
}

export function ShortsClipsSection({
  videoId,
  clips,
  shortsMode,
  shortsPerVideo,
  longShortsFromVideo,
  emptyMessage,
  subtitle,
  locale = 'es',
}: ShortsClipsSectionProps) {
  const loc: AppLocale = locale === 'en' ? 'en' : 'es';

  const sourceClips = clips
    .filter((c) => c.platform === 'short_source')
    .sort((a, b) => a.partIndex - b.partIndex);
  const publishedByPart = new Map(
    clips.filter((c) => c.platform === 'youtube_shorts').map((c) => [c.partIndex, c]),
  );

  const publishedCount = [...publishedByPart.values()].filter(
    (c) => c.publishStatus === 'published' || c.publishStatus === 'scheduled',
  ).length;

  const needsShortsRepublish = sourceClips.some((clip) => {
    const published = publishedByPart.get(clip.partIndex);
    if (!published) return true;
    if (published.publishStatus === 'failed' || published.publishStatus === 'pending') return true;
    if (published.externalId?.startsWith('mock_')) return true;
    return false;
  });

  const defaultSubtitle =
    shortsMode === 'mixed'
      ? translate(loc, 'videos.clips.mixedDesc')
      : shortsMode === 'dedicated'
        ? translate(loc, 'videos.clips.dedicatedDesc')
        : translate(loc, 'videos.clips.defaultDesc');

  const publishedSuffix =
    sourceClips.length > 0
      ? translate(loc, 'videos.clips.publishedCount', {
          published: publishedCount,
          total: sourceClips.length,
        })
      : '';

  return (
    <section className="card shorts-clips-panel">
      <h3>
        {shortsSectionTitle(shortsMode, loc)}
        {publishedSuffix}
      </h3>
      <p className="text-muted text-sm">{subtitle ?? defaultSubtitle}</p>
      {needsShortsRepublish && sourceClips.length > 0 && (
        <div className="clip-actions-row" style={{ marginTop: '0.75rem' }}>
          <RepublishShortsButton videoId={videoId} compact />
        </div>
      )}

      {sourceClips.length === 0 ? (
        <p className="text-muted text-sm" style={{ marginTop: '0.75rem' }}>
          {emptyMessage ?? translate(loc, 'videos.clips.emptyDefault')}
        </p>
      ) : (
        <ul className="clip-list">
          {sourceClips.map((clip) => {
            const published = publishedByPart.get(clip.partIndex);
            const url = published ? shortUrl(published) : null;
            const status = published?.publishStatus ?? 'pending';
            const scheduledAt =
              published?.scheduledPublishAt &&
              (status === 'scheduled' || status === 'failed' || status === 'pending')
                ? published.scheduledPublishAt
                : null;
            const badgeClass =
              status === 'published'
                ? 'badge-approved'
                : status === 'failed'
                  ? 'badge-rejected'
                  : status === 'scheduled'
                    ? 'badge-approved'
                    : 'badge-pending';
            const label =
              status === 'published'
                ? translate(loc, 'videos.clips.published')
                : status === 'failed'
                  ? translate(loc, 'videos.clips.error')
                  : status === 'scheduled'
                    ? published?.externalId
                      ? translate(loc, 'videos.clips.scheduledYoutube')
                      : translate(loc, 'videos.clips.scheduled')
                    : translate(loc, 'videos.clips.pending');
            const kind = clipKindLabel(clip.partIndex, shortsMode, shortsPerVideo, longShortsFromVideo, loc);

            return (
              <li key={clip.id} className="clip-item">
                <div className="clip-item-header">
                  <span className="clip-part">{kind}</span>
                  <span className="clip-title">{clip.title}</span>
                  <span className="clip-meta">{formatDurationCompact(clip.durationSec)}</span>
                  <span className={`badge ${badgeClass}`}>{label}</span>
                  {scheduledAt && (
                    <span className="clip-meta text-muted">
                      {published?.externalId ? translate(loc, 'videos.clips.onYoutube') : ''}
                      {formatScheduledDate(scheduledAt, loc)}
                    </span>
                  )}
                  {published?.error && (
                    <span className="clip-error" title={published.error}>
                      {published.error.slice(0, 80)}
                    </span>
                  )}
                </div>
                <ShortClipActions videoId={videoId} clip={clip} />
                {(status === 'pending' || status === 'failed') && (
                  <MarkClipPublishedButton
                    videoId={videoId}
                    clipId={published?.id ?? clip.id}
                    compact
                  />
                )}
                {url && (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost btn-sm"
                  >
                    {translate(loc, 'videos.clips.viewShortYoutube')}
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
