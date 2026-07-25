'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Chip } from '@/components/ui/Chip';
import {
  formatPublishDate,
  formatPublishDateShort,
  resolveChannelTimezone,
} from '@/lib/format-publish-date';

export function VideoPublishScheduleChip({
  reviewStatus,
  scheduledPublishAt,
  publishedAt,
  youtubeVideoId,
  channel,
  showUnscheduled = false,
}: {
  reviewStatus: string;
  scheduledPublishAt?: string | null;
  publishedAt?: string | null;
  youtubeVideoId?: string | null;
  channel?: { config?: Record<string, unknown>; timezone?: string } | null;
  showUnscheduled?: boolean;
}) {
  const t = useTranslations('videos');
  const locale = useLocale();
  const timezone = resolveChannelTimezone(channel);

  if ((reviewStatus === 'published' || youtubeVideoId) && publishedAt) {
    const when = formatPublishDateShort(publishedAt, timezone, locale);
    const fullDate = formatPublishDate(publishedAt, timezone, locale);
    return (
      <Chip
        variant="success"
        className="chip-wrap"
        title={t('schedule.publishedOn', { date: fullDate })}
      >
        {t('schedule.published', { when })}
      </Chip>
    );
  }

  if (reviewStatus === 'scheduled' && scheduledPublishAt) {
    const when = formatPublishDateShort(scheduledPublishAt, timezone, locale);
    const fullWhen = formatPublishDate(scheduledPublishAt, timezone, locale);
    const label = youtubeVideoId
      ? t('schedule.scheduledYoutubeFull', { when: fullWhen })
      : t('schedule.publicationFull', { when: fullWhen });
    const display = youtubeVideoId
      ? t('schedule.scheduledYoutubeFull', { when })
      : t('schedule.publicationShort', { when });
    return (
      <Chip variant="neutral" className="chip-wrap" title={label}>
        {display}
      </Chip>
    );
  }

  if (scheduledPublishAt) {
    const when = formatPublishDateShort(scheduledPublishAt, timezone, locale);
    const fullWhen = formatPublishDate(scheduledPublishAt, timezone, locale);
    return (
      <Chip
        variant="neutral"
        className="chip-wrap"
        title={t('schedule.publicationFull', { when: fullWhen })}
      >
        {t('schedule.publicationShort', { when })}
      </Chip>
    );
  }

  if (showUnscheduled && reviewStatus === 'pending') {
    return (
      <Chip variant="neutral" size="sm" title={t('noDateAssigned')}>
        {t('unscheduled')}
      </Chip>
    );
  }

  return null;
}
