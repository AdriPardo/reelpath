'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  organizations: { id: string; name: string; slug: string; plan: string; role: string }[];
};

export function AdminUsers() {
  const t = useTranslations('admin.users');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<UserRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
      const data = await api<{ users: UserRow[] }>(`/api/admin/users${qs}`);
      setRows(data.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [q, t]);

  useEffect(() => {
    void load();
  }, [load]);

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
          void load();
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
                <th>{t('email')}</th>
                <th>{t('name')}</th>
                <th>{t('orgs')}</th>
                <th>{t('created')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td>{u.name ?? '—'}</td>
                  <td>
                    {u.organizations.length === 0
                      ? '—'
                      : u.organizations.map((o) => `${o.name} (${o.role})`).join(', ')}
                  </td>
                  <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-muted">
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
