'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { trialDaysRemaining } from '@/lib/plan-limits';
import type { AuthSession } from '@/context/AuthContext';

export function TrialBanner({ session }: { session: AuthSession }) {
  const t = useTranslations('dashboard');
  const { plan, trialEndsAt } = session.organization;
  if (plan !== 'trial') return null;

  const days = trialDaysRemaining(trialEndsAt);
  if (days == null) return null;

  if (days === 0) {
    return (
      <div className="dashboard-trial-banner dashboard-trial-banner-expired" role="alert">
        <p>
          <strong>{t('trialExpired')}</strong>{' '}
          {t('upgradePlan')}
        </p>
        <Link href="/settings" className="btn btn-primary btn-sm">
          {t('viewPlans')}
        </Link>
      </div>
    );
  }

  if (days <= 3) {
    return (
      <div className="dashboard-trial-banner dashboard-trial-banner-warn" role="status">
        <p>{t('trialDaysLeft', { days })}</p>
        <Link href="/settings" className="btn btn-secondary btn-sm">
          {t('upgradePlan')}
        </Link>
      </div>
    );
  }

  return null;
}
