'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { ShortsClipsSection } from '@/components/ShortsClipsSection';
import { api, type PipelineRunDetail } from '@/lib/api';
import type { VideoClip } from '@/lib/clips';
import { VideoPlayer } from '@/components/VideoPlayer';
import { PipelineProgressBar } from '@/components/PipelineProgressBar';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { isPipelineCancellable, isPipelineInProgress } from '@/lib/pipeline-status';
import { PipelineRetryButton } from '@/components/PipelineRetryButton';
import { PipelineResumeButton } from '@/components/PipelineResumeButton';
import { PipelineCancelButton } from '@/components/PipelineCancelButton';
import {
  PIPELINE_STEP_ICONS,
  getPipelineStepLabel,
  getVisiblePipelineSteps,
} from '@/lib/pipeline-steps';
import { pipelineStepState } from '@/lib/pipeline-progress';
import { usePipelineElapsedLabel } from '@/hooks/usePipelineElapsedLabel';
import { mapPipelineError, pipelineErrorTitle } from '@/lib/user-messages';

function channelStepperOptions(channel?: { config?: unknown }) {
  const config = (channel?.config ?? {}) as {
    reviewRequired?: boolean;
    publishYoutubeShorts?: boolean;
    videoFormat?: 'shorts' | 'long';
    shortsMode?: 'split' | 'dedicated' | 'mixed';
    longShortsFromVideo?: number;
  };
  return {
    reviewRequired: config.reviewRequired,
    publishYoutubeShorts: config.publishYoutubeShorts,
    videoFormat: config.videoFormat,
    shortsMode: config.shortsMode,
    longShortsFromVideo: config.longShortsFromVideo,
  };
}

function IdeaScoreBreakdown({
  breakdown,
}: {
  breakdown: NonNullable<NonNullable<PipelineRunDetail['ideas']>[number]['scoreBreakdown']>;
}) {
  const t = useTranslations('pipelines.detail');
  const rows = [
    { label: t('scoreHook'), value: breakdown.hookStrength },
    { label: t('scoreTrend'), value: breakdown.trendAlignment },
    { label: t('scoreNiche'), value: breakdown.nicheFit },
    { label: t('scoreSeo'), value: breakdown.seoPotential },
  ];

  return (
    <ul className="idea-score-breakdown text-muted text-sm">
      {rows.map((row) => (
        <li key={row.label}>
          {row.label}: <strong>{Math.round(row.value)}</strong>
        </li>
      ))}
    </ul>
  );
}

