import type { OAuth2Client } from 'google-auth-library';
import type { YouTubeVideoMetrics } from '@autotube/shared';
import { google } from 'googleapis';

export interface YouTubeMetricsResult extends YouTubeVideoMetrics {
  source: 'youtube' | 'youtube_data_api';
  raw: Record<string, unknown>;
}

const METRICS_WITH_CTR =
  'views,likes,comments,averageViewPercentage,impressionsClickThroughRate,estimatedMinutesWatched,averageViewDuration';
/** CTR (impressions) often 403s the whole query — keep retention/watch without it. */
const METRICS_WITHOUT_CTR =
  'views,likes,comments,averageViewPercentage,estimatedMinutesWatched,averageViewDuration';

function formatYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseReportRow(
  headers: string[] | null | undefined,
  row: string[] | null | undefined,
): Record<string, number> {
  const out: Record<string, number> = {};
  if (!headers || !row) return out;
  headers.forEach((key, i) => {
    const val = row[i];
    if (val == null || val === '') return;
    const num = Number(val);
    if (!Number.isNaN(num)) out[key] = num;
  });
  return out;
}

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function reportHasData(raw: Record<string, unknown>): boolean {
  const report = raw.analyticsReport as { rows?: unknown[] } | undefined;
  return Array.isArray(report?.rows) && report.rows.length > 0;
}

/** Parse YouTube ISO-8601 duration (PT#H#M#S) to seconds. */
export function parseYouTubeDurationSec(iso: string | null | undefined): number {
  if (!iso) return 0;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
  if (!m) return 0;
  const h = Number(m[1] ?? 0);
  const min = Number(m[2] ?? 0);
  const s = Number(m[3] ?? 0);
  return h * 3600 + min * 60 + s;
}

function applyParsedMetrics(parsed: Record<string, number>): {
  views: number;
  likes: number;
  comments: number;
  retention: number;
  ctr: number;
  watchTimeMinutes: number;
  averageViewDurationSec: number;
} {
  return {
    views: Math.round(parsed.views ?? 0),
    likes: Math.round(parsed.likes ?? 0),
    comments: Math.round(parsed.comments ?? 0),
    retention: (parsed.averageViewPercentage ?? 0) / 100,
    ctr: (parsed.impressionsClickThroughRate ?? 0) / 100,
    watchTimeMinutes: parsed.estimatedMinutesWatched ?? 0,
    averageViewDurationSec: parsed.averageViewDuration ?? 0,
  };
}

