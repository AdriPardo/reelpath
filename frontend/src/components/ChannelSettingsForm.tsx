'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import type { ChannelConfig } from '@autotube/shared';
import {
  EDGE_TTS_VOICES,
  ELEVENLABS_TTS_VOICES,
  OPENAI_TTS_VOICES,
  resolveMixedShortsCounts,
  type TtsVoiceOption,
} from '@autotube/shared';
import { api, apiFetch } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { VoicePicker } from '@/components/ui/VoicePicker';

type FormConfig = Partial<ChannelConfig>;
type OrgTtsProvider = 'auto' | 'edge' | 'elevenlabs' | 'openai';

type OrgPipelineDefaults = {
  ttsProvider: OrgTtsProvider;
  generateAiImages: boolean;
  maxScenesLong: number | null;
  maxAiImagesPerVideo: number | null;
  openaiImageQuality: 'low' | 'medium' | 'high' | 'auto' | null;
  edgeTtsVoice: string | null;
  elevenLabsVoiceId: string | null;
  openaiTtsVoice: string | null;
  platformDefaults?: {
    generateAiImages?: boolean;
    maxScenesLong?: number;
    minScenesLong?: number;
    maxScenesShort?: number;
    maxAiImagesPerVideo?: number;
    openaiImageQuality?: string;
    edgeTtsVoice?: string;
    elevenLabsVoiceId?: string;
    openaiTtsVoice?: string;
  };
};

/** Defaults de código (canal → org → estos). */
const APP_DEFAULTS = {
  maxScenesLong: 8,
  minScenesLong: 6,
  maxScenesShort: 3,
  maxAiImagesPerVideo: 4,
  openaiImageQuality: 'medium' as const,
  generateAiImages: false,
  falI2vEnabled: false,
  maxFalI2vPerVideo: 2,
};

function voicesForProvider(provider: OrgTtsProvider): TtsVoiceOption[] {
  if (provider === 'elevenlabs') return ELEVENLABS_TTS_VOICES;
  if (provider === 'openai') return OPENAI_TTS_VOICES;
  return EDGE_TTS_VOICES;
}

