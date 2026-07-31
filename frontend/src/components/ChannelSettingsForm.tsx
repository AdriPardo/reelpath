'use client';

import { useEffect, useId, useMemo, useState } from 'react';
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
import { api } from '@/lib/api';
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
};

function voicesForProvider(provider: OrgTtsProvider): TtsVoiceOption[] {
  if (provider === 'elevenlabs') return ELEVENLABS_TTS_VOICES;
  if (provider === 'openai') return OPENAI_TTS_VOICES;
  return EDGE_TTS_VOICES;
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
      <fieldset className="settings-fieldset channel-profile-fieldset">
        <legend>{t('brandAudienceLegend')}</legend>
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
      </fieldset>

      <fieldset className="settings-fieldset">
        <legend>{t('contentGuideLegend')}</legend>
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
      </fieldset>

      <fieldset className="settings-fieldset">
        <legend>{t('opsLegend')}</legend>
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
        </div>
      </fieldset>

      {(config.videoFormat === 'long' || !config.videoFormat) && (
        <fieldset className="settings-fieldset">
          <legend>{t('scriptLegend')}</legend>
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
        </fieldset>
      )}

      {(config.videoFormat === 'long' || !config.videoFormat) && (
        <fieldset className="settings-fieldset">
          <legend>{t('durationLegend')}</legend>
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
        </fieldset>
      )}

      <fieldset className="settings-fieldset">
        <legend>{t('retentionLegend')}</legend>
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
      </fieldset>

      <fieldset className="settings-fieldset">
        <legend>{t('visualLegend')}</legend>
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
      </fieldset>

      <fieldset className="settings-fieldset">
        <legend>{t('motionLegend')}</legend>
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
      </fieldset>

      <fieldset className="settings-fieldset">
        <legend>{t('publishingLegend')}</legend>
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
                  <option value="1">{t('longParts1')}</option>
                  <option value="2">{t('longParts2')}</option>
                  <option value="3">{t('longParts3')}</option>
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
      </fieldset>

      <Button type="submit" variant="secondary" disabled={loading}>
        {loading ? tc('saving') : tch('saveSettings')}
      </Button>
    </form>
  );
}
