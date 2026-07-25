'use client';

import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import type { ChannelConfig } from '@autotube/shared';
import { resolveMixedShortsCounts } from '@autotube/shared';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { InfoTooltip } from '@/components/ui/InfoTooltip';

type FormConfig = Partial<ChannelConfig>;

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
  const [config, setConfig] = useState<FormConfig>(initialConfig);
  const [forbiddenInput, setForbiddenInput] = useState(
    (initialConfig.forbiddenTopics ?? []).join(', '),
  );
  const [loading, setLoading] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const forbiddenTopics = forbiddenInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const payload = { ...config, forbiddenTopics };
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
        <legend>{t('plannerLegend')}</legend>
        <label className="modal-checkbox">
          <input
            type="checkbox"
            checked={config.publishPlannerEnabled === true}
            onChange={() => toggle('publishPlannerEnabled')}
          />
          <span className="checkbox-label-row">
            <span>{t('plannerEnabledLabel')}</span>
            <InfoTooltip content={t('plannerEnabledTooltip')} />
          </span>
        </label>
        {config.publishPlannerEnabled && (
          <>
            <label className="modal-field">
              <span className="field-label-row">
                <span>{t('timezoneLabel')}</span>
                <InfoTooltip content={t('timezoneTooltip')} />
              </span>
              <input
                type="text"
                className="topic-input"
                value={config.timezone ?? 'Europe/Madrid'}
                onChange={(e) => setField('timezone', e.target.value)}
                placeholder="Europe/Madrid"
              />
            </label>
            <label className="modal-field">
              <span className="field-label-row">
                <span>{t('maxLongsLabel')}</span>
                <InfoTooltip content={t('maxLongsTooltip')} />
              </span>
              <input
                type="number"
                className="topic-input"
                min={1}
                max={7}
                value={config.maxLongsPerWeek ?? 1}
                onChange={(e) => setField('maxLongsPerWeek', Number(e.target.value))}
              />
            </label>
            <label className="modal-field">
              <span className="field-label-row">
                <span>{t('preferredHourLabel')}</span>
                <InfoTooltip content={t('preferredHourTooltip')} />
              </span>
              <input
                type="number"
                className="topic-input"
                min={0}
                max={23}
                value={config.preferredPublishHour ?? 19}
                onChange={(e) => setField('preferredPublishHour', Number(e.target.value))}
              />
            </label>
            <label className="modal-field">
              <span className="field-label-row">
                <span>{t('preferredDaysLabel')}</span>
                <InfoTooltip content={t('preferredDaysTooltip')} />
              </span>
              <input
                type="text"
                className="topic-input"
                value={(config.preferredPublishDays ?? [5]).join(', ')}
                onChange={(e) => {
                  const days = e.target.value
                    .split(',')
                    .map((d) => Number(d.trim()))
                    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 6);
                  setField('preferredPublishDays', days.length > 0 ? days : [5]);
                }}
                placeholder="5"
              />
            </label>
            <label className="modal-field">
              <span className="field-label-row">
                <span>{t('minDaysLabel')}</span>
                <InfoTooltip content={t('minDaysTooltip')} />
              </span>
              <input
                type="number"
                className="topic-input"
                min={1}
                max={14}
                value={config.minDaysBetweenLongs ?? Math.ceil(7 / (config.maxLongsPerWeek ?? 1))}
                onChange={(e) => setField('minDaysBetweenLongs', Number(e.target.value))}
              />
            </label>
          </>
        )}
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
