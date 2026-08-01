'use client';

import { ChannelAnalyticsPanel } from '@/components/ChannelAnalyticsPanel';
import { PublicationPlanPanel } from '@/components/PublicationPlanPanel';
import { ChannelDeleteButton } from '@/components/ChannelDeleteButton';
import { ChannelGeneralForm } from '@/components/ChannelGeneralForm';
import { ChannelIntegrationsPanel } from '@/components/ChannelIntegrationsPanel';
import { ChannelPlannerSettings } from '@/components/ChannelPlannerSettings';
import { ChannelSettingsForm } from '@/components/ChannelSettingsForm';
import { TriggerPipelineButton } from '@/components/TriggerPipelineButton';
import { UploadLongVideoButton } from '@/components/UploadLongVideoButton';
import { Chip } from '@/components/ui/Chip';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import type { ChannelDetail, ChannelIntegrationsResponse } from '@/lib/api';
import { getIntegrationDisplayStatus } from '@/lib/integration-labels';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import type { AppLocale } from '@/i18n/routing';

type TabValue = 'general' | 'contenido' | 'planificacion' | 'analiticas' | 'integraciones';

function configChip(
  enabled: boolean,
  enabledLabel: string,
  disabledLabel: string,
  warningWhenDisabled = false,
) {
  return {
    label: enabled ? enabledLabel : disabledLabel,
    variant: enabled ? 'success' : warningWhenDisabled ? 'warning' : 'neutral',
  } as const;
}

function shortsChip(
  config: Record<string, unknown>,
  t: ReturnType<typeof useTranslations<'channels.tabs'>>,
) {
  if (config.publishYoutubeShorts !== true) {
    return { label: t('noShorts'), variant: 'neutral' } as const;
  }

  const mode = config.shortsMode;
  if (mode === 'dedicated') return { label: t('dedicatedShorts'), variant: 'success' } as const;
  if (mode === 'mixed') return { label: t('mixedShorts'), variant: 'success' } as const;
  return { label: t('splitShorts'), variant: 'success' } as const;
}

