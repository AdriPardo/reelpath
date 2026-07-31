'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';

type OrgRow = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  billingStatus: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripeCustomerUrl: string | null;
  channelCount: number;
  videosThisMonth: number;
  createdAt: string;
};

type OrgDetail = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  billingStatus: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripeCustomerUrl: string | null;
  videosThisMonth: number;
  pipelines24h: number;
  pipelinesFailed24h: number;
  members: {
    role: string;
    joinedAt: string;
    user: { id: string; email: string; name: string | null };
  }[];
  channels: { id: string; name: string; slug: string; isActive: boolean }[];
};

export function AdminOrgs({
  selectedOrgId,
  onSelectOrg,
  onClearOrg,
}: {
  selectedOrgId: string | null;
  onSelectOrg: (id: string) => void;
  onClearOrg: () => void;
}) {
  const t = useTranslations('admin.organizations');
  const [q, setQ] = useState('');
  const [plan, setPlan] = useState('');
  const [status, setStatus] = useState('');
  const [rows, setRows] = useState<OrgRow[]>([]);
  const [detail, setDetail] = useState<OrgDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (plan) params.set('plan', plan);
      if (status) params.set('status', status);
      const qs = params.toString();
      const data = await api<{ organizations: OrgRow[] }>(
        `/api/admin/organizations${qs ? `?${qs}` : ''}`,
      );
      setRows(data.organizations);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [q, plan, status, t]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (!selectedOrgId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    api<OrgDetail>(`/api/admin/organizations/${selectedOrgId}`)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : t('loadError'));
      });
    return () => {
      cancelled = true;
    };
  }, [selectedOrgId, t]);

  if (selectedOrgId && detail) {
    return (
      <section className="settings-section">
        <header className="settings-section-header">
          <div className="settings-form-actions">
            <Button type="button" variant="ghost" onClick={onClearOrg}>
              {t('back')}
            </Button>
          </div>
          <h2>{detail.name}</h2>
          <p className="settings-section-desc">
            {detail.slug} · {detail.plan}
            {detail.billingStatus ? ` · ${detail.billingStatus}` : ''}
          </p>
        </header>

        <dl className="settings-dl">
          <dt>{t('videosThisMonth')}</dt>
          <dd>{detail.videosThisMonth}</dd>
          <dt>{t('pipelines24h')}</dt>
          <dd>
            {detail.pipelines24h} ({t('failed')}: {detail.pipelinesFailed24h})
          </dd>
          <dt>Stripe</dt>
          <dd>
            {detail.stripeCustomerUrl ? (
              <a href={detail.stripeCustomerUrl} target="_blank" rel="noreferrer">
                {detail.stripeCustomerId}
              </a>
            ) : (
              detail.stripeCustomerId ?? '—'
            )}
          </dd>
          <dt>{t('subscription')}</dt>
          <dd>
            <code className="channel-slug">{detail.stripeSubscriptionId ?? '—'}</code>
          </dd>
        </dl>

        <div className="settings-divider" />
        <h3>{t('members')}</h3>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t('email')}</th>
                <th>{t('name')}</th>
                <th>{t('role')}</th>
              </tr>
            </thead>
            <tbody>
              {detail.members.map((m) => (
                <tr key={m.user.id}>
                  <td>{m.user.email}</td>
                  <td>{m.user.name ?? '—'}</td>
                  <td>{m.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="settings-divider" />
        <h3>{t('channels')}</h3>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t('name')}</th>
                <th>Slug</th>
                <th>{t('active')}</th>
              </tr>
            </thead>
            <tbody>
              {detail.channels.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.slug}</td>
                  <td>{c.isActive ? '✓' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  return (
    <section className="settings-section">
      <header className="settings-section-header">
        <h2>{t('title')}</h2>
        <p className="settings-section-desc">{t('description')}</p>
      </header>

      <form
        className="settings-form-actions"
        onSubmit={(e) => {
          e.preventDefault();
          void loadList();
        }}
        style={{ marginBottom: '1rem' }}
      >
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchPlaceholder')}
        />
        <select value={plan} onChange={(e) => setPlan(e.target.value)} aria-label={t('plan')}>
          <option value="">{t('allPlans')}</option>
          <option value="trial">trial</option>
          <option value="starter">starter</option>
          <option value="pro">pro</option>
          <option value="unlimited">unlimited</option>
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label={t('status')}
        >
          <option value="">{t('allStatuses')}</option>
          <option value="active">active</option>
          <option value="past_due">past_due</option>
          <option value="canceled">canceled</option>
          <option value="trialing">trialing</option>
        </select>
        <Button type="submit" variant="secondary">
          {t('filter')}
        </Button>
      </form>

      {error && <p className="text-muted">{error}</p>}
      {loading ? (
        <p className="text-muted text-sm">{t('loading')}</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t('name')}</th>
                <th>{t('plan')}</th>
                <th>{t('status')}</th>
                <th>{t('channels')}</th>
                <th>{t('videosThisMonth')}</th>
                <th>{t('created')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((org) => (
                <tr key={org.id}>
                  <td>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => onSelectOrg(org.id)}
                    >
                      {org.name}
                    </button>
                    <div className="text-muted text-sm">{org.slug}</div>
                  </td>
                  <td>{org.plan}</td>
                  <td>{org.billingStatus ?? '—'}</td>
                  <td>{org.channelCount}</td>
                  <td>{org.videosThisMonth}</td>
                  <td>{new Date(org.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-muted">
                    {t('empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
