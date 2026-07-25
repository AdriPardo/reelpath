import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { PipelineDetailLive } from '@/components/PipelineDetailLive';
import { PageHeader } from '@/components/ui/PageHeader';
import { ButtonLink } from '@/components/ui/Button';
import { type PipelineRunDetail } from '@/lib/api';
import { serverApi } from '@/lib/api-server';

function pipelinePageTitle(pipeline: PipelineRunDetail): string {
  return (
    pipeline.metadata?.forcedTopic ??
    pipeline.videos?.[0]?.title ??
    pipeline.channel?.name ??
    ''
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}): Promise<Metadata> {
  const { id, locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pipelines' });
  try {
    const pipeline = await serverApi<PipelineRunDetail>(`/api/pipelines/${id}`);
    const title = pipelinePageTitle(pipeline);
    return { title: title || t('fallbackTitle') };
  } catch {
    return { title: t('generation') };
  }
}

export default async function PipelineDetailPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pipelines' });
  let pipeline: PipelineRunDetail | null = null;

  try {
    pipeline = await serverApi<PipelineRunDetail>(`/api/pipelines/${id}`);
  } catch {
    // offline or 404
  }

  if (!pipeline) notFound();

  const title = pipelinePageTitle(pipeline) || t('fallbackTitle');

  return (
    <>
      <PageHeader
        title={title}
        subtitle={pipeline.channel?.name ?? t('unknownChannel')}
        actions={
          <ButtonLink href="/pipelines" variant="ghost">
            {t('backToList')}
          </ButtonLink>
        }
      />

      <PipelineDetailLive initial={pipeline} />
    </>
  );
}
