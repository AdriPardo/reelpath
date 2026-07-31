'use client';

import { useEffect, useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';

type PlatformSecretsStatus = {
  hasYoutubeOAuthApp: boolean;
  hasOpenaiKey: boolean;
  hasDeepseekKey: boolean;
  hasElevenLabsKey: boolean;
  hasPexelsKey: boolean;
  youtubeOAuthRedirectUri: string;
};

export function SettingsPlatformSecretsPanel() {
  const t = useTranslations('settings.platformSecrets');
  const tc = useTranslations('common');
  const { session } = useAuth();
  const { toast } = useToast();

  const ytId = useId();
  const ytSecret = useId();
  const openaiId = useId();
  const deepseekId = useId();
  const elevenId = useId();
  const pexelsId = useId();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<PlatformSecretsStatus | null>(null);

  const [youtubeClientId, setYoutubeClientId] = useState('');
  const [youtubeClientSecret, setYoutubeClientSecret] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [deepseekKey, setDeepseekKey] = useState('');
  const [elevenLabsKey, setElevenLabsKey] = useState('');
  const [pexelsKey, setPexelsKey] = useState('');

  const isPlatformAdmin = session?.isPlatformAdmin === true;

  async function load() {
    setLoading(true);
    try {
      const data = await api<PlatformSecretsStatus>('/api/platform/secrets');
      setStatus(data);
    } catch (err) {
      toast(err instanceof Error ? err.message : t('loadError'), 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isPlatformAdmin) void load();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once when role known
  }, [isPlatformAdmin]);

  async function save() {
    setSaving(true);
    try {
      const body: Record<string, string> = {};
      if (youtubeClientId.trim() && youtubeClientSecret.trim()) {
        body.youtubeClientId = youtubeClientId.trim();
        body.youtubeClientSecret = youtubeClientSecret.trim();
      }
      if (openaiKey.trim()) body.openaiApiKey = openaiKey.trim();
      if (deepseekKey.trim()) body.deepseekApiKey = deepseekKey.trim();
      if (elevenLabsKey.trim()) body.elevenLabsApiKey = elevenLabsKey.trim();
      if (pexelsKey.trim()) body.pexelsApiKey = pexelsKey.trim();

      if (Object.keys(body).length === 0) {
        toast(t('nothingToSave'), 'error');
        return;
      }

      const data = await api<PlatformSecretsStatus>('/api/platform/secrets', {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      setStatus(data);
      setYoutubeClientId('');
      setYoutubeClientSecret('');
      setOpenaiKey('');
      setDeepseekKey('');
      setElevenLabsKey('');
      setPexelsKey('');
      toast(t('saved'), 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : t('saveError'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function clearKey(
    flag:
      | 'clearYoutubeOAuthApp'
      | 'clearOpenaiApiKey'
      | 'clearDeepseekApiKey'
      | 'clearElevenLabsApiKey'
      | 'clearPexelsApiKey',
  ) {
    setSaving(true);
    try {
      const data = await api<PlatformSecretsStatus>('/api/platform/secrets', {
        method: 'PATCH',
        body: JSON.stringify({ [flag]: true }),
      });
      setStatus(data);
      toast(t('cleared'), 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : t('saveError'), 'error');
    } finally {
      setSaving(false);
    }
  }

  if (!isPlatformAdmin) {
    return (
      <section className="settings-section">
        <h2>{t('title')}</h2>
        <p className="text-muted">{t('platformAdminOnly')}</p>
      </section>
    );
  }

  if (loading || !status) {
    return (
      <section className="settings-section">
        <h2>{t('title')}</h2>
        <p className="text-muted">{tc('loading')}</p>
      </section>
    );
  }

  return (
    <div className="settings-platform-secrets">
      <section className="settings-section">
        <h2>{t('title')}</h2>
        <p className="text-muted">{t('desc')}</p>
      </section>

      <section className="settings-section">
        <h3>{t('youtubeTitle')}</h3>
        <p className="text-muted">{t('youtubeHint')}</p>
        <p className="settings-secrets-status">
          {t('status')}:{' '}
          <strong>{status.hasYoutubeOAuthApp ? t('configured') : t('missing')}</strong>
        </p>
        <label className="settings-field" htmlFor={`${ytId}-redirect`}>
          {t('redirectLabel')}
        </label>
        <input
          id={`${ytId}-redirect`}
          className="input"
          readOnly
          value={status.youtubeOAuthRedirectUri}
          onFocus={(e) => e.target.select()}
        />
        <p className="text-muted settings-field-hint">{t('redirectHint')}</p>

        <label className="settings-field" htmlFor={ytId}>
          {t('clientIdLabel')}
        </label>
        <input
          id={ytId}
          className="input"
          type="text"
          autoComplete="off"
          placeholder={status.hasYoutubeOAuthApp ? t('leaveBlank') : ''}
          value={youtubeClientId}
          onChange={(e) => setYoutubeClientId(e.target.value)}
        />
        <label className="settings-field" htmlFor={ytSecret}>
          {t('clientSecretLabel')}
        </label>
        <input
          id={ytSecret}
          className="input"
          type="password"
          autoComplete="new-password"
          placeholder={status.hasYoutubeOAuthApp ? t('leaveBlank') : ''}
          value={youtubeClientSecret}
          onChange={(e) => setYoutubeClientSecret(e.target.value)}
        />
        {status.hasYoutubeOAuthApp ? (
          <Button
            type="button"
            variant="secondary"
            disabled={saving}
            onClick={() => void clearKey('clearYoutubeOAuthApp')}
          >
            {t('clearYoutube')}
          </Button>
        ) : null}
      </section>

      <section className="settings-section">
        <h3>{t('apiKeysTitle')}</h3>
        <p className="text-muted">{t('apiKeysHint')}</p>

        {(
          [
            {
              id: openaiId,
              label: t('openaiLabel'),
              has: status.hasOpenaiKey,
              value: openaiKey,
              set: setOpenaiKey,
              clear: 'clearOpenaiApiKey' as const,
            },
            {
              id: deepseekId,
              label: t('deepseekLabel'),
              has: status.hasDeepseekKey,
              value: deepseekKey,
              set: setDeepseekKey,
              clear: 'clearDeepseekApiKey' as const,
            },
            {
              id: elevenId,
              label: t('elevenLabel'),
              has: status.hasElevenLabsKey,
              value: elevenLabsKey,
              set: setElevenLabsKey,
              clear: 'clearElevenLabsApiKey' as const,
            },
            {
              id: pexelsId,
              label: t('pexelsLabel'),
              has: status.hasPexelsKey,
              value: pexelsKey,
              set: setPexelsKey,
              clear: 'clearPexelsApiKey' as const,
            },
          ] as const
        ).map((field) => (
          <div key={field.id} className="settings-secrets-row">
            <label className="settings-field" htmlFor={field.id}>
              {field.label}
            </label>
            <p className="settings-secrets-status">
              {t('status')}: <strong>{field.has ? t('configured') : t('missing')}</strong>
            </p>
            <input
              id={field.id}
              className="input"
              type="password"
              autoComplete="new-password"
              placeholder={field.has ? t('leaveBlank') : ''}
              value={field.value}
              onChange={(e) => field.set(e.target.value)}
            />
            {field.has ? (
              <Button
                type="button"
                variant="secondary"
                disabled={saving}
                onClick={() => void clearKey(field.clear)}
              >
                {t('removeKey')}
              </Button>
            ) : null}
          </div>
        ))}
      </section>

      <div className="settings-actions">
        <Button type="button" disabled={saving} onClick={() => void save()}>
          {saving ? tc('saving') : t('save')}
        </Button>
      </div>
    </div>
  );
}