/** Métricas reales vía YouTube Analytics API v2 (requiere scope yt-analytics.readonly). */
export async function fetchYouTubeVideoMetrics(params: {
  auth: OAuth2Client;
  youtubeVideoId: string;
  publishedAt?: Date | null;
}): Promise<YouTubeMetricsResult> {
  const youtube = google.youtube({ version: 'v3', auth: params.auth });
  const youtubeAnalytics = google.youtubeAnalytics({ version: 'v2', auth: params.auth });

  const end = new Date();
  const start = params.publishedAt ?? new Date(end.getTime() - 28 * 86400000);
  const startDate = formatYmd(start);
  const endDate = formatYmd(end);

  let views = 0;
  let likes = 0;
  let comments = 0;
  let retention = 0;
  let ctr = 0;
  let watchTimeMinutes = 0;
  let averageViewDurationSec = 0;
  const raw: Record<string, unknown> = {
    youtubeVideoId: params.youtubeVideoId,
    startDate,
    endDate,
  };

  const runReport = async (metrics: string) => {
    const report = await youtubeAnalytics.reports.query({
      ids: 'channel==MINE',
      startDate,
      endDate,
      metrics,
      dimensions: 'video',
      filters: `video==${params.youtubeVideoId}`,
    });
    return report;
  };

  try {
    let report;
    try {
      report = await runReport(METRICS_WITH_CTR);
      raw.analyticsMetrics = 'with_ctr';
    } catch (ctrErr) {
      raw.ctrQueryError = ctrErr instanceof Error ? ctrErr.message : String(ctrErr);
      console.warn(
        '[analytics/youtube] CTR metrics failed, retrying without impressionsClickThroughRate:',
        raw.ctrQueryError,
      );
      report = await runReport(METRICS_WITHOUT_CTR);
      raw.analyticsMetrics = 'without_ctr';
    }

    raw.analyticsReport = report.data;
    const headers = report.data.columnHeaders?.map((h) => h.name ?? '') ?? [];
    const row = report.data.rows?.[0];
    const parsed = parseReportRow(headers, row);
    const applied = applyParsedMetrics(parsed);
    views = applied.views;
    likes = applied.likes;
    comments = applied.comments;
    retention = applied.retention;
    ctr = applied.ctr;
    watchTimeMinutes = applied.watchTimeMinutes;
    averageViewDurationSec = applied.averageViewDurationSec;
  } catch (err) {
    raw.analyticsError = err instanceof Error ? err.message : String(err);
    console.warn(
      '[analytics/youtube] Analytics API query failed, falling back to Data API:',
      raw.analyticsError,
    );
  }

  const dataRes = await youtube.videos.list({
    part: ['statistics', 'contentDetails'],
    id: [params.youtubeVideoId],
  });

  const item = dataRes.data.items?.[0];
  const stats = item?.statistics;
  const durationSec = parseYouTubeDurationSec(item?.contentDetails?.duration);
  raw.dataApiStatistics = stats ?? null;
  raw.durationSec = durationSec || null;

  if (stats) {
    if (views === 0 && stats.viewCount) views = parseInt(stats.viewCount, 10) || 0;
    if (likes === 0 && stats.likeCount) likes = parseInt(stats.likeCount, 10) || 0;
    if (comments === 0 && stats.commentCount) comments = parseInt(stats.commentCount, 10) || 0;
  }

  // Proxy retención si Analytics no dio % pero sí duración media de visionado.
  if (retention <= 0 && averageViewDurationSec > 0 && durationSec > 0) {
    retention = clamp01(averageViewDurationSec / durationSec);
    raw.retentionProxy = 'averageViewDuration/duration';
  }

  const usedAnalytics = !raw.analyticsError && reportHasData(raw);

  return {
    views,
    likes,
    comments,
    retention: clamp01(retention),
    ctr: clamp01(ctr),
    watchTimeMinutes,
    averageViewDurationSec,
    source: usedAnalytics ? 'youtube' : 'youtube_data_api',
    raw,
  };
}

/** Comprueba si el token OAuth tiene acceso a YouTube Analytics. */
export async function probeYouTubeAnalyticsAccess(auth: OAuth2Client): Promise<{
  ok: boolean;
  error: string | null;
}> {
  try {
    const youtubeAnalytics = google.youtubeAnalytics({ version: 'v2', auth });
    const end = new Date().toISOString().slice(0, 10);
    const start = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    await youtubeAnalytics.reports.query({
      ids: 'channel==MINE',
      startDate: start,
      endDate: end,
      metrics: 'views',
    });
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Métricas simuladas (desarrollo / mock / sin YouTube ID real). */
export function buildMockVideoMetrics(videoId: string, durationSec = 480): YouTubeVideoMetrics {
  const seed = videoId.charCodeAt(0) + videoId.charCodeAt(videoId.length - 1);
  const views = 100 + (seed * 17) % 5000;
  const retention = 0.35 + (seed % 30) / 100;
  const avgViewSec = Math.round(durationSec * retention);
  return {
    views,
    ctr: 0.04 + (seed % 10) / 100,
    retention,
    likes: 10 + (seed % 200),
    comments: seed % 50,
    watchTimeMinutes: Math.round((views * avgViewSec) / 60),
    averageViewDurationSec: avgViewSec,
  };
}
