/** Métricas de vídeo sincronizadas desde YouTube Analytics / Data API. */
export interface YouTubeVideoMetrics {
  views: number;
  ctr: number;
  retention: number;
  likes: number;
  comments: number;
  watchTimeMinutes: number;
  averageViewDurationSec: number;
}

export type YouTubeMetricsSource = 'youtube' | 'youtube_data_api' | 'mock';

export interface YouTubeAnalyticsSummary {
  totalViews: number;
  totalWatchTimeMinutes: number;
  avgCtr: number;
  avgRetention: number;
  avgViewDurationSec: number;
  videoCount: number;
}

export interface YouTubeAnalyticsInsights {
  hasData: boolean;
  summary: string;
  bullets: string[];
}