function ChannelVoicePreviewButton({
  provider,
  voiceId,
}: {
  provider: OrgTtsProvider;
  voiceId: string;
}) {
  const t = useTranslations('channels.settingsForm');
  const tc = useTranslations('common');
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (audioRef.current?.src?.startsWith('blob:')) {
        URL.revokeObjectURL(audioRef.current.src);
      }
    };
  }, []);

  async function playPreview() {
    if (!voiceId || busy) return;
    setBusy(true);
    try {
      const resolvedProvider =
        provider === 'elevenlabs' || provider === 'openai' ? provider : 'edge';
      const res = await apiFetch('/api/org/tts/preview', {
        method: 'POST',
        body: JSON.stringify({
          provider: resolvedProvider,
          voiceId,
        }),
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      audioRef.current?.pause();
      if (audioRef.current?.src?.startsWith('blob:')) {
        URL.revokeObjectURL(audioRef.current.src);
      }
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
      toast(t('bgmPreviewTtsOk'), 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : tc('errorGeneric'), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: '0.5rem' }}>
      <Button type="button" variant="secondary" size="sm" disabled={busy || !voiceId} onClick={() => void playPreview()}>
        {busy ? t('bgmPreviewTtsBusy') : t('bgmPreviewTts')}
      </Button>
    </div>
  );
}

function BgmSettingsSection({
  channelId,
  config,
  setField,
  toggle,
}: {
  channelId: string;
  config: FormConfig;
  setField: <K extends keyof FormConfig>(key: K, value: FormConfig[K]) => void;
  toggle: (key: keyof FormConfig) => void;
}) {
  const t = useTranslations('channels.settingsForm');
  const tc = useTranslations('common');
  const { toast } = useToast();
  const [tracks, setTracks] = useState<Array<{ name: string; source: string }>>([]);
  const [loadingTracks, setLoadingTracks] = useState(true);
  const [uploading, setUploading] = useState(false);

  async function refreshTracks() {
    setLoadingTracks(true);
    try {
      const data = await api<{ tracks: Array<{ name: string; source: string }> }>(
        `/api/channels/${channelId}/bgm`,
      );
      setTracks(data.tracks ?? []);
    } catch {
      setTracks([]);
    } finally {
      setLoadingTracks(false);
    }
  }

  useEffect(() => {
    void refreshTracks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  async function onUpload(file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const data = await api<{ name: string }>(`/api/channels/${channelId}/bgm`, {
        method: 'POST',
        body: form,
      });
      setField('bgmFile', data.name);
      setField('bgmEnabled', true);
      toast(t('bgmUploadOk', { name: data.name }), 'success');
      await refreshTracks();
    } catch (err) {
      toast(err instanceof Error ? err.message : tc('errorGeneric'), 'error');
    } finally {
      setUploading(false);
    }
  }

  async function onDelete(name: string) {
    try {
      await api(`/api/channels/${channelId}/bgm/${encodeURIComponent(name)}`, {
        method: 'DELETE',
      });
      if (config.bgmFile === name) setField('bgmFile', undefined);
      toast(t('bgmDeleted', { name }), 'success');
      await refreshTracks();
    } catch (err) {
      toast(err instanceof Error ? err.message : tc('errorGeneric'), 'error');
    }
  }

  return (
    <>
      <label className="modal-checkbox">
        <input
          type="checkbox"
          checked={config.bgmEnabled === true}
          onChange={() => toggle('bgmEnabled')}
        />
        <span className="checkbox-label-row">
          <span>{t('bgmEnabledLabel')}</span>
          <InfoTooltip content={t('bgmEnabledTooltip')} />
        </span>
      </label>
      <label className="modal-field">
        <span className="field-label-row">
          <span>{t('bgmVolumeLabel')}</span>
          <InfoTooltip content={t('bgmVolumeTooltip')} />
        </span>
        <input
          type="number"
          className="topic-input"
          min={0}
          max={1}
          step={0.01}
          value={config.bgmVolume ?? 0.18}
          onChange={(e) => setField('bgmVolume', Number(e.target.value))}
          disabled={config.bgmEnabled !== true}
        />
      </label>
      <label className="modal-field">
        <span className="field-label-row">
          <span>{t('bgmFileLabel')}</span>
          <InfoTooltip content={t('bgmFileTooltip')} />
        </span>
        <select
          className="topic-input"
          value={config.bgmFile ?? ''}
          onChange={(e) => setField('bgmFile', e.target.value || undefined)}
          disabled={config.bgmEnabled !== true}
        >
          <option value="">{t('bgmFileRandom')}</option>
          {tracks.map((tr) => (
            <option key={tr.name} value={tr.name}>
              {tr.name} ({tr.source})
            </option>
          ))}
        </select>
      </label>
      <div className="modal-field">
        <span className="field-label-row">
          <span>{t('bgmUploadLabel')}</span>
        </span>
        <input
          type="file"
          accept=".mp3,.m4a,.aac,.wav,.flac,.ogg,.opus,audio/*"
          disabled={uploading}
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            e.target.value = '';
            void onUpload(f);
          }}
        />
        <span className="text-muted text-sm">{t('bgmUploadHint')}</span>
      </div>
      {loadingTracks ? (
        <p className="text-muted text-sm">{tc('loading')}</p>
      ) : tracks.length === 0 ? (
        <p className="text-muted text-sm">{t('bgmListEmpty')}</p>
      ) : (
        <ul className="text-sm" style={{ margin: 0, paddingLeft: '1.1rem' }}>
          {tracks.map((tr) => (
            <li key={tr.name}>
              {tr.name}{' '}
              <span className="text-muted">({tr.source})</span>
              {tr.source === 'storage' ? (
                <>
                  {' '}
                  <button type="button" className="link-button" onClick={() => void onDelete(tr.name)}>
                    {tc('delete')}
                  </button>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function ChannelSettingsForm({
  channelId,
  initialConfig,
}: {
  channelId: string;
  initialConfig: FormConfig;
}) {
  const t = useTranslations('channels.settingsForm');
  const tc = useTranslations('common');
  const tch = useTranslations('channels');
  const router = useRouter();
  const { toast } = useToast();
  const brandId = useId();
  const toneId = useId();
  const audienceId = useId();
  const forbiddenId = useId();
  const hintsId = useId();
  const disclaimerId = useId();
  const voiceFieldId = useId();
  const [config, setConfig] = useState<FormConfig>(initialConfig);
  const [forbiddenInput, setForbiddenInput] = useState(
    (initialConfig.forbiddenTopics ?? []).join(', '),
  );
  const [loading, setLoading] = useState(false);
  const [orgTts, setOrgTts] = useState<OrgPipelineDefaults | null>(null);

  useEffect(() => {
    api<OrgPipelineDefaults>('/api/org/settings')
      .then((data) =>
        setOrgTts({
          ttsProvider: data.ttsProvider,
          generateAiImages: data.generateAiImages,
          maxScenesLong: data.maxScenesLong,
          maxAiImagesPerVideo: data.maxAiImagesPerVideo,
          openaiImageQuality: data.openaiImageQuality,
          edgeTtsVoice: data.edgeTtsVoice,
          elevenLabsVoiceId: data.elevenLabsVoiceId,
          openaiTtsVoice: data.openaiTtsVoice,
          platformDefaults: data.platformDefaults,
        }),
      )
      .catch(() => {});
  }, []);

  const effectiveMaxScenesLong =
    orgTts?.maxScenesLong ??
    orgTts?.platformDefaults?.maxScenesLong ??
    APP_DEFAULTS.maxScenesLong;
  const effectiveMinScenesLong =
    orgTts?.platformDefaults?.minScenesLong ?? APP_DEFAULTS.minScenesLong;
  const effectiveMaxScenesShort =
    orgTts?.platformDefaults?.maxScenesShort ?? APP_DEFAULTS.maxScenesShort;
  const effectiveMaxAiImages =
    orgTts?.maxAiImagesPerVideo ??
    orgTts?.platformDefaults?.maxAiImagesPerVideo ??
    APP_DEFAULTS.maxAiImagesPerVideo;
  const effectiveImageQuality =
    orgTts?.openaiImageQuality ??
    orgTts?.platformDefaults?.openaiImageQuality ??
    APP_DEFAULTS.openaiImageQuality;
  const effectiveGenerateAiImages =
    orgTts?.generateAiImages ??
    orgTts?.platformDefaults?.generateAiImages ??
    APP_DEFAULTS.generateAiImages;

  const orgProvider: OrgTtsProvider = orgTts?.ttsProvider ?? 'auto';
  const effectiveProvider: OrgTtsProvider =
    config.ttsProvider === 'auto' ||
    config.ttsProvider === 'edge' ||
    config.ttsProvider === 'elevenlabs' ||
    config.ttsProvider === 'openai'
      ? config.ttsProvider
      : orgProvider;
  const voiceOptions = useMemo(() => voicesForProvider(effectiveProvider), [effectiveProvider]);
  const activeChannelVoice =
    effectiveProvider === 'elevenlabs'
      ? (config.elevenLabsVoiceId ?? '')
      : effectiveProvider === 'openai'
        ? (config.openaiTtsVoice ?? '')
        : (config.edgeTtsVoice ?? '');
  const inheritVoiceId =
    effectiveProvider === 'elevenlabs'
      ? (orgTts?.elevenLabsVoiceId ||
          orgTts?.platformDefaults?.elevenLabsVoiceId ||
          '')
      : effectiveProvider === 'openai'
        ? (orgTts?.openaiTtsVoice || orgTts?.platformDefaults?.openaiTtsVoice || 'nova')
        : (orgTts?.edgeTtsVoice ||
            orgTts?.platformDefaults?.edgeTtsVoice ||
            'es-ES-ElviraNeural');
  const inheritVoiceName = voiceOptions.find((v) => v.id === inheritVoiceId)?.label ?? null;
  const inheritLabel = inheritVoiceName
    ? t('ttsVoiceInherit', { default: inheritVoiceName })
    : t('ttsVoiceInheritPlain');

  function setChannelVoice(value: string) {
    const next = value.trim() === '' ? null : value.trim();
    if (effectiveProvider === 'elevenlabs') {
      setField('elevenLabsVoiceId', next);
    } else if (effectiveProvider === 'openai') {
      setField('openaiTtsVoice', next);
    } else {
      setField('edgeTtsVoice', next);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const forbiddenTopics = forbiddenInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const payload: Record<string, unknown> = { ...config, forbiddenTopics };
    // null = inherit org/code (explicit clear of channel override)
    if (config.maxScenesLong == null) payload.maxScenesLong = null;
    if (config.minScenesLong == null) payload.minScenesLong = null;
    if (config.maxScenesShort == null) payload.maxScenesShort = null;
    if (config.generateAiImages == null) payload.generateAiImages = null;
    if (config.maxAiImagesPerVideo == null) payload.maxAiImagesPerVideo = null;
    if (config.falI2vEnabled == null) payload.falI2vEnabled = null;
    if (config.maxFalI2vPerVideo == null) payload.maxFalI2vPerVideo = null;
    if (config.openaiImageQuality == null) payload.openaiImageQuality = null;
    if (config.ttsProvider == null) payload.ttsProvider = null;
    if (config.edgeTtsVoice == null) payload.edgeTtsVoice = null;
    if (config.elevenLabsVoiceId == null) payload.elevenLabsVoiceId = null;
    if (config.openaiTtsVoice == null) payload.openaiTtsVoice = null;
    try {
      await api(`/api/channels/${channelId}`, {
        method: 'PATCH',
        body: JSON.stringify({ config: payload }),
      });
      toast(t('savedToast'), 'success');
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : tc('errorGeneric'), 'error');
    } finally {
      setLoading(false);
    }
  }

  function toggle(key: keyof FormConfig) {
    setConfig((c) => ({ ...c, [key]: !c[key] }));
  }

  function setField<K extends keyof FormConfig>(key: K, value: FormConfig[K]) {
    setConfig((c) => ({ ...c, [key]: value }));
  }

  return (
    <form className="channel-settings-form" onSubmit={save} aria-label={t('formAria')}>
      <details className="settings-section settings-fieldset channel-profile-fieldset" open>
        <summary className="settings-section-summary">{t('brandAudienceLegend')}</summary>
        <div className="channel-profile-grid">
          <label className="modal-field channel-profile-field" htmlFor={brandId}>
            <span className="field-label">{t('brandNameLabel')}</span>
            <input
              id={brandId}
              type="text"
              className="topic-input"
              value={config.brandName ?? ''}
              onChange={(e) => setField('brandName', e.target.value)}
              placeholder={t('brandNamePlaceholder')}
              maxLength={120}
            />
          </label>
          <label className="modal-field channel-profile-field" htmlFor={toneId}>
            <span className="field-label">{t('toneLabel')}</span>
            <input
              id={toneId}
              type="text"
              className="topic-input"
              value={config.tone ?? ''}
              onChange={(e) => setField('tone', e.target.value)}
              placeholder={t('tonePlaceholder')}
              maxLength={200}
            />
          </label>
          <label
            className="modal-field channel-profile-field channel-profile-field-full"
            htmlFor={audienceId}
          >
            <span className="field-label field-label-row">
              <span>{t('audienceLabel')}</span>
              <InfoTooltip content={t('audienceTooltip')} />
            </span>
            <textarea
              id={audienceId}
              className="topic-input video-edit-textarea"
              value={config.targetAudience ?? ''}
              onChange={(e) => setField('targetAudience', e.target.value)}
              placeholder={t('audiencePlaceholder')}
              maxLength={300}
              rows={4}
            />
          </label>
        </div>
      </details>

      <details className="settings-section settings-fieldset" open>
        <summary className="settings-section-summary">{t('contentGuideLegend')}</summary>
        <label className="modal-field" htmlFor={forbiddenId}>
          <span className="field-label-row">
            <span>{t('forbiddenLabel')}</span>
            <InfoTooltip content={t('forbiddenTooltip')} />
          </span>
          <input
            id={forbiddenId}
            type="text"
            className="topic-input"
            value={forbiddenInput}
            onChange={(e) => setForbiddenInput(e.target.value)}
            placeholder={t('forbiddenPlaceholder')}
          />
        </label>
        <label className="modal-field" htmlFor={hintsId}>
          <span className="field-label-row">
            <span>{t('aiHintsLabel')}</span>
            <InfoTooltip content={t('aiHintsTooltip')} />
          </span>
          <textarea
            id={hintsId}
            className="topic-input video-edit-textarea"
            value={config.customPromptHints ?? ''}
            onChange={(e) => setField('customPromptHints', e.target.value)}
            placeholder={t('aiHintsPlaceholder')}
            maxLength={2000}
            rows={3}
          />
        </label>
        <label className="modal-field" htmlFor={disclaimerId}>
          <span className="field-label-row">
            <span>{t('disclaimerLabel')}</span>
            <InfoTooltip content={t('disclaimerTooltip')} />
          </span>
          <textarea
            id={disclaimerId}
            className="topic-input video-edit-textarea"
            value={config.contentDisclaimer ?? ''}
            onChange={(e) => setField('contentDisclaimer', e.target.value)}
            placeholder={t('disclaimerPlaceholder')}
            maxLength={500}
            rows={2}
          />
        </label>
      </details>

      <details className="settings-section settings-fieldset">
        <summary className="settings-section-summary">{t('opsLegend')}</summary>
        <label className="modal-field">
          <span className="field-label-row">
            <span>{t('languageLabel')}</span>
            <InfoTooltip content={t('languageTooltip')} />
          </span>
          <select
            className="topic-input"
            value={config.language ?? 'es'}
            onChange={(e) => setField('language', e.target.value)}
          >
            <option value="es">Español</option>
            <option value="en">English</option>
          </select>
        </label>
        <label className="modal-field">
          <span className="field-label-row">
            <span>{t('ideasPerRunLabel')}</span>
            <InfoTooltip content={t('ideasPerRunTooltip')} />
          </span>
          <input
            type="number"
            className="topic-input"
            min={1}
            max={50}
            value={config.ideasPerRun ?? 3}
            onChange={(e) => setField('ideasPerRun', Number(e.target.value))}
          />
        </label>
        <label className="modal-checkbox">
          <input
            type="checkbox"
            checked={config.autoPublish ?? false}
            onChange={() => toggle('autoPublish')}
          />
          <span className="checkbox-label-row">
            <span>{t('autoPublishLabel')}</span>
            <InfoTooltip content={t('autoPublishTooltip')} />
          </span>
        </label>
        <label className="modal-field">
          <span className="field-label-row">
            <span>{t('shortsClipMaxLabel')}</span>
            <InfoTooltip content={t('shortsClipMaxTooltip')} />
          </span>
          <input
            type="number"
            className="topic-input"
            min={15}
            max={600}
            value={config.shortsClipMaxSec ?? 60}
            onChange={(e) => setField('shortsClipMaxSec', Number(e.target.value))}
          />
        </label>
        {(config.videoFormat === 'long' || !config.videoFormat) && (
          <>
            <label className="modal-field">
              <span className="field-label-row">
                <span>{t('maxScenesLongLabel')}</span>
                <InfoTooltip content={t('maxScenesLongTooltip')} />
              </span>
              <input
                type="number"
                className="topic-input"
                min={4}
                max={40}
                value={config.maxScenesLong ?? ''}
                placeholder={t('inheritEffective', { value: String(effectiveMaxScenesLong) })}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  setField('maxScenesLong', v === '' ? null : Number(v));
                }}
              />
              {config.maxScenesLong == null ? (
                <span className="field-effective-hint">
                  {t('effectiveValue', { value: String(effectiveMaxScenesLong) })}
                </span>
              ) : null}
            </label>
            <label className="modal-field">
              <span className="field-label-row">
                <span>{t('minScenesLongLabel')}</span>
                <InfoTooltip content={t('minScenesLongTooltip')} />
              </span>
              <input
                type="number"
                className="topic-input"
                min={2}
                max={40}
                value={config.minScenesLong ?? ''}
                placeholder={t('inheritEffective', { value: String(effectiveMinScenesLong) })}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  setField('minScenesLong', v === '' ? null : Number(v));
                }}
              />
              {config.minScenesLong == null ? (
                <span className="field-effective-hint">
                  {t('effectiveValue', { value: String(effectiveMinScenesLong) })}
                </span>
              ) : null}
            </label>
          </>
        )}
        <label className="modal-field">
          <span className="field-label-row">
            <span>{t('maxScenesShortLabel')}</span>
            <InfoTooltip content={t('maxScenesShortTooltip')} />
          </span>
          <input
            type="number"
            className="topic-input"
            min={1}
            max={12}
            value={config.maxScenesShort ?? ''}
            placeholder={t('inheritEffective', { value: String(effectiveMaxScenesShort) })}
            onChange={(e) => {
              const v = e.target.value.trim();
              setField('maxScenesShort', v === '' ? null : Number(v));
            }}
          />
          {config.maxScenesShort == null ? (
            <span className="field-effective-hint">
              {t('effectiveValue', { value: String(effectiveMaxScenesShort) })}
            </span>
          ) : null}
        </label>
        <label className="modal-field">
          <span className="field-label-row">
            <span>{t('generateAiImagesLabel')}</span>
            <InfoTooltip content={t('generateAiImagesTooltip')} />
          </span>
          <select
            className="topic-input"
            value={
              config.generateAiImages === true
                ? 'on'
                : config.generateAiImages === false
                  ? 'off'
                  : 'inherit'
            }
            onChange={(e) => {
              const v = e.target.value;
              if (v === 'inherit') setField('generateAiImages', null);
              else setField('generateAiImages', v === 'on');
            }}
          >
            <option value="inherit">
              {t('generateAiImagesInheritEffective', {
                value: effectiveGenerateAiImages
                  ? t('generateAiImagesOn')
                  : t('generateAiImagesOff'),
              })}
            </option>
            <option value="on">{t('generateAiImagesOn')}</option>
            <option value="off">{t('generateAiImagesOff')}</option>
          </select>
        </label>
        <label className="modal-field">
          <span className="field-label-row">
            <span>{t('maxAiImagesLabel')}</span>
            <InfoTooltip content={t('maxAiImagesTooltip')} />
          </span>
          <input
            type="number"
            className="topic-input"
            min={0}
            max={100}
            value={config.maxAiImagesPerVideo ?? ''}
            placeholder={t('inheritEffective', { value: String(effectiveMaxAiImages) })}
            onChange={(e) => {
              const v = e.target.value.trim();
              setField('maxAiImagesPerVideo', v === '' ? null : Number(v));
            }}
          />
          {config.maxAiImagesPerVideo == null ? (
            <span className="field-effective-hint">
              {t('effectiveValue', { value: String(effectiveMaxAiImages) })}
            </span>
          ) : null}
        </label>
        <label className="modal-field">
          <span className="field-label-row">
            <span>{t('imageQualityLabel')}</span>
            <InfoTooltip content={t('imageQualityTooltip')} />
          </span>
          <select
            className="topic-input"
            value={config.openaiImageQuality ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              setField(
                'openaiImageQuality',
                v === '' ? null : (v as 'low' | 'medium' | 'high' | 'auto'),
              );
            }}
          >
            <option value="">
              {t('imageQualityInheritEffective', { value: String(effectiveImageQuality) })}
            </option>
            <option value="low">{t('imageQualityLow')}</option>
            <option value="medium">{t('imageQualityMedium')}</option>
            <option value="high">{t('imageQualityHigh')}</option>
            <option value="auto">{t('imageQualityAuto')}</option>
          </select>
        </label>
        <label className="modal-field">
          <span className="field-label-row">
            <span>{t('falI2vLabel')}</span>
            <InfoTooltip content={t('falI2vTooltip')} />
          </span>
          <select
            className="topic-input"
            value={
              config.falI2vEnabled === true
                ? 'on'
                : config.falI2vEnabled === false
                  ? 'off'
                  : 'inherit'
            }
            onChange={(e) => {
              const v = e.target.value;
              if (v === 'inherit') setField('falI2vEnabled', null);
              else setField('falI2vEnabled', v === 'on');
            }}
          >
            <option value="inherit">
              {t('falI2vInheritEffective', {
                value: APP_DEFAULTS.falI2vEnabled ? t('falI2vOn') : t('falI2vOff'),
              })}
            </option>
            <option value="on">{t('falI2vOn')}</option>
            <option value="off">{t('falI2vOff')}</option>
          </select>
        </label>
        <label className="modal-field">
          <span className="field-label-row">
            <span>{t('maxFalI2vLabel')}</span>
            <InfoTooltip content={t('maxFalI2vTooltip')} />
          </span>
          <input
            type="number"
            className="topic-input"
            min={0}
            max={8}
            value={config.maxFalI2vPerVideo ?? ''}
            placeholder={t('inheritEffective', {
              value: String(APP_DEFAULTS.maxFalI2vPerVideo),
            })}
            onChange={(e) => {
              const v = e.target.value.trim();
              setField('maxFalI2vPerVideo', v === '' ? null : Number(v));
            }}
          />
          {config.maxFalI2vPerVideo == null ? (
            <span className="field-effective-hint">
              {t('effectiveValue', { value: String(APP_DEFAULTS.maxFalI2vPerVideo) })}
            </span>
          ) : null}
        </label>
        <label className="modal-field">
          <span className="field-label-row">
            <span>{t('ttsProviderLabel')}</span>
            <InfoTooltip content={t('ttsProviderTooltip')} />
          </span>
          <select
            className="topic-input"
            value={config.ttsProvider ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              setField(
                'ttsProvider',
                v === '' ? null : (v as 'auto' | 'edge' | 'elevenlabs' | 'openai'),
              );
            }}
          >
            <option value="">{t('ttsProviderInherit')}</option>
            <option value="auto">{t('ttsProviderAuto')}</option>
            <option value="edge">{t('ttsProviderEdge')}</option>
            <option value="elevenlabs">{t('ttsProviderEleven')}</option>
            <option value="openai">{t('ttsProviderOpenai')}</option>
          </select>
        </label>
        <div className="modal-field settings-field-full">
          <span className="field-label-row" id={`${voiceFieldId}-label`}>
            <span>{t('ttsVoiceLabel')}</span>
            <InfoTooltip content={t('ttsVoiceTooltip')} />
          </span>
          <VoicePicker
            id={voiceFieldId}
            voices={
              typeof activeChannelVoice === 'string' &&
              activeChannelVoice &&
              !voiceOptions.some((v) => v.id === activeChannelVoice)
                ? [
                    ...voiceOptions,
                    {
                      id: activeChannelVoice,
                      label: t('ttsVoiceCustom', { id: activeChannelVoice }),
                      locale: 'custom',
                      description: activeChannelVoice,
                    },
                  ]
                : voiceOptions
            }
            value={typeof activeChannelVoice === 'string' ? activeChannelVoice : ''}
            onChange={setChannelVoice}
            inheritLabel={inheritLabel}
            provider={effectiveProvider}
          />
          <ChannelVoicePreviewButton
            provider={effectiveProvider}
            voiceId={
              (typeof activeChannelVoice === 'string' && activeChannelVoice
                ? activeChannelVoice
                : inheritVoiceId) || 'es-ES-ElviraNeural'
            }
          />
        </div>
      </details>

      {(config.videoFormat === 'long' || !config.videoFormat) && (
        <details className="settings-section settings-fieldset">
          <summary className="settings-section-summary">{t('scriptLegend')}</summary>
          <label className="modal-field">
            <span className="field-label-row">
              <span>{t('scriptModeLabel')}</span>
              <InfoTooltip content={t('scriptModeTooltip')} />
            </span>
            <select
              className="topic-input"
              value={config.scriptGenerationMode ?? 'chunked'}
              onChange={(e) =>
                setField('scriptGenerationMode', e.target.value as 'chunked' | 'monolithic')
              }
            >
              <option value="chunked">{t('scriptModeChunked')}</option>
              <option value="monolithic">{t('scriptModeMonolithic')}</option>
            </select>
          </label>
        </details>
      )}

      {(config.videoFormat === 'long' || !config.videoFormat) && (
        <details className="settings-section settings-fieldset">
          <summary className="settings-section-summary">{t('durationLegend')}</summary>
          <label className="modal-field">
            <span className="field-label-row">
              <span>{t('durationMinLabel')}</span>
              <InfoTooltip content={t('durationMinTooltip')} />
            </span>
            <input
              type="number"
              className="topic-input"
              min={120}
              max={3600}
              value={config.targetDurationMinSec ?? 480}
              onChange={(e) => setField('targetDurationMinSec', Number(e.target.value))}
            />
          </label>
          <label className="modal-field">
            <span className="field-label-row">
              <span>{t('durationMaxLabel')}</span>
              <InfoTooltip content={t('durationMaxTooltip')} />
            </span>
            <input
              type="number"
              className="topic-input"
              min={120}
              max={3600}
              value={config.targetDurationMaxSec ?? 900}
              onChange={(e) => setField('targetDurationMaxSec', Number(e.target.value))}
            />
          </label>
        </details>
      )}

      <details className="settings-section settings-fieldset">
        <summary className="settings-section-summary">{t('retentionLegend')}</summary>
        <label className="modal-checkbox">
          <input
            type="checkbox"
            checked={config.retentionMode ?? false}
            onChange={() => toggle('retentionMode')}
          />
          <span className="checkbox-label-row">
            <span>{t('retentionModeLabel')}</span>
            <InfoTooltip content={t('retentionModeTooltip')} />
          </span>
        </label>
      </details>

      <details className="settings-section settings-fieldset">
        <summary className="settings-section-summary">{t('visualLegend')}</summary>
        <label className="modal-field">
          <span className="field-label-row">
            <span>{t('footageLabel')}</span>
            <InfoTooltip content={t('footageTooltip')} />
          </span>
          <select
            className="topic-input"
            value={config.visualSourceMode ?? 'mixed'}
            onChange={(e) =>
              setField('visualSourceMode', e.target.value as 'image' | 'stock' | 'mixed')
            }
          >
            <option value="image">{t('footageImage')}</option>
            <option value="stock">{t('footageStock')}</option>
            <option value="mixed">{t('footageMixed')}</option>
          </select>
        </label>
        <label className="modal-field">
          <span className="field-label-row">
            <span>{t('stockSpeedLabel')}</span>
            <InfoTooltip content={t('stockSpeedTooltip')} />
          </span>
          <input
            type="number"
            className="topic-input"
            min={0.75}
            max={1.5}
            step={0.05}
            value={config.stockPlaybackSpeed ?? 1}
            onChange={(e) => setField('stockPlaybackSpeed', Number(e.target.value))}
          />
        </label>
      </details>

      <details className="settings-section settings-fieldset">
        <summary className="settings-section-summary">{t('bgmLegend')}</summary>
        <BgmSettingsSection
          channelId={channelId}
          config={config}
          setField={setField}
          toggle={toggle}
        />
      </details>

      <details className="settings-section settings-fieldset">
        <summary className="settings-section-summary">{t('motionLegend')}</summary>
        <label className="modal-field">
          <span className="field-label-row">
            <span>{t('motionIntensityLabel')}</span>
            <InfoTooltip content={t('motionIntensityTooltip')} />
          </span>
          <select
            className="topic-input"
            value={config.videoMotionIntensity ?? 'normal'}
            onChange={(e) =>
              setField('videoMotionIntensity', e.target.value as 'subtle' | 'normal' | 'dynamic')
            }
          >
            <option value="subtle">{t('motionSubtle')}</option>
            <option value="normal">{t('motionNormal')}</option>
            <option value="dynamic">{t('motionDynamic')}</option>
          </select>
        </label>
      </details>

      <details className="settings-section settings-fieldset">
        <summary className="settings-section-summary">{t('publishingLegend')}</summary>
        <label className="modal-checkbox">
          <input
            type="checkbox"
            checked={config.reviewRequired ?? true}
            onChange={() => toggle('reviewRequired')}
          />
          <span className="checkbox-label-row">
            <span>{t('reviewRequiredLabel')}</span>
            <InfoTooltip content={t('reviewRequiredTooltip')} />
          </span>
        </label>
        <label className="modal-checkbox">
          <input
            type="checkbox"
            checked={config.autoReview === true}
            onChange={() => toggle('autoReview')}
          />
          <span className="checkbox-label-row">
            <span>{t('autoReviewLabel')}</span>
            <InfoTooltip content={t('autoReviewTooltip')} />
          </span>
        </label>
        <label className="modal-field">
          <span className="field-label-row">
            <span>{t('autoApproveLabel')}</span>
            <InfoTooltip content={t('autoApproveTooltip')} />
          </span>
          <input
            type="number"
            className="topic-input"
            min={0}
            max={100}
            value={config.autoApproveMinScore ?? 80}
            onChange={(e) => setField('autoApproveMinScore', Number(e.target.value))}
          />
        </label>
        <label className="modal-checkbox">
          <input
            type="checkbox"
            checked={config.publishYoutube ?? true}
            onChange={() => toggle('publishYoutube')}
          />
          <span className="checkbox-label-row">
            <span>{t('publishYoutubeLabel')}</span>
            <InfoTooltip content={t('publishYoutubeTooltip')} />
          </span>
        </label>
        <label className="modal-checkbox">
          <input
            type="checkbox"
            checked={config.crossPostEnabled === true}
            onChange={() => {
              const next = !config.crossPostEnabled;
              setField('crossPostEnabled', next);
              if (next && (config.crossPostPlatforms == null || config.crossPostPlatforms.length === 0)) {
                setField('crossPostPlatforms', ['tiktok', 'instagram']);
              }
            }}
          />
          <span className="checkbox-label-row">
            <span>{t('crossPostLabel')}</span>
            <InfoTooltip content={t('crossPostTooltip')} />
          </span>
        </label>
        {config.crossPostEnabled === true && (
          <fieldset className="modal-field" disabled={config.crossPostEnabled !== true}>
            <legend className="field-label-row">
              <span>{t('crossPostPlatformsLabel')}</span>
              <InfoTooltip content={t('crossPostPlatformsTooltip')} />
            </legend>
            <div className="checkbox-group" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
              {(['tiktok', 'instagram', 'youtube'] as const).map((platform) => {
                const selected = (config.crossPostPlatforms ?? ['tiktok', 'instagram']).includes(
                  platform,
                );
                return (
                  <label key={platform} className="modal-checkbox" style={{ margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => {
                        const current = config.crossPostPlatforms ?? ['tiktok', 'instagram'];
                        const next = selected
                          ? current.filter((p) => p !== platform)
                          : [...current, platform];
                        setField(
                          'crossPostPlatforms',
                          next.length > 0 ? next : ['tiktok', 'instagram'],
                        );
                      }}
                    />
                    <span>{t(`crossPostPlatform_${platform}`)}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}
        <label className="modal-checkbox">
          <input
            type="checkbox"
            checked={config.publishYoutubeShorts === true}
            onChange={() => toggle('publishYoutubeShorts')}
          />
          <span className="checkbox-label-row">
            <span>{t('publishShortsLabel')}</span>
            <InfoTooltip content={t('publishShortsTooltip')} />
          </span>
        </label>
        {(config.videoFormat === 'long' || !config.videoFormat) &&
          config.publishYoutubeShorts === true && (
          <>
            <label className="modal-field">
              <span className="field-label-row">
                <span>{t('shortsModeLabel')}</span>
                <InfoTooltip content={t('shortsModeTooltip')} />
              </span>
              <select
                className="topic-input"
                value={config.shortsMode ?? 'split'}
                onChange={(e) => setField('shortsMode', e.target.value as 'split' | 'dedicated' | 'mixed')}
              >
                <option value="split">{t('shortsModeSplit')}</option>
                <option value="dedicated">{t('shortsModeDedicated')}</option>
                <option value="mixed">{t('shortsModeMixed')}</option>
              </select>
            </label>
            {(config.shortsMode === 'split' || config.shortsMode === 'mixed') && (
              <label className="modal-field">
                <span className="field-label-row">
                  <span>{t('longPartsLabel')}</span>
                  <InfoTooltip content={t('longPartsTooltip')} />
                </span>
                <select
                  className="topic-input"
                  value={
                    config.shortsMode === 'split' && config.longShortsFromVideo == null
                      ? 'auto'
                      : String(config.longShortsFromVideo ?? (config.shortsMode === 'mixed' ? 1 : 'auto'))
                  }
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === 'auto') {
                      setField('longShortsFromVideo', undefined);
                    } else {
                      setField('longShortsFromVideo', Number(v));
                    }
                  }}
                >
                  {config.shortsMode === 'split' && (
                    <option value="auto">{t('longPartsAuto')}</option>
                  )}
                  {[1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20].map((n) => (
                    <option key={n} value={String(n)}>
                      {t('longPartsN', { n })}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {(config.shortsMode === 'dedicated' || config.shortsMode === 'mixed') && (
              <label className="modal-field">
                <span className="field-label-row">
                  <span>{t('shortsCountLabel')}</span>
                  <InfoTooltip
                    content={
                      config.shortsMode === 'mixed'
                        ? t('shortsCountMixedTooltip', {
                            split: resolveMixedShortsCounts({
                              shortsPerVideo: config.shortsPerVideo,
                              longShortsFromVideo: config.longShortsFromVideo,
                            }).splitCount,
                            dedicated: resolveMixedShortsCounts({
                              shortsPerVideo: config.shortsPerVideo,
                              longShortsFromVideo: config.longShortsFromVideo,
                            }).dedicatedCount,
                          })
                        : t('shortsCountDedicatedTooltip')
                    }
                  />
                </span>
                <input
                  type="number"
                  className="topic-input"
                  min={1}
                  max={7}
                  value={config.shortsPerVideo ?? 1}
                  onChange={(e) => setField('shortsPerVideo', Number(e.target.value))}
                />
              </label>
            )}
            <label className="modal-field">
              <span className="field-label-row">
                <span>{t('shortsIntervalLabel')}</span>
                <InfoTooltip content={t('shortsIntervalTooltip')} />
              </span>
              <input
                type="number"
                className="topic-input"
                min={0}
                max={30}
                value={config.shortsPublishIntervalDays ?? 1}
                onChange={(e) => setField('shortsPublishIntervalDays', Number(e.target.value))}
              />
            </label>
          </>
        )}
        <label className="modal-field">
          <span className="field-label-row">
            <span>{t('minViralLabel')}</span>
            <InfoTooltip content={t('minViralTooltip')} />
          </span>
          <input
            type="number"
            className="topic-input"
            min={0}
            max={100}
            value={config.minViralScore ?? 0}
            onChange={(e) => setField('minViralScore', Number(e.target.value))}
          />
        </label>
      </details>

      <Button type="submit" variant="secondary" disabled={loading}>
        {loading ? tc('saving') : tch('saveSettings')}
      </Button>
    </form>
  );
}
