import { parseChannelConfig } from '@autotube/config';
import { prisma } from '@autotube/database';
import {
  buildPublicationCalendar,
  computeNextPublishSlot,
  resolveAutoScheduledPublishAt,
  resolveDefaultShortCount,
  applyRetentionFeedbackToCalendar,
  type PublicationCalendar,
  type ChannelPublishInsights,
} from '@autotube/shared';
import { buildRetentionByPublishHour, deriveChannelPublishInsights } from '@autotube/analytics';
import {
  publicationPlanVideoWhere,
  reconcileOverdueYoutubeScheduledVideos,
} from './video-schedule-reconcile.js';

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
    take: 500,
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
  const insights = await deriveChannelPublishInsights(channelId);
  return resolveAutoScheduledPublishAt(config, explicit, existing, insights);
}

export type PublicationPlanEntryWithMeta = PublicationCalendar['entries'][number] & {
  /** True si `scheduledPublishAt` ya está persistido en DB (futuro). */
  isPersisted: boolean;
};

export type PublicationPlanResponse = Omit<PublicationCalendar, 'entries'> & {
  entries: PublicationPlanEntryWithMeta[];
  /** Vídeos sin fecha futura a los que se pueden aplicar sugerencias. */
  unscheduledCount: number;
  insights?: ChannelPublishInsights;
};

export async function getChannelPublicationPlan(channelId: string): Promise<PublicationPlanResponse> {
  const channel = await prisma.channel.findUniqueOrThrow({ where: { id: channelId } });
  const config = parseChannelConfig(channel.config);

  await reconcileOverdueYoutubeScheduledVideos(channelId);

  const videos = await prisma.video.findMany({
    where: publicationPlanVideoWhere(channelId),
    orderBy: { createdAt: 'asc' },
    take: 200,
    select: {
      id: true,
      title: true,
      scheduledPublishAt: true,
    },
  });

  const shortCount = resolveDefaultShortCount(config);
  const now = Date.now();
  const persistedIds = new Set(
    videos
      .filter((v) => v.scheduledPublishAt !== null && v.scheduledPublishAt.getTime() > now)
      .map((v) => v.id),
  );

  const insights = await deriveChannelPublishInsights(channelId);
  const calendar = buildPublicationCalendar(
    config,
    videos.map((v) => ({
      videoId: v.id,
      title: v.title,
      scheduledAt: v.scheduledPublishAt ?? new Date(0),
    })),
    { shortCountPerVideo: shortCount, insights },
  );

  const { channelAvgRetention, retentionByHour } = await buildRetentionByPublishHour(channelId);
  const withFeedback = applyRetentionFeedbackToCalendar(
    calendar,
    channelAvgRetention,
    retentionByHour,
  );

  return {
    ...withFeedback,
    insights,
    unscheduledCount: videos.length - persistedIds.size,
    entries: withFeedback.entries.map((entry) => ({
      ...entry,
      isPersisted: persistedIds.has(entry.videoId),
    })),
  };
}

/**
 * Persiste las fechas sugeridas del planificador en vídeos sin `scheduledPublishAt` futuro.
 * No encola publicación en YouTube — solo programa en DB.
 */
export async function applyChannelPublicationPlan(channelId: string): Promise<{
  updated: number;
  skipped: number;
  videoIds: string[];
}> {
  const channel = await prisma.channel.findUniqueOrThrow({ where: { id: channelId } });
  const config = parseChannelConfig(channel.config);

  if (!config.publishPlannerEnabled) {
    const err = new Error('El planificador no está activo en este canal');
    Object.assign(err, { statusCode: 400 });
    throw err;
  }

  await reconcileOverdueYoutubeScheduledVideos(channelId);

  const now = Date.now();
  const videos = await prisma.video.findMany({
    where: publicationPlanVideoWhere(channelId),
    orderBy: { createdAt: 'asc' },
    take: 200,
    select: {
      id: true,
      title: true,
      scheduledPublishAt: true,
    },
  });

  const insights = await deriveChannelPublishInsights(channelId);
  const shortCount = resolveDefaultShortCount(config);
  const calendar = buildPublicationCalendar(
    config,
    videos.map((v) => ({
      videoId: v.id,
      title: v.title,
      scheduledAt: v.scheduledPublishAt ?? new Date(0),
    })),
    { shortCountPerVideo: shortCount, insights },
  );

  const videoById = new Map(videos.map((v) => [v.id, v]));
  const updatedIds: string[] = [];
  let skipped = 0;

  for (const entry of calendar.entries) {
    const video = videoById.get(entry.videoId);
    if (!video) continue;

    const hasFuture =
      video.scheduledPublishAt !== null && video.scheduledPublishAt.getTime() > now;
    if (hasFuture) {
      skipped += 1;
      continue;
    }

    const scheduledAt =
      entry.scheduledAt instanceof Date ? entry.scheduledAt : new Date(entry.scheduledAt);

    await prisma.video.update({
      where: { id: video.id },
      data: { scheduledPublishAt: scheduledAt },
    });
    updatedIds.push(video.id);
  }

  return { updated: updatedIds.length, skipped, videoIds: updatedIds };
}

export async function previewNextPublishSlot(channelId: string): Promise<Date | null> {
  const channel = await prisma.channel.findUniqueOrThrow({ where: { id: channelId } });
  const config = parseChannelConfig(channel.config);
  if (!config.publishPlannerEnabled) return null;
  const existing = await fetchChannelScheduledLongDates(channelId);
  const insights = await deriveChannelPublishInsights(channelId);
  return computeNextPublishSlot(config, existing, { insights });
}
