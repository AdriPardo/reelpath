'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import {
  api,
  metricsSourceLabel,
  parseYouTubeAnalyticsSetupIssue,
  type AnalyticsSnapshot,
  type ChannelAnalytics,
  type ChannelIntegrationsResponse,
  type YouTubeAnalyticsInsights,
} from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { useToast } from '@/components/ui/Toast';

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatMinutes(sec: number, locale: string): string {
  if (sec < 60) return `${Math.round(sec)} s`;
  const minLabel = locale === 'en' ? 'min' : 'min';
  return `${(sec / 60).toFixed(1)} ${minLabel}`;
}

function MetricCard({
  label,
  value,
  hint,
  metricExplain,
}: {
  label: string;
  value: string;
  hint?: string;
  metricExplain: (label: string) => string;
}) {
  return (
    <div className="analytics-metric-card">
      <span className="analytics-metric-label field-label-row">
        <span>{label}</span>
        {hint && <InfoTooltip content={hint} ariaLabel={metricExplain(label)} />}
      </span>
      <strong className="analytics-metric-value">{value}</strong>
    </div>
  );
}

export function ChannelAnalyticsPanel({
  channelId,
  integrations,
}: {
  channelId: string;
  integrations: ChannelIntegrationsResponse;
}) {
  const t = useTranslations('channels.analytics');
  const tc = useTranslations('common');
  const locale = useLocale();
  const numberLocale = locale === 'en' ? 'en-GB' : 'es-ES';
  const { toast } = useToast();
  const [analytics, setAnalytics] = useState<ChannelAnalytics | null>(null);
  const [insights, setInsights] = useState<YouTubeAnalyticsInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const youtube = integrations.youtube;
  const analyticsIssue = parseYouTubeAnalyticsSetupIssue(youtube.analyticsError);
  const analyticsBlocked =
    youtube.connected && youtube.tokenOk && youtube.analyticsOk === false;

  const fetchAnalytics = useCallback(async () => {
    const [data, insightData] = await Promise.all([
      api<ChannelAnalytics>(`/api/channels/${channelId}/youtube-analytics`),
      api<YouTubeAnalyticsInsights>(`/api/channels/${channelId}/analytics-insights`),
    ]);
    setAnalytics(data);
    setInsights(insightData);
  }, [channelId]);

  const syncAnalytics = useCallback(async () => {
    if (analyticsBlocked) return null;
    return api<{ synced: number; message: string }>(
      `/api/channels/${channelId}/youtube-analytics/sync`,
      { method: 'POST' },
    );
  }, [channelId, analyticsBlocked]);

  useEffect(() => {
    let cancelled = false;

    async function autoSyncOnMount() {
      setLoading(true);
      setSyncing(true);
      setError(null);
      try {
        await syncAnalytics();
        if (cancelled) return;
        await fetchAnalytics();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('loadError'));
        }
      } finally {
        if (!cancelled) {
          setSyncing(false);
          setLoading(false);
        }
      }
    }

    void autoSyncOnMount();
    return () => {
      cancelled = true;
    };
  }, [channelId, syncAnalytics, fetchAnalytics, t]);

  async function handleRefresh() {
    setSyncing(true);
    try {
      const result = await syncAnalytics();
      if (result) {
        toast(result.message, 'success');
      }
      await fetchAnalytics();
    } catch (err) {
      toast(err instanceof Error ? err.message : tc('refreshError'), 'error');
    } finally {
      setSyncing(false);
    }
  }

  if (loading) {
    return (
      <p className="text-muted" aria-live="polite">
        {syncing ? t('syncing') : t('loading')}
      </p>
    );
  }

  if (error) {
    return (
      <p className="text-muted" role="alert">
        {error}
      </p>
    );
  }

  const summary = analytics?.summary;
  const latestByVideo = new Map<string, AnalyticsSnapshot & { video?: { title: string } }>();
  for (const snap of analytics?.snapshots ?? []) {
    const vid = (snap as AnalyticsSnapshot & { video?: { id: string; title: string } }).video?.id;
    if (vid && !latestByVideo.has(vid)) {
      latestByVideo.set(vid, snap as AnalyticsSnapshot & { video?: { title: string } });
    }
  }
  const videoRows = [...latestByVideo.values()];

  return (
    <div className="channel-analytics-panel">
      <div className="analytics-toolbar">
        <div>
          <div className="section-title-row" style={{ marginBottom: '0.25rem' }}>
            <h3 style={{ margin: 0 }}>{t('youtubeTitle')}</h3>
            <InfoTooltip content={t('tooltip')} />
          </div>
          <p className="text-muted text-sm">
            {youtube.connected && youtube.tokenOk
              ? t('connectedAs', { name: youtube.channelTitle ?? 'YouTube' })
              : t('connectHint')}
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={() => void handleRefresh()} disabled={syncing}>
          {syncing ? tc('refreshing') : tc('refresh')}
        </Button>
      </div>

      {analyticsBlocked && (
        <div className="hint-box" style={{ marginTop: '1rem' }}>
          {analyticsIssue?.type === 'api_disabled' ? (
            <>
              <strong>{t('apiDisabledTitle')}</strong> {t('apiDisabledBody')}
              {analyticsIssue.enableUrl ? (
                <>
                  {' '}
                  <a href={analyticsIssue.enableUrl} target="_blank" rel="noopener noreferrer">
                    {t('enableApiLink')}
                  </a>
                </>
              ) : (
                <> {t('apiDisabledManual')}</>
              )}
              {analyticsIssue.projectId && (
                <span className="text-muted" style={{ display: 'block', marginTop: '0.35rem', fontSize: '0.85rem' }}>
                  {t('projectHint', { projectId: analyticsIssue.projectId })}
                </span>
              )}
            </>
          ) : analyticsIssue?.type === 'missing_scope' ? (
            <>
              <strong>{t('missingScopeTitle')}</strong> {t('missingScopeBefore')}{' '}
              <Link href={`/channels/${channelId}?tab=integraciones`}>{tc('accountsTab')}</Link>{' '}
              {t('missingScopeAfter')}
            </>
          ) : (
            <>
              <strong>{t('readErrorTitle')}</strong>
              {youtube.analyticsError && (
                <span className="text-muted" style={{ display: 'block', marginTop: '0.35rem', fontSize: '0.85rem' }}>
                  {youtube.analyticsError}
                </span>
              )}
            </>
          )}
        </div>
      )}

      {insights && (
        <div className="hint-box" style={{ marginTop: '1rem' }}>
          <p style={{ margin: 0 }}>{insights.summary}</p>
          {insights.bullets.length > 0 && (
            <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem' }}>
              {insights.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {summary && (
        <div className="analytics-metrics-grid" style={{ marginTop: '1.25rem' }}>
          <MetricCard
            label={tc('views')}
            value={summary.totalViews.toLocaleString(numberLocale)}
            metricExplain={(label) => t('metricExplain', { label })}
          />
          <MetricCard
            label={t('watchTimeLabel')}
            value={`${summary.totalWatchTimeMinutes.toLocaleString(numberLocale)} min`}
            hint={`~${(summary.totalWatchTimeMinutes / 60).toFixed(1)} h`}
            metricExplain={(label) => t('metricExplain', { label })}
          />
          <MetricCard
            label={t('avgCtr')}
            value={formatPct(summary.avgCtr)}
            metricExplain={(label) => t('metricExplain', { label })}
          />
          <MetricCard
            label={tc('avgDuration')}
            value={formatMinutes(summary.avgViewDurationSec, locale)}
            hint={t('retentionHint', { pct: formatPct(summary.avgRetention) })}
            metricExplain={(label) => t('metricExplain', { label })}
          />
        </div>
      )}

      {videoRows.length > 0 ? (
        <div style={{ marginTop: '1.5rem', overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('colVideo')}</th>
                <th>{t('colViews')}</th>
                <th>{t('colWatchTime')}</th>
                <th>{t('colCtr')}</th>
                <th>{t('colAvgDuration')}</th>
                <th>{t('colSource')}</th>
              </tr>
            </thead>
            <tbody>
              {videoRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.video?.title ?? '—'}</td>
                  <td>{row.views.toLocaleString(numberLocale)}</td>
                  <td>{Math.round(row.watchTimeMinutes ?? 0).toLocaleString(numberLocale)} min</td>
                  <td>{formatPct(row.ctr)}</td>
                  <td>{formatMinutes(row.averageViewDurationSec ?? 0, locale)}</td>
                  <td className="text-muted text-sm">{metricsSourceLabel(row.raw)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-muted" style={{ marginTop: '1rem' }}>
          {t('noSnapshots')}
        </p>
      )}
    </div>
  );
}
