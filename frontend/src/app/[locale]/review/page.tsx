import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ReviewVideoCard } from '@/components/ReviewVideoCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { ButtonLink } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';
import { type PaginatedResponse, type Video } from '@/lib/api';
import { serverApi } from '@/lib/api-server';
import { parseApiError } from '@/lib/user-messages';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'review' });
  return { title: t('title') };
}

export default async function ReviewPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? '1', 10) || 1);
  const t = await getTranslations({ locale, namespace: 'review' });
  const tc = await getTranslations({ locale, namespace: 'common' });

  let videos: Video[] = [];
  let total = 0;
  let totalPages = 1;
  let loadError: string | null = null;
  try {
    const res = await serverApi<PaginatedResponse<Video>>(
      `/api/videos?reviewStatus=pending&page=${page}&limit=20`,
    );
    videos = res.items;
    total = res.total;
    totalPages = res.totalPages;
  } catch (err) {
    loadError = parseApiError(err instanceof Error ? err.message : String(err));
  }

  const subtitle =
    !loadError && total > 0
      ? t('subtitleWithCount', { count: total })
      : t('subtitle');

  return (
    <div className="page-content">
      <PageHeader
        title={t('title')}
        subtitle={subtitle}
        actions={
          total > 0 ? (
            <ButtonLink href="/channels" variant="secondary" size="sm">
              {tc('generateVideo')}
            </ButtonLink>
          ) : undefined
        }
      />

      {loadError ? (
        <EmptyState
          variant="error"
          title={t('loadError')}
          description={loadError}
          action={
            <ButtonLink href="/review" variant="primary">
              {tc('retry')}
            </ButtonLink>
          }
        />
      ) : total > 0 && videos.length === 0 ? (
        <>
          <EmptyState
            variant="review"
            title={t('emptyTitle')}
            description={t('subtitleWithCount', { count: total })}
            action={
              <ButtonLink href="/review" variant="primary">
                {tc('retry')}
              </ButtonLink>
            }
          />
          <Pagination page={Math.min(page, totalPages)} totalPages={totalPages} basePath="/review" />
        </>
      ) : videos.length === 0 ? (
        <EmptyState
          variant="review"
          title={t('emptyTitle')}
          description={t('emptyDesc')}
          action={
            <ButtonLink href="/channels" variant="primary">
              {tc('generateVideo')}
            </ButtonLink>
          }
        />
      ) : (
        <>
          <div className="review-queue">
            {videos.map((v) => (
              <ReviewVideoCard key={v.id} video={v} />
            ))}
          </div>
          {totalPages > 1 && (
            <Pagination page={page} totalPages={totalPages} basePath="/review" />
          )}
        </>
      )}
    </div>
  );
}
