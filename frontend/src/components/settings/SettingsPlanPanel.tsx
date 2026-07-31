'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { apiFetch } from '@/lib/api';
import { parseApiError } from '@/lib/user-messages';
import {
  formatPlanPrice,
  planLimitsToBullets,
  trialDaysRemaining,
  type PlanDefinition,
  type PlanLimits,
} from '@/lib/plan-limits';

const UPGRADE_PLAN_IDS = ['starter', 'pro', 'unlimited'] as const;

function isAdminRole(role: string | undefined): boolean {
  return role === 'owner' || role === 'admin';
}

function formatRenewalDate(iso: string | null | undefined, locale: string): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(locale === 'en' ? 'en-US' : 'es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function SettingsPlanPanel({ plans }: { plans: PlanDefinition[] }) {
  const t = useTranslations('settings.plan');
  const td = useTranslations('dashboard');
  const tc = useTranslations('common');
  const locale = useLocale();
  const { session, loading, refresh } = useAuth();
  const [showPlans, setShowPlans] = useState(false);
  const [checkoutPlanId, setCheckoutPlanId] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  if (loading) {
    return (
      <section className="settings-section">
        <header className="settings-section-header">
          <h2>{t('title')}</h2>
        </header>
        <p className="text-muted text-sm">{tc('loading')}</p>
      </section>
    );
  }

  const currentPlanId = session?.organization.plan ?? 'trial';
  const currentPlan = plans.find((p) => p.id === currentPlanId);
  const orgLimits = session?.organization.planLimits as PlanLimits | null | undefined;
  const limits: PlanLimits =
    orgLimits ??
    (currentPlan?.limits as PlanLimits | undefined) ?? {
      maxChannels: 1,
      maxVideosPerMonth: 5,
      trialDays: 14,
    };
  const isUnlimited = Boolean(limits.unlimited);
  const limitBullets = planLimitsToBullets(limits, locale);
  const trialDays = trialDaysRemaining(session?.organization.trialEndsAt);
  const trialExpired = currentPlanId === 'trial' && trialDays === 0;
  const trialEndingSoon =
    currentPlanId === 'trial' && trialDays != null && trialDays > 0 && trialDays <= 3;
  const isPaidPlan = currentPlanId !== 'trial';
  const hasStripeCustomer = Boolean(session?.organization.stripeCustomerId);
  const hasActiveSubscription = Boolean(session?.organization.stripeSubscriptionId);
  const billingPastDue = session?.organization.billingStatus === 'past_due';
  const renewalLabel = formatRenewalDate(session?.organization.subscriptionRenewsAt, locale);
  const canManageBilling = isAdminRole(session?.role);

  async function handlePlanChange(planId: string) {
    if (!UPGRADE_PLAN_IDS.includes(planId as (typeof UPGRADE_PLAN_IDS)[number])) return;
    setCheckoutPlanId(planId);
    setCheckoutError(null);
    try {
      const res = await apiFetch('/api/billing/change-plan', {
        method: 'POST',
        body: JSON.stringify({ planId }),
      });
      const text = await res.text();
      if (!res.ok) {
        throw new Error(parseApiError(text, t('changePlanError')));
      }
      const data = JSON.parse(text) as { url?: string; updated?: boolean };
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      if (data.updated) {
        await refresh();
        setShowPlans(false);
        return;
      }
      throw new Error(t('billingUnexpected'));
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : t('changePlanFailed'));
    } finally {
      setCheckoutPlanId(null);
    }
  }

  async function handleManageSubscription() {
    setPortalLoading(true);
    setPortalError(null);
    try {
      const res = await apiFetch('/api/billing/portal', { method: 'POST' });
      const text = await res.text();
      if (!res.ok) {
        throw new Error(parseApiError(text, t('portalError')));
      }
      const data = JSON.parse(text) as { url?: string };
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error(t('portalNoUrl'));
    } catch (err) {
      setPortalError(err instanceof Error ? err.message : t('portalOpenFailed'));
    } finally {
      setPortalLoading(false);
    }
  }

  const statusBadge = billingPastDue
    ? { label: t('paymentPending'), className: 'badge-rejected' }
    : trialExpired
      ? { label: t('trialExpired'), className: 'badge-rejected' }
      : isPaidPlan && hasActiveSubscription
        ? { label: t('subscriptionActive'), className: 'badge-approved' }
        : { label: t('active'), className: 'badge-approved' };

  return (
    <section className="settings-section">
      <header className="settings-section-header">
        <h2>{t('title')}</h2>
        <p className="settings-section-desc">{t('description')}</p>
      </header>

      {billingPastDue && (
        <p className="settings-plan-alert" role="alert">
          {t('paymentFailedAlert')}
        </p>
      )}

      {trialExpired && (
        <p className="settings-plan-alert" role="alert">
          {t('trialExpiredAlert')}
        </p>
      )}
      {trialEndingSoon && trialDays != null && (
        <p className="settings-plan-alert settings-plan-alert-warn" role="status">
          {td('trialDaysLeft', { days: trialDays })}
        </p>
      )}

      <div className="settings-plan-hero">
        <div className="settings-plan-hero-top">
          <div>
            <span className="settings-plan-label">{t('current')}</span>
            <p className="settings-plan-name">{currentPlan?.name ?? currentPlanId}</p>
          </div>
          <span className={`badge ${statusBadge.className}`}>{statusBadge.label}</span>
        </div>

        <ul className="settings-plan-limits">
          {limitBullets.map((item) => (
            <li key={item}>{item}</li>
          ))}
          {currentPlanId === 'trial' && trialDays != null && trialDays > 0 && (
            <li>
              {trialDays} {trialDays === 1 ? t('trialDayRemaining') : t('trialDaysRemaining')}
            </li>
          )}
          {isPaidPlan && renewalLabel && (
            <li>{t('nextRenewal', { date: renewalLabel })}</li>
          )}
        </ul>

        {session?.organization.name && (
          <p className="settings-plan-org text-muted text-sm">
            {t('organization', { name: session.organization.name })}
          </p>
        )}

        <div className="settings-plan-cta">
          {canManageBilling && hasStripeCustomer && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={portalLoading}
              onClick={() => void handleManageSubscription()}
            >
              {portalLoading ? t('openingPortal') : t('manageSubscription')}
            </Button>
          )}
          {!isUnlimited && (
            <Button type="button" variant="primary" size="sm" onClick={() => setShowPlans(true)}>
              {trialExpired ? td('upgradePlan') : t('viewPlansUpgrade')}
            </Button>
          )}
        </div>

        {portalError && (
          <p className="settings-plan-alert" role="alert">
            {portalError}
          </p>
        )}
      </div>

      {(showPlans || isUnlimited) && (
        <div className="settings-plans-compare">
          <div className="settings-subsection-head">
            <h3>{t('availablePlans')}</h3>
            {!isUnlimited && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowPlans(false)}>
                {t('hide')}
              </Button>
            )}
          </div>

          {checkoutError && (
            <p className="settings-plan-alert" role="alert">
              {checkoutError}
            </p>
          )}

          {plans.length === 0 ? (
            <p className="text-muted text-sm">{t('plansComingSoon')}</p>
          ) : (
            <div className="settings-plans-compare-grid" role="table" aria-label={t('availablePlans')}>
              {(() => {
                const visible = plans.filter((plan) => plan.id !== 'trial');
                const cells = visible.map((plan) => {
                  const limits = plan.limits as PlanLimits;
                  const isCurrent = plan.id === currentPlanId;
                  const canChange =
                    !isCurrent &&
                    UPGRADE_PLAN_IDS.includes(plan.id as (typeof UPGRADE_PLAN_IDS)[number]);
                  return { plan, limits, isCurrent, canChange };
                });
                return (
                  <>
                    <div className="settings-plans-compare-row" role="row">
                      {cells.map(({ plan, isCurrent }) => (
                        <div
                          key={`${plan.id}-name`}
                          role="columnheader"
                          className={`settings-plans-compare-cell${isCurrent ? ' is-current' : ''}`}
                        >
                          <strong>{plan.name}</strong>
                        </div>
                      ))}
                    </div>
                    <div className="settings-plans-compare-row" role="row">
                      {cells.map(({ plan, isCurrent }) => (
                        <div
                          key={`${plan.id}-price`}
                          role="cell"
                          className={`settings-plans-compare-cell settings-plans-compare-price${isCurrent ? ' is-current' : ''}`}
                        >
                          {formatPlanPrice(plan.priceMonthlyCents)}
                        </div>
                      ))}
                    </div>
                    <div className="settings-plans-compare-row" role="row">
                      {cells.map(({ plan, limits, isCurrent }) => (
                        <div
                          key={`${plan.id}-videos`}
                          role="cell"
                          className={`settings-plans-compare-cell${isCurrent ? ' is-current' : ''}`}
                        >
                          <span className="settings-plans-compare-label">{t('limitVideos')}</span>
                          <span>
                            {limits.unlimited
                              ? t('unlimitedVideos')
                              : limits.maxVideosPerMonth != null
                                ? String(limits.maxVideosPerMonth)
                                : '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="settings-plans-compare-row" role="row">
                      {cells.map(({ plan, limits, isCurrent }) => (
                        <div
                          key={`${plan.id}-channels`}
                          role="cell"
                          className={`settings-plans-compare-cell${isCurrent ? ' is-current' : ''}`}
                        >
                          <span className="settings-plans-compare-label">{t('limitChannels')}</span>
                          <span>
                            {limits.unlimited
                              ? t('unlimitedChannels')
                              : limits.maxChannels != null
                                ? String(limits.maxChannels)
                                : '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="settings-plans-compare-row settings-plans-compare-ctas" role="row">
                      {cells.map(({ plan, isCurrent, canChange }) => (
                        <div
                          key={`${plan.id}-cta`}
                          role="cell"
                          className={`settings-plans-compare-cell${isCurrent ? ' is-current' : ''}`}
                        >
                          {isCurrent ? (
                            <span className="badge badge-approved">{t('yourPlan')}</span>
                          ) : canChange && canManageBilling ? (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              disabled={checkoutPlanId === plan.id}
                              onClick={() => void handlePlanChange(plan.id)}
                            >
                              {checkoutPlanId === plan.id ? t('processing') : t('upgradeToPlan')}
                            </Button>
                          ) : (
                            <span className="text-muted text-sm">—</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          <p className="text-muted text-sm settings-plans-footnote">{t('stripeFootnote')}</p>
        </div>
      )}
    </section>
  );
}
