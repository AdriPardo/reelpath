'use client';

import { useEffect, useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';

type SecretSource = 'db' | 'env' | 'none';

type PlatformSecretsStatus = {
  hasYoutubeOAuthApp: boolean;
  hasOpenaiKey: boolean;
  hasDeepseekKey: boolean;
  hasElevenLabsKey: boolean;
  hasFalKey?: boolean;
  hasPexelsKey: boolean;
  hasPixabayKey?: boolean;
  hasCoverrKey?: boolean;
  hasUploadPost?: boolean;
  youtubeOAuthRedirectUri: string;
  sources?: {
    youtube: SecretSource;
    openai: SecretSource;
    deepseek: SecretSource;
    elevenlabs: SecretSource;
    fal?: SecretSource;
    pexels: SecretSource;
    pixabay?: SecretSource;
    coverr?: SecretSource;
    uploadPost?: SecretSource;
  };
};

function StatusChip({
  configured,
  source,
  configuredLabel,
  missingLabel,
  envLabel,
}: {
  configured: boolean;
  source?: SecretSource;
  configuredLabel: string;
  missingLabel: string;
  envLabel: string;
}) {
  if (!configured) {
    return <Chip variant="neutral">{missingLabel}</Chip>;
  }
  if (source === 'env') {
    return <Chip variant="success">{envLabel}</Chip>;
  }
  return <Chip variant="success">{configuredLabel}</Chip>;
}

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
  const falId = useId();
  const pexelsId = useId();
  const pixabayId = useId();
  const coverrId = useId();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<PlatformSecretsStatus | null>(null);

  const [youtubeClientId, setYoutubeClientId] = useState('');
  const [youtubeClientSecret, setYoutubeClientSecret] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [deepseekKey, setDeepseekKey] = useState('');
  const [elevenLabsKey, setElevenLabsKey] = useState('');
  const [falKey, setFalKey] = useState('');
  const [pexelsKey, setPexelsKey] = useState('');
  const [pixabayKey, setPixabayKey] = useState('');
  const [coverrKey, setCoverrKey] = useState('');
  const [uploadPostApiKey, setUploadPostApiKey] = useState('');
  const [uploadPostUsername, setUploadPostUsername] = useState('');

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
      if (falKey.trim()) body.falApiKey = falKey.trim();
      if (pexelsKey.trim()) body.pexelsApiKey = pexelsKey.trim();
      if (pixabayKey.trim()) body.pixabayApiKey = pixabayKey.trim();
      if (coverrKey.trim()) body.coverrApiKey = coverrKey.trim();
      if (uploadPostApiKey.trim() && uploadPostUsername.trim()) {
        body.uploadPostApiKey = uploadPostApiKey.trim();
        body.uploadPostUsername = uploadPostUsername.trim();
      }

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
      setFalKey('');
      setPexelsKey('');
      setPixabayKey('');
      setCoverrKey('');
      setUploadPostApiKey('');
      setUploadPostUsername('');
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
      | 'clearFalApiKey'
      | 'clearPexelsApiKey'
      | 'clearPixabayApiKey'
      | 'clearCoverrApiKey'
      | 'clearUploadPost',
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

  const ytSource = status.sources?.youtube ?? (status.hasYoutubeOAuthApp ? 'db' : 'none');

  return (
    <div className="settings-platform-secrets">
      {/* Título lo pone Admin → Secretos; aquí solo bloques. */}
      <section className="settings-section platform-secret-block">
        <div className="platform-secret-block-head">
          <h3>{t('youtubeTitle')}</h3>
          <StatusChip
            configured={status.hasYoutubeOAuthApp}
            source={ytSource}
            configuredLabel={t('configured')}
            missingLabel={t('missing')}
            envLabel={t('configuredEnv')}
          />
        </div>
        <p className="text-muted">{t('youtubeHint')}</p>

        <label className="platform-secret-field" htmlFor={`${ytId}-redirect`}>
          <span className="platform-secret-label">{t('redirectLabel')}</span>
          <input
            id={`${ytId}-redirect`}
            className="platform-secret-input"
            readOnly
            value={status.youtubeOAuthRedirectUri}
            onFocus={(e) => e.target.select()}
          />
          <span className="platform-secret-hint">{t('redirectHint')}</span>
        </label>

        <div className="platform-secret-grid">
          <label className="platform-secret-field" htmlFor={ytId}>
            <span className="platform-secret-label">{t('clientIdLabel')}</span>
            <input
              id={ytId}
              className="platform-secret-input"
              type="text"
              autoComplete="off"
              placeholder={status.hasYoutubeOAuthApp ? t('leaveBlank') : t('clientIdPlaceholder')}
              value={youtubeClientId}
              onChange={(e) => setYoutubeClientId(e.target.value)}
            />
          </label>
          <label className="platform-secret-field" htmlFor={ytSecret}>
            <span className="platform-secret-label">{t('clientSecretLabel')}</span>
            <input
              id={ytSecret}
              className="platform-secret-input"
              type="password"
              autoComplete="new-password"
              placeholder={status.hasYoutubeOAuthApp ? t('leaveBlank') : t('clientSecretPlaceholder')}
              value={youtubeClientSecret}
              onChange={(e) => setYoutubeClientSecret(e.target.value)}
            />
          </label>
        </div>

        {status.hasYoutubeOAuthApp && ytSource === 'db' ? (
          <div className="platform-secret-actions">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={saving}
              onClick={() => void clearKey('clearYoutubeOAuthApp')}
            >
              {t('clearYoutube')}
            </Button>
          </div>
        ) : null}
        {ytSource === 'env' ? <p className="platform-secret-hint">{t('envOnlyHint')}</p> : null}
      </section>

      <section className="settings-section platform-secret-block">
        <h3>{t('apiKeysTitle')}</h3>
        <p className="text-muted">{t('apiKeysHint')}</p>

        {(
          [
            {
              id: openaiId,
              label: t('openaiLabel'),
              has: status.hasOpenaiKey,
              source: status.sources?.openai,
              value: openaiKey,
              set: setOpenaiKey,
              clear: 'clearOpenaiApiKey' as const,
            },
            {
              id: deepseekId,
              label: t('deepseekLabel'),
              has: status.hasDeepseekKey,
              source: status.sources?.deepseek,
              value: deepseekKey,
              set: setDeepseekKey,
              clear: 'clearDeepseekApiKey' as const,
            },
            {
              id: elevenId,
              label: t('elevenLabel'),
              has: status.hasElevenLabsKey,
              source: status.sources?.elevenlabs,
              value: elevenLabsKey,
              set: setElevenLabsKey,
              clear: 'clearElevenLabsApiKey' as const,
            },
            {
              id: falId,
              label: t('falLabel'),
              has: !!status.hasFalKey,
              source: status.sources?.fal,
              value: falKey,
              set: setFalKey,
              clear: 'clearFalApiKey' as const,
            },
            {
              id: pexelsId,
              label: t('pexelsLabel'),
              has: status.hasPexelsKey,
              source: status.sources?.pexels,
              value: pexelsKey,
              set: setPexelsKey,
              clear: 'clearPexelsApiKey' as const,
            },
            {
              id: pixabayId,
              label: t('pixabayLabel'),
              has: !!status.hasPixabayKey,
              source: status.sources?.pixabay,
              value: pixabayKey,
              set: setPixabayKey,
              clear: 'clearPixabayApiKey' as const,
            },
            {
              id: coverrId,
              label: t('coverrLabel'),
              has: !!status.hasCoverrKey,
              source: status.sources?.coverr,
              value: coverrKey,
              set: setCoverrKey,
              clear: 'clearCoverrApiKey' as const,
            },
          ] as const
        ).map((field) => {
          const source = field.source ?? (field.has ? 'db' : 'none');
          return (
            <div key={field.id} className="platform-secret-row">
              <div className="platform-secret-block-head">
                <label className="platform-secret-label" htmlFor={field.id}>
                  {field.label}
                </label>
                <StatusChip
                  configured={field.has}
                  source={source}
                  configuredLabel={t('configured')}
                  missingLabel={t('missing')}
                  envLabel={t('configuredEnv')}
                />
              </div>
              {field.has ? (
                <p className="platform-secret-stored" aria-hidden="true">
                  ••••••••••••••••
                </p>
              ) : null}
              <input
                id={field.id}
                className="platform-secret-input"
                type="password"
                autoComplete="new-password"
                placeholder={field.has ? t('leaveBlank') : t('pasteKey')}
                value={field.value}
                onChange={(e) => field.set(e.target.value)}
              />
              {field.has && source === 'db' ? (
                <div className="platform-secret-actions">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={saving}
                    onClick={() => void clearKey(field.clear)}
                  >
                    {t('removeKey')}
                  </Button>
                </div>
              ) : null}
              {source === 'env' ? <p className="platform-secret-hint">{t('envOnlyHint')}</p> : null}
            </div>
          );
        })}
      </section>

      <section className="platform-secret-block" aria-labelledby="upload-post-heading">
        <div className="platform-secret-block-head">
          <h3 id="upload-post-heading">{t('uploadPostLabel')}</h3>
          <StatusChip
            configured={!!status.hasUploadPost}
            source={status.sources?.uploadPost ?? (status.hasUploadPost ? 'db' : 'none')}
            configuredLabel={t('configured')}
            missingLabel={t('missing')}
            envLabel={t('configuredEnv')}
          />
        </div>
        <p className="text-muted text-sm">{t('uploadPostHint')}</p>
        <label className="platform-secret-label" htmlFor="upload-post-user">
          {t('uploadPostUsernameLabel')}
        </label>
        <input
          id="upload-post-user"
          className="platform-secret-input"
          type="text"
          autoComplete="off"
          value={uploadPostUsername}
          onChange={(e) => setUploadPostUsername(e.target.value)}
          placeholder={status.hasUploadPost ? t('leaveBlank') : 'username'}
        />
        <label className="platform-secret-label" htmlFor="upload-post-key">
          {t('uploadPostLabel')}
        </label>
        <input
          id="upload-post-key"
          className="platform-secret-input"
          type="password"
          autoComplete="new-password"
          value={uploadPostApiKey}
          onChange={(e) => setUploadPostApiKey(e.target.value)}
          placeholder={status.hasUploadPost ? t('leaveBlank') : t('pasteKey')}
        />
        {status.hasUploadPost && status.sources?.uploadPost === 'db' ? (
          <div className="platform-secret-actions">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={saving}
              onClick={() => void clearKey('clearUploadPost')}
            >
              {t('removeKey')}
            </Button>
          </div>
        ) : null}
      </section>

      <div className="platform-secret-actions platform-secret-actions-primary">
        <Button type="button" disabled={saving} onClick={() => void save()}>
          {saving ? tc('saving') : t('save')}
        </Button>
      </div>
    </div>
  );
}
