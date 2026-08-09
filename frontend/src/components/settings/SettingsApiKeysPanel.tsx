'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  EDGE_TTS_VOICES,
  ELEVENLABS_TTS_VOICES,
  OPENAI_TTS_VOICES,
  type TtsVoiceOption,
} from '@autotube/shared';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { VoicePicker } from '@/components/ui/VoicePicker';

type LlmProvider = 'auto' | 'deepseek' | 'openai';
type TtsProvider = 'auto' | 'edge' | 'elevenlabs' | 'openai';
type ImageQuality = 'low' | 'medium' | 'high' | 'auto';

type OrgSettings = {
  llmProvider: LlmProvider;
  ttsProvider: TtsProvider;
  generateAiImages: boolean;
  maxScenesLong: number | null;
  maxAiImagesPerVideo: number | null;
  openaiImageQuality: ImageQuality | null;
  edgeTtsVoice: string | null;
  elevenLabsVoiceId: string | null;
  openaiTtsVoice: string | null;
  hasElevenLabsKey?: boolean;
  platformKeys?: { openai?: boolean; deepseek?: boolean; elevenlabs?: boolean };
  platformDefaults?: {
    llmProvider: string;
    ttsProvider: string;
    generateAiImages: boolean;
    maxScenesLong: number;
    maxAiImagesPerVideo: number;
    openaiImageQuality: string;
    edgeTtsVoice?: string;
    elevenLabsVoiceId?: string;
    openaiTtsVoice?: string;
  };
};

const LLM_OPTIONS: LlmProvider[] = ['auto', 'deepseek', 'openai'];
const TTS_OPTIONS: TtsProvider[] = ['auto', 'edge', 'elevenlabs', 'openai'];
const IMAGE_QUALITY_OPTIONS: ImageQuality[] = ['low', 'medium', 'high', 'auto'];

function voicesForProvider(provider: TtsProvider): TtsVoiceOption[] {
  if (provider === 'elevenlabs') return ELEVENLABS_TTS_VOICES;
  if (provider === 'openai') return OPENAI_TTS_VOICES;
  return EDGE_TTS_VOICES; // edge + auto
}

