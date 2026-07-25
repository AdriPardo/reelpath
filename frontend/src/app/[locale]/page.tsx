import { Link } from '@/i18n/navigation';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { MarketingHome } from '@/components/MarketingHome';
import { GettingStartedChecklist } from '@/components/GettingStartedChecklist';
import { DashboardActivePipelines } from '@/components/DashboardActivePipelines';
import { DashboardOrgAnalytics } from '@/components/DashboardOrgAnalytics';
import { TrialBanner } from '@/components/TrialBanner';
import { BillingPastDueBanner } from '@/components/BillingPastDueBanner';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { isPipelineInProgress } from '@/lib/pipeline-status';
import type { AuthSession } from '@/context/AuthContext';
import { checkApiHealth, type Channel, type PipelineRun, type Video } from '@/lib/api';
import { serverApi } from '@/lib/api-server';
import { formatDateTime } from '@/lib/format-publish-date';
import { PLATFORM } from '@/lib/site-brand';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'common' });
  return { title: { absolute: t('appName') } };
}

function channelHasIntegration(channel: Channel): boolean {
  const yt = channel.integrations?.youtube;
  return Boolean(yt?.connected && yt.tokenOk);
}

function greetingName(session: AuthSession | null): string | null {
  if (!session) return null;
  const name = session.user.name?.trim();
  if (name) return name.split(/\s+/)[0] ?? name;
  const local = session.user.email.split('@')[0];
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'dashboard' });
  const tc = await getTranslations({ locale, namespace: 'common' });

  const apiOnline = await checkApiHealth();
  let session: AuthSession | null = null;
  let channels: Channel[] = [];
  let pendingVideos: Video[] = [];
  let scheduledVideos: Video[] = [];
  let pipelines: PipelineRun[] = [];

  if (apiOnline) {
    try {
      const results = await Promise.allSettled([
        serverApi<AuthSession>('/api/auth/me'),
        serverApi<Channel[]>('/api/channels'),
        serverApi<Video[]>('/api/videos?reviewStatus=pending'),
        serverApi<Video[]>('/api/videos?reviewStatus=scheduled'),
        serverApi<PipelineRun[]>('/api/pipelines'),
      ]);

      if (results[0].status === 'fulfilled') session = results[0].value;
      if (results[1].status === 'fulfilled') channels = results[1].value;
      if (results[2].status === 'fulfilled') pendingVideos = results[2].value;
      if (results[3].status === 'fulfilled') scheduledVideos = results[3].value;
      if (results[4].status === 'fulfilled') pipelines = results[4].value;
    } catch {
      // fetch parcial fallido
    }
  }

  const orgName = session?.organization.name ?? tc('workspace');
  const firstName = greetingName(session);
  const hasChannels = channels.length > 0;
  const hasIntegrations = channels.some(channelHasIntegration);
  const hasGenerations = pipelines.length > 0;
  const activePipelines = pipelines.filter((p) => isPipelineInProgress(p.status));
  const pendingPreview = pendingVideos.slice(0, 3);
  const scheduledPreview = scheduledVideos.slice(0, 3);
  const firstChannelId = channels[0]?.id;
  const onboardingIncomplete = !hasChannels || !hasIntegrations || !hasGenerations;

  if (!session) {
    return <MarketingHome />;
  }

  const dashboardSubtitle = !hasChannels
    ? t('subtitleNoChannels', { org: orgName })
    : onboardingIncomplete
      ? t('subtitleOnboarding', { org: orgName })
      : t('subtitleReady', { org: orgName });

  return (
    <div className="page-content">
      <PageHeader
        title={firstName ? t('greeting', { name: firstName }) : t('title')}
        subtitle={dashboardSubtitle}
        actions={
          hasChannels ? (
            <ButtonLink href="/channels" variant="primary">
              {tc('generateVideo')}
            </ButtonLink>
          ) : (
            <ButtonLink href="/channels" variant="primary">
              {tc('createChannel')}
            </ButtonLink>
          )
        }
      />

      <BillingPastDueBanner session={session} />
      <TrialBanner session={session} />

      {onboardingIncomplete && (
        <GettingStartedChecklist
          hasChannels={hasChannels}
          hasIntegrations={hasIntegrations}
          hasGenerations={hasGenerations}
          firstChannelId={firstChannelId}
        />
      )}

      {!hasChannels ? (
        <EmptyState
          variant="channels"
          title={t('noChannelsTitle')}
          description={t('noChannelsDesc')}
          action={
            <ButtonLink href="/channels" variant="primary">
              {t('createFirstChannel')}
            </ButtonLink>
          }
        />
      ) : (
        <>
          <div className="stat-grid">
            <Link href="/pipelines" className="stat stat-clickable">
              <div className="stat-body">
                <div className="stat-value">{activePipelines.length}</div>
                <div className="stat-label">{t('activePipelines')}</div>
              </div>
            </Link>
            <Link href="/review" className="stat stat-clickable">
              <div className="stat-body">
                <div className="stat-value">{pendingVideos.length}</div>
                <div className="stat-label">{t('pendingReview')}</div>
              </div>
            </Link>
            <Link href="/videos?reviewStatus=scheduled" className="stat stat-clickable">
              <div className="stat-body">
                <div className="stat-value">{scheduledVideos.length}</div>
                <div className="stat-label">{t('upcomingPublish')}</div>
              </div>
            </Link>
          </div>

          <DashboardOrgAnalytics />

          <section className="page-section">
            <div className="page-section-title">
              <h2>{t('pendingReviewSection')}</h2>
              {pendingVideos.length > 0 && (
                <Link href="/review" className="btn btn-ghost btn-sm">
                  {tc('viewAll')}
                </Link>
              )}
            </div>
            {pendingPreview.length === 0 ? (
              <EmptyState
                compact
                variant="review"
                title={t('noPendingTitle')}
                description={t('noPendingDesc')}
                action={
                  <ButtonLink href="/channels" variant="secondary">
                    {tc('generateVideo')}
                  </ButtonLink>
                }
              />
            ) : (
              <ul className="dashboard-list">
                {pendingPreview.map((v) => (
                  <li key={v.id} className="dashboard-list-item">
                    <Link href={`/videos/${v.id}`} className="dashboard-list-link">
                      {v.title}
                    </Link>
                    <StatusBadge status={v.reviewStatus} />
                    <Link href={`/videos/${v.id}`} className="btn btn-sm btn-secondary">
                      {tc('review')}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="page-section">
            <div className="page-section-title">
              <h2>{t('activePipelinesSection')}</h2>
              {activePipelines.length > 0 && (
                <Link href="/pipelines" className="btn btn-ghost btn-sm">
                  {tc('viewAllFem')}
                </Link>
              )}
            </div>
            {activePipelines.length === 0 ? (
              <EmptyState
                compact
                variant="pipeline"
                title={t('noActiveTitle')}
                description={t('noActiveDesc')}
                action={
                  <ButtonLink href="/channels" variant="secondary">
                    {tc('generateVideo')}
                  </ButtonLink>
                }
              />
            ) : (
              <DashboardActivePipelines initialPipelines={pipelines} />
            )}
          </section>

          {scheduledPreview.length > 0 && (
            <section className="page-section">
              <div className="page-section-title">
                <h2>{t('upcomingSection')}</h2>
                <Link href="/videos?reviewStatus=scheduled" className="btn btn-ghost btn-sm">
                  {tc('viewAll')}
                </Link>
              </div>
              <ul className="dashboard-list">
                {scheduledPreview.map((v) => (
                  <li key={v.id} className="dashboard-list-item">
                    <Link href={`/videos/${v.id}`} className="dashboard-list-link">
                      {v.title}
                    </Link>
                    <StatusBadge status={v.reviewStatus} />
                    {v.scheduledPublishAt && (
                      <span className="text-muted text-sm">
                        {formatDateTime(v.scheduledPublishAt, locale, {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