export function ChannelDetailTabs({
  channel,
  integrations,
}: {
  channel: ChannelDetail;
  integrations: ChannelIntegrationsResponse;
}) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations('channels');
  const tt = useTranslations('channels.tabs');
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = searchParams?.get('tab');

  const tabs: { value: TabValue; label: string }[] = [
    { value: 'general', label: tt('general') },
    { value: 'contenido', label: tt('content') },
    { value: 'planificacion', label: t('tabPlanning') },
    { value: 'analiticas', label: t('tabAnalytics') },
    { value: 'integraciones', label: tt('accounts') },
  ];

  const current: TabValue =
    rawTab && tabs.some((tab) => tab.value === rawTab) ? (rawTab as TabValue) : 'general';
  const config = channel.config as Record<string, unknown>;
  const youtubeDisplay = getIntegrationDisplayStatus(integrations.youtube, 'youtube', locale);
  const summaryChips = [
    configChip(channel.isActive, t('active'), t('inactive'), true),
    {
      label: tt('youtubeLabel', { status: youtubeDisplay.pillLabel.toLowerCase() }),
      variant:
        youtubeDisplay.pillClass === 'connected'
          ? 'success'
          : youtubeDisplay.pillClass === 'attention'
            ? 'warning'
            : 'neutral',
    } as const,
    configChip(config.publishPlannerEnabled === true, t('plannerActive'), t('plannerManual')),
    shortsChip(config, tt),
    configChip(config.reviewRequired !== false, tt('reviewRequired'), tt('noManualReview')),
  ];

  function setTab(tab: TabValue) {
    const params = new URLSearchParams(searchParams?.toString());
    if (tab === 'general') {
      params.delete('tab');
    } else {
      params.set('tab', tab);
    }
    const qs = params.toString();
    router.push(qs ? `/channels/${channel.id}?${qs}` : `/channels/${channel.id}`, { scroll: false });
  }

  return (
    <>
      <div className="channel-status-strip">
        <div className="channel-status-strip-chips" aria-label={t('tabs.statusStripAria')}>
          {summaryChips.map((chip) => (
            <Chip key={chip.label} variant={chip.variant} size="sm">
              {chip.label}
            </Chip>
          ))}
        </div>
      </div>

      <TriggerPipelineButton channelId={channel.id} />
      <UploadLongVideoButton channelId={channel.id} />

      <div className="filter-tabs" role="tablist" aria-label={tt('sectionsAria')}>
        {tabs.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={current === value}
            className={`filter-tab${current === value ? ' filter-tab-active' : ''}`}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="card channel-tab-panel" role="tabpanel">
        {current === 'general' && (
          <>
            <ChannelGeneralForm
              channelId={channel.id}
              initialName={channel.name}
              initialIsActive={channel.isActive}
              niche={channel.niche}
            />
            <ChannelDeleteButton channelId={channel.id} channelName={channel.name} />
          </>
        )}

        {current === 'contenido' && (
          <>
            <div className="section-title-row" style={{ marginBottom: '0.5rem' }}>
              <h3 style={{ margin: 0 }}>{t('contentSection')}</h3>
              <InfoTooltip content={t('tabs.settingsTooltip')} />
            </div>
            <ChannelSettingsForm
              channelId={channel.id}
              initialConfig={{
                brandName: config.brandName as string | undefined,
                tone: config.tone as string | undefined,
                targetAudience: config.targetAudience as string | undefined,
                forbiddenTopics: config.forbiddenTopics as string[] | undefined,
                customPromptHints: config.customPromptHints as string | undefined,
                contentDisclaimer: config.contentDisclaimer as string | undefined,
                reviewRequired: config.reviewRequired as boolean | undefined,
                publishYoutube: config.publishYoutube as boolean | undefined,
                publishYoutubeShorts: config.publishYoutubeShorts as boolean | undefined,
                autoPublish: config.autoPublish as boolean | undefined,
                shortsClipMaxSec: config.shortsClipMaxSec as number | undefined,
                minViralScore: config.minViralScore as number | undefined,
                retentionMode: config.retentionMode as boolean | undefined,
                videoFormat: config.videoFormat as 'shorts' | 'long' | undefined,
                shortsMode: config.shortsMode as 'split' | 'dedicated' | 'mixed' | undefined,
                shortsPerVideo: config.shortsPerVideo as number | undefined,
                longShortsFromVideo: config.longShortsFromVideo as number | undefined,
                shortsPublishIntervalDays: config.shortsPublishIntervalDays as number | undefined,
                language: config.language as string | undefined,
                ideasPerRun: config.ideasPerRun as number | undefined,
                scriptGenerationMode: config.scriptGenerationMode as
                  | 'chunked'
                  | 'monolithic'
                  | undefined,
                targetDurationMinSec: config.targetDurationMinSec as number | undefined,
                targetDurationMaxSec: config.targetDurationMaxSec as number | undefined,
                visualSourceMode: config.visualSourceMode as
                  | 'image'
                  | 'stock'
                  | 'mixed'
                  | undefined,
                videoMotionIntensity: config.videoMotionIntensity as
                  | 'subtle'
                  | 'normal'
                  | 'dynamic'
                  | undefined,
                autoReview: config.autoReview as boolean | undefined,
                autoApproveMinScore: config.autoApproveMinScore as number | undefined,
                maxScenesLong: config.maxScenesLong as number | null | undefined,
                generateAiImages: config.generateAiImages as boolean | null | undefined,
                edgeTtsVoice: config.edgeTtsVoice as string | null | undefined,
                elevenLabsVoiceId: config.elevenLabsVoiceId as string | null | undefined,
                openaiTtsVoice: config.openaiTtsVoice as string | null | undefined,
              }}
            />
          </>
        )}

        {current === 'planificacion' && (
          <div className="planner-tab">
            <div className="section-title-row planner-tab-title">
              <h3 style={{ margin: 0 }}>{t('calendarSection')}</h3>
              <InfoTooltip content={t('tabs.calendarTooltip')} />
            </div>
            <PublicationPlanPanel
              channelId={channel.id}
              plannerEnabledFromConfig={config.publishPlannerEnabled === true}
              timezoneFromConfig={
                typeof config.timezone === 'string' ? config.timezone : undefined
              }
            />
            <ChannelPlannerSettings
              channelId={channel.id}
              defaultOpen={config.publishPlannerEnabled !== true}
              initialConfig={{
                publishPlannerEnabled: config.publishPlannerEnabled as boolean | undefined,
                timezone: config.timezone as string | undefined,
                maxLongsPerWeek: config.maxLongsPerWeek as number | undefined,
                preferredPublishHour: config.preferredPublishHour as number | undefined,
                preferredPublishDays: config.preferredPublishDays as number[] | undefined,
                minDaysBetweenLongs: config.minDaysBetweenLongs as number | undefined,
                shortPreferredSlots: config.shortPreferredSlots as
                  | Array<{ hour: number; minute: number }>
                  | undefined,
                autoGenerateEnabled: config.autoGenerateEnabled as boolean | undefined,
                autoGenerateLeadDays: config.autoGenerateLeadDays as number | undefined,
              }}
            />
          </div>
        )}

        {current === 'analiticas' && (
          <ChannelAnalyticsPanel channelId={channel.id} integrations={integrations} />
        )}

        {current === 'integraciones' && (
          <>
            <div className="section-title-row" style={{ marginBottom: '0.75rem' }}>
              <h3 style={{ margin: 0 }}>{t('accountsSection')}</h3>
              <InfoTooltip content={t('tabs.integrationsTooltip')} />
            </div>
            <ChannelIntegrationsPanel channelId={channel.id} integrations={integrations} />
          </>
        )}
      </div>
    </>
  );
}
