import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { VideoCard } from '@/components/VideoCard';
import { VideoFilters } from '@/components/VideoFilters';
import { VideoSearch } from '@/components/VideoSearch';
import { ChannelFilter } from '@/components/ChannelFilter';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { ButtonLink } from '@/components/ui/Button';
import { type Channel, type PaginatedResponse, type Video } from '@/lib/api';
import { serverApi } from '@/lib/api-server';
import { parseApiError } from '@/lib/user-messages';
import { Pagination } from '@/components/ui/Pagination';
import { SkeletonTabs } from '@/components/ui/Skeleton';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string; q?: string; channel?: string; page?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'videos' });
  return { title: t('title') };
}

export default async function VideosPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'videos' });
  const tc = await getTranslations({ locale, namespace: 'common' });
  const { status, q, channel, page: pageParam } = await searchParams;
  const filter = status && status !== 'all' ? status : null;
  const search = q?.trim() || null;
  const channelId = channel && channel !== 'all' ? channel : null;
  const page = Math.max(1, parseInt(pageParam ?? '1', 10) || 1);

  const FILTER_KEYS: Record<string, string> = {
    all: 'filterAll',
    pending: 'filterPending',
    approved: 'filterApproved',
    scheduled: 'filterScheduled',
    published: 'filterPublished',
    rejected: 'filterRejected',
  };

  let videos: Video[] = [];
  let totalPages = 1;
  let channels: Channel[] = [];
  let loadError: string | null = null;
  try {
    const paramsQs = new URLSearchParams();
    if (filter) paramsQs.set('reviewStatus', filter);
    if (search) paramsQs.set('q', search);
    if (channelId) paramsQs.set('channelId', channelId);
    paramsQs.set('page', String(page));
    paramsQs.set('limit', '50');
    const qs = paramsQs.toString();
    const [videosRes, channelsRes] = await Promise.all([
      serverApi<PaginatedResponse<Video>>(`/api/videos?${qs}`),
      serverApi<Channel[]>('/api/channels?light=1'),
    ]);
    videos = videosRes.items;
    totalPages = videosRes.totalPages;
    channels = channelsRes;
  } catch (err) {
    loadError = parseApiError(err instanceof Error ? err.message : String(err));
  }

  const filterLabel = filter && FILTER_KEYS[filter] ? t(FILTER_KEYS[filter]) : filter;

  return (
    <div className="page-content">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <div className="videos-toolbar">
        <Suspense fallback={<SkeletonTabs count={6} />}>
          <VideoFilters />
        </Suspense>
        <div className="videos-toolbar-aside">
          <Suspense fallback={<div className="skeleton skeleton-chip" style={{ width: '10rem', height: '2.5rem' }} aria-hidden="true" />}>
            <ChannelFilter channels={channels} basePath="/videos" />
          </Suspense>
          <Suspense fallback={<div className="skeleton" style={{ height: '2.5rem', width: '14rem', borderRadius: 8 }} aria-hidden="true" />}>
            <VideoSearch />
          </Suspense>
        </div>
      </div>

      {loadError ? (
        <EmptyState
          variant="error"
          title={t('loadError')}
          description={loadError}
          action={
            <ButtonLink href="/videos" variant="primary">
              {tc('retry')}
            </ButtonLink>
          }
        />
      ) : videos.length === 0 ? (
        <EmptyState
          variant="videos"
          title={
            search
              ? t('noResults', { query: search })
              : filter
                ? t('noFiltered', { filter: filterLabel ?? filter })
                : t('emptyTitle')
          }
          description={filter || search || channelId ? t('emptyFilteredDesc') : t('emptyDesc')}
          action={
            <>
              <ButtonLink href="/channels" variant="primary">
                {tc('goToChannels')}
              </ButtonLink>
              <ButtonLink href="/pipelines" variant="secondary">
                {t('viewPipelines')}
              </ButtonLink>
            </>
          }
        />
      ) : (
        <>
          <div className="video-grid">
            {videos.map((v) => (
              <VideoCard key={v.id} video={v} />
            ))}
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            basePath="/videos"
            searchParams={{ status, q, channel }}
          />
        </>
      )}
    </div>
  );
}
