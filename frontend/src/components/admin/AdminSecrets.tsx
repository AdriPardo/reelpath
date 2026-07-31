'use client';

import { useTranslations } from 'next-intl';
import { SettingsPlatformSecretsPanel } from '@/components/settings/SettingsPlatformSecretsPanel';

export function AdminSecrets() {
  const t = useTranslations('admin.secrets');

  return (
    <div className="settings-section">
      <header className="settings-section-header">
        <h2>{t('title')}</h2>
        <p className="settings-section-desc">{t('description')}</p>
      </header>
      <SettingsPlatformSecretsPanel />
    </div>
  );
}
