'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';

type BillingOrg = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  billingStatus: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripeCustomerUrl: string | null;
  trialEndsAt: string | null;
  subscriptionRenewsAt: string | null;
};

type BillingPayload = {
  organizations: BillingOrg[];
  recentWebhookEvents: { id: string; eventId: string; processedAt: string }[];
  note: string;
};

export function AdminBilling() {
  const t = useTranslations('admin.billing');
  const [data, setData] = useState<BillingPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<BillingPayload>('/api/admin/billing')
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : t('loadError'));
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  if (error) return <p className="text-muted">{error}</p>;
  if (!data) return <p className="text-muted text-sm">{t('loading')}</p>;

  return (
    <section className="settings-section">
      <header className="settings-section-header">
        <h2>{t('title')}</h2>
        <p className="settings-section-desc">{t('description')}</p>
      </header>

      <p className="text-muted text-sm" style={{ marginBottom: '1rem' }}>
        {t('stripeNote')}
      </p>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>{t('org')}</th>
              <th>{t('plan')}</th>
              <th>{t('status')}</th>
              <th>Customer</th>
              <th>Subscription</th>
            </tr>
          </thead>
          <tbody>
            {data.organizations.map((org) => (
              <tr key={org.id}>
                <td>
                  {org.name}
                  <div className="text-muted text-sm">{org.slug}</div>
                </td>
                <td>{org.plan}</td>
                <td>{org.billingStatus ?? '—'}</td>
                <td>
                  {org.stripeCustomerUrl ? (
                    <a href={org.stripeCustomerUrl} target="_blank" rel="noreferrer">
                      {org.stripeCustomerId}
                    </a>
                  ) : (
                    org.stripeCustomerId ?? '—'
                  )}
                </td>
                <td>
                  <code className="channel-slug">{org.stripeSubscriptionId ?? '—'}</code>
                </td>
              </tr>
            ))}
            {data.organizations.length === 0 && (
              <tr>
                <td colSpan={5} className="text-muted">
                  {t('empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="settings-divider" />
      <h3>{t('webhookEvents')}</h3>
      {data.recentWebhookEvents.length === 0 ? (
        <p className="text-muted text-sm">{t('noEvents')}</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Event ID</th>
                <th>{t('processedAt')}</th>
              </tr>
            </thead>
            <tbody>
              {data.recentWebhookEvents.map((e) => (
                <tr key={e.id}>
                  <td>
                    <code className="channel-slug">{e.eventId}</code>
                  </td>
                  <td>{new Date(e.processedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
