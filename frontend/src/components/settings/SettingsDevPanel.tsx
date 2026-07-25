'use client';

import { useTranslations } from 'next-intl';
import { StorageStatsPanel } from '@/components/StorageStatsPanel';
import { getApiUrl, type StorageStats } from '@/lib/api';

export function SettingsDevPanel({ storage }: { storage: StorageStats | null }) {
  const t = useTranslations('settingsExt');
  const apiUrl = getApiUrl();

  return (
    <div className="settings-dev">
      <section className="settings-section settings-dev-section">
        <details>
          <summary>{t('devSummary')}</summary>
          <dl className="settings-dl" style={{ marginTop: '0.75rem' }}>
            <dt>{t('devBackendUrl')}</dt>
            <dd>
              <code className="channel-slug">{apiUrl}</code>
            </dd>
            <dt>{t('devEnvVar')}</dt>
            <dd>
              <code className="channel-slug">NEXT_PUBLIC_API_URL</code>
            </dd>
          </dl>
          <p className="text-muted text-sm" style={{ marginTop: '0.75rem' }}>
            {t('devHint')} <code>npm run dev:clean</code>
          </p>
        </details>
      </section>
      <StorageStatsPanel initial={storage} />
    </div>
  );
}
