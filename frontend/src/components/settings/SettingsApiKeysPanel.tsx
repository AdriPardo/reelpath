'use client';

import { useEffect, useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';

type LlmProvider = 'auto' | 'deepseek' | 'openai';
type TtsProvider = 'auto' | 'edge' | 'elevenlabs' | 'openai';

type OrgSettings = {
  llmProvider: LlmProvider;
  ttsProvider: TtsProvider;
  generateAiImages: boolean;
  maxScenesLong: number | null;
  hasOpenaiKey: boolean;
  hasDeepseekKey: boolean;
  hasElevenLabsKey: boolean;
  platformDefaults?: {
    llmProvider: string;
    ttsProvider: string;
    generateAiImages: boolean;
    maxScenesLong: number;
  };
};

const LLM_OPTIONS: LlmProvider[] = ['auto', 'deepseek', 'openai'];
const TTS_OPTIONS: TtsProvider[] = ['auto', 'edge', 'elevenlabs', 'openai'];

export function SettingsApiKeysPanel() {
  const t = useTranslations('settings.apikeys');
  const ts = useTranslations('settingsExt');
  const tc = useTranslations('common');
  const { session } = useAuth();
  const { toast } = useToast();

  const openaiId = useId();
  const deepseekId = useId();
  const elevenId = useId();
  const scenesId = useId();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<OrgSettings | null>(null);

  const [llmProvider, setLlmProvider] = useState<LlmProvider>('auto');
  const [ttsProvider, setTtsProvider] = useState<TtsProvider>('auto');
  const [generateAiImages, setGenerateAiImages] = useState(false);
  const [maxScenesLong, setMaxScenesLong] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [deepseekKey, setDeepseekKey] = useState('');
  const [elevenLabsKey, setElevenLabsKey] = useState('');

  const isAdmin = session?.role === 'owner' || session?.role === 'admin';

  useEffect(() => {
    if (!session) return;
    api<OrgSettings>('/api/org/settings')
      .then((data) => {
        setSettings(data);
        setLlmProvider(data.llmProvider);
        setTtsProvider(data.ttsProvider);
        setGenerateAiImages(data.generateAiImages);
        setMaxScenesLong(data.maxScenesLong != null ? String(data.maxScenesLong) : '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session]);

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!isAdmin) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        llmProvider,
        ttsProvider,
        generateAiImages,
        maxScenesLong: maxScenesLong.trim() === '' ? null : Number(maxScenesLong),
      };
      if (openaiKey.trim()) body.openaiApiKey = openaiKey.trim();
      if (deepseekKey.trim()) body.deepseekApiKey = deepseekKey.trim();
      if (elevenLabsKey.trim()) body.elevenLabsApiKey = elevenLabsKey.trim();

      const result = await api<OrgSettings & { message: string }>('/api/org/settings', {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      setSettings(result);
      setLlmProvider(result.llmProvider);
      setTtsProvider(result.ttsProvider);
      setGenerateAiImages(result.generateAiImages);
      setMaxScenesLong(result.maxScenesLong != null ? String(result.maxScenesLong) : '');
      setOpenaiKey('');
      setDeepseekKey('');
      setElevenLabsKey('');
      toast(result.message || ts('apikeysSaved'), 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : ts('apikeysSaveError'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function removeKey(provider: 'openai' | 'deepseek' | 'elevenlabs') {
    if (!isAdmin) return;
    setSaving(true);
    try {
      const payload =
        provider === 'openai'
          ? { openaiApiKey: null }
          : provider === 'deepseek'
            ? { deepseekApiKey: null }
            : { elevenLabsApiKey: null };
      const result = await api<OrgSettings & { message: string }>('/api/org/settings', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      setSettings(result);
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

  const platformScenes = settings?.platformDefaults?.maxScenesLong ?? 12;

  return (
    <section className="settings-section">
      <header className="settings-section-header">
        <h2>{t('title')}</h2>
        <p className="settings-section-desc">{ts('apikeysDesc')}</p>
      </header>

      {loading ? (
        <p className="text-muted text-sm">{tc('loading')}</p>
      ) : (
        <form className="settings-form-block" onSubmit={saveSettings}>
          <fieldset disabled={!isAdmin || saving} className="settings-ai-fieldset">
            <div className="settings-pref-row">
              <div>
                <h3>{ts('apikeysLlmTitle')}</h3>
                <p className="text-muted text-sm">{ts('apikeysLlmHint')}</p>
              </div>
              <select
                className="topic-input"
                value={llmProvider}
                onChange={(e) => setLlmProvider(e.target.value as LlmProvider)}
                aria-label={ts('apikeysLlmTitle')}
              >
                {LLM_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {ts(`apikeysLlm_${opt}`)}
                  </option>
                ))}
              </select>
            </div>

            <div className="settings-divider" />

            <div className="settings-pref-row">
              <div>
                <h3>{ts('apikeysTtsTitle')}</h3>
                <p className="text-muted text-sm">{ts('apikeysTtsHint')}</p>
              </div>
              <select
                className="topic-input"
                value={ttsProvider}
                onChange={(e) => setTtsProvider(e.target.value as TtsProvider)}
                aria-label={ts('apikeysTtsTitle')}
              >
                {TTS_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {ts(`apikeysTts_${opt}`)}
                  </option>
                ))}
              </select>
            </div>

            <div className="settings-divider" />

            <div className="settings-pref-row">
              <div>
                <h3>{ts('apikeysImagesTitle')}</h3>
                <p className="text-muted text-sm">{ts('apikeysImagesHint')}</p>
              </div>
              <label className="settings-toggle-label">
                <input
                  type="checkbox"
                  checked={generateAiImages}
                  onChange={(e) => setGenerateAiImages(e.target.checked)}
                />
                <span>{generateAiImages ? ts('apikeysImagesOn') : ts('apikeysImagesOff')}</span>
              </label>
            </div>

            <div className="settings-divider" />

            <label className="modal-field" htmlFor={scenesId}>
              {ts('apikeysScenesLabel')}
              <input
                id={scenesId}
                type="number"
                min={4}
                max={40}
                className="topic-input"
                value={maxScenesLong}
                onChange={(e) => setMaxScenesLong(e.target.value)}
                placeholder={String(platformScenes)}
              />
              <span className="text-muted text-sm">{ts('apikeysScenesHint', { default: platformScenes })}</span>
            </label>

            <div className="settings-divider" />

            <h3>{ts('apikeysByokTitle')}</h3>
            <p className="text-muted text-sm" style={{ marginBottom: '1rem' }}>
              {ts('apikeysByokHint')}
            </p>

            <label className="modal-field" htmlFor={openaiId}>
              {ts('apikeysKeyLabel')}
              <span className="text-muted text-sm">
                {settings?.hasOpenaiKey ? ts('apikeysOwn') : ts('apikeysServer')}
              </span>
              <input
                id={openaiId}
                type="password"
                className="topic-input"
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder={settings?.hasOpenaiKey ? '••••••••••••' : 'sk-...'}
                autoComplete="off"
              />
              {settings?.hasOpenaiKey && isAdmin && (
                <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={() => removeKey('openai')}>
                  {ts('apikeysRemove')}
                </Button>
              )}
            </label>

            <label className="modal-field" htmlFor={deepseekId}>
              {ts('apikeysDeepseekLabel')}
              <span className="text-muted text-sm">
                {settings?.hasDeepseekKey ? ts('apikeysOwn') : ts('apikeysServer')}
              </span>
              <input
                id={deepseekId}
                type="password"
                className="topic-input"
                value={deepseekKey}
                onChange={(e) => setDeepseekKey(e.target.value)}
                placeholder={settings?.hasDeepseekKey ? '••••••••••••' : 'sk-...'}
                autoComplete="off"
              />
              {settings?.hasDeepseekKey && isAdmin && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={saving}
                  onClick={() => removeKey('deepseek')}
                >
                  {ts('apikeysRemove')}
                </Button>
              )}
            </label>

            <label className="modal-field" htmlFor={elevenId}>
              {ts('apikeysElevenLabel')}
              <span className="text-muted text-sm">
                {settings?.hasElevenLabsKey ? ts('apikeysOwn') : ts('apikeysServer')}
              </span>
              <input
                id={elevenId}
                type="password"
                className="topic-input"
                value={elevenLabsKey}
                onChange={(e) => setElevenLabsKey(e.target.value)}
                placeholder={settings?.hasElevenLabsKey ? '••••••••••••' : 'xi-...'}
                autoComplete="off"
              />
              {settings?.hasElevenLabsKey && isAdmin && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={saving}
                  onClick={() => removeKey('elevenlabs')}
                >
                  {ts('apikeysRemove')}
                </Button>
              )}
            </label>
          </fieldset>

          {isAdmin ? (
            <div className="settings-form-actions">
              <Button type="submit" variant="primary" size="sm" disabled={saving}>
                {saving ? tc('saving') : t('saveKey')}
              </Button>
            </div>
          ) : (
            <p className="text-muted text-sm">{ts('apikeysAdminOnly')}</p>
          )}
        </form>
      )}
    </section>
  );
}
