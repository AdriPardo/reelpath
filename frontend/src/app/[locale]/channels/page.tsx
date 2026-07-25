import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ChannelCard } from '@/components/ChannelCard';
import { CreateChannelForm } from '@/components/CreateChannelForm';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { type Channel, type PipelineRun, type Video } from '@/lib/api';
import { serverApi } from '@/lib/api-server';
import { buildChannelStatsMap } from '@/lib/channel-stats';
import { parseApiError } from '@/lib/user-messages';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'channels' });
  return { title: t('title') };
}

export default async function ChannelsPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'channels' });
  const tc = await getTranslations({ locale, namespace: 'common' });

  let channels: Channel[] = [];
  let pipelines: PipelineRun[] = [];
  let pendingVideos: Video[] = [];
  let loadError: string | null = null;

  try {
    const results = await Promise.allSettled([
      serverApi<Channel[]>('/api/channels'),
      serverApi<PipelineRun[]>('/api/pipelines'),
      serverApi<Video[]>('/api/videos?reviewStatus=pending'),
    ]);

    if (results[0].status === 'fulfilled') channels = results[0].value;
    else loadError = parseApiError(String(results[0].reason));

    if (results[1].status === 'fulfilled') pipelines = results[1].value;
    if (results[2].status === 'fulfilled') pendingVideos = results[2].value;
  } catch (err) {
    loadError = parseApiError(err instanceof Error ? err.message : String(err));
  }

  const statsByChannel = buildChannelStatsMap(channels, pipelines, pendingVideos);

  return (
    <div className="page-content">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          channels.length > 0 ? (
            <ButtonLink href="#nuevo-canal" variant="secondary" size="sm">
              {t('addChannel')}
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
            <ButtonLink href="/channels" variant="primary">
              {tc('retry')}
            </ButtonLink>
          }
        />
      ) : channels.length === 0 ? (
        <section className="channels-empty-hero" aria-labelledby="channels-empty-title">
          <h2 id="channels-empty-title">{t('emptyTitle')}</h2>
          <p className="channels-empty-desc">{t('emptyDesc')}</p>
          <div className="card-elevated create-channel-panel page-narrow-sm">
            <CreateChannelForm mode="first" />
          </div>
        </section>
      ) : (
        <>
          <p className="channels-intro text-muted">{t('intro')}</p>
          <div className="channels-grid">
            {channels.map((ch) => (
              <ChannelCard key={ch.id} channel={ch} stats={statsByChannel[ch.id]} />
            ))}

            <div id="nuevo-canal" className="card create-channel-card">
              <CreateChannelForm mode="add" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
