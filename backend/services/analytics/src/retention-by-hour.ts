import { prisma } from '@autotube/database';
import type { RetentionByPublishHour } from '@autotube/shared';
import { parseChannelConfig } from '@autotube/config';

function getZonedHour(date: Date, timeZone: string): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    hour12: false,
  });
  return Number(fmt.format(date)) % 24;
}

/** Agrupa retención media por hora de publicación (timezone del canal). */
export async function buildRetentionByPublishHour(
  channelId: string,
): Promise<{ channelAvgRetention: number; retentionByHour: RetentionByPublishHour }> {
  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  const timezone = parseChannelConfig(channel?.config).timezone ?? 'Europe/Madrid';

  const snapshots = await prisma.analyticsSnapshot.findMany({
    where: { channelId, videoId: { not: null } },
    orderBy: { snapshotAt: 'desc' },
    take: 200,
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

  const buckets = new Map<number, { total: number; count: number }>();
  let retentionSum = 0;
  let retentionCount = 0;

  for (const snap of latestByVideo.values()) {
    const publishAt = snap.video?.publishedAt ?? snap.video?.scheduledPublishAt;
    if (!publishAt) continue;
    const hour = getZonedHour(publishAt, timezone);
    const bucket = buckets.get(hour) ?? { total: 0, count: 0 };
    bucket.total += snap.retention;
    bucket.count += 1;
    buckets.set(hour, bucket);
    retentionSum += snap.retention;
    retentionCount += 1;
  }

  const retentionByHour: RetentionByPublishHour = new Map();
  for (const [hour, data] of buckets) {
    retentionByHour.set(hour, {
      avgRetention: data.total / data.count,
      sampleCount: data.count,
    });
  }

  return {
    channelAvgRetention: retentionCount > 0 ? retentionSum / retentionCount : 0,
    retentionByHour,
  };
}
