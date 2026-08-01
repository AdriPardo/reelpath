import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getLocale, getTranslations } from 'next-intl/server';
import { ChannelDetailTabs } from '@/components/ChannelDetailTabs';
import { SkeletonPanel } from '@/components/ui/Skeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { ButtonLink } from '@/components/ui/Button';
import { type ChannelDetail, type ChannelIntegrationsResponse } from '@/lib/api';
import { serverApi } from '@/lib/api-server';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const locale = await getLocale();
  const tc = await getTranslations({ locale, namespace: 'common' });
  try {
    const ch = await serverApi<ChannelDetail>(`/api/channels/${id}`);
    return { title: ch.name };
  } catch {
    return { title: tc('channel') };
  }
}

export default async function ChannelDetailPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: 'channelDetail' });
  let channel: ChannelDetail | null = null;
  let integrations: ChannelIntegrationsResponse | null = null;

  try {
    [channel, integrations] = await Promise.all([
      serverApi<ChannelDetail>(`/api/channels/${id}`),
      serverApi<ChannelIntegrationsResponse>(`/api/channels/${id}/integrations`),
    ]);
  } catch {
    // offline
  }

  if (!channel || !integrations) notFound();

  return (
    <div className="page-content">
      <PageHeader
        title={channel.name}
        subtitle={t('nicheSubtitle', { niche: channel.niche })}
        actions={
          <ButtonLink href="/channels" variant="ghost">
            {t('backToChannels')}
          </ButtonLink>
        }
      />

      <Suspense fallback={<SkeletonPanel lines={5} />}>
        <ChannelDetailTabs channel={channel} integrations={integrations} />
      </Suspense>
    </div>
  );
}
