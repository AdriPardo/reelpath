import type { ContentScoreBreakdown } from '@autotube/shared';
import { API_URL } from './api-url';
import { getToken, isAuthRequired } from './auth';
import { parseApiError } from './user-messages';
import type { AppLocale } from './i18n';

export function getApiUrl(): string {
  return API_URL;
}

/** Locale activo en el cliente (cookie NEXT_LOCALE de next-intl). */
export function getClientLocale(): AppLocale {
  if (typeof document === 'undefined') return 'es';
  const match = document.cookie.match(/(?:^|;\s*)NEXT_LOCALE=(\w+)/);
  return match?.[1] === 'en' ? 'en' : 'es';
}

function localeHeader(): Record<string, string> {
  const locale = getClientLocale();
  return { 'Accept-Language': locale === 'en' ? 'en-US,en;q=0.9' : 'es-ES,es;q=0.9' };
}

function mediaPath(apiPath: string): string {
  if (isAuthRequired()) return `/api/media/${apiPath}`;
  return `${API_URL}/api/${apiPath}`;
}

export async function checkApiHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/health`, { cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  }
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function requestHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...localeHeader(),
    ...authHeaders(),
  };
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...requestHeaders(),
      ...init?.headers,
    },
    cache: 'no-store',
  });
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) throw new Error(parseApiError(await res.text(), undefined, getClientLocale()));
  return res.json() as Promise<T>;
}

export interface Channel {
  id: string;
  name: string;
  slug: string;
  niche: string;
  isActive: boolean;
  integrations?: {
    youtube: IntegrationSummary;
  };
  stats?: {
    pendingReview: number;
    activeGenerations: number;
    lastGenerationAt: string | null;
  };
}

export interface IntegrationSummary {
  connected: boolean;
  tokenOk: boolean;
  source: 'channel' | 'env' | 'none';
}

export interface IntegrationProviderStatus extends IntegrationSummary {
  provider: 'youtube';
  error: string | null;
  channelTitle?: string | null;
  privacyStatus?: string;
  oauthAvailable?: boolean;
  analyticsOk?: boolean;
  analyticsError?: string | null;
}

export interface ChannelIntegrationsResponse {
  channelId: string;
  youtube: IntegrationProviderStatus;
}

export function videoStreamUrl(id: string): string {
  return mediaPath(`videos/${id}/stream`);
}

export function videoThumbnailUrl(id: string): string {
  return mediaPath(`videos/${id}/thumbnail`);
}

export function clipStreamUrl(videoId: string, clipId: string): string {
  return mediaPath(`videos/${videoId}/clips/${clipId}/stream`);
}

export function clipThumbnailUrl(videoId: string, clipId: string): string {
  return mediaPath(`videos/${videoId}/clips/${clipId}/thumbnail`);
}

export interface Video {
  id: string;
  title: string;
  description?: string;
  thumbnailPath?: string | null;
  filePath?: string;
  youtubeVideoId?: string | null;
  reviewStatus: string;
  scheduledPublishAt?: string | null;
  publishedAt?: string | null;
  durationSec: number;
  format: string;
  aspectRatio?: string;
  createdAt: string;
  pipelineRunId?: string;
  pipelineRun?: { status: string; currentStep: string | null; error?: string | null };
  channelId?: string;
  channel?: { id: string; name: string; slug: string; timezone?: string; config?: Record<string, unknown> };
  qualityScore?: number | null;
  qualityReport?: VideoQualityReport | null;
  clipCount?: number;
  visualSummary?: VisualOriginSummary | null;
}

export type VisualOrigin = 'stock' | 'ai' | 'placeholder';

export interface SceneVisualOrigin {
  sceneIndex: number;
  origin: VisualOrigin;
}

export interface VisualOriginSummary {
  stock: number;
  ai: number;
  placeholder: number;
  total: number;
  hasPlaceholders: boolean;
  scenes: SceneVisualOrigin[];
}

export interface VideoQualityCheck {
  id: string;
  label: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
}

export interface VideoQualityReport {
  score: number;
  passed: boolean;
  autoApproved: boolean;
  checks: VideoQualityCheck[];
  generatedAt: string;
}

export interface VideoDetail extends Video {
  description: string;
  tags: string[];
  clips?: VideoClipSummary[];
  analytics?: AnalyticsSnapshot[];
  pipelineRun?: {
    status: string;
    currentStep: string | null;
    error?: string | null;
    metadata?: { forcedTopic?: string };
    ideas: Array<{
      id: string;
      title: string;
      viralScore: number;
      isSelected: boolean;
      scoreBreakdown?: ContentScoreBreakdown | null;
    }>;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  counts?: {
    all: number;
    active: number;
    done: number;
    failed: number;
  };
}

/** Extrae items tanto de envelope paginado como de array legacy. */
export function listItems<T>(data: PaginatedResponse<T> | T[]): T[] {
  return Array.isArray(data) ? data : data.items;
}

export function listTotal<T>(data: PaginatedResponse<T> | T[]): number {
  return Array.isArray(data) ? data.length : data.total;
}

export interface PipelineRun {
  id: string;
  status: string;
  currentStep: string | null;
  createdAt: string;
  completedAt?: string | null;
  error?: string | null;
  metadata?: { forcedTopic?: string };
  channel?: { id?: string; name: string; slug: string; config?: Record<string, unknown> };
  videos?: Array<{ id: string; title: string; reviewStatus: string }>;
}

export interface PipelineRunDetail extends PipelineRun {
  ideas?: Array<{
    id: string;
    title: string;
    viralScore: number;
    isSelected: boolean;
    scoreBreakdown?: ContentScoreBreakdown | null;
  }>;
  videos?: Array<{
    id: string;
    title: string;
    reviewStatus: string;
    filePath?: string | null;
    aspectRatio?: string;
    thumbnailPath?: string | null;
    youtubeVideoId?: string | null;
    durationSec?: number;
  }>;
  clips?: VideoClipSummary[];
}

export interface VideoClipSummary {
  id: string;
  videoId: string;
  pipelineRunId: string;
  partIndex: number;
  title: string;
  durationSec: number;
  platform: string;
  publishStatus: string;
  externalId: string | null;
  scheduledPublishAt?: string | null;
  publishedAt: string | null;
  error: string | null;
  thumbnailPath?: string | null;
}

export interface StorageStats {
  storagePath: string;
  totalBytes: number;
  totalFormatted: string;
  pipelinesBytes: number;
  pipelinesFormatted: string;
  videosBytes: number;
  videosFormatted: string;
  pipelineDirs: number;
  pipelineRuns: number;
  videos: number;
  clips: number;
}

export interface YouTubeStatus {
  hasCredentials: boolean;
  tokenOk: boolean;
  error: string | null;
  channelTitle: string | null;
  privacyStatus?: string;
  analyticsOk?: boolean;
  analyticsError?: string | null;
}

export interface AnalyticsSnapshot {
  id: string;
  views: number;
  ctr: number;
  retention: number;
  likes: number;
  comments: number;
  watchTimeMinutes?: number;
  averageViewDurationSec?: number;
  snapshotAt: string;
  raw?: { source?: string; analyticsError?: string } | null;
}

export type MetricsSource = 'youtube' | 'youtube_data_api' | 'mock';

export function metricsSourceLabel(raw: AnalyticsSnapshot['raw']): string {
  const source = raw?.source;
  if (source === 'youtube') return 'YouTube Analytics';
  if (source === 'youtube_data_api') return 'YouTube (vistas/likes reales)';
  return 'Simulado';
}

export type YouTubeAnalyticsSetupIssue =
  | { type: 'api_disabled'; projectId?: string; enableUrl?: string }
  | { type: 'missing_scope' }
  | { type: 'other'; message: string };

/** Clasifica errores de YouTube Analytics para mostrar el paso correcto (GCP vs reconectar OAuth). */
export function parseYouTubeAnalyticsSetupIssue(
  error: string | null | undefined,
): YouTubeAnalyticsSetupIssue | null {
  if (!error) return null;

  const apiDisabled = /has not been used in project (\d+)|it is disabled/i.exec(error);
  if (apiDisabled) {
    const enableUrl = /https:\/\/console\.developers\.google\.com[^\s]+/.exec(error)?.[0];
    return { type: 'api_disabled', projectId: apiDisabled[1], enableUrl };
  }

  if (/insufficient.*permission|accessNotConfigured|scope|forbidden|403/i.test(error)) {
    return { type: 'missing_scope' };
  }

  return { type: 'other', message: error };
}

export interface ChannelDetail extends Channel {
  config: Record<string, unknown>;
}

export interface ChannelAnalytics {
  snapshots: Array<
    AnalyticsSnapshot & {
      video?: { id?: string; title: string; youtubeVideoId: string | null; publishedAt?: string };
    }
  >;
  summary: {
    totalViews: number;
    totalWatchTimeMinutes: number;
    avgCtr: number;
    avgRetention: number;
    avgViewDurationSec: number;
    videoCount: number;
  };
}

export interface VideoYouTubeAnalytics {
  snapshots: AnalyticsSnapshot[];
  latest: AnalyticsSnapshot | null;
}

export interface YouTubeAnalyticsInsights {
  hasData: boolean;
  summary: string;
  bullets: string[];
}
