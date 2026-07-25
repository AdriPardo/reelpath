import Link from 'next/link';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ReviewActions } from '@/components/ReviewActions';
import { ScriptEditorPanel } from '@/components/ScriptEditorPanel';
import { RepublishButton } from '@/components/RepublishButton';
import { ShortsPanel } from '@/components/ShortsPanel';
import { VideoAnalyticsPanel } from '@/components/VideoAnalyticsPanel';
import { QualityReportPanel } from '@/components/QualityReportPanel';
import { VisualOriginSummaryPanel, VisualPlaceholderBanner } from '@/components/VisualOriginPanel';
import { VideoPlayer } from '@/components/VideoPlayer';
import { VideoEditForm } from '@/components/VideoEditForm';
import { VideoMaintenanceActions } from '@/components/VideoMaintenanceActions';
import { PageHeader } from '@/components/ui/PageHeader';
import { VideoStatusBadge } from '@/components/VideoStatusBadge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ButtonLink } from '@/components/ui/Button';
import { type VideoDetail } from '@/lib/api';
import { ServerApiError, serverApi } from '@/lib/api-server';
import { formatDurationReadable } from '@/lib/format-duration';
import { mapPipelineError, parseApiError, SERVICE_UNAVAILABLE } from '@/lib/user-messages';
import { formatVideoLabel } from '@/lib/video-labels';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}): Promise<Metadata> {
  const { id, locale } = await params;
  const t = await getTranslations({ locale, namespace: 'videos.page' });
  try {
    const video = await serverApi<VideoDetail>(`/api/videos/${id}`);
    return { title: video.title };
  } catch {
    return { title: t('metadataTitle') };
  }
}

