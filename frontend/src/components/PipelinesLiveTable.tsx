'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { api, listItems, type Channel, type PaginatedResponse, type PipelineRun } from '@/lib/api';
import { PipelineProgressBar } from '@/components/PipelineProgressBar';
import { ChannelBadge } from '@/components/ChannelBadge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { isPipelineCancellable, isPipelineInProgress } from '@/lib/pipeline-status';
import { PipelineCancelButton } from '@/components/PipelineCancelButton';
import { PipelineRetryButton } from '@/components/PipelineRetryButton';
import { PipelineElapsed } from '@/components/PipelineElapsed';
import { pipelineStepLabel } from '@/lib/pipeline-progress';
import { mapPipelineError } from '@/lib/user-messages';

type Filter = 'all' | 'active' | 'done' | 'failed';

interface PipelineCounts {
  all: number;
  active: number;
  done: number;
  failed: number;
}

interface PipelinesLiveTableProps {
  initialPipelines: PipelineRun[];
  page?: number;
  filter?: Filter;
  channelFilter?: string;
  counts?: PipelineCounts;
  channels?: Channel[];
}

function buildPipelinesHref(opts: {
  page?: number;
  filter?: Filter;
  channel?: string;
}): string {
  const params = new URLSearchParams();
  if (opts.filter && opts.filter !== 'all') params.set('filter', opts.filter);
  if (opts.channel && opts.channel !== 'all') params.set('channel', opts.channel);
  if (opts.page && opts.page > 1) params.set('page', String(opts.page));
  const qs = params.toString();
  return qs ? `/pipelines?${qs}` : '/pipelines';
}

export function PipelinesLiveTable({
  initialPipelines,
  page = 1,
  filter = 'all',
  channelFilter = 'all',
  counts = { all: 0, active: 0, done: 0, failed: 0 },
  channels = [],
}: PipelinesLiveTableProps) {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations('pipelines');
  const tc = useTranslations('common');
  const tch = useTranslations('channels');
  const [pipelines, setPipelines] = useState(initialPipelines);
  const [refreshing, setRefreshing] = useState(false);

  const dateLocale = locale === 'en' ? 'en-GB' : 'es-ES';
  const hasInProgress =
    counts.active > 0 || pipelines.some((p) => isPipelineInProgress(p.status));

  useEffect(() => {
    setPipelines(initialPipelines);
  }, [initialPipelines]);

  useEffect(() => {
    if (!hasInProgress) return;

    const interval = setInterval(async () => {
      setRefreshing(true);
      try {
        const qs = new URLSearchParams();
        qs.set('page', String(page));
        qs.set('limit', '50');
        if (filter !== 'all') qs.set('filter', filter);
        if (channelFilter !== 'all') qs.set('channelId', channelFilter);
        const data = await api<PaginatedResponse<PipelineRun>>(`/api/pipelines?${qs}`);
        setPipelines(listItems(data));
      } catch {
        // silencioso
      } finally {
        setRefreshing(false);
      }
    }, 20000);

    return () => clearInterval(interval);
  }, [hasInProgress, page, filter, channelFilter]);

  const channelOptions = channels
    .map((ch) => ({ id: ch.id, name: ch.name }))
    .sort((a, b) => a.name.localeCompare(b.name, dateLocale));

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: 'all', label: t('filterAll'), count: counts.all },
    { key: 'active', label: t('filterActive'), count: counts.active },
    { key: 'done', label: t('filterDone'), count: counts.done },
    { key: 'failed', label: t('filterFailed'), count: counts.failed },
  ];

  function setFilter(next: Filter) {
    router.push(buildPipelinesHref({ filter: next, channel: channelFilter }));
  }

  function setChannel(next: string) {
    router.push(buildPipelinesHref({ filter, channel: next }));
  }

  return (
    <>
      {hasInProgress && (
        <div className="generaciones-live-banner live-indicator-pulse" aria-live="polite">
          <span className="generaciones-live-dot" aria-hidden="true" />
          {refreshing ? t('liveRefreshing') : t('liveActive')}
        </div>
      )}

      <div className="generaciones-stats" aria-label={t('stats.summaryAria')}>
        <div className={`generaciones-stat${counts.active > 0 ? ' generaciones-stat-active' : ''}`}>
          <span className="generaciones-stat-value">{counts.active}</span>
          <span className="generaciones-stat-label">{t('stats.inProgress')}</span>
        </div>
        <div className="generaciones-stat">
          <span className="generaciones-stat-value">{counts.done}</span>
          <span className="generaciones-stat-label">{t('stats.completed')}</span>
        </div>
        <div className="generaciones-stat">
          <span className="generaciones-stat-value">{counts.failed}</span>
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
            {count > 0 && <span className="pipeline-filter-count">{count}</span>}
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
              onChange={(e) => setChannel(e.target.value)}
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

      {pipelines.length > 0 && (
        <>
          <div className="pipeline-cards">
            {pipelines.map((p) => {
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
                    {p.channel?.name && <ChannelBadge name={p.channel.name} asText />}
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
                        {errorMessage.slice(0, 80)}
                        {errorMessage.length > 80 ? '…' : ''}
                      </p>
                    )}
                    {video && (
                      <p className="pipeline-card-video text-sm">
                        {t('videoLabel')}{' '}
                        <span>
                          {video.title.slice(0, 50)}
                          {video.title.length > 50 ? '…' : ''}
                        </span>
                      </p>
                    )}
                  </Link>
                  {(canCancel || canRetry) && (
                    <div className="pipeline-card-actions">
                      {canRetry && <PipelineRetryButton pipelineId={p.id} compact />}
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
                  {pipelines.map((p) => {
                    const video = p.videos?.[0];
                    const forcedTopic = p.metadata?.forcedTopic;
                    return (
                      <tr key={p.id}>
                        <td>
                          <StatusBadge status={p.status} kind="pipeline" />
                        </td>
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
