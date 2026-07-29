'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing, type AppLocale } from '@/i18n/routing';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

interface LocaleSwitcherProps {
  variant?: 'nav' | 'settings';
  className?: string;
}

export function LocaleSwitcher({ variant = 'nav', className }: LocaleSwitcherProps) {
  const locale = useLocale() as AppLocale;
  const tc = useTranslations('common');
  const router = useRouter();
  const pathname = usePathname();
  const { refresh, setUserLocale, session } = useAuth();
  const [saving, setSaving] = useState(false);

  async function switchLocale(next: AppLocale) {
    if (next === locale || saving) return;
    setSaving(true);
    try {
      if (session) {
        setUserLocale(next);
        await api('/api/auth/me', {
          method: 'PATCH',
          body: JSON.stringify({ locale: next }),
        });
        await refresh();
      }
      router.replace(pathname, { locale: next });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (variant === 'settings') {
    return (
      <div className={`locale-switcher locale-switcher-settings${className ? ` ${className}` : ''}`}>
        {routing.locales.map((loc) => (
          <button
            key={loc}
            type="button"
            className={`locale-switcher-btn${locale === loc ? ' locale-switcher-btn-active' : ''}`}
            aria-pressed={locale === loc}
            aria-current={locale === loc ? 'true' : undefined}
            disabled={saving}
            onClick={() => switchLocale(loc)}
          >
            {loc === 'es' ? tc('languageEs') : tc('languageEn')}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div
      className={`locale-switcher locale-switcher-nav${className ? ` ${className}` : ''}`}
      role="group"
      aria-label={tc('language')}
    >
      {routing.locales.map((loc) => (
        <button
          key={loc}
          type="button"
          className={`locale-switcher-chip${locale === loc ? ' locale-switcher-chip-active' : ''}`}
          aria-pressed={locale === loc}
          aria-current={locale === loc ? 'true' : undefined}
          disabled={saving}
          onClick={() => switchLocale(loc)}
        >
          {loc.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
