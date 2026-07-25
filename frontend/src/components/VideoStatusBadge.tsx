'use client';

import { useTranslations } from 'next-intl';
import { Chip } from '@/components/ui/Chip';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  formatPublishDate,
  formatPublishDateShort,
  resolveChannelTimezone,
} from '@/lib/format-publish-date';

export function VideoStatusBadge({
  reviewStatus,
  scheduledPublishAt,
  publishedAt,
  youtubeVideoId,
  channel,
}: {
  reviewStatus: string;
  scheduledPublishAt?: string | null;
  publishedAt?: string | null;
  youtubeVideoId?: string | null;
  channel?: { config?: Record<string, unknown>; timezone?: string } | null;
}) {
  const tc = useTranslations('common');
  const tv = useTranslations('videos.status');
  const timezone = resolveChannelTimezone(channel);

  if ((reviewStatus === 'published' || youtubeVideoId) && publishedAt) {
    const when = formatPublishDateShort(publishedAt, timezone);
    return (
      <Chip
        variant="success"
        className="chip-wrap chip-stacked"
        title={tc('publishedOn', { date: formatPublishDate(publishedAt, timezone) })}
      >
        <span className="chip-primary">{tv('published')}</span>
        <span className="chip-secondary">{when}</span>
      </Chip>
    );
  }

  if (reviewStatus === 'scheduled' && scheduledPublishAt) {
    const when = formatPublishDateShort(scheduledPublishAt, timezone);
    if (youtubeVideoId) {
      return (
        <Chip
          variant="neutral"
          className="chip-wrap chip-stacked"
          title={tc('scheduledFor', { date: formatPublishDate(scheduledPublishAt, timezone) })}
        >
          <span className="chip-primary">{tv('scheduledYoutube')}</span>
          <span className="chip-secondary">{when}</span>
        </Chip>
      );
    }
    return <Chip variant="neutral">{tv('schedulingYoutube')}</Chip>;
  }

  return <StatusBadge status={reviewStatus} />;
}
