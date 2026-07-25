import { parseChannelConfig } from '@autotube/config';
import { prisma } from '@autotube/database';
import {
  buildPublicationCalendar,
  computeNextPublishSlot,
  resolveAutoScheduledPublishAt,
  resolveDefaultShortCount,
  applyRetentionFeedbackToCalendar,
  type PublicationCalendar,
} from '@autotube/shared';
import { buildRetentionByPublishHour } from '@autotube/analytics';

export { resolveAutoScheduledPublishAt };

/** Vídeos largos ya programados en el canal (futuros). */
export async function fetchChannelScheduledLongDates(
  channelId: string,
  excludeVideoId?: string,
): Promise<Date[]> {
  const videos = await prisma.video.findMany({
    where: {
      channelId,
      scheduledPublishAt: { gt: new Date() },
      ...(excludeVideoId ? { id: { not: excludeVideoId } } : {}),
    },
    select: { scheduledPublishAt: true },
  });
  return videos
    .map((v) => v.scheduledPublishAt)
    .filter((d): d is Date => d !== null);
}

export async function resolveChannelAutoPublishAt(
  channelId: string,
  config: ReturnType<typeof parseChannelConfig>,
  explicit: Date | null | undefined,
  excludeVideoId?: string,
): Promise<Date | null> {
  const existing = await fetchChannelScheduledLongDates(channelId, excludeVideoId);
  return resolveAutoScheduledPublishAt(config, explicit, existing);
}

export async function getChannelPublicationPlan(channelId: string): Promise<PublicationCalendar> {
  const channel = await prisma.channel.findUniqueOrThrow({ where: { id: channelId } });
  const config = parseChannelConfig(channel.config);

  const videos = await prisma.video.findMany({
    where: {
      channelId,
      reviewStatus: { in: ['pending', 'approved', 'scheduled'] },
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      title: true,
      scheduledPublishAt: true,
    },
  });

  const shortCount = resolveDefaultShortCount(config);

  const calendar = buildPublicationCalendar(
    config,
    videos.map((v) => ({
      videoId: v.id,
      title: v.title,
      scheduledAt: v.scheduledPublishAt ?? new Date(0),
    })),
    { shortCountPerVideo: shortCount },
  );

  const { channelAvgRetention, retentionByHour } = await buildRetentionByPublishHour(channelId);
  return applyRetentionFeedbackToCalendar(calendar, channelAvgRetention, retentionByHour);
}

export async function previewNextPublishSlot(channelId: string): Promise<Date | null> {
  const channel = await prisma.channel.findUniqueOrThrow({ where: { id: channelId } });
  const config = parseChannelConfig(channel.config);
  if (!config.publishPlannerEnabled) return null;
  const existing = await fetchChannelScheduledLongDates(channelId);
  return computeNextPublishSlot(config, existing);
}
