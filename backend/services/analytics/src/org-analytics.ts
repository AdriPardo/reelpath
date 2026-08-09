import { prisma } from '@autotube/database';
import { averageEngagement } from './engagement.js';

export { averageEngagement } from './engagement.js';

export interface OrgAnalyticsTopVideo {
  videoId: string;
  title: string;
  channelName: string;
  views: number;
  source: 'youtube' | 'youtube_data_api' | 'mock';
}

export interface OrgAnalyticsSummary {
  totalViews: number;
  videoCount: number;
  channelCount: number;
  hasMockData: boolean;
  /** 0–1. Null when no snapshot has real CTR/retention yet. */
  avgCtr: number | null;
  /** 0–1. Null when no snapshot has real CTR/retention yet. */
  avgRetention: number | null;
  /** Videos included in CTR/retention averages. */
  engagementSampleCount: number;
  topVideos: OrgAnalyticsTopVideo[];
}

function metricsSource(raw: unknown): OrgAnalyticsTopVideo['source'] {
  if (!raw || typeof raw !== 'object') return 'mock';
  const source = (raw as { source?: string }).source;
  if (source === 'youtube') return 'youtube';
  if (source === 'youtube_data_api') return 'youtube_data_api';
  return 'mock';
}

export async function getOrgAnalyticsSummary(orgId: string): Promise<OrgAnalyticsSummary> {
  const channels = await prisma.channel.findMany({
    where: { organizationId: orgId },
    select: { id: true, name: true },
  });

  const channelIds = channels.map((c) => c.id);
  const channelNameById = new Map(channels.map((c) => [c.id, c.name]));

  if (channelIds.length === 0) {
    return {
      totalViews: 0,
      videoCount: 0,
      channelCount: 0,
      hasMockData: false,
      avgCtr: null,
      avgRetention: null,
      engagementSampleCount: 0,
      topVideos: [],
    };
  }

  const snapshots = await prisma.analyticsSnapshot.findMany({
    where: { channelId: { in: channelIds }, videoId: { not: null } },
    orderBy: { snapshotAt: 'desc' },
    take: 500,
    include: {
      video: { select: { id: true, title: true, channelId: true } },
    },
  });

  const latestByVideo = new Map<
    string,
    {
      views: number;
      ctr: number;
      retention: number;
      title: string;
      channelId: string;
      source: OrgAnalyticsTopVideo['source'];
    }
  >();

  let hasMockData = false;

  for (const snap of snapshots) {
    if (!snap.videoId || !snap.video) continue;
    if (latestByVideo.has(snap.videoId)) continue;

    const source = metricsSource(snap.raw);
    if (source === 'mock') hasMockData = true;

    latestByVideo.set(snap.videoId, {
      views: snap.views,
      ctr: snap.ctr ?? 0,
      retention: snap.retention ?? 0,
      title: snap.video.title,
      channelId: snap.video.channelId,
      source,
    });
  }

  const videos = [...latestByVideo.entries()].map(([videoId, data]) => ({
    videoId,
    title: data.title,
    channelName: channelNameById.get(data.channelId) ?? 'Canal',
    views: data.views,
    source: data.source,
  }));

  videos.sort((a, b) => b.views - a.views);

  const metrics = [...latestByVideo.values()];
  const engagement = averageEngagement(metrics);

  return {
    totalViews: videos.reduce((sum, v) => sum + v.views, 0),
    videoCount: videos.length,
    channelCount: channels.length,
    hasMockData,
    avgCtr: engagement.avgCtr,
    avgRetention: engagement.avgRetention,
    engagementSampleCount: engagement.sampleCount,
    topVideos: videos.slice(0, 5),
  };
}
