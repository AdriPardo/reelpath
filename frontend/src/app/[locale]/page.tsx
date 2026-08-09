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
import type { AuthSession } from '@/context/AuthContext';
import { type Channel, type PaginatedResponse, type PipelineRun, type Video } from '@/lib/api';
import { serverApi } from '@/lib/api-server';
import { formatDateTime } from '@/lib/format-publish-date';

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

  let session: AuthSession | null = null;
  let channels: Channel[] = [];
  let pendingVideos: Video[] = [];
  let pendingTotal = 0;
  let scheduledVideos: Video[] = [];
  let scheduledTotal = 0;
  let pipelines: PipelineRun[] = [];
  let activePipelinesTotal = 0;
  let reviewedTotal = 0;

  // No gatear sesión con checkApiHealth: en Docker el health público puede fallar
  // (hairpin) y la home renderiza MarketingHome → en móvil parece logout.
  try {
    const results = await Promise.allSettled([
      serverApi<AuthSession>('/api/auth/me'),
      serverApi<Channel[]>('/api/channels?light=1'),
      serverApi<PaginatedResponse<Video>>('/api/videos?reviewStatus=pending&page=1&limit=10'),
      serverApi<PaginatedResponse<Video>>(
        '/api/videos?reviewStatus=scheduled&upcoming=true&page=1&limit=3',
      ),
      serverApi<PaginatedResponse<PipelineRun>>('/api/pipelines?active=true&page=1&limit=20'),
      serverApi<PaginatedResponse<Video>>('/api/videos?reviewStatus=approved&page=1&limit=1'),
    ]);

    if (results[0].status === 'fulfilled') session = results[0].value;
    if (results[1].status === 'fulfilled') channels = results[1].value;
    if (results[2].status === 'fulfilled') {
      pendingVideos = results[2].value.items;
      pendingTotal = results[2].value.total;
    }
    if (results[3].status === 'fulfilled') {
      scheduledVideos = results[3].value.items;
      scheduledTotal = results[3].value.total;
    }
    if (results[4].status === 'fulfilled') {
      pipelines = results[4].value.items;
      activePipelinesTotal = results[4].value.total;
    }
    if (results[5].status === 'fulfilled') {
      reviewedTotal = results[5].value.total;
    }
  } catch {
    // fetch parcial fallido
  }

  const orgName = session?.organization.name ?? tc('workspace');
  const firstName = greetingName(session);
  const hasChannels = channels.length > 0;
  const hasIntegrations = channels.some(channelHasIntegration);
  const hasGenerations =
    channels.some(
      (c) => Boolean(c.stats?.lastGenerationAt) || (c.stats?.activeGenerations ?? 0) > 0,
    ) ||
    pendingTotal > 0 ||
    scheduledTotal > 0 ||
    activePipelinesTotal > 0;
  const hasReviewAction = reviewedTotal > 0 || scheduledTotal > 0;
  const activePipelines = pipelines;
  const pendingPreview = pendingVideos.slice(0, 3);
  const scheduledPreview = scheduledVideos;
  const firstChannelId = channels[0]?.id;
  const onboardingIncomplete =
    !hasChannels || !hasIntegrations || !hasGenerations || !hasReviewAction;

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
            <ButtonLink href={firstChannelId ? `/channels/${firstChannelId}` : '/channels'} variant="primary">
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
          hasReviewAction={hasReviewAction}
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
            <Link
              href="/review"
              className={`stat stat-clickable${pendingTotal > 0 ? ' stat-attention' : ''}`}
            >
              <div className="stat-body">
                <div className="stat-value">{pendingTotal}</div>
                <div className="stat-label">{t('pendingReview')}</div>
              </div>
            </Link>
            <Link
              href="/pipelines"
              className={`stat stat-clickable${activePipelinesTotal > 0 ? ' stat-attention' : ''}`}
            >
              <div className="stat-body">
                <div className="stat-value">{activePipelinesTotal}</div>
                <div className="stat-label">{t('activePipelines')}</div>
              </div>
            </Link>
            <Link href="/videos?status=scheduled" className="stat stat-clickable">
              <div className="stat-body">
                <div className="stat-value">{scheduledTotal}</div>
                <div className="stat-label">{t('upcomingPublish')}</div>
              </div>
            </Link>
          </div>

          {pendingTotal > 0 && (
            <section className="page-section">
              <div className="page-section-title">
                <h2>{t('pendingReviewSection')}</h2>
                <Link href="/review" className="btn btn-ghost btn-sm">
                  {tc('viewAll')}
                </Link>
              </div>
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
            </section>
          )}

          {activePipelinesTotal > 0 && (
            <section className="page-section">
              <div className="page-section-title">
                <h2>{t('activePipelinesSection')}</h2>
                <Link href="/pipelines" className="btn btn-ghost btn-sm">
                  {tc('viewAllFem')}
                </Link>
              </div>
              <DashboardActivePipelines initialPipelines={pipelines} />
            </section>
          )}

          {scheduledPreview.length > 0 && (
            <section className="page-section">
              <div className="page-section-title">
                <h2>{t('upcomingSection')}</h2>
                <Link href="/videos?status=scheduled" className="btn btn-ghost btn-sm">
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

          <DashboardOrgAnalytics />
        </>
      )}
    </div>
  );
}
