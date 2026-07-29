import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PipelinesLiveTable } from '@/components/PipelinesLiveTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { ButtonLink } from '@/components/ui/Button';
import { type Channel, type PaginatedResponse, type PipelineRun } from '@/lib/api';
import { serverApi } from '@/lib/api-server';
import { parseApiError } from '@/lib/user-messages';
import { Pagination } from '@/components/ui/Pagination';

type PipelineFilter = 'all' | 'active' | 'done' | 'failed';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string; filter?: string; channel?: string }>;
};

function parseFilter(raw: string | undefined): PipelineFilter {
  if (raw === 'active' || raw === 'done' || raw === 'failed') return raw;
  return 'all';
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pipelines' });
  return { title: t('title') };
}

export default async function PipelinesPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { page: pageParam, filter: filterParam, channel: channelParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? '1', 10) || 1);
  const filter = parseFilter(filterParam);
  const channelId = channelParam && channelParam !== 'all' ? channelParam : null;
  const t = await getTranslations({ locale, namespace: 'pipelines' });
  const tc = await getTranslations({ locale, namespace: 'common' });

  let pipelines: PipelineRun[] = [];
  let totalPages = 1;
  let total = 0;
  let counts = { all: 0, active: 0, done: 0, failed: 0 };
  let channels: Channel[] = [];
  let loadError: string | null = null;

  try {
    const qs = new URLSearchParams();
    qs.set('page', String(page));
    qs.set('limit', '50');
    if (filter !== 'all') qs.set('filter', filter);
    if (channelId) qs.set('channelId', channelId);

    const [res, channelsRes] = await Promise.all([
      serverApi<PaginatedResponse<PipelineRun>>(`/api/pipelines?${qs}`),
      serverApi<Channel[]>('/api/channels?light=1'),
    ]);
    pipelines = res.items;
    totalPages = res.totalPages;
    total = res.total;
    counts = res.counts ?? counts;
    channels = channelsRes;
  } catch (err) {
    loadError = parseApiError(err instanceof Error ? err.message : String(err));
  }

  const paginationParams = {
    filter: filter !== 'all' ? filter : undefined,
    channel: channelId ?? undefined,
  };

  return (
    <div className="page-content">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <ButtonLink href="/channels" variant="secondary">
            {tc('generateVideo')}
          </ButtonLink>
        }
      />

      {loadError ? (
        <EmptyState
          variant="error"
          title={t('loadError')}
          description={loadError}
          action={
            <ButtonLink href="/pipelines" variant="primary">
              {tc('retry')}
            </ButtonLink>
          }
        />
      ) : counts.all === 0 ? (
        <EmptyState
          variant="pipeline"
          title={t('emptyTitle')}
          description={t('emptyDesc')}
          action={
            <ButtonLink href="/channels" variant="primary">
              {tc('goToChannels')}
            </ButtonLink>
          }
        />
      ) : (
        <>
          <PipelinesLiveTable
            initialPipelines={pipelines}
            page={page}
            filter={filter}
            channelFilter={channelId ?? 'all'}
            counts={counts}
            channels={channels}
          />
          {total === 0 ? (
            <EmptyState
              variant="pipeline"
              compact
              title={t('emptyCategory')}
              description={t('emptyCategoryDesc')}
            />
          ) : null}
          {totalPages > 1 && (
            <Pagination
              page={page}
              totalPages={totalPages}
              basePath="/pipelines"
              searchParams={paginationParams}
            />
          )}
        </>
      )}
    </div>
  );
}