export function PipelineDetailLive({ initial }: { initial: PipelineRunDetail }) {
  const locale = useLocale();
  const t = useTranslations('pipelines.detail');
  const tp = useTranslations('pipelines');
  const tc = useTranslations('common');
  const router = useRouter();
  const dateLocale = locale === 'en' ? 'en-GB' : 'es-ES';
  const [pipeline, setPipeline] = useState(initial);
  const live = isPipelineInProgress(pipeline.status);

  useEffect(() => {
    setPipeline(initial);
  }, [initial]);

  useEffect(() => {
    if (!live) return;

    const interval = setInterval(async () => {
      try {
        const data = await api<PipelineRunDetail>(`/api/pipelines/${pipeline.id}`);
        setPipeline(data);
        if (!isPipelineInProgress(data.status)) {
          router.refresh();
        }
      } catch {
        // silencioso
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [live, pipeline.id, router]);

  const video = pipeline.videos?.[0];
  const forcedTopic = pipeline.metadata?.forcedTopic;
  const pipelineTitle = forcedTopic ?? video?.title ?? pipeline.channel?.name ?? tp('untitled');
  const canCancel = isPipelineCancellable(pipeline.status, video);
  const elapsed = usePipelineElapsedLabel(pipeline.createdAt, pipeline.completedAt);
  const stepperOptions = channelStepperOptions(pipeline.channel);
  const visibleSteps = getVisiblePipelineSteps(stepperOptions);
  const channelConfig = (pipeline.channel?.config ?? {}) as {
    publishYoutubeShorts?: boolean;
    videoFormat?: 'shorts' | 'long';
    shortsMode?: 'split' | 'dedicated' | 'mixed';
    shortsPerVideo?: number;
    longShortsFromVideo?: number;
  };
  const showShortsSection =
    !!video?.id &&
    channelConfig.publishYoutubeShorts === true &&
    (channelConfig.videoFormat === 'long' || stepperOptions.videoFormat === 'long');
  const preRenderSteps = new Set([
    'generate_ideas',
    'select_idea',
    'generate_script',
    'generate_media',
  ]);
  const awaitingRender = !video && (live || preRenderSteps.has(pipeline.currentStep ?? ''));
  const preReviewClipSplit =
    stepperOptions.reviewRequired !== false &&
    stepperOptions.publishYoutubeShorts === true &&
    stepperOptions.videoFormat === 'long';

  return (
    <>
      {live && (
        <div className="pipeline-live-banner live-indicator-pulse" aria-live="polite">
          <span className="generaciones-live-dot" aria-hidden="true" />
          {pipeline.currentStep === 'split_shorts' && preReviewClipSplit
            ? stepperOptions.shortsMode === 'mixed'
              ? (stepperOptions.longShortsFromVideo ?? 1) > 1
                ? t('liveCuttingParts', { n: stepperOptions.longShortsFromVideo ?? 1 })
                : t('liveCuttingShort')
              : stepperOptions.longShortsFromVideo
                ? t('liveCuttingParts', { n: stepperOptions.longShortsFromVideo })
                : t('liveGeneratingClips')
            : pipeline.currentStep === 'generate_short' && preReviewClipSplit
              ? stepperOptions.shortsMode === 'mixed'
                ? t('liveGeneratingTeasers')
                : t('liveGeneratingDedicated')
              : t('liveInProgress')}
        </div>
      )}

      <div className="pipeline-detail-hero card">
        <div className="pipeline-detail-hero-main">
          <div className="pipeline-detail-hero-head">
            <StatusBadge status={pipeline.status} kind="pipeline" />
            <span className="text-muted text-sm">{t('timeLabel', { elapsed })}</span>
            {canCancel && (
              <PipelineCancelButton
                pipelineId={pipeline.id}
                pipelineTitle={pipelineTitle}
                onCancelled={() => {
                  setPipeline((prev) => ({ ...prev, status: 'cancelled' }));
                }}
              />
            )}
          </div>
          <PipelineProgressBar
            currentStep={pipeline.currentStep}
            status={pipeline.status}
            size="md"
            stepperOptions={stepperOptions}
          />
          {pipeline.error && (
            <div className="pipeline-error-box">
              <strong>{pipelineErrorTitle(pipeline.error)}</strong>
              <p>{mapPipelineError(pipeline.error)}</p>
              {pipeline.status === 'failed' && (
                <PipelineRetryButton pipelineId={pipeline.id} />
              )}
            </div>
          )}
          {!pipeline.error &&
            pipeline.status !== 'failed' &&
            pipeline.status !== 'completed' &&
            pipeline.status !== 'cancelled' &&
            pipeline.status !== 'pending_review' && (
              <div className="pipeline-resume-box">
                <p className="text-muted text-sm">{t('resumeHint')}</p>
                <PipelineResumeButton pipelineId={pipeline.id} force />
              </div>
            )}
        </div>

        <dl className="pipeline-detail-meta detail-list">
          <dt>{t('currentStep')}</dt>
          <dd>{pipeline.currentStep ? getPipelineStepLabel(pipeline.currentStep, stepperOptions) : '—'}</dd>
          <dt>{t('created')}</dt>
          <dd>{new Date(pipeline.createdAt).toLocaleString(dateLocale)}</dd>
          {pipeline.completedAt && (
            <>
              <dt>{t('completed')}</dt>
              <dd>{new Date(pipeline.completedAt).toLocaleString(dateLocale)}</dd>
            </>
          )}
          {forcedTopic && (
            <>
              <dt>{t('forcedTopic')}</dt>
              <dd>{forcedTopic}</dd>
            </>
          )}
          {video && (
            <>
              <dt>{tc('video')}</dt>
              <dd className="pipeline-detail-video-dd">
                <Link href={`/videos/${video.id}`} className="pipeline-video-link">
                  {video.title}
                </Link>
                <StatusBadge status={video.reviewStatus} />
              </dd>
            </>
          )}
          {!video && (
            <>
              <dt>{tc('video')}</dt>
              <dd className="text-muted text-sm">
                {awaitingRender
                  ? t('videoPendingRender')
                  : pipeline.status === 'failed'
                    ? t('videoFailedBeforeRender')
                    : t('noVideo')}
              </dd>
            </>
          )}
        </dl>
      </div>

      {awaitingRender && (
        <div className="hint-box">
          {t('renderHint')}
          {pipeline.currentStep && (
            <>
              {' '}
              {t('currentStepInline')} <strong>{getPipelineStepLabel(pipeline.currentStep, stepperOptions)}</strong>.
            </>
          )}
        </div>
      )}

      {video?.filePath && (
        <section className="page-section">
          <h2>{t('preview')}</h2>
          <div className="pipeline-video-preview">
            <VideoPlayer
              videoId={video.id}
              title={video.title}
              aspectRatio={video.aspectRatio}
              hasLocalFile={!!video.filePath}
              youtubeVideoId={video.youtubeVideoId}
              durationSec={video.durationSec}
              hasThumbnail={!!video.thumbnailPath}
            />
          </div>
        </section>
      )}

      {showShortsSection && video?.id && (
        <section className="page-section">
          <ShortsClipsSection
            videoId={video.id}
            clips={(pipeline.clips ?? []) as VideoClip[]}
            shortsMode={channelConfig.shortsMode}
            shortsPerVideo={channelConfig.shortsPerVideo}
            longShortsFromVideo={channelConfig.longShortsFromVideo}
            locale={locale}
            emptyMessage={
              live
                ? pipeline.currentStep === 'generate_short'
                  ? t('shortsGeneratingTeasers')
                  : pipeline.currentStep === 'split_shorts'
                    ? t('shortsGeneratingCuts')
                    : t('shortsPending')
                : pipeline.status === 'failed'
                  ? t('shortsFailed')
                  : t('shortsEmpty')
            }
          />
        </section>
      )}

      <section className="page-section">
        <h2>{t('process')}</h2>
        <div className="stepper stepper-compact">
          {visibleSteps.map((step) => {
            const state = pipelineStepState(
              step,
              pipeline.currentStep,
              pipeline.status,
              stepperOptions,
            );
            const icon = PIPELINE_STEP_ICONS[step] ?? '•';
            return (
              <div
                key={step}
                className={`stepper-step stepper-step-${state}${state === 'pending' ? ' stepper-step-muted' : ''}`}
              >
                <div className="stepper-dot" title={getPipelineStepLabel(step, stepperOptions)}>
                  {state === 'done' ? '✓' : state === 'failed' ? '✗' : icon}
                </div>
                <span className="stepper-label">
                  {getPipelineStepLabel(step, stepperOptions)}
                  {step === pipeline.currentStep && state === 'active' && (
                    <span className="stepper-active-tag">{t('stepInProgress')}</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {pipeline.ideas && pipeline.ideas.length > 0 && (
        <section className="page-section">
          <h2>{t('ideasTitle')}</h2>
          <div className="ideas-grid">
            {pipeline.ideas.map((idea) => (
              <article
                key={idea.id}
                className={`idea-card${idea.isSelected ? ' idea-card-selected' : ''}`}
              >
                <div className="idea-card-head">
                  <strong>{idea.title}</strong>
                  {idea.isSelected && <span className="idea-card-badge">{t('selected')}</span>}
                </div>
                <div className="idea-score-row">
                  <span className="text-muted text-sm">{t('virality')}</span>
                  <span className="idea-score-value">{Math.round(idea.viralScore)}</span>
                </div>
                <div className="idea-score-bar">
                  <div className="idea-score-bar-fill" style={{ width: `${Math.min(100, idea.viralScore)}%` }} />
                </div>
                {idea.scoreBreakdown && <IdeaScoreBreakdown breakdown={idea.scoreBreakdown} />}
              </article>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
