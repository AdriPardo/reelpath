'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { api, type PipelineRun } from '@/lib/api';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { isPipelineInProgress } from '@/lib/pipeline-status';

interface DashboardActivePipelinesProps {
  initialPipelines: PipelineRun[];
}

export function DashboardActivePipelines({ initialPipelines }: DashboardActivePipelinesProps) {
  const t = useTranslations('dashboard');
  const tc = useTranslations('common');
  const router = useRouter();
  const [pipelines, setPipelines] = useState(initialPipelines);
  const active = pipelines.filter((p) => isPipelineInProgress(p.status));
  const preview = active.slice(0, 5);
  const hasInProgress = active.length > 0;

  useEffect(() => {
    setPipelines(initialPipelines);
  }, [initialPipelines]);

  useEffect(() => {
    if (!hasInProgress) return;

    const interval = setInterval(async () => {
      try {
        const data = await api<PipelineRun[]>('/api/pipelines');
        setPipelines(data);
        router.refresh();
      } catch {
        // silencioso
      }
    }, 20000);

    return () => clearInterval(interval);
  }, [hasInProgress, router]);

  if (preview.length === 0) return null;

  return (
    <>
      {hasInProgress && (
        <p className="live-indicator" aria-live="polite">{t('syncingGenerations')}</p>
      )}
      <ul className="dashboard-list">
        {preview.map((p) => (
          <li key={p.id} className="dashboard-list-item">
            <Link href={`/pipelines/${p.id}`} className="dashboard-list-link">
              {p.channel?.name ?? tc('channel')} — {p.currentStep ?? p.status}
            </Link>
            <StatusBadge status={p.status} kind="pipeline" />
          </li>
        ))}
      </ul>
    </>
  );
}
