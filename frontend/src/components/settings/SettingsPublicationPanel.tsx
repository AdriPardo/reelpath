'use client';

import { useTranslations } from 'next-intl';
import { ButtonLink } from '@/components/ui/Button';

export function SettingsPublicationPanel() {
  const t = useTranslations('settings.publication');
  const ts = useTranslations('settingsExt');
  const tc = useTranslations('common');

  return (
    <section className="settings-section">
      <header className="settings-section-header">
        <h2>{t('title')}</h2>
        <p className="settings-section-desc">{ts('publicationDesc')}</p>
      </header>

      <div className="settings-publish-card">
        <div className="settings-publish-icon" aria-hidden="true">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 8.5V17a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.5" />
            <path d="M12 12v6" />
            <path d="M7 12v6" />
            <path d="M17 12v6" />
            <path d="M2 8.5 12 3l10 5.5" />
          </svg>
        </div>
        <div className="settings-publish-body">
          <h3>{t('connectedAccounts')}</h3>
          <p>{ts('publicationManage')}</p>
        </div>
        <ButtonLink href="/channels" variant="secondary" size="sm" className="settings-publish-cta">
          {tc('goToChannels')}
        </ButtonLink>
      </div>
    </section>
  );
}
