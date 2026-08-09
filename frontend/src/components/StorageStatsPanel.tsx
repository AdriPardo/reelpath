'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { api, type StorageStats } from '@/lib/api';
import { SERVICE_UNAVAILABLE } from '@/lib/user-messages';

export function StorageStatsPanel({ initial }: { initial: StorageStats | null }) {
  const t = useTranslations('settings.storage');
  const tc = useTranslations('common');
  const router = useRouter();
  const { toast } = useToast();
  const [stats, setStats] = useState(initial);
  const [loading, setLoading] = useState<string | null>(null);

  async function refresh() {
    setLoading('refresh');
    try {
      setStats(await api<StorageStats>('/api/system/storage'));
    } catch (err) {
      toast(err instanceof Error ? err.message : SERVICE_UNAVAILABLE, 'error');
    } finally {
      setLoading(null);
    }
  }

  async function cleanup(action: 'orphans' | 'rejected' | 'stock-cache') {
    const label =
      action === 'orphans'
        ? t('confirmOrphans')
        : action === 'rejected'
          ? t('confirmRejected')
          : t('confirmStockCache');
    if (!window.confirm(label)) return;

    setLoading(action);
    try {
      const data = await api<{ message: string }>(`/api/system/storage/cleanup-${action}`, {
        method: 'POST',
      });
      toast(data.message, 'success');
      await refresh();
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : SERVICE_UNAVAILABLE, 'error');
    } finally {
      setLoading(null);
    }
  }

  if (!stats) {
    return (
      <section className="settings-section card">
        <h2>{t('title')}</h2>
        <p className="text-muted text-sm">{SERVICE_UNAVAILABLE}</p>
      </section>
    );
  }

  return (
    <section className="settings-section card">
      <h2>{t('title')}</h2>
      <p className="text-muted text-sm" style={{ marginBottom: '0.75rem' }}>
        {t('description')}
      </p>
      <dl className="settings-dl">
        <dt>{t('pathLabel')}</dt>
        <dd><code className="channel-slug">{stats.storagePath}</code></dd>
        <dt>{t('totalUsage')}</dt>
        <dd><strong>{stats.totalFormatted}</strong></dd>
        <dt>{t('pipelineFiles')}</dt>
        <dd>{t('pipelineFolders', { size: stats.pipelinesFormatted, count: stats.pipelineDirs })}</dd>
        <dt>{t('renderedVideos')}</dt>
        <dd>{stats.videosFormatted}</dd>
        {stats.stockCacheFormatted ? (
          <>
            <dt>{t('stockCache')}</dt>
            <dd>{stats.stockCacheFormatted}</dd>
          </>
        ) : null}
        <dt>{t('storedContent')}</dt>
        <dd>
          {t('storedSummary', {
            videos: stats.videos,
            clips: stats.clips,
            runs: stats.pipelineRuns,
          })}
        </dd>
      </dl>
      <div className="maintenance-actions" style={{ marginTop: '1rem' }}>
        <Button type="button" variant="ghost" size="sm" disabled={!!loading} onClick={refresh}>
          {loading === 'refresh' ? '…' : tc('refresh')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!!loading}
          onClick={() => cleanup('orphans')}
        >
          {loading === 'orphans' ? '…' : t('cleanupOrphans')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!!loading}
          onClick={() => cleanup('rejected')}
        >
          {loading === 'rejected' ? '…' : t('cleanupRejected')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!!loading}
          onClick={() => cleanup('stock-cache')}
        >
          {loading === 'stock-cache' ? '…' : t('cleanupStockCache')}
        </Button>
      </div>
    </section>
  );
}
