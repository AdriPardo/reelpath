import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PipelinesLiveTable } from '@/components/PipelinesLiveTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { ButtonLink } from '@/components/ui/Button';
import { type PaginatedResponse, type PipelineRun } from '@/lib/api';
import { serverApi } from '@/lib/api-server';
import { parseApiError } from '@/lib/user-messages';
import { Pagination } from '@/components/ui/Pagination';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pipelines' });
  return { title: t('title') };
}

export default async function PipelinesPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? '1', 10) || 1);
  const t = await getTranslations({ locale, namespace: 'pipelines' });
  const tc = await getTranslations({ locale, namespace: 'common' });

  let pipelines: PipelineRun[] = [];
  let totalPages = 1;
  let loadError: string | null = null;
  try {
    const res = await serverApi<PaginatedResponse<PipelineRun>>(
      `/api/pipelines?page=${page}&limit=50`,
    );
    pipelines = res.items;
    totalPages = res.totalPages;
  } catch (err) {
    loadError = parseApiError(err instanceof Error ? err.message : String(err));
  }

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
      ) : pipelines.length === 0 ? (
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
          <PipelinesLiveTable initialPipelines={pipelines} />
          <Pagination page={page} totalPages={totalPages} basePath="/pipelines" />
        </>
      )}
    </div>
  );
}