export default async function VideoDetailPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  const t = await getTranslations({ locale, namespace: 'videos' });
  const tp = await getTranslations({ locale, namespace: 'pipelines.detail' });
  const tc = await getTranslations({ locale, namespace: 'common' });
  const dateLocale = locale === 'en' ? 'en-GB' : 'es-ES';
  let video: VideoDetail | null = null;
  let loadState: 'not_found' | 'forbidden' | 'error' = 'not_found';
  let loadError: string | null = null;

  try {
    video = await serverApi<VideoDetail>(`/api/videos/${id}`);
  } catch (err) {
    if (err instanceof ServerApiError) {
      if (err.status === 403) {
        loadState = 'forbidden';
      } else if (err.status === 404) {
        loadState = 'not_found';
      } else {
        loadState = 'error';
        loadError = parseApiError(err.message, SERVICE_UNAVAILABLE);
      }
    } else {
      loadState = 'error';
      loadError = SERVICE_UNAVAILABLE;
    }
  }

  if (!video) {
    const title =
      loadState === 'forbidden'
        ? t('noAccess')
        : loadState === 'error'
          ? t('loadFailed')
          : t('notFound');

    const description =
      loadState === 'forbidden'
        ? t('forbiddenDesc')
        : loadState === 'error'
          ? loadError ?? SERVICE_UNAVAILABLE
          : t('notFoundDesc');

    return (
      <>
        <PageHeader title={title} />
        <p className="text-muted">
          {description}{' '}
          {loadState === 'not_found' && (
            <>
              <Link href="/pipelines">{t('viewGenerations')}</Link>.
            </>
          )}
        </p>
        <ButtonLink href="/videos" variant="ghost">{t('backToVideos')}</ButtonLink>
      </>
    );
  }

  const selectedIdea = video.pipelineRun?.ideas?.find((i) => i.isSelected);
  const pipelineFailed = video.pipelineRun?.status === 'failed';
  const channelSettings = (video.channel?.config ?? {}) as {
    publishYoutubeShorts?: boolean;
    shortsMode?: 'split' | 'dedicated' | 'mixed';
    shortsPerVideo?: number;
    longShortsFromVideo?: number;
    videoFormat?: 'shorts' | 'long';
  };

  return (
    <div className="video-detail-page">
      <PageHeader
        title={video.title}
        subtitle={video.description}
        actions={
          <ButtonLink href="/videos" variant="ghost">
            {t('back')}
          </ButtonLink>
        }
      />

      {video.visualSummary?.hasPlaceholders && <VisualPlaceholderBanner />}

      {video.reviewStatus === 'pending' && (
        <div className="hint-box">{t('pendingHint')}</div>
      )}

      {video.reviewStatus === 'scheduled' && video.scheduledPublishAt && (
        <div className="hint-box">
          {video.youtubeVideoId ? (
            <>
              {t('scheduledPublished', {
                date: new Date(video.scheduledPublishAt).toLocaleString(dateLocale),
              })}
            </>
          ) : (
            <>
              {t('scheduledUploading', {
                date: new Date(video.scheduledPublishAt).toLocaleString(dateLocale),
              })}
            </>
          )}
        </div>
      )}

      {pipelineFailed && video.pipelineRun?.error && (
        <div className="hint-box" style={{ borderColor: 'rgba(239, 68, 68, 0.35)', background: 'rgba(239, 68, 68, 0.08)' }}>
          <strong>{t('pipelineFailed')}</strong> {mapPipelineError(video.pipelineRun.error)}
        </div>
      )}

      <div className="video-detail-layout">
        <div className="video-detail-player-wrap">
          <VideoPlayer
            videoId={video.id}
            title={video.title}
            aspectRatio={video.aspectRatio}
            hasLocalFile={!!video.filePath}
            youtubeVideoId={video.youtubeVideoId}
            durationSec={video.durationSec}
            hasThumbnail={!!video.thumbnailPath}
          />
          {video.youtubeVideoId && !video.youtubeVideoId.startsWith('mock_') && (
            <a
              href={`https://www.youtube.com/watch?v=${video.youtubeVideoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="video-youtube-link btn btn-ghost btn-sm"
            >
              {t('openYoutube')}
            </a>
          )}
        </div>

        <aside className="video-detail-panel card">
          <h3>{t('details')}</h3>
          <dl className="detail-list">
            <dt>{tc('status')}</dt>
            <dd>
              <VideoStatusBadge
                reviewStatus={video.reviewStatus}
                scheduledPublishAt={video.scheduledPublishAt}
                publishedAt={video.publishedAt}
                youtubeVideoId={video.youtubeVideoId}
                channel={video.channel}
              />
            </dd>
            <dt>{t('formatLabel')}</dt>
            <dd>{formatVideoLabel(video.format)} ({video.aspectRatio})</dd>
            <dt>{tc('duration')}</dt>
            <dd>{formatDurationReadable(video.durationSec)}</dd>
            <dt>{t('generationGroup')}</dt>
            <dd>
              {video.pipelineRun ? (
                <StatusBadge status={video.pipelineRun.status} kind="pipeline" />
              ) : (
                '—'
              )}
            </dd>
            {selectedIdea && (
              <>
                <dt>{t('viralPotential')}</dt>
                <dd>
                  {selectedIdea.viralScore}
                  <span className="text-muted" style={{ display: 'block', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                    {t('viralHint')}
                  </span>
                </dd>
              </>
            )}
            <dt>{t('tags')}</dt>
            <dd>{video.tags?.join(', ') || '—'}</dd>
            {video.visualSummary && (
              <>
                <dt>{t('visuals')}</dt>
                <dd>
                  <VisualOriginSummaryPanel summary={video.visualSummary} />
                </dd>
              </>
            )}
          </dl>

          <div className="action-stack">
            {video.reviewStatus === 'pending' && (
              <div className="action-group">
                <span className="action-group-label">{t('reviewGroup')}</span>
                <ReviewActions videoId={video.id} channelId={video.channelId} />
              </div>
            )}

            {video.reviewStatus === 'pending' && (
              <div className="action-group">
                <span className="action-group-label">{t('detail.editMetadata')}</span>
                <VideoEditForm
                  videoId={video.id}
                  initialTitle={video.title}
                  initialDescription={video.description}
                  initialTags={video.tags ?? []}
                />
              </div>
            )}

            {(video.reviewStatus === 'published' ||
              video.reviewStatus === 'approved' ||
              video.reviewStatus === 'scheduled') && (
              <>
                <div className="action-group">
                  <span className="action-group-label">{t('youtubeGroup')}</span>
                  <RepublishButton videoId={video.id} youtubeVideoId={video.youtubeVideoId} />
                </div>
              </>
            )}

            {video.pipelineRun && (
              <div className="action-group">
                <span className="action-group-label">{t('generationGroup')}</span>
                <Link href={`/pipelines/${video.pipelineRunId}`} className="btn btn-secondary btn-sm">
                  {tp('viewProgress')}
                </Link>
              </div>
            )}

            <div className="action-group">
              <span className="action-group-label">{t('detail.tools')}</span>
              <VideoMaintenanceActions
                videoId={video.id}
                canDeleteLocal={!!video.filePath && video.reviewStatus === 'published'}
              />
            </div>
          </div>
        </aside>
      </div>

      {video.qualityReport && (
        <div className="video-quality-section">
          <QualityReportPanel report={video.qualityReport} />
        </div>
      )}

      {video.pipelineRun && video.pipelineRunId && (
        <ScriptEditorPanel
          pipelineRunId={video.pipelineRunId}
          videoId={video.id}
          reviewStatus={video.reviewStatus}
        />
      )}

      <ShortsPanel
        videoId={video.id}
        initialClips={video.clips}
        shortsMode={channelSettings.shortsMode}
        shortsPerVideo={channelSettings.shortsPerVideo}
        longShortsFromVideo={channelSettings.longShortsFromVideo}
        publishYoutubeShorts={channelSettings.publishYoutubeShorts}
      />

      {(video.reviewStatus === 'published' || video.youtubeVideoId) && (
        <VideoAnalyticsPanel videoId={video.id} youtubeVideoId={video.youtubeVideoId} />
      )}
    </div>
  );
}
