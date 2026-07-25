'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { api, type PipelineRun } from '@/lib/api';
import { PipelineProgressBar } from '@/components/PipelineProgressBar';
import { ChannelBadge } from '@/components/ChannelBadge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { isPipelineCancellable, isPipelineInProgress } from '@/lib/pipeline-status';
import { PipelineCancelButton } from '@/components/PipelineCancelButton';
import { PipelineRetryButton } from '@/components/PipelineRetryButton';
import { PipelineElapsed } from '@/components/PipelineElapsed';
import { EmptyState } from '@/components/ui/EmptyState';
import { pipelineStepLabel } from '@/lib/pipeline-progress';
import { mapPipelineError } from '@/lib/user-messages';

type Filter = 'all' | 'active' | 'done' | 'failed';

interface PipelinesLiveTableProps {
  initialPipelines: PipelineRun[];
}

export function PipelinesLiveTable({ initialPipelines }: PipelinesLiveTableProps) {
  const locale = useLocale();
  const t = useTranslations('pipelines');
  const tc = useTranslations('common');
  const tch = useTranslations('channels');
  const [pipelines, setPipelines] = useState(initialPipelines);
  const [filter, setFilter] = useState<Filter>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);

  const dateLocale = locale === 'en' ? 'en-GB' : 'es-ES';
  const hasInProgress = pipelines.some((p) => isPipelineInProgress(p.status));

  useEffect(() => {
    setPipelines(initialPipelines);
  }, [initialPipelines]);

  useEffect(() => {
    if (!hasInProgress) return;

    const interval = setInterval(async () => {
      setRefreshing(true);
      try {
        const data = await api<PipelineRun[]>('/api/pipelines');
        setPipelines(data);
      } catch {
        // silencioso
      } finally {
        setRefreshing(false);
      }
    }, 20000);

    return () => clearInterval(interval);
  }, [hasInProgress]);

  const stats = useMemo(() => ({
    active: pipelines.filter((p) => isPipelineInProgress(p.status)).length,
    done: pipelines.filter((p) => p.status === 'completed').length,
    failed: pipelines.filter((p) => p.status === 'failed').length,
  }), [pipelines]);

  const channelOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of pipelines) {
      if (p.channel?.id && p.channel.name) map.set(p.channel.id, p.channel.name);
    }
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name, dateLocale),
    );
  }, [pipelines, dateLocale]);

  const filtered = useMemo(() => {
    const byChannel =
      channelFilter === 'all'
        ? pipelines
        : pipelines.filter((p) => p.channel?.id === channelFilter);
    switch (filter) {
      case 'active':
        return byChannel.filter((p) => isPipelineInProgress(p.status));
      case 'done':
        return byChannel.filter((p) => p.status === 'completed');
      case 'failed':
        return byChannel.filter((p) => p.status === 'failed');
      default:
        return byChannel;
    }
  }, [pipelines, filter, channelFilter]);

  const filters: { key: Filter; label: string; count?: number }[] = [
    { key: 'all', label: t('filterAll'), count: pipelines.length },
    { key: 'active', label: t('filterActive'), count: stats.active },
    { key: 'done', label: t('filterDone'), count: stats.done },
    { key: 'failed', label: t('filterFailed'), count: stats.failed },
  ];

  return (
    <>
      {hasInProgress && (
        <div className="generaciones-live-banner live-indicator-pulse" aria-live="polite">
          <span className="generaciones-live-dot" aria-hidden="true" />
          {refreshing ? t('liveRefreshing') : t('liveActive')}
        </div>
      )}

      <div className="generaciones-stats" aria-label={t('stats.summaryAria')}>
        <div className={`generaciones-stat${stats.active > 0 ? ' generaciones-stat-active' : ''}`}>
          <span className="generaciones-stat-value">{stats.active}</span>
          <span className="generaciones-stat-label">{t('stats.inProgress')}</span>
        </div>
        <div className="generaciones-stat">
          <span className="generaciones-stat-value">{stats.done}</span>
          <span className="generaciones-stat-label">{t('stats.completed')}</span>
        </div>
        <div className="generaciones-stat">
          <span className="generaciones-stat-value">{stats.failed}</span>
          <span className="generaciones-stat-label">{t('stats.failed')}</span>
        </div>
      </div>

      <div className="pipeline-filter-bar">
        {filters.map(({ key, label, count }) => (
          <button
            key={key}
            type="button"
            className={`pipeline-filter-chip${filter === key ? ' pipeline-filter-chip-active' : ''}`}
            onClick={() => setFilter(key)}
          >
            {label}
            {count != null && count > 0 && <span className="pipeline-filter-count">{count}</span>}
          </button>
        ))}
        {channelOptions.length > 1 && (
          <div className="channel-filter pipeline-channel-filter">
            <label htmlFor="pipeline-channel-filter" className="channel-filter-label">
              {tch('filterLabel')}
            </label>
            <select
              id="pipeline-channel-filter"
              className="channel-filter-select"
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
            >
              <option value="all">{tch('allChannels')}</option>
              {channelOptions.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {ch.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="▶"
          title={t('emptyCategory')}
          description={t('emptyCategoryDesc')}
        />
      ) : (
        <>
          <div className="pipeline-cards">
            {filtered.map((p) => {
              const video = p.videos?.[0];
              const forcedTopic = p.metadata?.forcedTopic;
              const errorMessage = p.error ? mapPipelineError(p.error) : null;
              const isActive = isPipelineInProgress(p.status);
              const canCancel = isPipelineCancellable(p.status, video);
              const canRetry = p.status === 'failed';
              const cardTitle = forcedTopic ?? video?.title ?? p.channel?.name ?? t('generation');
              return (
                <div
                  key={p.id}
                  className={`pipeline-card pipeline-card-studio card${isActive ? ' pipeline-card-studio-active' : ''}`}
                >
                  <Link href={`/pipelines/${p.id}`} className="pipeline-card-link">
                  <div className="pipeline-card-top">
                    <StatusBadge status={p.status} kind="pipeline" />
                    <PipelineElapsed
                      createdAt={p.createdAt}
                      completedAt={p.completedAt}
                      className="text-muted text-sm"
                    />
                  </div>
                  {p.channel?.name && (
                    <ChannelBadge name={p.channel.name} asText />
                  )}
                  <h3 className="pipeline-card-title">
                    {forcedTopic ?? video?.title ?? p.channel?.name ?? t('untitled')}
                  </h3>
                  <p className="pipeline-card-sub text-muted text-sm">
                    {new Date(p.createdAt).toLocaleString(dateLocale)}
                  </p>
                  <PipelineProgressBar
                    currentStep={p.currentStep}
                    status={p.status}
                    size="sm"
                  />
                  {errorMessage && (
                    <p className="pipeline-card-error" title={errorMessage}>
                      {errorMessage.slice(0, 80)}{errorMessage.length > 80 ? '…' : ''}
                    </p>
                  )}
                  {video && (
                    <p className="pipeline-card-video text-sm">
                      {t('videoLabel')} <span>{video.title.slice(0, 50)}{video.title.length > 50 ? '…' : ''}</span>
                    </p>
                  )}
                  </Link>
                  {(canCancel || canRetry) && (
                    <div className="pipeline-card-actions">
                      {canRetry && (
                        <PipelineRetryButton pipelineId={p.id} compact />
                      )}
                      {canCancel && (
                        <PipelineCancelButton
                          pipelineId={p.id}
                          pipelineTitle={cardTitle}
                          compact
                          onCancelled={() => {
                            setPipelines((prev) =>
                              prev.map((row) =>
                                row.id === p.id ? { ...row, status: 'cancelled' } : row,
                              ),
                            );
                          }}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <details className="pipeline-table-details">
            <summary>{t('tableView')}</summary>
            <div className="table-scroll" style={{ marginTop: '1rem' }}>
              <table>
                <thead>
                  <tr>
                    <th>{t('tableStatus')}</th>
                    <th>{t('tableProgress')}</th>
                    <th>{tc('channel')}</th>
                    <th>{t('tableTopic')}</th>
                    <th>{t('tableStep')}</th>
                    <th>{t('tableTime')}</th>
                    <th>{t('tableCreated')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const video = p.videos?.[0];
                    const forcedTopic = p.metadata?.forcedTopic;
                    return (
                      <tr key={p.id}>
                        <td><StatusBadge status={p.status} kind="pipeline" /></td>
                        <td className="pipeline-table-progress">
                          <PipelineProgressBar
                            currentStep={p.currentStep}
                            status={p.status}
                            size="sm"
                            showLabel={false}
                          />
                        </td>
                        <td>
                          {p.channel?.name ? (
                            <ChannelBadge name={p.channel.name} channelId={p.channel.id} />
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          <Link href={`/pipelines/${p.id}`} className="mono-link">
                            {(forcedTopic ?? video?.title ?? p.id.slice(0, 10)).slice(0, 36)}…
                          </Link>
                        </td>
                        <td>{pipelineStepLabel(p.currentStep)}</td>
                        <td>
                          <PipelineElapsed createdAt={p.createdAt} completedAt={p.completedAt} />
                        </td>
                        <td>{new Date(p.createdAt).toLocaleString(dateLocale)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </>
  );
}
