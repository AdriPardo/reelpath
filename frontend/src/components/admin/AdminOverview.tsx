'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';

type Overview = {
  activeOrgs: number;
  totalUsers: number;
  pipelines24h: number;
  pipelines7d: number;
  pipelinesFailed24h: number;
  videosThisMonth: number;
  trialOrgs: number;
  paidOrgs: number;
  pastDueOrgs: number;
};

export function AdminOverview() {
  const t = useTranslations('admin.overview');
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<Overview>('/api/admin/overview')
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : t('loadError'));
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  if (error) return <p className="text-muted">{error}</p>;
  if (!data) return <p className="text-muted text-sm">{t('loading')}</p>;

  const stats: { key: keyof Overview; label: string }[] = [
    { key: 'activeOrgs', label: t('activeOrgs') },
    { key: 'totalUsers', label: t('totalUsers') },
    { key: 'pipelines24h', label: t('pipelines24h') },
    { key: 'pipelines7d', label: t('pipelines7d') },
    { key: 'pipelinesFailed24h', label: t('pipelinesFailed24h') },
    { key: 'videosThisMonth', label: t('videosThisMonth') },
    { key: 'trialOrgs', label: t('trialOrgs') },
    { key: 'paidOrgs', label: t('paidOrgs') },
    { key: 'pastDueOrgs', label: t('pastDueOrgs') },
  ];

  return (
    <section className="settings-section">
      <header className="settings-section-header">
        <h2>{t('title')}</h2>
        <p className="settings-section-desc">{t('description')}</p>
      </header>
      <div className="stat-grid">
        {stats.map(({ key, label }) => (
          <div key={key} className="stat">
            <span className="stat-label">{label}</span>
            <span className="stat-value">{data[key]}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
