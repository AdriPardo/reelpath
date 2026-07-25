'use client';

import { useTranslations } from 'next-intl';
import { useTheme } from '@/context/ThemeContext';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { PLATFORM } from '@/lib/site-brand';

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

export function SettingsPreferencesPanel() {
  const t = useTranslations('settings');
  const tc = useTranslations('common');
  const { theme, setTheme } = useTheme();

  return (
    <section className="settings-section">
      <header className="settings-section-header">
        <h2>{t('preferencesTitle')}</h2>
        <p className="settings-section-desc">{t('preferencesDesc', { appName: PLATFORM.name })}</p>
      </header>

      <div className="settings-pref-row">
        <div>
          <h3>{tc('appearance')}</h3>
          <p className="text-muted text-sm">{tc('chooseTheme')}</p>
        </div>
        <div className="settings-theme-toggle" role="group" aria-label={tc('themeLabel')}>
          <button
            type="button"
            className={`settings-theme-option${theme === 'light' ? ' settings-theme-option-active' : ''}`}
            aria-pressed={theme === 'light'}
            onClick={() => setTheme('light')}
          >
            <SunIcon />
            <span>{tc('themeLight')}</span>
          </button>
          <button
            type="button"
            className={`settings-theme-option${theme === 'dark' ? ' settings-theme-option-active' : ''}`}
            aria-pressed={theme === 'dark'}
            onClick={() => setTheme('dark')}
          >
            <MoonIcon />
            <span>{tc('themeDark')}</span>
          </button>
        </div>
      </div>

      <div className="settings-divider" />

      <div className="settings-pref-row">
        <div>
          <h3>{tc('language')}</h3>
          <p className="text-muted text-sm">{tc('interfaceLanguage')}</p>
        </div>
        <LocaleSwitcher variant="settings" />
      </div>
    </section>
  );
}
