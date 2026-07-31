'use client';

import { useTranslations } from 'next-intl';
import { SettingsPlatformSecretsPanel } from '@/components/settings/SettingsPlatformSecretsPanel';
import { StorageStatsPanel } from '@/components/StorageStatsPanel';
import type { StorageStats } from '@/lib/api';

export function AdminInfra({ storage }: { storage: StorageStats | null }) {
  const t = useTranslations('admin.infra');

  return (
    <div className="settings-section">
      <header className="settings-section-header">
        <h2>{t('title')}</h2>
        <p className="settings-section-desc">{t('description')}</p>
      </header>
      <SettingsPlatformSecretsPanel />
      <div className="settings-divider" />
      <StorageStatsPanel initial={storage} />
    </div>
  );
}
