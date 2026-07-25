'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  api,
  metricsSourceLabel,
  type AnalyticsSnapshot,
  type VideoYouTubeAnalytics,
} from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { useToast } from '@/components/ui/Toast';

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatMinutes(sec: number, locale: string): string {
  if (sec < 60) return `${Math.round(sec)} s`;
  return `${(sec / 60).toFixed(1)} min`;
}

export function VideoAnalyticsPanel({
  videoId,
  youtubeVideoId,
}: {
  videoId: string;
  youtubeVideoId?: string | null;
}) {
  const locale = useLocale();
  const t = useTranslations('videos.analytics');
  const tc = useTranslations('common');
  const { toast } = useToast();
  const [data, setData] = useState<VideoYouTubeAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const dateLocale = locale === 'en' ? 'en-GB' : 'es-ES';
  const numberLocale = locale === 'en' ? 'en-GB' : 'es-ES';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api<VideoYouTubeAnalytics>(`/api/videos/${videoId}/youtube-analytics`);
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [videoId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSync() {
    setSyncing(true);
    try {
      const result = await api<{ message: string; source: string }>(
        `/api/videos/${videoId}/sync-analytics`,
        { method: 'POST' },
      );
      toast(result.message, 'success');
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : t('syncError'), 'error');
    } finally {
      setSyncing(false);
    }
  }

  if (!youtubeVideoId) return null;

  const latest: AnalyticsSnapshot | null = data?.latest ?? data?.snapshots?.[0] ?? null;

  return (
    <div className="card" style={{ marginTop: '1.5rem' }}>
      <div className="analytics-toolbar">
        <div>
          <div className="section-title-row" style={{ marginBottom: '0.25rem' }}>
            <h3 style={{ margin: 0 }}>{t('title')}</h3>
            <InfoTooltip content={t('tooltip')} />
          </div>
          <p className="text-muted text-sm">
            {latest
              ? tc('lastSync', {
                  date: new Date(latest.snapshotAt).toLocaleString(dateLocale),
                  source: metricsSourceLabel(latest.raw),
                })
              : t('noMetrics')}
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={() => void handleSync()} disabled={syncing}>
          {syncing ? tc('syncing') : tc('sync')}
        </Button>
      </div>

      {loading && <p className="text-muted">{tc('loading')}</p>}

      {!loading && latest && (
        <div className="analytics-metrics-grid" style={{ marginTop: '1rem' }}>
          <div className="analytics-metric-card">
            <span className="analytics-metric-label">{t('views')}</span>
            <strong className="analytics-metric-value">{latest.views.toLocaleString(numberLocale)}</strong>
          </div>
          <div className="analytics-metric-card">
            <span className="analytics-metric-label">{t('watchTime')}</span>
            <strong className="analytics-metric-value">
              {Math.round(latest.watchTimeMinutes ?? 0).toLocaleString(numberLocale)} min
            </strong>
          </div>
          <div className="analytics-metric-card">
            <span className="analytics-metric-label">{t('ctr')}</span>
            <strong className="analytics-metric-value">{formatPct(latest.ctr)}</strong>
          </div>
          <div className="analytics-metric-card">
            <span className="analytics-metric-label field-label-row">
              <span>{t('avgDuration')}</span>
              <InfoTooltip content={t('retentionTooltip', { pct: formatPct(latest.retention) })} />
            </span>
            <strong className="analytics-metric-value">
              {formatMinutes(latest.averageViewDurationSec ?? 0, locale)}
            </strong>
          </div>
        </div>
      )}
    </div>
  );
}