export function SettingsApiKeysPanel() {
  const t = useTranslations('settings.apikeys');
  const ts = useTranslations('settingsExt');
  const tc = useTranslations('common');
  const { session } = useAuth();
  const { toast } = useToast();

  const scenesId = useId();
  const maxAiId = useId();
  const qualityId = useId();
  const voiceId = useId();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<OrgSettings | null>(null);

  const [llmProvider, setLlmProvider] = useState<LlmProvider>('auto');
  const [ttsProvider, setTtsProvider] = useState<TtsProvider>('auto');
  const [generateAiImages, setGenerateAiImages] = useState(false);
  const [maxScenesLong, setMaxScenesLong] = useState('');
  const [maxAiImagesPerVideo, setMaxAiImagesPerVideo] = useState('');
  const [openaiImageQuality, setOpenaiImageQuality] = useState<'' | ImageQuality>('');
  const [edgeTtsVoice, setEdgeTtsVoice] = useState('');
  const [elevenLabsVoiceId, setElevenLabsVoiceId] = useState('');
  const [openaiTtsVoice, setOpenaiTtsVoice] = useState('');
  const [elevenLabsApiKey, setElevenLabsApiKey] = useState('');
  const [hasOrgElevenLabsKey, setHasOrgElevenLabsKey] = useState(false);

  const isAdmin = session?.role === 'owner' || session?.role === 'admin';

  const voiceOptions = useMemo(() => voicesForProvider(ttsProvider), [ttsProvider]);
  const activeVoiceValue =
    ttsProvider === 'elevenlabs'
      ? elevenLabsVoiceId
      : ttsProvider === 'openai'
        ? openaiTtsVoice
        : edgeTtsVoice;
  const platformVoiceDefault =
    ttsProvider === 'elevenlabs'
      ? (settings?.platformDefaults?.elevenLabsVoiceId ?? '')
      : ttsProvider === 'openai'
        ? (settings?.platformDefaults?.openaiTtsVoice ?? 'nova')
        : (settings?.platformDefaults?.edgeTtsVoice ?? 'es-ES-ElviraNeural');
  const platformVoiceLabel =
    voiceOptions.find((v) => v.id === platformVoiceDefault)?.label ?? null;
  const voiceInheritLabel = platformVoiceLabel
    ? ts('apikeysVoiceInherit', { default: platformVoiceLabel })
    : ts('apikeysVoiceInheritPlain');

  function setActiveVoice(value: string) {
    if (ttsProvider === 'elevenlabs') setElevenLabsVoiceId(value);
    else if (ttsProvider === 'openai') setOpenaiTtsVoice(value);
    else setEdgeTtsVoice(value);
  }

  function applySettings(data: OrgSettings) {
    setSettings(data);
    setLlmProvider(data.llmProvider);
    setTtsProvider(data.ttsProvider);
    setGenerateAiImages(data.generateAiImages);
    setMaxScenesLong(data.maxScenesLong != null ? String(data.maxScenesLong) : '');
    setMaxAiImagesPerVideo(
      data.maxAiImagesPerVideo != null ? String(data.maxAiImagesPerVideo) : '',
    );
    setOpenaiImageQuality(data.openaiImageQuality ?? '');
    setEdgeTtsVoice(data.edgeTtsVoice ?? '');
    setElevenLabsVoiceId(data.elevenLabsVoiceId ?? '');
    setOpenaiTtsVoice(data.openaiTtsVoice ?? '');
    setHasOrgElevenLabsKey(Boolean(data.hasElevenLabsKey));
    setElevenLabsApiKey('');
  }

  useEffect(() => {
    if (!session) return;
    api<OrgSettings>('/api/org/settings')
      .then((data) => applySettings(data))
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
        maxAiImagesPerVideo:
          maxAiImagesPerVideo.trim() === '' ? null : Number(maxAiImagesPerVideo),
        openaiImageQuality: openaiImageQuality === '' ? null : openaiImageQuality,
        edgeTtsVoice: edgeTtsVoice.trim() === '' ? null : edgeTtsVoice.trim(),
        elevenLabsVoiceId: elevenLabsVoiceId.trim() === '' ? null : elevenLabsVoiceId.trim(),
        openaiTtsVoice: openaiTtsVoice.trim() === '' ? null : openaiTtsVoice.trim(),
      };
      if (elevenLabsApiKey.trim()) {
        body.elevenLabsApiKey = elevenLabsApiKey.trim();
      }

      const result = await api<OrgSettings & { message: string }>('/api/org/settings', {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      applySettings(result);
      toast(result.message || ts('apikeysSaved'), 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : ts('apikeysSaveError'), 'error');
    } finally {
      setSaving(false);
    }
  }

  if (!session) {
    return null;
  }

  const platformScenes = settings?.platformDefaults?.maxScenesLong ?? 8;
  const platformMaxAi = settings?.platformDefaults?.maxAiImagesPerVideo ?? 4;
  const platformQuality = settings?.platformDefaults?.openaiImageQuality ?? 'medium';


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

            <div className="modal-field" id={`${voiceId}-wrap`}>
              <span className="field-label-row">
                <span>{ts('apikeysVoiceLabel')}</span>
              </span>
              <VoicePicker
                id={voiceId}
                voices={
                  activeVoiceValue && !voiceOptions.some((v) => v.id === activeVoiceValue)
                    ? [
                        ...voiceOptions,
                        {
                          id: activeVoiceValue,
                          label: ts('apikeysVoiceCustom', { id: activeVoiceValue }),
                          locale: 'custom',
                          description: activeVoiceValue,
                        },
                      ]
                    : voiceOptions
                }
                value={activeVoiceValue}
                onChange={setActiveVoice}
                inheritLabel={voiceInheritLabel}
                provider={ttsProvider === 'auto' ? 'edge' : ttsProvider}
              />
              <span className="text-muted text-sm">
                {ttsProvider === 'auto'
                  ? ts('apikeysVoiceHintAuto')
                  : ts('apikeysVoiceHint')}
              </span>
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

            <label className="modal-field" htmlFor={maxAiId}>
              {ts('apikeysMaxAiLabel')}
              <input
                id={maxAiId}
                type="number"
                min={0}
                max={100}
                className="topic-input"
                value={maxAiImagesPerVideo}
                onChange={(e) => setMaxAiImagesPerVideo(e.target.value)}
                placeholder={String(platformMaxAi)}
              />
              <span className="text-muted text-sm">
                {ts('apikeysMaxAiHint', { default: platformMaxAi })}
              </span>
            </label>

            <label className="modal-field" htmlFor={qualityId}>
              {ts('apikeysQualityLabel')}
              <select
                id={qualityId}
                className="topic-input"
                value={openaiImageQuality}
                onChange={(e) => setOpenaiImageQuality(e.target.value as '' | ImageQuality)}
              >
                <option value="">{ts('apikeysQualityInherit', { default: platformQuality })}</option>
                {IMAGE_QUALITY_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {ts(`apikeysQuality_${opt}`)}
                  </option>
                ))}
              </select>
              <span className="text-muted text-sm">{ts('apikeysQualityHint')}</span>
            </label>

            <div className="settings-divider" />

            <div className="modal-field">
              <span className="field-label-row">
                <span>{ts('apikeysElevenByokLabel')}</span>
              </span>
              <input
                type="password"
                className="topic-input"
                autoComplete="off"
                placeholder={
                  hasOrgElevenLabsKey
                    ? ts('apikeysElevenByokConfigured')
                    : ts('apikeysElevenByokPlaceholder')
                }
                value={elevenLabsApiKey}
                onChange={(e) => setElevenLabsApiKey(e.target.value)}
                disabled={!isAdmin}
              />
              <span className="text-muted text-sm">{ts('apikeysElevenByokHint')}</span>
              {hasOrgElevenLabsKey && isAdmin ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  style={{ marginTop: '0.35rem' }}
                  onClick={() => {
                    void (async () => {
                      try {
                        const result = await api<OrgSettings & { message: string }>(
                          '/api/org/settings',
                          {
                            method: 'PATCH',
                            body: JSON.stringify({ elevenLabsApiKey: null }),
                          },
                        );
                        applySettings(result);
                        toast(ts('apikeysElevenByokRemoved'), 'success');
                      } catch (err) {
                        toast(
                          err instanceof Error ? err.message : ts('apikeysRemoveError'),
                          'error',
                        );
                      }
                    })();
                  }}
                >
                  {ts('apikeysRemove')}
                </Button>
              ) : null}
            </div>

            <div className="settings-divider" />

            <p className="text-muted text-sm">{ts('apikeysPlatformKeysNote')}</p>
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
