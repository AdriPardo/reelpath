import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ReviewVideoCard } from '@/components/ReviewVideoCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { ButtonLink } from '@/components/ui/Button';
import { type Video } from '@/lib/api';
import { serverApi } from '@/lib/api-server';
import { parseApiError } from '@/lib/user-messages';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'review' });
  return { title: t('title') };
}

export default async function ReviewPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'review' });
  const tc = await getTranslations({ locale, namespace: 'common' });

  let videos: Video[] = [];
  let loadError: string | null = null;
  try {
    videos = await serverApi<Video[]>('/api/videos?reviewStatus=pending');
  } catch (err) {
    loadError = parseApiError(err instanceof Error ? err.message : String(err));
  }

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      {loadError ? (
        <EmptyState
          icon="⚠️"
          title={t('loadError')}
          description={loadError}
          action={
            <ButtonLink href="/review" variant="primary">
              {tc('retry')}
            </ButtonLink>
          }
        />
      ) : videos.length === 0 ? (
        <EmptyState icon="✅" title={t('emptyTitle')} description={t('emptyDesc')} />
      ) : (
        <div className="review-queue">
          {videos.map((v) => (
            <ReviewVideoCard key={v.id} video={v} />
          ))}
        </div>
      )}
    </>
  );
}
