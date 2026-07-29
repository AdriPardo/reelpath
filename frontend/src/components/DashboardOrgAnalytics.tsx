'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { api, metricsSourceLabel, type Channel } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { SkeletonStats } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';

export interface OrgAnalyticsSummary {
  totalViews: number;
  videoCount: number;
  channelCount: number;
  hasMockData: boolean;
  topVideos: Array<{
    videoId: string;
    title: string;
    channelName: string;
    views: number;
    source: 'youtube' | 'youtube_data_api' | 'mock';
  }>;
}

function isSyncableChannel(channel: Channel): boolean {
  const yt = channel.integrations?.youtube;
  return Boolean(yt?.connected && yt.tokenOk);
}

export function DashboardOrgAnalytics() {
  const t = useTranslations('dashboard');
  const tc = useTranslations('common');
  const locale = useLocale();
  const numberLocale = locale === 'en' ? 'en-GB' : 'es-ES';
  const { toast } = useToast();
  const [summary, setSummary] = useState<OrgAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [failed, setFailed] = useState(false);

  const syncAllChannels = useCallback(async () => {
    const channels = await api<Channel[]>('/api/channels?light=1');
    const syncable = channels.filter(isSyncableChannel);
    if (syncable.length === 0) return 0;

    const results = await Promise.allSettled(
      syncable.map((channel) =>
        api<{ synced: number; message: string }>(`/api/channels/${channel.id}/youtube-analytics/sync`, {
          method: 'POST',
        }),
      ),
    );

    return results.filter((r) => r.status === 'fulfilled').length;
  }, []);

  const fetchSummary = useCallback(async () => {
    return api<OrgAnalyticsSummary>('/api/analytics/org-summary');
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSummary() {
      setLoading(true);
      setFailed(false);
      try {
        const data = await fetchSummary();
        if (!cancelled) setSummary(data);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadSummary();
    return () => {
      cancelled = true;
    };
  }, [fetchSummary]);

  async function handleRefresh() {
    setSyncing(true);
    try {
      const synced = await syncAllChannels();
      const data = await fetchSummary();
      setSummary(data);
      toast(
        synced > 0
          ? synced === 1
            ? t('analyticsUpdatedOne')
            : t('analyticsUpdatedMany', { count: synced })
          : t('summaryUpdated'),
        'success',
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : tc('refreshError'), 'error');
    } finally {
      setSyncing(false);
    }
  }

  if (failed) {
    return null;
  }

  if (loading) {
    return (
      <section className="page-section dashboard-org-analytics" aria-busy="true" aria-live="polite">
        <div className="page-section-title">
          <h2>{t('globalAnalytics')}</h2>
        </div>
        <SkeletonStats count={3} />
      </section>
    );
  }

  if (!summary || summary.videoCount === 0) {
    return (
      <section className="page-section dashboard-org-analytics">
        <div className="page-section-title">
          <h2>{t('globalAnalytics')}</h2>
          <Button type="button" variant="secondary" onClick={() => void handleRefresh()} disabled={syncing}>
            {syncing ? tc('refreshing') : tc('refresh')}
          </Button>
        </div>
        <p className="text-muted">{t('publishConnectHint')}</p>
      </section>
    );
  }

  return (
    <section className="page-section dashboard-org-analytics">
      <div className="page-section-title">
        <h2>{t('globalAnalytics')}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {summary.hasMockData && (
            <span className="chip chip-muted" title={t('mockDataTitle')}>
              {t('mockData')}
            </span>
          )}
          <Button type="button" variant="secondary" onClick={() => void handleRefresh()} disabled={syncing}>
            {syncing ? tc('refreshing') : tc('refresh')}
          </Button>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat">
          <div className="stat-body">
            <div className="stat-value">{summary.totalViews.toLocaleString(numberLocale)}</div>
            <div className="stat-label">{t('totalViews')}</div>
          </div>
        </div>
        <div className="stat">
          <div className="stat-body">
            <div className="stat-value">{summary.videoCount}</div>
            <div className="stat-label">{t('videosWithData')}</div>
          </div>
        </div>
        <div className="stat">
          <div className="stat-body">
            <div className="stat-value">{summary.channelCount}</div>
            <div className="stat-label">{tc('channels')}</div>
          </div>
        </div>
      </div>

      {summary.topVideos.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <h3 className="text-sm" style={{ marginBottom: '0.5rem' }}>
            {t('topVideos')}
          </h3>
          <ul className="dashboard-list">
            {summary.topVideos.map((video) => (
              <li key={video.videoId} className="dashboard-list-item">
                <Link href={`/videos/${video.videoId}`} className="dashboard-list-link">
                  {video.title}
                </Link>
                <span className="text-muted text-sm">{video.channelName}</span>
                <span>{t('viewsCount', { count: video.views.toLocaleString(numberLocale) })}</span>
                <span className="text-muted text-sm">
                  {metricsSourceLabel({ source: video.source })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
