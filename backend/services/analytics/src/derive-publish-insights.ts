import { prisma } from '@autotube/database';
import { parseChannelConfig } from '@autotube/config';
import {
  buildPublishInsights,
  emptyPublishInsights,
  getZonedParts,
  type ChannelPublishInsights,
  type PublishBucketMetrics,
} from '@autotube/shared';

function avgMetrics(
  items: Array<{ retention: number; views: number; ctr: number }>,
): PublishBucketMetrics {
  const n = items.length || 1;
  return {
    retention: items.reduce((s, i) => s + i.retention, 0) / n,
    views: items.reduce((s, i) => s + i.views, 0) / n,
    ctr: items.reduce((s, i) => s + i.ctr, 0) / n,
  };
}

/**
 * Deriva mejores horas/días de publicación a partir de AnalyticsSnapshot del canal.
 * Confianza cuando hay ≥5 vídeos con métricas reales.
 */
export async function deriveChannelPublishInsights(
  channelId: string,
): Promise<ChannelPublishInsights> {
  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel) return emptyPublishInsights();

  const timezone = parseChannelConfig(channel.config).timezone ?? 'Europe/Madrid';

  const snapshots = await prisma.analyticsSnapshot.findMany({
    where: { channelId, videoId: { not: null } },
    orderBy: { snapshotAt: 'desc' },
    take: 400,
    include: {
      video: { select: { publishedAt: true, scheduledPublishAt: true } },
    },
  });

  const latestByVideo = new Map<string, (typeof snapshots)[number]>();
  for (const snap of snapshots) {
    if (!snap.videoId) continue;
    if (!latestByVideo.has(snap.videoId)) {
      latestByVideo.set(snap.videoId, snap);
    }
  }

  const byHour = new Map<number, Array<{ retention: number; views: number; ctr: number }>>();
  const byDay = new Map<number, Array<{ retention: number; views: number; ctr: number }>>();

  for (const snap of latestByVideo.values()) {
    const publishAt = snap.video?.publishedAt ?? snap.video?.scheduledPublishAt;
    if (!publishAt) continue;
    const parts = getZonedParts(publishAt, timezone);
    const point = { retention: snap.retention, views: snap.views, ctr: snap.ctr };
    const hourList = byHour.get(parts.hour) ?? [];
    hourList.push(point);
    byHour.set(parts.hour, hourList);
    const dayList = byDay.get(parts.weekday) ?? [];
    dayList.push(point);
    byDay.set(parts.weekday, dayList);
  }

  const sampleCount = [...byHour.values()].reduce((n, list) => n + list.length, 0);
  if (sampleCount === 0) return emptyPublishInsights();

  const hourBuckets = new Map<number, PublishBucketMetrics>();
  for (const [hour, list] of byHour) {
    hourBuckets.set(hour, avgMetrics(list));
  }
  const dayBuckets = new Map<number, PublishBucketMetrics>();
  for (const [day, list] of byDay) {
    dayBuckets.set(day, avgMetrics(list));
  }

  return buildPublishInsights({ sampleCount, hourBuckets, dayBuckets });
}
