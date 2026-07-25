'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { stripLocalePrefix } from '@/lib/public-paths';

export function HelpFab() {
  const t = useTranslations('help');
  const tn = useTranslations('nav');
  const pathname = usePathname();
  const path = stripLocalePrefix(pathname ?? '');
  if (path.startsWith('/ayuda')) return null;

  return (
    <Link href="/ayuda" className="help-fab" aria-label={t('openFab')}>
      <span className="help-fab-icon" aria-hidden="true">
        ?
      </span>
      <span className="help-fab-label">{tn('help')}</span>
    </Link>
  );
}
