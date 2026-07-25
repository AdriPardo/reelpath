'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { AuthSession } from '@/context/AuthContext';

export function BillingPastDueBanner({ session }: { session: AuthSession }) {
  const t = useTranslations('dashboard');
  if (session.organization.billingStatus !== 'past_due') return null;

  return (
    <div className="dashboard-trial-banner dashboard-trial-banner-expired" role="alert">
      <p>
        <strong>{t('billingPastDue')}</strong>
      </p>
      <Link href="/settings" className="btn btn-primary btn-sm">
        {t('manageBilling')}
      </Link>
    </div>
  );
}
