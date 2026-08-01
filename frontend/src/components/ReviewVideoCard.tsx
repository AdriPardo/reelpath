import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { ReviewActions } from '@/components/ReviewActions';
import { VideoThumbnail } from '@/components/VideoThumbnail';
import { VideoPublishScheduleChip } from '@/components/VideoPublishScheduleChip';
import { QualityReportPanel } from '@/components/QualityReportPanel';
import { VisualOriginSummaryPanel, VisualPlaceholderBanner } from '@/components/VisualOriginPanel';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatDurationCompact } from '@/lib/format-duration';
import type { Video } from '@/lib/api';
import { formatVideoLabel } from '@/lib/video-labels';
import type { AppLocale } from '@/lib/i18n';

interface ReviewVideoCardProps {
  video: Video;
}

function formatReviewDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale === 'en' ? 'en-GB' : 'es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export async function ReviewVideoCard({ video }: ReviewVideoCardProps) {
  const locale = (await getLocale()) as AppLocale;
  const tv = await getTranslations({ locale, namespace: 'videos' });
  const isShorts = video.aspectRatio === '9:16';

  return (
    <article
      className={`review-card card-elevated${isShorts ? ' review-card-shorts' : ' review-card-long'}`}
    >
      <div className="review-card-layout">
        <div className="review-card-preview">
          <div className="review-card-frame">
            <VideoThumbnail
              videoId={video.id}
              title={video.title}
              aspectRatio={video.aspectRatio}
              hasThumbnail={!!video.thumbnailPath}
            />
          </div>
        </div>

        <div className="review-card-panel">
          <h3>
            <Link href={`/videos/${video.id}`} className="video-card-title-link">
              {video.title}
            </Link>
          </h3>

          <div className="review-meta-chips">
            <span className="review-meta-chip">{formatVideoLabel(video.format, locale)}</span>
            <span className="review-meta-chip">{formatDurationCompact(video.durationSec)}</span>
            <span className="review-meta-chip">{formatReviewDate(video.createdAt, locale)}</span>
            <StatusBadge status={video.reviewStatus} />
            {video.visualSummary && (
              <VisualOriginSummaryPanel summary={video.visualSummary} compact />
            )}
          </div>

          {video.visualSummary?.hasPlaceholders && <VisualPlaceholderBanner />}

          <div className="review-publish-schedule">
            <VideoPublishScheduleChip
              reviewStatus={video.reviewStatus}
              scheduledPublishAt={video.scheduledPublishAt}
              publishedAt={video.publishedAt}
              youtubeVideoId={video.youtubeVideoId}
              channel={video.channel}
              showUnscheduled
            />
          </div>

          {video.qualityReport && (
            <QualityReportPanel report={video.qualityReport} compact />
          )}

          <div className="action-group review-card-actions">
            <ReviewActions videoId={video.id} channelId={video.channelId} layout="stacked" />
          </div>

          <Link href={`/videos/${video.id}`} className="btn btn-ghost btn-sm review-card-detail-link">
            {tv('viewDetail')} →
          </Link>
        </div>
      </div>
    </article>
  );
}
