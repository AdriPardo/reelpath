'use client';

import { useEffect, useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';

export function SettingsApiKeysPanel() {
  const t = useTranslations('settings.apikeys');
  const ts = useTranslations('settingsExt');
  const tc = useTranslations('common');
  const { session } = useAuth();
  const { toast } = useToast();
  const keyId = useId();
  const [hasOpenaiKey, setHasOpenaiKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [openaiKey, setOpenaiKey] = useState('');
  const [saving, setSaving] = useState(false);

  const isAdmin = session?.role === 'owner' || session?.role === 'admin';

  useEffect(() => {
    if (!session) return;
    api<{ hasOpenaiKey: boolean }>('/api/org/settings')
      .then((data) => setHasOpenaiKey(data.hasOpenaiKey))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session]);

  async function saveKey(e: React.FormEvent) {
    e.preventDefault();
    if (!openaiKey.trim()) return;
    setSaving(true);
    try {
      const result = await api<{ hasOpenaiKey: boolean; message: string }>('/api/org/settings', {
        method: 'PATCH',
        body: JSON.stringify({ openaiApiKey: openaiKey.trim() }),
      });
      setHasOpenaiKey(result.hasOpenaiKey);
      setOpenaiKey('');
      toast(result.message, 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : ts('apikeysSaveError'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function removeKey() {
    setSaving(true);
    try {
      await api('/api/org/settings', {
        method: 'PATCH',
        body: JSON.stringify({ openaiApiKey: null }),
      });
      setHasOpenaiKey(false);
      toast(ts('apikeysRemoved'), 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : ts('apikeysRemoveError'), 'error');
    } finally {
      setSaving(false);
    }
  }

  if (!session) {
    return null;
  }

  return (
    <section className="settings-section">
      <header className="settings-section-header">
        <h2>{t('title')}</h2>
        <p className="settings-section-desc">{ts('apikeysDesc')}</p>
      </header>

      {loading ? (
        <p className="text-muted text-sm">{tc('loading')}</p>
      ) : (
        <>
          <p className="text-sm">
            {ts('apikeysStatus')}{' '}
            <strong>{hasOpenaiKey ? ts('apikeysOwn') : ts('apikeysServer')}</strong>
          </p>

          {isAdmin ? (
            <form className="settings-form-block" onSubmit={saveKey}>
              <label className="modal-field" htmlFor={keyId}>
                {ts('apikeysKeyLabel')}
                <input
                  id={keyId}
                  type="password"
                  className="topic-input"
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  placeholder={hasOpenaiKey ? '••••••••••••' : 'sk-...'}
                  autoComplete="off"
                />
              </label>
              <div className="settings-form-actions">
                <Button type="submit" variant="primary" size="sm" disabled={saving || !openaiKey.trim()}>
                  {saving ? tc('saving') : t('saveKey')}
                </Button>
                {hasOpenaiKey && (
                  <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={removeKey}>
                    {ts('apikeysRemove')}
                  </Button>
                )}
              </div>
            </form>
          ) : (
            <p className="text-muted text-sm">{ts('apikeysAdminOnly')}</p>
          )}
        </>
      )}
    </section>
  );
}
