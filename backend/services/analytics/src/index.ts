import { loadConfig } from '@autotube/config';
import { prisma } from '@autotube/database';
import { promptEngine } from '@autotube/prompt-engine';
import type { YouTubeAnalyticsInsights, YouTubeAnalyticsSummary } from '@autotube/shared';
import {
  createYouTubeOAuthFromCredentials,
  resolveYouTubeCredentialsForChannel,
} from '@autotube/youtube-publisher';
import {
  buildMockVideoMetrics,
  fetchYouTubeVideoMetrics,
  type YouTubeMetricsResult,
} from './youtube-analytics.js';
import { buildRetentionByPublishHour } from './retention-by-hour.js';

export { buildRetentionByPublishHour };

export type { VideoMetrics } from './types.js';
import type { VideoMetrics } from './types.js';

export type MetricsSource = 'youtube' | 'youtube_data_api' | 'mock';

export interface SyncVideoAnalyticsResult extends VideoMetrics {
  source: MetricsSource;
}

function isRealYouTubeId(id: string | null | undefined): id is string {
  return !!id && !id.startsWith('mock_');
}

async function resolveMetrics(
  channelId: string,
  videoId: string,
  youtubeVideoId: string | null,
  publishedAt: Date | null,
  durationSec?: number,
): Promise<{ metrics: VideoMetrics; source: MetricsSource; raw: Record<string, unknown> }> {
  const config = loadConfig();

  if (!config.MOCK_EXTERNAL_APIS && isRealYouTubeId(youtubeVideoId)) {
    const creds = await resolveYouTubeCredentialsForChannel(channelId);
    if (creds) {
      try {
        const auth = createYouTubeOAuthFromCredentials(creds);
        const result: YouTubeMetricsResult = await fetchYouTubeVideoMetrics({
          auth,
          youtubeVideoId,
          publishedAt,
        });
        console.info(
          `[analytics] YouTube real metrics video=${youtubeVideoId} views=${result.views} source=${result.source}`,
        );
        return {
          metrics: result,
          source: result.source,
          raw: { ...result.raw, source: result.source },
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[analytics] YouTube fetch failed, using mock: ${message}`);
        return {
          metrics: buildMockVideoMetrics(videoId, durationSec),
          source: 'mock',
          raw: { source: 'mock', youtubeError: message },
        };
      }
    }
  }

  return {
    metrics: buildMockVideoMetrics(videoId, durationSec),
    source: 'mock',
    raw: { source: 'mock', reason: 'mock_credentials_or_video_id' },
  };
}

async function persistSnapshot(
  channelId: string,
  videoId: string,
  metrics: VideoMetrics,
  raw: Record<string, unknown>,
) {
  return prisma.analyticsSnapshot.create({
    data: {
      channelId,
      videoId,
      views: metrics.views,
      ctr: metrics.ctr,
      retention: metrics.retention,
      likes: metrics.likes,
      comments: metrics.comments,
      watchTimeMinutes: metrics.watchTimeMinutes,
      averageViewDurationSec: metrics.averageViewDurationSec,
      raw: raw as object,
    },
  });
}

export async function syncVideoAnalytics(videoId: string): Promise<SyncVideoAnalyticsResult> {
  const video = await prisma.video.findUniqueOrThrow({
    where: { id: videoId },
    include: { pipelineRun: { include: { scripts: true } } },
  });

  const { metrics, source, raw } = await resolveMetrics(
    video.channelId,
    videoId,
    video.youtubeVideoId,
    video.publishedAt,
    video.durationSec,
  );

  await persistSnapshot(video.channelId, video.id, metrics, raw);

  const script = video.pipelineRun.scripts[0];
  if (script?.hookVariantUsed && source !== 'mock') {
    const binding = await prisma.promptBinding.findFirst({
      where: { channelId: video.channelId, promptType: 'script_generation' },
      include: { promptVersion: { include: { variants: true } } },
    });

    const variant = binding?.promptVersion.variants.find(
      (v) => v.variantKey === script.hookVariantUsed,
    );

    if (variant && binding) {
      await promptEngine.recordAbResult({
        promptVersionId: binding.promptVersionId,
        variantId: variant.id,
        pipelineRunId: video.pipelineRunId,
        metric: 'retention_proxy',
        value: metrics.retention,
      });
    }
  }

  return { ...metrics, source };
}

export async function syncChannelYouTubeAnalytics(channelId: string): Promise<{
  synced: number;
  skipped: number;
  results: Array<{ videoId: string; title: string; source: MetricsSource }>;
}> {
  const videos = await prisma.video.findMany({
    where: {
      channelId,
      reviewStatus: 'published',
      youtubeVideoId: { not: null },
    },
    select: { id: true, title: true, youtubeVideoId: true },
    orderBy: { publishedAt: 'desc' },
    take: 50,
  });

  const results: Array<{ videoId: string; title: string; source: MetricsSource }> = [];
  let skipped = 0;

  for (const video of videos) {
    if (!isRealYouTubeId(video.youtubeVideoId)) {
      skipped += 1;
      continue;
    }
    const result = await syncVideoAnalytics(video.id);
    results.push({ videoId: video.id, title: video.title, source: result.source });
  }

  return { synced: results.length, skipped, results };
}

function buildSummaryFromSnapshots(
  snapshots: Array<{
    views: number;
    ctr: number;
    retention: number;
    watchTimeMinutes: number;
    averageViewDurationSec: number;
    videoId: string | null;
  }>,
): YouTubeAnalyticsSummary {
  const latestByVideo = new Map<string, (typeof snapshots)[number]>();
  for (const snap of snapshots) {
    if (!snap.videoId) continue;
    if (!latestByVideo.has(snap.videoId)) {
      latestByVideo.set(snap.videoId, snap);
    }
  }
  const unique = [...latestByVideo.values()];
  const count = unique.length || snapshots.length;
  const pool = unique.length > 0 ? unique : snapshots;

  const totals = pool.reduce(
    (acc, s) => ({
      views: acc.views + s.views,
      watchTime: acc.watchTime + s.watchTimeMinutes,
      ctr: acc.ctr + s.ctr,
      retention: acc.retention + s.retention,
      avgDur: acc.avgDur + s.averageViewDurationSec,
    }),
    { views: 0, watchTime: 0, ctr: 0, retention: 0, avgDur: 0 },
  );

  return {
    totalViews: totals.views,
    totalWatchTimeMinutes: Math.round(totals.watchTime * 10) / 10,
    avgCtr: count ? totals.ctr / count : 0,
    avgRetention: count ? totals.retention / count : 0,
    avgViewDurationSec: count ? totals.avgDur / count : 0,
    videoCount: unique.length,
  };
}

export async function getChannelYouTubeAnalytics(channelId: string) {
  const snapshots = await prisma.analyticsSnapshot.findMany({
    where: { channelId },
    orderBy: { snapshotAt: 'desc' },
    take: 100,
    include: { video: { select: { id: true, title: true, youtubeVideoId: true, publishedAt: true } } },
  });

  const summary = buildSummaryFromSnapshots(snapshots);

  return { snapshots, summary };
}

export async function getVideoYouTubeAnalytics(videoId: string) {
  const snapshots = await prisma.analyticsSnapshot.findMany({
    where: { videoId },
    orderBy: { snapshotAt: 'desc' },
    take: 20,
  });

  const latest = snapshots[0] ?? null;
  return { snapshots, latest };
}

export async function getChannelAnalyticsInsights(channelId: string): Promise<YouTubeAnalyticsInsights> {
  const { snapshots, summary } = await getChannelYouTubeAnalytics(channelId);

  if (snapshots.length === 0 || summary.videoCount === 0) {
    return {
      hasData: false,
      summary: 'Aún no hay métricas sincronizadas para este canal.',
      bullets: [
        'Conecta YouTube con el scope de Analytics en la pestaña Cuentas.',
        'Publica al menos un vídeo y pulsa «Sincronizar» en Analíticas.',
      ],
    };
  }

  const ctrPct = (summary.avgCtr * 100).toFixed(1);
  const retentionPct = (summary.avgRetention * 100).toFixed(0);
  const watchHours = (summary.totalWatchTimeMinutes / 60).toFixed(1);
  const avgMin = (summary.avgViewDurationSec / 60).toFixed(1);

  const bullets: string[] = [
    `${summary.totalViews.toLocaleString('es')} vistas acumuladas en ${summary.videoCount} vídeo(s) con datos.`,
    `Tiempo de visualización total: ~${watchHours} horas.`,
    `CTR medio: ${ctrPct}% · retención media: ${retentionPct}%.`,
    `Duración media de visualización: ${avgMin} min por sesión.`,
  ];

  if (summary.avgCtr < 0.03) {
    bullets.push('El CTR está por debajo del 3%: prueba miniaturas y títulos más contrastados.');
  } else if (summary.avgCtr > 0.06) {
    bullets.push('Buen CTR: las miniaturas y títulos están funcionando bien.');
  }

  if (summary.avgRetention < 0.3) {
    bullets.push('La retención es baja: revisa ganchos de los primeros 30 segundos.');
  }

  return {
    hasData: true,
    summary: `Canal con ${summary.totalViews.toLocaleString('es')} vistas y ${watchHours} h de reproducción.`,
    bullets,
  };
}

/** @deprecated Use getChannelYouTubeAnalytics */
export async function getChannelAnalytics(channelId: string) {
  const data = await getChannelYouTubeAnalytics(channelId);
  return {
    snapshots: data.snapshots,
    summary: {
      totalViews: data.summary.totalViews,
      avgCtr: data.summary.avgCtr,
      avgRetention: data.summary.avgRetention,
    },
  };
}

export { getOrgAnalyticsSummary } from './org-analytics.js';
export type { OrgAnalyticsSummary, OrgAnalyticsTopVideo } from './org-analytics.js';
